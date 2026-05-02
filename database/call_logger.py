from database.db import get_connection
from integrations.zoho import zoho_service
from loguru import logger

def save_call_log(call_sid, phone, direction, status, duration, transcript, summary, decision):
    """
    Saves a call log to the local database and synchronizes with Zoho CRM if connected.
    """
    logger.info(f"Saving call log for {call_sid} ({phone})")
    
    # 1. Save to local DB
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO call_logs 
                (call_sid, caller_phone, direction, status, duration_seconds, transcript, transcript_summary, ai_decision)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (call_sid, phone, direction, status, duration, transcript, summary, decision)
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to save call log to DB: {e}")
    finally:
        conn.close()

    # 2. Sync with Zoho CRM
    try:
        zoho_service.log_call(phone, direction, duration, status, summary)
    except Exception as e:
        logger.error(f"Failed to sync call log with Zoho: {e}")

def get_transcript_summary(context_messages):
    """
    Simplified helper to extract or generate a summary from the LLM context.
    In a real app, you might use an LLM to summarize the conversation.
    """
    # For now, just join the user messages
    user_msgs = [m['content'] for m in context_messages if m['role'] == 'user' and m['content'] != 'Hello']
    return " | ".join(user_msgs) if user_msgs else "Automated call completed."
