from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from loguru import logger
from database.db import get_connection
from api.auth import require_roles

router = APIRouter(prefix="/api/logs", tags=["Logs"])
_AUTHORIZED = Depends(require_roles(["vendor", "admin"]))

class CallLogOut(BaseModel):
    id: int
    call_sid: str
    caller_phone: str
    direction: str
    status: str
    duration_seconds: int
    transcript: Optional[str] = None
    created_at: str

def _parse_json(val):
    import json
    if not val: return []
    try:
        return json.loads(val)
    except:
        return []

@router.get("", summary="List call logs (paginated)")
def list_call_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status")
):
    """Returns a list of recent calls, including potential escalations."""
    offset = (page - 1) * page_size
    params = []
    where = ""
    
    if status_filter:
        where = "WHERE status = %s"
        params.append(status_filter)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) as cnt FROM call_logs {where}", params)
            total = cur.fetchone()["cnt"]

            cur.execute(
                f"""
                SELECT id, call_sid, caller_phone, direction, status, 
                       duration_seconds, transcript, created_at,
                       priority, assignee, internal_notes, transcript_summary, ai_decision
                FROM call_logs
                {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [page_size, offset]
            )
            rows = cur.fetchall()
            
            # Formatting rows
            formatted = []
            for r in rows:
                formatted.append({
                    "id": r["id"],
                    "call_sid": r["call_sid"],
                    "caller_phone": r["caller_phone"],
                    "direction": r["direction"],
                    "status": r["status"],
                    "duration": f"{r['duration_seconds'] // 60}m {r['duration_seconds'] % 60}s",
                    "date": str(r["created_at"]),
                    "transcript": r.get("transcript", ""),
                    "priority": r.get("priority", "Low"),
                    "assignee": r.get("assignee"),
                    "notes": _parse_json(r.get("internal_notes")),
                    "transcriptSummary": r.get("transcript_summary"),
                    "aiDecision": r.get("ai_decision")
                })

        return {
            "total": total,
            "page": page,
            "logs": formatted
        }
    except Exception as exc:
        logger.warning(f"Could not fetch call logs: {exc}")
        # Return empty list instead of 500 if table missing
        return {"total": 0, "page": page, "logs": [], "note": "Table might not exist yet"}
    finally:
        conn.close()
