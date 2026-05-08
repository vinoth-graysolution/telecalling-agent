import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from google.oauth2 import service_account
from googleapiclient.discovery import build
from loguru import logger

SCOPES = ["https://www.googleapis.com/auth/calendar"]
IST = ZoneInfo("Asia/Kolkata")


def _get_calendar_service():
    """Build and return the Google Calendar service using service account credentials."""
    credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "./google_credentials.json")
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    service = build("calendar", "v3", credentials=credentials)
    return service


def _build_event_body(name: str, phone: str, date: str, time: str, doctor: str = "Dr. Anjali Rao") -> dict:
    """
    Build the Google Calendar event body.

    Args:
        name:   Patient full name
        phone:  Patient phone number
        date:   Date in YYYY-MM-DD format
        time:   Time in HH:MM 24-hour format
        doctor: Assigned doctor full name
    """
    # Parse date and time into IST datetime
    dt_start = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M").replace(tzinfo=IST)
    dt_end = dt_start + timedelta(minutes=30)  # Default 30-minute slot

    return {
        "summary": f"[{doctor}] Dental Appt — {name}",
        "description": (
            f"Patient : {name}\n"
            f"Phone   : {phone}\n"
            f"Doctor  : {doctor}\n"
            f"Clinic  : Whitepoint Dental Studio, 100 Feet Rd, Indiranagar\n"
            f"Booked via Maya (AI Voice Assistant)"
        ),
        "start": {
            "dateTime": dt_start.isoformat(),
            "timeZone": "Asia/Kolkata",
        },
        "end": {
            "dateTime": dt_end.isoformat(),
            "timeZone": "Asia/Kolkata",
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 60},
                {"method": "popup", "minutes": 30},
            ],
        },
    }


def create_calendar_event(name: str, phone: str, date: str, time: str, doctor: str = "Dr. Anjali Rao") -> str | None:
    """
    Create a Google Calendar event for a new appointment.

    Returns the event ID (to store in the database) or None on failure.
    """
    try:
        service = _get_calendar_service()
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "vinoth17170@gmail.com")
        event_body = _build_event_body(name, phone, date, time, doctor=doctor)

        event = service.events().insert(calendarId=calendar_id, body=event_body).execute()
        event_id = event.get("id")
        logger.info(f"📅 Calendar event created: {event_id} | {name} with {doctor} on {date} at {time}")
        return event_id

    except Exception as e:
        logger.error(f"❌ Failed to create calendar event: {e}")
        return None


def delete_calendar_event(event_id: str) -> bool:
    """
    Delete a Google Calendar event by its event ID.

    Returns True on success, False on failure.
    """
    if not event_id:
        logger.warning("delete_calendar_event called with no event_id — skipping.")
        return False

    try:
        service = _get_calendar_service()
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "vinoth17170@gmail.com")

        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        logger.info(f"🗑️ Calendar event deleted: {event_id}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to delete calendar event {event_id}: {e}")
        return False


def update_calendar_event(
    event_id: str,
    name: str,
    phone: str,
    new_date: str,
    new_time: str,
    doctor: str = "Dr. Anjali Rao",
) -> bool:
    """
    Update an existing Google Calendar event to a new date/time.

    Returns True on success, False on failure.
    """
    if not event_id:
        logger.warning("update_calendar_event called with no event_id — skipping.")
        return False

    try:
        service = _get_calendar_service()
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "vinoth17170@gmail.com")
        event_body = _build_event_body(name, phone, new_date, new_time, doctor=doctor)

        service.events().update(
            calendarId=calendar_id,
            eventId=event_id,
            body=event_body,
        ).execute()
        logger.info(f"📅 Calendar event updated: {event_id} | {doctor} → {new_date} at {new_time}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to update calendar event {event_id}: {e}")
        return False
