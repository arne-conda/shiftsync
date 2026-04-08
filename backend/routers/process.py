import io
import csv
import re
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from thefuzz import fuzz, process as fuzz_process
from db import get_db

router = APIRouter(prefix="/process", tags=["Processing"])

EXCLUDED_SALARY_TYPES = {"6811", "2078", "2071"}
SIGMA_PREFIX = "∑ "


def normalize_name(name: str) -> str:
    if not name or not isinstance(name, str):
        return ""
    return re.sub(r'\s+', ' ', name.lower().strip())


# --- Pydantic models ---

class SalaryTypeSummary(BaseModel):
    salary_type: str
    total_hours: float


class WorkerSummary(BaseModel):
    full_name: str
    lonnstakernr: Optional[str] = None
    salary_type_summary: list[SalaryTypeSummary]


class AggregatedResponse(BaseModel):
    data: list[WorkerSummary]
    unmapped_names: list[str]
    message: str


class PreviewItem(BaseModel):
    lonnstakernr: str
    employee_name: str
    quinyx_code: str
    loennsart: str
    hours: float
    rate: Optional[float] = None
    amount: Optional[float] = None
    comment: Optional[str] = None


class PreviewResponse(BaseModel):
    items: list[PreviewItem]
    total_hours: float
    total_amount: float
    missing_employee_mappings: int
    missing_salary_type_mappings: int
    message: str


def parse_quinyx_excel(contents: bytes) -> pd.DataFrame:
    """Parse Quinyx Excel file. Header is on row 2 (index 1)."""
    df = pd.read_excel(io.BytesIO(contents), header=1)
    df.dropna(how="all", inplace=True)

    # Forward-fill Full name (merged cells in Quinyx export)
    if "Full name" in df.columns:
        df["Full name"] = df["Full name"].ffill()

    return df


def extract_sigma_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Extract summary rows (Salary type starts with ∑)."""
    if "Salary type" not in df.columns:
        raise HTTPException(status_code=400, detail="Column 'Salary type' not found in file.")

    df["Salary type"] = df["Salary type"].fillna("").astype(str).str.strip()

    sigma_rows = df[df["Salary type"].str.startswith(SIGMA_PREFIX)].copy()
    if sigma_rows.empty:
        # Fallback: try without space
        sigma_rows = df[df["Salary type"].str.startswith("∑")].copy()
    if sigma_rows.empty:
        raise HTTPException(
            status_code=400,
            detail="No summary rows (∑) found. Check that this is a Quinyx salary export."
        )
    return sigma_rows


def load_employer_map() -> dict[str, str]:
    """Load {normalized_name: lonnstakernr} from Supabase."""
    db = get_db()
    result = db.table("employer_mappings").select("normalized_name, lonnstakernr").execute()
    return {r["normalized_name"]: r["lonnstakernr"] for r in result.data}


def load_salary_type_map(employee_type: str) -> dict[str, list[dict]]:
    """Load {source_code: [mapping, ...]} from Supabase."""
    db = get_db()
    result = db.table("salary_type_mappings") \
        .select("source_code, target_loennsart, rate, comment") \
        .eq("employee_type", employee_type) \
        .execute()

    mapping: dict[str, list[dict]] = {}
    for r in result.data:
        code = r["source_code"]
        mapping.setdefault(code, []).append(r)
    return mapping


# --- Endpoints ---

@router.post("/aggregate", response_model=AggregatedResponse)
async def aggregate_quinyx(
    file: UploadFile = File(...),
    employee_type: str = Query(..., description="'driver' or 'warehouse'")
):
    """Step 1 of processing: parse Quinyx file, aggregate hours, match employees."""
    if employee_type not in ("driver", "warehouse"):
        raise HTTPException(status_code=400, detail="employee_type must be 'driver' or 'warehouse'")

    contents = await file.read()

    try:
        df = parse_quinyx_excel(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse Excel file: {e}")

    required = ["Full name", "Salary type", "Amount"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

    sigma_rows = extract_sigma_rows(df)

    # Aggregate hours per name + salary_type
    records = []
    for _, row in sigma_rows.iterrows():
        raw_type = str(row["Salary type"])
        salary_type = raw_type.replace(SIGMA_PREFIX, "", 1).strip()
        if not salary_type.isdigit():
            salary_type = "".join(filter(str.isdigit, salary_type))
        if not salary_type:
            continue
        if salary_type in EXCLUDED_SALARY_TYPES:
            continue

        try:
            hours = float(str(row["Amount"]).replace(",", "."))
        except (ValueError, TypeError):
            continue

        records.append({
            "name": str(row["Full name"]),
            "salary_type": salary_type,
            "hours": hours,
        })

    if not records:
        raise HTTPException(status_code=400, detail="No valid sigma rows could be processed.")

    # Group by name + salary_type
    agg: dict[str, dict[str, float]] = {}
    for r in records:
        name = r["name"]
        st = r["salary_type"]
        agg.setdefault(name, {})
        agg[name][st] = agg[name].get(st, 0.0) + r["hours"]

    # Match names to lønnstakernr
    employer_map = load_employer_map()
    map_keys = list(employer_map.keys())

    result = []
    unmapped = []

    for name, type_hours in agg.items():
        normalized = normalize_name(name)
        lonnstakernr = employer_map.get(normalized)

        # Fuzzy fallback if exact match fails
        if not lonnstakernr and map_keys:
            match = fuzz_process.extractOne(
                normalized, map_keys,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=88
            )
            if match:
                lonnstakernr = employer_map[match[0]]

        if not lonnstakernr:
            unmapped.append(name)

        result.append(WorkerSummary(
            full_name=name,
            lonnstakernr=lonnstakernr,
            salary_type_summary=[
                SalaryTypeSummary(salary_type=st, total_hours=h)
                for st, h in type_hours.items()
            ]
        ))

    return AggregatedResponse(
        data=result,
        unmapped_names=unmapped,
        message=f"Processed {len(result)} employees. {len(unmapped)} unmapped."
    )


@router.post("/preview", response_model=PreviewResponse)
async def preview_salary(
    file: UploadFile = File(...),
    employee_type: str = Query(..., description="'driver' or 'warehouse'")
):
    """Aggregate + apply salary type mappings to produce preview."""
    # Reuse aggregate logic
    aggregated = await aggregate_quinyx(file=file, employee_type=employee_type)

    salary_map = load_salary_type_map(employee_type)

    items = []
    total_hours = 0.0
    total_amount = 0.0
    missing_emp = 0
    missing_sal = 0

    for worker in aggregated.data:
        if not worker.lonnstakernr:
            missing_emp += 1
            continue

        for st in worker.salary_type_summary:
            mappings = salary_map.get(st.salary_type)
            if not mappings:
                missing_sal += 1
                continue

            for m in mappings:
                rate = None
                amount = None
                try:
                    if m.get("rate"):
                        rate = float(m["rate"])
                        amount = st.total_hours * rate
                except (ValueError, TypeError):
                    pass

                items.append(PreviewItem(
                    lonnstakernr=worker.lonnstakernr,
                    employee_name=worker.full_name,
                    quinyx_code=st.salary_type,
                    loennsart=m["target_loennsart"],
                    hours=st.total_hours,
                    rate=rate,
                    amount=amount,
                    comment=m.get("comment"),
                ))
                total_hours += st.total_hours
                if amount:
                    total_amount += amount

    return PreviewResponse(
        items=items,
        total_hours=round(total_hours, 2),
        total_amount=round(total_amount, 2),
        missing_employee_mappings=missing_emp,
        missing_salary_type_mappings=missing_sal,
        message="Preview generated." if not (missing_emp or missing_sal)
                else f"Preview generated with {missing_emp} unmapped employees and {missing_sal} unmapped salary types."
    )


@router.post("/download-csv")
async def download_csv(
    file: UploadFile = File(...),
    employee_type: str = Query(...),
    fradato: str = Query(..., description="DD/MM/YYYY"),
    tildato: str = Query(..., description="DD/MM/YYYY"),
):
    """Generate and download the Tripletex import CSV."""
    preview = await preview_salary(file=file, employee_type=employee_type)

    # Aggregate by (lonnstakernr, loennsart) - sum hours, keep rate/comment
    agg: dict[tuple, dict] = {}
    for item in preview.items:
        key = (item.lonnstakernr, item.loennsart)
        if key not in agg:
            agg[key] = {
                "lonnstakernr": item.lonnstakernr,
                "loennsart": item.loennsart,
                "hours": 0.0,
                "rate": item.rate or 0.0,
                "comment": item.comment or "",
                "fradato": fradato,
                "tildato": tildato,
            }
        agg[key]["hours"] += item.hours

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["Lønnstakernr", "Lønnsart", "Antall", "Sats", "Fradato", "Tildato", "Kommentar"])

    for row in agg.values():
        writer.writerow([
            row["lonnstakernr"],
            row["loennsart"],
            f"{row['hours']:.2f}".replace(".", ","),
            f"{row['rate']:.2f}".replace(".", ","),
            row["fradato"],
            row["tildato"],
            row["comment"],
        ])

    csv_content = output.getvalue()

    # Save to run_log
    employee_count = len({item.lonnstakernr for item in preview.items})
    row_count = len(agg)
    db = get_db()
    db.table("run_log").insert({
        "employee_type": employee_type,
        "fradato": fradato,
        "tildato": tildato,
        "employee_count": employee_count,
        "row_count": row_count,
        "csv_content": csv_content,
    }).execute()

    return StreamingResponse(
        iter([csv_content.encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=importlonn_tripletex.csv"}
    )


@router.post("/save-run")
async def save_run(
    request: Request,
    employee_type: str = Query(...),
    fradato: str = Query(...),
    tildato: str = Query(...),
    employee_count: int = Query(...),
    row_count: int = Query(...),
):
    """Save a run to run_log and return the saved row id."""
    csv_content = (await request.body()).decode("utf-8")
    db = get_db()
    result = db.table("run_log").insert({
        "employee_type": employee_type,
        "fradato": fradato,
        "tildato": tildato,
        "employee_count": employee_count,
        "row_count": row_count,
        "csv_content": csv_content,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save run log.")
    return {"id": result.data[0]["id"]}


@router.get("/run-log")
def get_run_log():
    """Return all run_log rows ordered by created_at desc (without csv_content)."""
    db = get_db()
    result = db.table("run_log") \
        .select("id, created_at, employee_type, fradato, tildato, employee_count, row_count") \
        .order("created_at", desc=True) \
        .execute()
    return result.data


@router.get("/run-log/{run_id}/download")
def download_run_log(run_id: str):
    """Download the CSV for a specific run_log entry."""
    db = get_db()
    result = db.table("run_log").select("csv_content").eq("id", run_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Run not found.")
    csv_content = result.data["csv_content"]
    return StreamingResponse(
        iter([csv_content.encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=run_{run_id}.csv"}
    )


@router.post("/manual-mapping")
def save_manual_mapping(name: str, lonnstakernr: str):
    """Save a single manual employee mapping."""
    normalized = normalize_name(name)
    db = get_db()
    db.table("employer_mappings").upsert(
        {"normalized_name": normalized, "lonnstakernr": lonnstakernr},
        on_conflict="normalized_name"
    ).execute()
    return {"message": f"Mapping saved: {normalized} -> {lonnstakernr}"}
