from datetime import datetime, timezone, timedelta
from database.db import get_connection
from database.slots import AVAILABLE_SLOTS, SUNDAY_SLOTS

# Indian Standard Time = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))


def get_ist_now() -> datetime:
    """Return current datetime in IST."""
    return datetime.now(IST)


async def get_free_slots(date: str, doctor: str | None = None) -> list[str]:
    """
    Returns free appointment slots for the given date (YYYY-MM-DD).

    Args:
        date:   Date in YYYY-MM-DD format.
        doctor: Optional doctor name to filter by (e.g. "Dr. Anjali Rao").
                Each doctor has independent slot availability.
                If None, returns slots free across all doctors.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if doctor:
                cur.execute(
                    "SELECT appointment_time FROM appointments WHERE appointment_date = %s AND doctor = %s",
                    (date, doctor)
                )
            else:
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

    # Use Sunday shorter schedule if applicable
    day_of_week = datetime.strptime(date, "%Y-%m-%d").weekday()  # Monday=0, Sunday=6
    slot_grid = SUNDAY_SLOTS if day_of_week == 6 else AVAILABLE_SLOTS

    free_slots = []
    for slot in slot_grid:
        if slot in booked_slots:
            continue
        # If the requested date is today, skip past slots
        if date == today_str and slot <= current_time_str:
            continue
        free_slots.append(slot)

    return free_slots