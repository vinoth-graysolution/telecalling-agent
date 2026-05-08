"""
database/tools.py — Pipecat tool functions for Whitepoint Dental Studio GVA (Maya).

All functions follow the FunctionCallParams pattern required by Pipecat's
LLM tool-calling interface.

Doctor routing:
  Dr. Anjali Rao  → General Dentistry, Cleaning, Fillings, Cosmetic, Sensitivity
  Dr. Vikram Shetty → Root Canal, Severe Pain, Implants
"""

from pipecat.services.llm_service import FunctionCallParams
from datetime import timedelta
from database.utils import get_free_slots, get_ist_now
from database.db import get_connection
from database.calendar import create_calendar_event, delete_calendar_event, update_calendar_event
from pipeline.services.exotel_whatsapp import send_whatsapp_appointment_confirmation

from loguru import logger


# ── Doctor constants ──────────────────────────────────────────────────────────
DR_ANJALI   = "Dr. Anjali Rao"
DR_VIKRAM   = "Dr. Vikram Shetty"
VALID_DOCTORS = {DR_ANJALI, DR_VIKRAM}

DOCTOR_SPECIALTIES = {
    DR_ANJALI:  "General Dentistry, Cleaning, Fillings, Cosmetic Dentistry, Sensitivity",
    DR_VIKRAM:  "Root Canal Treatment, Implants, Severe Tooth Pain",
}


# ── check_slot ────────────────────────────────────────────────────────────────
async def check_slot(params: FunctionCallParams, date: str, time: str, doctor: str = DR_ANJALI):
    """Check if an appointment slot is available for a specific doctor on a given date and time.

    Args:
        date:   The appointment date in YYYY-MM-DD format (e.g. 2026-05-06).
        time:   The appointment time in HH:MM 24-hour format (e.g. 17:00 for 5 PM).
        doctor: The doctor's full name. Must be one of:
                - "Dr. Anjali Rao"   (General, Cleaning, Fillings, Cosmetic)
                - "Dr. Vikram Shetty" (Root Canal, Implants)
                Defaults to "Dr. Anjali Rao".
    """
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM appointments WHERE appointment_date = %s AND appointment_time = %s AND doctor = %s",
                    (date, time, doctor)
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        if len(rows) == 0:
            await params.result_callback({
                "available": True,
                "doctor": doctor,
                "date": date,
                "time": time,
            })
        else:
            free_slots = await get_free_slots(date, doctor=doctor)
            await params.result_callback({
                "available": False,
                "doctor": doctor,
                "suggested_slots": free_slots[:3],
            })

    except Exception as e:
        logger.error(f"check_slot error: {e}")
        await params.result_callback({"error": str(e)})


# ── book_slot ─────────────────────────────────────────────────────────────────
async def book_slot(
    params: FunctionCallParams,
    name: str,
    phone: str,
    date: str,
    time: str,
    doctor: str = DR_ANJALI,
    reason: str = "",
    patient_type: str = "NEW",
):
    """Book a confirmed appointment slot for a patient.
    Only call this AFTER the patient has explicitly confirmed the booking.

    Args:
        name:         Full name of the patient (e.g. "Rohan Mehta").
        phone:        Patient's phone number as a numeric string.
        date:         Appointment date in YYYY-MM-DD format (e.g. 2026-05-06).
        time:         Appointment time in HH:MM 24-hour format (e.g. 17:00).
        doctor:       Doctor's full name — "Dr. Anjali Rao" or "Dr. Vikram Shetty".
                      Defaults to "Dr. Anjali Rao".
        reason:       Brief reason/symptom the patient described (e.g. "Tooth sensitivity").
        patient_type: "NEW" for first-time visitors, "EXISTING" for returning patients.
    """
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                # Check if this slot is already taken for this doctor
                cur.execute(
                    "SELECT * FROM appointments WHERE appointment_date = %s AND appointment_time = %s AND doctor = %s",
                    (date, time, doctor)
                )
                if cur.fetchall():
                    free_slots = await get_free_slots(date, doctor=doctor)
                    await params.result_callback({
                        "status": "error",
                        "message": "Slot already booked for this doctor.",
                        "suggested_slots": free_slots[:3],
                    })
                    return

                # Insert appointment with doctor + reason + patient_type columns
                cur.execute(
                    """INSERT INTO appointments
                         (name, phone, appointment_date, appointment_time,
                          doctor, reason, patient_type)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)
                       RETURNING id""",
                    (name, phone, date, time, doctor, reason, patient_type)
                )
                new_id = cur.fetchone()["id"]
                conn.commit()
        finally:
            conn.close()

        logger.info(f"✅ Appointment booked: {name} with {doctor} on {date} at {time} (ID={new_id})")

        # Notify front desk (non-critical — receptionist dashboard)
        try:
            conn_fd = get_connection()
            with conn_fd.cursor() as cur_fd:
                cur_fd.execute(
                    """
                    INSERT INTO front_desk_notifications
                        (appointment_id, patient_name, appointment_date, appointment_time,
                         doctor, patient_type)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (new_id, name, date, time, doctor, patient_type)
                )
                conn_fd.commit()
            conn_fd.close()
            logger.info(f"🔔 Front desk notified: {patient_type} patient {name} with {doctor} on {date} at {time}")
        except Exception as fd_err:
            logger.warning(f"Front desk notification failed (non-critical): {fd_err}")

        # Sync to Google Calendar
        event_id = create_calendar_event(name, phone, date, time, doctor=doctor)
        if event_id:
            try:
                conn2 = get_connection()
                with conn2.cursor() as cur2:
                    cur2.execute(
                        "UPDATE appointments SET calendar_event_id = %s WHERE id = %s",
                        (event_id, new_id)
                    )
                    conn2.commit()
                conn2.close()
            except Exception as cal_err:
                logger.warning(f"Could not save calendar_event_id: {cal_err}")

        # Send WhatsApp confirmation
        try:
            send_whatsapp_appointment_confirmation(
                to_phone=phone,
                patient_name=name,
                appointment_date=date,
                appointment_time=time,
                doctor=doctor,
            )
        except Exception as wa_err:
            logger.warning(f"WhatsApp notification failed (non-critical): {wa_err}")

        await params.result_callback({
            "status": "success",
            "message": f"Appointment confirmed for {name} with {doctor} on {date} at {time}.",
            "appointment_id": new_id,
            "patient_type": patient_type,
            "whatsapp_sent": True,
            "front_desk_notified": True,
            "crm_updated": True,
        })

    except Exception as e:
        logger.error(f"book_slot error: {e}")
        await params.result_callback({"error": str(e)})


# ── next_available_slot ───────────────────────────────────────────────────────
async def next_available_slot(params: FunctionCallParams, doctor: str = DR_ANJALI):
    """Find the next 2 available appointment slots for a specific doctor within the next 7 days.
    Use this when the patient asks for the earliest available time or doesn't have a preferred date.

    Args:
        doctor: Doctor's full name — "Dr. Anjali Rao" or "Dr. Vikram Shetty".
                Defaults to "Dr. Anjali Rao".
    """
    try:
        today = get_ist_now()
        results = []

        for i in range(7):
            date = (today + timedelta(days=i)).strftime("%Y-%m-%d")
            free_slots = await get_free_slots(date, doctor=doctor)

            for slot in free_slots:
                results.append({"date": date, "time": slot})
                if len(results) >= 2:
                    break
            if len(results) >= 2:
                break

        if results:
            await params.result_callback({
                "doctor": doctor,
                "available_slots": results,
                # Convenience fields so LLM can say "tomorrow at 11:30 AM or 5 PM"
                "slot_1": results[0] if len(results) > 0 else None,
                "slot_2": results[1] if len(results) > 1 else None,
            })
        else:
            await params.result_callback({
                "doctor": doctor,
                "message": "No available slots in the next 7 days.",
            })

    except Exception as e:
        logger.error(f"next_available_slot error: {e}")
        await params.result_callback({"error": str(e)})


# ── cancel_slot ───────────────────────────────────────────────────────────────
async def cancel_slot(params: FunctionCallParams, phone: str):
    """Cancel an existing appointment for a patient using their phone number.
    Only call this AFTER the patient has explicitly confirmed they want to cancel.

    Args:
        phone: The patient's phone number used when the appointment was booked.
    """
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, doctor, appointment_date, appointment_time, calendar_event_id
                    FROM appointments
                    WHERE phone = %s
                      AND appointment_date >= CURRENT_DATE
                    ORDER BY appointment_date ASC, appointment_time ASC
                    LIMIT 1
                    """,
                    (phone,)
                )
                row = cur.fetchone()

                if not row:
                    await params.result_callback({
                        "status": "not_found",
                        "message": "No upcoming appointment found for this phone number.",
                    })
                    return

                cur.execute("DELETE FROM appointments WHERE id = %s", (row["id"],))
                conn.commit()

                appt_date = str(row["appointment_date"])
                appt_time = str(row["appointment_time"])[:5]
                doctor    = row.get("doctor", DR_ANJALI)
                logger.info(f"Cancelled appointment for {row['name']} with {doctor} on {appt_date} at {appt_time}")

                if row.get("calendar_event_id"):
                    delete_calendar_event(row["calendar_event_id"])

        finally:
            conn.close()

        await params.result_callback({
            "status": "success",
            "message": f"Appointment with {doctor} on {appt_date} at {appt_time} has been successfully cancelled.",
        })

    except Exception as e:
        logger.error(f"cancel_slot error: {e}")
        await params.result_callback({"error": str(e)})


# ── reschedule_slot ───────────────────────────────────────────────────────────
async def reschedule_slot(params: FunctionCallParams, phone: str, new_date: str, new_time: str):
    """Reschedule an existing appointment to a new date and time.
    Only call this after verifying the new slot is available and the patient has confirmed.

    Args:
        phone:    Patient's phone number used at booking time.
        new_date: New appointment date in YYYY-MM-DD format.
        new_time: New appointment time in HH:MM 24-hour format.
    """
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, phone, doctor, appointment_date, appointment_time, calendar_event_id
                    FROM appointments
                    WHERE phone = %s
                      AND appointment_date >= CURRENT_DATE
                    ORDER BY appointment_date ASC, appointment_time ASC
                    LIMIT 1
                    """,
                    (phone,)
                )
                row = cur.fetchone()

                if not row:
                    await params.result_callback({
                        "status": "not_found",
                        "message": "No upcoming appointment found for this phone number.",
                    })
                    return

                doctor = row.get("doctor", DR_ANJALI)

                # Check for conflict at new slot (same doctor)
                cur.execute(
                    """
                    SELECT id FROM appointments
                    WHERE appointment_date = %s
                      AND appointment_time = %s
                      AND doctor = %s
                      AND id != %s
                    """,
                    (new_date, new_time, doctor, row["id"])
                )
                if cur.fetchone():
                    free_slots = await get_free_slots(new_date, doctor=doctor)
                    await params.result_callback({
                        "status": "slot_taken",
                        "message": "That slot is already taken.",
                        "suggested_slots": free_slots[:3],
                    })
                    return

                old_date = str(row["appointment_date"])
                old_time = str(row["appointment_time"])[:5]

                cur.execute(
                    """
                    UPDATE appointments
                    SET appointment_date = %s, appointment_time = %s
                    WHERE id = %s
                    """,
                    (new_date, new_time, row["id"])
                )
                conn.commit()
                logger.info(f"Rescheduled {row['name']} ({doctor}) from {old_date} {old_time} → {new_date} {new_time}")

                if row.get("calendar_event_id"):
                    update_calendar_event(
                        row["calendar_event_id"],
                        name=row["name"],
                        phone=row["phone"],
                        new_date=new_date,
                        new_time=new_time,
                        doctor=doctor,
                    )

        finally:
            conn.close()

        await params.result_callback({
            "status": "success",
            "message": f"Appointment with {doctor} rescheduled from {old_date} at {old_time} to {new_date} at {new_time}.",
        })

    except Exception as e:
        logger.error(f"reschedule_slot error: {e}")
        await params.result_callback({"error": str(e)})


# ── create_patient_record ─────────────────────────────────────────────────────
async def create_patient_record(
    params: FunctionCallParams,
    name: str,
    phone: str,
    patient_type: str = "NEW",
    reason: str = "",
):
    """Create or update a patient record in the CRM.
    Call this for first-time patients after collecting their details.

    Args:
        name:         Patient's full name.
        phone:        Patient's phone number.
        patient_type: "NEW" for first-time visitors, "EXISTING" for returning patients.
        reason:       Chief complaint or reason for visit (e.g. "Tooth sensitivity").
    """
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                # Upsert: insert new or update existing record
                cur.execute(
                    """
                    INSERT INTO patients (name, phone, patient_type, last_complaint, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (phone)
                    DO UPDATE SET
                        name           = EXCLUDED.name,
                        last_complaint = EXCLUDED.last_complaint,
                        updated_at     = NOW()
                    RETURNING id
                    """,
                    (name, phone, patient_type, reason)
                )
                patient_id = cur.fetchone()["id"]
                conn.commit()
        finally:
            conn.close()

        logger.info(f"👤 Patient record created/updated: {name} ({phone}) | type={patient_type} | ID={patient_id}")

        await params.result_callback({
            "status": "success",
            "patient_id": patient_id,
            "patient_type": patient_type,
            "message": f"Patient record {'created' if patient_type == 'NEW' else 'updated'} for {name}.",
        })

    except Exception as e:
        logger.error(f"create_patient_record error: {e}")
        await params.result_callback({"error": str(e)})


# ── send_whatsapp_confirmation ────────────────────────────────────────────────
async def send_whatsapp_confirmation(
    params: FunctionCallParams,
    phone: str,
    name: str,
    date: str,
    time: str,
    doctor: str = DR_ANJALI,
):
    """Send a WhatsApp appointment confirmation to the patient.
    This includes clinic address, doctor name, appointment time, and a map link.
    Call this after a successful booking confirmation.

    Args:
        phone:  Patient's phone number.
        name:   Patient's full name.
        date:   Appointment date in YYYY-MM-DD format.
        time:   Appointment time in HH:MM 24-hour format.
        doctor: Doctor's full name (default: "Dr. Anjali Rao").
    """
    try:
        send_whatsapp_appointment_confirmation(
            to_phone=phone,
            patient_name=name,
            appointment_date=date,
            appointment_time=time,
            doctor=doctor,
        )
        logger.info(f"📲 WhatsApp confirmation sent to {phone} for {name} ({doctor} on {date} at {time})")
        await params.result_callback({
            "status": "success",
            "message": f"WhatsApp confirmation sent to {phone}.",
        })
    except Exception as e:
        logger.error(f"send_whatsapp_confirmation error: {e}")
        await params.result_callback({"error": str(e)})


# ── transfer_to_human ─────────────────────────────────────────────────────────
async def transfer_to_human(params: FunctionCallParams):
    """Transfer the call to a human agent (front desk staff).
    Call this ONLY when the user explicitly asks to speak with a human,
    a doctor, the clinic staff, or a real person.
    """
    call_sid = getattr(params, "call_sid", None) or ""

    await params.result_callback({
        "action": "transfer",
        "message": (
            "Sure! Please hold on while I connect you to our clinic staff. "
            "One moment please."
        ),
    })

    from pipeline.services.exotel_transfer import transfer_call_to_human
    success = transfer_call_to_human(call_sid)
    if not success:
        logger.warning("⚠️  Human transfer API call failed – caller will stay with bot.")
