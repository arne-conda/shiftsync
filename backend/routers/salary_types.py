import io
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter(prefix="/salary-types", tags=["Salary Type Mappings"])

VALID_TYPES = ("driver", "warehouse")


class SalaryTypeMapping(BaseModel):
    source_code: str
    target_loennsart: str
    rate: Optional[str] = None
    comment: Optional[str] = None


class SalaryTypeMappingWithId(SalaryTypeMapping):
    id: int


class SaveMappingsRequest(BaseModel):
    employee_type: str
    mappings: list[SalaryTypeMapping]


class MappingsResponse(BaseModel):
    employee_type: str
    mappings: list[SalaryTypeMappingWithId]


@router.get("/{employee_type}", response_model=MappingsResponse)
def get_salary_type_mappings(employee_type: str):
    if employee_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="employee_type must be 'driver' or 'warehouse'")

    db = get_db()
    result = db.table("salary_type_mappings") \
        .select("id, source_code, target_loennsart, rate, comment") \
        .eq("employee_type", employee_type) \
        .order("source_code") \
        .execute()

    return MappingsResponse(
        employee_type=employee_type,
        mappings=[SalaryTypeMappingWithId(**r) for r in result.data]
    )


@router.put("/{employee_type}", response_model=MappingsResponse)
def save_salary_type_mappings(employee_type: str, request: SaveMappingsRequest):
    if employee_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="employee_type must be 'driver' or 'warehouse'")

    db = get_db()

    # Delete existing and insert fresh
    db.table("salary_type_mappings").delete().eq("employee_type", employee_type).execute()

    if request.mappings:
        rows = [
            {
                "employee_type": employee_type,
                "source_code": m.source_code,
                "target_loennsart": m.target_loennsart,
                "rate": m.rate,
                "comment": m.comment,
            }
            for m in request.mappings
        ]
        db.table("salary_type_mappings").insert(rows).execute()

    return get_salary_type_mappings(employee_type)
