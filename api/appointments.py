"""
Service 2 – Appointment Service
================================
GET  /api/appointments           – paginated list
GET  /api/appointments/{id}      – detail view
PATCH /api/appointments/{id}     – update status (e.g. "checked-in")

All endpoints are public (no JWT required) so that clinic staff can use the
dashboard without logging in.  Add `dependencies=[Depends(get_current_user)]`
to any route if you later want to restrict access.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from loguru import logger

from database.db import get_connection

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AppointmentOut(BaseModel):
    id: int
    name: str
    phone: str
    doctor: Optional[str] = None
    reason: Optional[str] = None
    patient_type: Optional[str] = None
    treatment_type: Optional[str] = None
    appointment_date: str
    appointment_time: str
    call_status: Optional[str] = None
    calendar_event_id: Optional[str] = None

    class Config:
        from_attributes = True


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        description="New appointment status (e.g. 'checked-in', 'cancelled', 'completed')",
        examples=["checked-in"],
    )


# ---------------------------------------------------------------------------
# Helper – serialize a raw RealDictRow to a plain dict safe for JSON
# ---------------------------------------------------------------------------

def _serialize_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "doctor": row.get("doctor"),
        "reason": row.get("reason"),
        "patient_type": row.get("patient_type"),
        "treatment_type": row.get("treatment_type"),
        "appointment_date": str(row["appointment_date"]),
        "appointment_time": str(row["appointment_time"])[:5],  # HH:MM only
        "call_status": row.get("call_status"),
        "calendar_event_id": row.get("calendar_event_id"),
        "whatsapp_status": row.get("whatsapp_status", "not_sent"),
        "whatsapp_message_sid": row.get("whatsapp_message_sid"),
    }


# ---------------------------------------------------------------------------
# GET /api/appointments  – paginated list
# ---------------------------------------------------------------------------

@router.get(
    "",
    summary="List appointments (paginated)",
)
def list_appointments(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
):
    """
    Returns a paginated list of appointments ordered by date and time.

    Optional query parameters:
    - **date**: filter to a specific appointment date (YYYY-MM-DD)
    - **status**: filter by appointment status (e.g. `checked-in`, `cancelled`)
    - **page** / **page_size**: pagination controls
    """
    offset = (page - 1) * page_size

    # Build dynamic WHERE clause
    filters = []
    params: list = []

    if date:
        filters.append("appointment_date = %s")
        params.append(date)
    if status_filter:
        filters.append("call_status = %s")
        params.append(status_filter)

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Total count for pagination metadata
            cur.execute(f"SELECT COUNT(*) AS cnt FROM appointments {where}", params)
            total = cur.fetchone()["cnt"]

            # Paginated rows
            cur.execute(
                f"""
<<<<<<< HEAD
                SELECT id, name, phone, treatment_type,
                       appointment_date, appointment_time,
                       call_status, calendar_event_id,
                       whatsapp_status, whatsapp_message_sid
=======
                SELECT id, name, phone, doctor, reason, patient_type,
                       treatment_type, appointment_date, appointment_time,
                       call_status, calendar_event_id
>>>>>>> main
                FROM appointments
                {where}
                ORDER BY appointment_date ASC, appointment_time ASC
                LIMIT %s OFFSET %s
                """,
                params + [page_size, offset],
            )
            rows = [_serialize_row(r) for r in cur.fetchall()]

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, -(-total // page_size)),  # ceiling division
            "appointments": rows,
        }

    except Exception as exc:
        logger.error(f"list_appointments error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# GET /api/appointments/{id}  – detail view
# ---------------------------------------------------------------------------

@router.get(
    "/{appointment_id}",
    summary="Get a single appointment by ID",
)
def get_appointment(appointment_id: int):
    """Returns full details for a single appointment."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
<<<<<<< HEAD
                SELECT id, name, phone, treatment_type,
                       appointment_date, appointment_time,
                       call_status, calendar_event_id,
                       whatsapp_status, whatsapp_message_sid
=======
                SELECT id, name, phone, doctor, reason, patient_type,
                       treatment_type, appointment_date, appointment_time,
                       call_status, calendar_event_id
>>>>>>> main
                FROM appointments
                WHERE id = %s
                """,
                (appointment_id,),
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment {appointment_id} not found.",
            )

        return _serialize_row(row)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"get_appointment error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# PATCH /api/appointments/{id}  – update status
# ---------------------------------------------------------------------------

@router.patch(
    "/{appointment_id}",
    summary="Update appointment status",
)
def update_appointment_status(
    appointment_id: int,
    body: AppointmentStatusUpdate,
):
    """
    Updates the `status` field of an appointment.

    Common status values:
    - `checked-in` – patient has arrived
    - `completed`  – consultation finished
    - `cancelled`  – appointment cancelled
    - `no-show`    – patient did not arrive
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Confirm the appointment exists first
            cur.execute("SELECT id FROM appointments WHERE id = %s", (appointment_id,))
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Appointment {appointment_id} not found.",
                )

            cur.execute(
                "UPDATE appointments SET call_status = %s WHERE id = %s",
                (body.status, appointment_id),
            )
            conn.commit()

        logger.info(f"Appointment {appointment_id} status → '{body.status}'")
        return {
            "id": appointment_id,
            "status": body.status,
            "message": "Status updated successfully.",
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"update_appointment_status error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    finally:
        conn.close()
