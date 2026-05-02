from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from database.db import get_connection
from api.auth import require_roles
from loguru import logger

router = APIRouter(prefix="/api/admin/config", tags=["Admin Config"])
_AUTHORIZED = Depends(require_roles(["admin"]))

class ConfigUpdate(BaseModel):
    value: str

@router.get("", summary="Get all system configurations")
def get_all_config(auth=_AUTHORIZED):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT key, value, updated_at FROM system_config")
            rows = cur.fetchall()
            return rows
    except Exception as e:
        logger.error(f"Error fetching config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/{key}", summary="Get specific config")
def get_config(key: str, auth=_AUTHORIZED):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM system_config WHERE key = %s", (key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Config not found")
            return row
    except Exception as e:
        logger.error(f"Error fetching config {key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/{key}", summary="Update specific config")
def update_config(key: str, data: ConfigUpdate, auth=_AUTHORIZED):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO system_config (key, value, updated_at) VALUES (%s, %s, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
                (key, data.value)
            )
            conn.commit()
            return {"status": "success", "message": f"Config {key} updated"}
    except Exception as e:
        logger.error(f"Error updating config {key}: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
