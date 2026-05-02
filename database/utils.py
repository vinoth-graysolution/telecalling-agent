from datetime import datetime, timezone, timedelta
from database.db import get_connection
from database.slots import AVAILABLE_SLOTS

# Indian Standard Time = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))


def get_ist_now() -> datetime:
    """Return current datetime in IST."""
    return datetime.now(IST)


async def get_free_slots(date: str) -> list[str]:
    """
    Returns free appointment slots for the given date (YYYY-MM-DD).
    For today's date, past time slots are excluded based on IST current time.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT appointment_time FROM appointments WHERE appointment_date = %s",
                (date,)
            )
            rows = cur.fetchall()
            booked_slots = [str(row["appointment_time"])[:5] for row in rows]
    finally:
        conn.close()

    now_ist = get_ist_now()
    today_str = now_ist.strftime("%Y-%m-%d")
    current_time_str = now_ist.strftime("%H:%M")

    free_slots = []
    for slot in AVAILABLE_SLOTS:
        if slot in booked_slots:
            continue
        # If the requested date is today, skip slots that are in the past
        if date == today_str and slot <= current_time_str:
            continue
        free_slots.append(slot)

    return free_slots


def get_system_config(key: str, default: str = None) -> str:
    """Fetch a configuration value from the system_config table."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM system_config WHERE key = %s", (key,))
            row = cur.fetchone()
            return row["value"] if row else default
    except Exception:
        return default
    finally:
        conn.close()