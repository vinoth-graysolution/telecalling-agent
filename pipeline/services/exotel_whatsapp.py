import os
import requests
from loguru import logger
from dotenv import load_dotenv

load_dotenv()


def send_whatsapp_appointment_confirmation(
    to_phone: str,
    patient_name: str,
    appointment_date: str,
    appointment_time: str,
    doctor: str = "Dr. Anjali Rao",
) -> bool:
    """
    Send a WhatsApp appointment confirmation message via Exotel.

    Args:
        to_phone: Patient's phone number (e.g. "919876543210" or "+919876543210")
        patient_name: Full name of the patient
        appointment_date: Date string in YYYY-MM-DD format
        appointment_time: Time string in HH:MM format (24-hour)
        doctor: Assigned doctor's full name (default: "Dr. Anjali Rao")

    Returns:
        True if message was sent successfully, False otherwise.
    """
    api_key = os.getenv("EXOTEL_API_KEY")
    api_token = os.getenv("EXOTEL_API_TOKEN")
    account_sid = os.getenv("EXOTEL_ACCOUNT_SID")
    from_number = os.getenv("EXOTEL_WHATSAPP_NUMBER")   # your registered WhatsApp number
    subdomain = os.getenv("EXOTEL_SUBDOMAIN", "api.in.exotel.com")

    if not all([api_key, api_token, account_sid, from_number]):
        logger.error(
            "❌ WhatsApp send failed: missing one or more env vars "
            "(EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_ACCOUNT_SID, EXOTEL_WHATSAPP_NUMBER)"
        )
        return False

    # Normalise phone: strip leading '+' or '0', keep digits only
    digits = "".join(filter(str.isdigit, to_phone))
    if not digits.startswith("91"):
        digits = "91" + digits

    recipient = f"whatsapp:{digits}"
    sender   = f"whatsapp:{from_number}"

    # Format time to 12-hour for readability (e.g. "10:00" → "10:00 AM")
    try:
        from datetime import datetime
        time_obj = datetime.strptime(appointment_time[:5], "%H:%M")
        friendly_time = time_obj.strftime("%I:%M %p").lstrip("0")   # "10:00 AM"
    except Exception:
        friendly_time = appointment_time

    # Format date (e.g. "2026-04-10" → "April 10, 2026")
    try:
        date_obj = datetime.strptime(appointment_date, "%Y-%m-%d")
        friendly_date = date_obj.strftime("%B %d, %Y")              # "April 10, 2026"
    except Exception:
        friendly_date = appointment_date

    message_text = (
        f"Hi {patient_name}! 👋\n\n"
        f"✅ Your appointment at *Whitepoint Dental Studio* is confirmed.\n\n"
        f"👨‍⚕️ Doctor : {doctor}\n"
        f"📅 Date   : {friendly_date}\n"
        f"⏰ Time   : {friendly_time}\n\n"
        f"📍 *Location:* 100 Feet Road, Indiranagar, Bangalore\n"
        f"(Near Indiranagar Metro Station)\n"
        f"🗺️ Map: https://maps.app.goo.gl/WhitepointDentalIndiranagar\n\n"
        f"Please arrive 5 minutes early. Carry any past dental records if available.\n"
        f"To reschedule or cancel, call us back anytime.\n\n"
        f"— Whitepoint Dental Studio 🦷"
    )

    url = (
        f"https://{api_key}:{api_token}@{subdomain}"
        f"/v2/accounts/{account_sid}/messages"
    )

    payload = {
        "whatsapp": {
            "messages": [
                {
                    "from": sender,
                    "to": recipient,
                    "content": {
                        "type": "text",
                        "text": message_text,
                    }
                }
            ]
        }
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(
            f"✅ WhatsApp confirmation sent to {recipient} "
            f"(status={response.status_code})"
        )
        return True

    except requests.exceptions.HTTPError as e:
        logger.error(
            f"❌ WhatsApp HTTP error: {e} | body: {e.response.text if e.response is not None else 'N/A'}"
        )
    except Exception as e:
        logger.error(f"❌ WhatsApp send failed: {e}")

    return False
