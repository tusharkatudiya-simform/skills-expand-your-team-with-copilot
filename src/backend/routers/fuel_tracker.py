"""
Endpoints for the Fuel Tracker feature
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..database import fuel_entries_collection

router = APIRouter(
    prefix="/fuel-tracker",
    tags=["fuel-tracker"]
)


class FuelEntryCreate(BaseModel):
    amount: float       # Rupees spent on fuel
    odometer_km: float  # Odometer reading at time of refuel
    date: Optional[str] = None  # ISO date string, defaults to today


class FuelEntryResponse(BaseModel):
    id: str
    amount: float
    odometer_km: float
    date: str
    range_km: Optional[float] = None      # km driven since last fill-up
    cost_per_km: Optional[float] = None   # rupees per km
    total_km: Optional[float] = None      # total km since first entry


def _compute_entries(raw_entries: list) -> List[dict]:
    """Attach range_km, cost_per_km, and total_km to each entry (sorted by odometer)."""
    entries = sorted(raw_entries, key=lambda e: e["odometer_km"])

    first_odometer = entries[0]["odometer_km"] if entries else None

    result = []
    for i, entry in enumerate(entries):
        if i == 0:
            range_km = None
            cost_per_km = None
        else:
            prev_odometer = entries[i - 1]["odometer_km"]
            range_km = round(entry["odometer_km"] - prev_odometer, 2)
            cost_per_km = round(entry["amount"] / range_km, 2) if range_km > 0 else None

        total_km = round(entry["odometer_km"] - first_odometer, 2) if first_odometer is not None else 0.0

        result.append({
            "id": entry["id"],
            "amount": entry["amount"],
            "odometer_km": entry["odometer_km"],
            "date": entry["date"],
            "range_km": range_km,
            "cost_per_km": cost_per_km,
            "total_km": total_km,
        })

    return result


@router.get("/entries", response_model=List[FuelEntryResponse])
def get_fuel_entries():
    """Get all fuel entries with calculated range, cost per km, and total km."""
    raw = list(fuel_entries_collection.find({}))
    if not raw:
        return []
    # Convert ObjectId to string id
    for entry in raw:
        entry["id"] = str(entry.pop("_id"))
    return _compute_entries(raw)


@router.post("/entries", response_model=FuelEntryResponse, status_code=201)
def add_fuel_entry(entry: FuelEntryCreate):
    """Add a new fuel entry."""
    if entry.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if entry.odometer_km < 0:
        raise HTTPException(status_code=400, detail="Odometer reading cannot be negative")

    date_str = entry.date if entry.date else datetime.utcnow().strftime("%Y-%m-%d")

    doc = {
        "amount": entry.amount,
        "odometer_km": entry.odometer_km,
        "date": date_str,
    }
    result = fuel_entries_collection.insert_one(doc)
    new_id = str(result.inserted_id)

    # Re-fetch all entries and compute derived fields
    all_raw = list(fuel_entries_collection.find({}))
    for e in all_raw:
        e["id"] = str(e.pop("_id"))
    computed = _compute_entries(all_raw)
    new_entry = next(e for e in computed if e["id"] == new_id)
    return new_entry


@router.delete("/entries/{entry_id}", status_code=200)
def delete_fuel_entry(entry_id: str):
    """Delete a fuel entry by id."""
    from bson import ObjectId
    try:
        oid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry id")

    result = fuel_entries_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully"}
