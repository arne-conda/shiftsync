import io
import re
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter(prefix="/employer", tags=["Employer Mappings"])


def normalize_name(name: str) -> str:
    if not name or not isinstance(name, str):
        return ""
    return re.sub(r'\s+', ' ', name.lower().strip())


class UploadResponse(BaseModel):
    message: str
    mappings_count: int


class MappingItem(BaseModel):
    normalized_name: str
    lonnstakernr: str


class MappingsResponse(BaseModel):
    mappings: list[MappingItem]
    count: int


@router.post("/upload", response_model=UploadResponse)
async def upload_employer_file(file: UploadFile = File(...)):
    """
    Upload employer Excel/CSV file.
    Expected format (data from row 3):
      Col B (index 1): Lønnstakernr
      Col F (index 5): First name
      Col G (index 6): Last name
    """
    contents = await file.read()
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".csv"):
            try:
                text = contents.decode("utf-8")
            except UnicodeDecodeError:
                text = contents.decode("latin-1")
            df = pd.read_csv(io.StringIO(text), skiprows=2, header=0,
                             sep=None, engine="python", skipinitialspace=True)
        else:
            df = pd.read_excel(io.BytesIO(contents), skiprows=2, header=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    if df.shape[1] < 7:
        raise HTTPException(
            status_code=400,
            detail=f"File needs at least 7 columns (A-G). Found {df.shape[1]}."
        )

    mappings = []
    for _, row in df.iterrows():
        try:
            lonnstakernr = str(row.iloc[1]).strip()
            first_name = str(row.iloc[5]).strip()
            last_name = str(row.iloc[6]).strip()
        except Exception:
            continue

        if not lonnstakernr or lonnstakernr in ("nan", ""):
            continue
        if not first_name or first_name == "nan":
            continue
        if not last_name or last_name == "nan":
            continue

        full_name = f"{first_name} {last_name}"
        normalized = normalize_name(full_name)
        if normalized:
            mappings.append({
                "normalized_name": normalized,
                "lonnstakernr": lonnstakernr
            })

    if not mappings:
        raise HTTPException(status_code=400, detail="No valid mappings found in file.")

    db = get_db()
    # Upsert all mappings
    db.table("employer_mappings").upsert(
        mappings,
        on_conflict="normalized_name"
    ).execute()

    return UploadResponse(
        message="Employer mappings uploaded successfully.",
        mappings_count=len(mappings)
    )


@router.get("/mappings", response_model=MappingsResponse)
def get_mappings():
    db = get_db()
    result = db.table("employer_mappings").select("normalized_name, lonnstakernr").execute()
    items = [MappingItem(**r) for r in result.data]
    return MappingsResponse(mappings=items, count=len(items))


@router.delete("/mappings")
def clear_mappings():
    db = get_db()
    db.table("employer_mappings").delete().neq("id", 0).execute()
    return {"message": "All employer mappings cleared."}
