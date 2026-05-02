from database.db import get_connection
import sys

def setup_db():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Create system_config table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_config (
                    key VARCHAR(50) PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_VALUE
                );
            """.replace("CURRENT_VALUE", "CURRENT_TIMESTAMP"))
            
            # Create campaigns table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS campaigns (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    total_calls INTEGER DEFAULT 0,
                    completed_calls INTEGER DEFAULT 0,
                    failed_calls INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Create patients table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    phone VARCHAR(20) UNIQUE NOT NULL,
                    initials VARCHAR(5),
                    last_visit TIMESTAMP,
                    visits INTEGER DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'Active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Fix call_logs table schema
            cur.execute("""
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS caller_phone VARCHAR(20);
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'inbound';
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript TEXT;
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'English';
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Low';
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS assignee VARCHAR(50);
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS internal_notes TEXT;
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript_summary TEXT;
                ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_decision TEXT;
            """)

            # Add WhatsApp status to appointments
            cur.execute("""
                ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR(20) DEFAULT 'not_sent';
                ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsapp_message_sid VARCHAR(100);
            """)
            
            # Seed patients for testing
            patients = [
                ('Rajesh Kumar', '+919876543210', 'RK', '2024-01-15', 8),
                ('Lakshmi Devi', '+919823456789', 'LD', '2024-01-12', 5),
                ('Arjun Menon', '+919987654321', 'AM', '2024-01-10', 12)
            ]
            for name, phone, initials, last_visit, visits in patients:
                cur.execute(
                    "INSERT INTO patients (name, phone, initials, last_visit, visits) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (phone) DO NOTHING",
                    (name, phone, initials, last_visit, visits)
                )

            # Seed some failed calls as escalations
            cur.execute("""
                INSERT INTO call_logs (call_sid, caller_phone, direction, status, duration_seconds, priority, transcript, transcript_summary, ai_decision)
                VALUES 
                ('mock_sid_1', '+919876543210', 'inbound', 'failed', 124, 'High', 'User: I need to speak to a doctor immediately. Bot: I can help you schedule an appointment.', 'Patient requested immediate doctor intervention during appointment booking.', 'Escalated due to urgent medical request.'),
                ('mock_sid_2', '+919987654321', 'inbound', 'failed', 88, 'Medium', 'User: My appointment was cancelled without notice. Bot: I am sorry to hear that.', 'Patient expressing frustration over cancelled appointment.', 'Human follow-up required for customer retention.')
                ON CONFLICT (id) DO NOTHING
            """)

            # Sync existing data if needed (optional but good for consistency)
            cur.execute("""
                UPDATE call_logs SET caller_phone = phone_number WHERE caller_phone IS NULL AND phone_number IS NOT NULL;
                UPDATE call_logs SET status = call_status WHERE status = 'completed' AND call_status IS NOT NULL;
            """)

            # Seed prompts
            prompts = {
                'inbound_prompt': """You are Aria, the AI voice assistant for Kishore Dental Clinic... (full prompt here)""",
                'outbound_prompt': """You are Maya, the AI voice assistant for Axis Finance Bank... (full prompt here)"""
            }
            
            # Since the prompts are long, I'll just use placeholders for now and update them via the actual content later
            # Or I can read them from the files in this script.
            
            from prompt.clinic_system_prompt import get_system_prompt as get_inbound
            from outbound.prompt.outbound_prompt import get_system_prompt as get_outbound
            
            fake_context = {"day": "{day}", "date": "{date}", "time_12h": "{time_12h}"}
            inbound_text = get_inbound(fake_context)
            outbound_text = get_outbound(fake_context)
            
            cur.execute("INSERT INTO system_config (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", ('inbound_prompt', inbound_text))
            cur.execute("INSERT INTO system_config (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", ('outbound_prompt', outbound_text))
            
            conn.commit()
            print("Database setup successful.")
    except Exception as e:
        print(f"Error setting up database: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    setup_db()
