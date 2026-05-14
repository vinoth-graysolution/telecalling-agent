from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from loguru import logger
from database.db import get_connection
from api.auth import require_roles

_AUTHORIZED = Depends(require_roles(["vendor", "admin"]))

router = APIRouter(
    prefix="/api/patients", 
    tags=["Patients"],
    dependencies=[_AUTHORIZED]
)



@router.get("", summary="List patients")
def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    offset = (page - 1) * page_size
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM patients")
            total = cur.fetchone()["cnt"]

            cur.execute(
                """
                SELECT id, name, phone, initials, last_visit, visits, status
                FROM patients
                ORDER BY name ASC
                LIMIT %s OFFSET %s
                """,
                (page_size, offset)
            )
            rows = cur.fetchall()
            
            formatted = []
            for r in rows:
                formatted.append({
                    "id": r["id"],
                    "name": r["name"],
                    "phone": r["phone"],
                    "initials": r["initials"],
                    "lastVisit": str(r["last_visit"].strftime("%d %b %Y")) if r["last_visit"] else "Never",
                    "visits": r["visits"],
                    "status": r["status"]
                })

        return {
            "total": total,
            "page": page,
            "patients": formatted
        }
    except Exception as exc:
        logger.error(f"Error fetching patients: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()

@router.get("/{phone}/history", summary="Get patient interaction history")
def get_patient_history(phone: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Get calls
            cur.execute(
                """
                SELECT id, created_at, duration_seconds, status, transcript_summary
                FROM call_logs
                WHERE caller_phone = %s
                ORDER BY created_at DESC
                """,
                (phone,)
            )
            calls = cur.fetchall()
            
            # Get appointments
            cur.execute(
                """
                SELECT id, appointment_date, appointment_time, treatment_type, call_status
                FROM appointments
                WHERE phone = %s
                ORDER BY appointment_date DESC, appointment_time DESC
                """,
                (phone,)
            )
            apts = cur.fetchall()
            
            history = []
            for c in calls:
                history.append({
                    "type": "call",
                    "date": str(c["created_at"].strftime("%d %b %Y")),
                    "time": str(c["created_at"].strftime("%I:%M %p")),
                    "treatment": "AI Conversation",
                    "doctor": "AI Agent",
                    "outcome": c["status"].capitalize(),
                    "notes": c["transcript_summary"] or "Call processed by AI.",
                    "ref": f"CALL-{c['id']}"
                })
            
            for a in apts:
                history.append({
                    "type": "appointment",
                    "date": str(a["appointment_date"].strftime("%d %b %Y")) if hasattr(a["appointment_date"], 'strftime') else str(a["appointment_date"]),
                    "time": str(a["appointment_time"]),
                    "treatment": a["treatment_type"] or "Consultation",
                    "doctor": "TBD",
                    "outcome": a["call_status"] or "Booked",
                    "notes": "Scheduled via platform.",
                    "ref": f"APT-{a['id']}"
                })
            
            # Sort combined history by date
            history.sort(key=lambda x: x["date"], reverse=True)

        return history
    except Exception as exc:
        logger.error(f"Error fetching history for {phone}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()
