"""
Service 1 – Analytics & Stats
==============================
GET /api/dashboard/stats

Returns:
  - Appointment counts (total, today, upcoming, cancelled)
  - Call-log conversation metrics (total calls, avg duration, completed calls)

Requires JWT with role = "vendor" OR "admin".
"""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from database.db import get_connection
from api.auth import require_roles

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

_AUTHORIZED = Depends(require_roles(["vendor", "admin"]))


# ---------------------------------------------------------------------------
# Helper – appointment counts
# ---------------------------------------------------------------------------

def _fetch_appointment_stats(cur) -> dict:
    """Run aggregate queries against the appointments table."""

    # Total appointments ever
    cur.execute("SELECT COUNT(*) AS cnt FROM appointments")
    total = cur.fetchone()["cnt"]

    # Appointments scheduled for today (IST date passed in via SQL NOW()
    # – RDS stores in UTC, so we compare against CURRENT_DATE in the DB timezone.
    # Adjust to IST by adding the offset if needed.)
    cur.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM appointments
        WHERE appointment_date = CURRENT_DATE
        """
    )
    today = cur.fetchone()["cnt"]

    # Upcoming (future dates, excluding today)
    cur.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM appointments
        WHERE appointment_date > CURRENT_DATE
        """
    )
    upcoming = cur.fetchone()["cnt"]

    # Cancelled appointments (status column – safe fallback if column missing)
    try:
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM appointments WHERE call_status = 'cancelled'"
        )
        cancelled = cur.fetchone()["cnt"]
    except Exception:
        cancelled = 0

    return {
        "total": total,
        "today": today,
        "upcoming": upcoming,
        "cancelled": cancelled,
    }


# ---------------------------------------------------------------------------
# Helper – call_logs metrics (table may not exist yet → graceful fallback)
# ---------------------------------------------------------------------------

def _fetch_call_log_stats(cur) -> dict:
    """Query the call_logs table for conversation metrics.

    If the table does not exist the function returns zeros so the dashboard
    remains functional even before call logging is fully deployed.
    """
    try:
        cur.execute(
            """
            SELECT
                COUNT(*)                                        AS total_calls,
                COALESCE(AVG(duration_seconds), 0)::NUMERIC(10,2) AS avg_duration_seconds,
                COUNT(*) FILTER (WHERE status = 'completed')   AS completed_calls,
                COUNT(*) FILTER (WHERE status = 'failed')      AS failed_calls
            FROM call_logs
            """
        )
        row = cur.fetchone()
        return {
            "total_calls": row["total_calls"],
            "avg_duration_seconds": float(row["avg_duration_seconds"]),
            "completed_calls": row["completed_calls"],
            "failed_calls": row["failed_calls"],
        }
    except Exception as exc:
        logger.warning(f"call_logs table not available yet: {exc}")
        return {
            "total_calls": 0,
            "avg_duration_seconds": 0.0,
            "completed_calls": 0,
            "failed_calls": 0,
            "note": "call_logs table not yet provisioned",
        }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/stats",
    summary="Dashboard analytics & stats",
    dependencies=[_AUTHORIZED],
)
def get_dashboard_stats():
    """
    Returns aggregated appointment counts and call-log conversation metrics.

    **Requires** Bearer JWT with `role = vendor` or `role = admin`.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            appointment_stats = _fetch_appointment_stats(cur)
            call_log_stats = _fetch_call_log_stats(cur)
            
            # 1. Outcome Distribution
            cur.execute("""
                SELECT status, COUNT(*) as count 
                FROM call_logs 
                GROUP BY status
            """)
            outcomes = cur.fetchall()
            
            # 2. Peak Booking Hours (from appointments)
            cur.execute("""
                SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
                FROM appointments
                GROUP BY hour
                ORDER BY hour
            """)
            hours = cur.fetchall()
            
            # 3. Language Usage
            cur.execute("""
                SELECT language, COUNT(*) as count
                FROM call_logs
                GROUP BY language
            """)
            languages = cur.fetchall()

        return {
            "appointments": appointment_stats,
            "call_logs": call_log_stats,
            "analytics": {
                "outcomes": outcomes,
                "hours": hours,
                "languages": languages
            }
        }

    except Exception as exc:
        logger.error(f"Dashboard stats error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    finally:
        conn.close()


@router.get(
    "/live",
    summary="Live call monitoring feed",
    dependencies=[_AUTHORIZED],
)
def get_live_calls():
    """
    Returns calls currently in progress or recently completed.
    In a production system, this would fetch from a Redis state or WebSocket feed.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # For demo/mock replacement, we'll fetch calls from the last 10 minutes
            cur.execute(
                """
                SELECT id, caller_phone, status, direction, created_at
                FROM call_logs
                WHERE created_at > NOW() - INTERVAL '10 minutes'
                ORDER BY created_at DESC
                LIMIT 5
                """
            )
            rows = cur.fetchall()
            
            live_calls = []
            for r in rows:
                # Map real DB status to UI stages
                stage = "Conversation"
                if r["status"] == "failed": stage = "Escalation Required"
                if r["status"] == "completed": stage = "Call Ending"
                
                live_calls.append({
                    "id": r["id"],
                    "phone": r["caller_phone"],
                    "status": "In Progress" if r["status"] == "in_progress" else r["status"].capitalize(),
                    "duration": "Live",
                    "stage": stage
                })
                
        return live_calls
    except Exception as exc:
        logger.error(f"Live calls error: {exc}")
        return []
    finally:
        conn.close()
