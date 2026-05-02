from database.db import get_connection
import json

def check_schema():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'patients'")
            columns = cur.fetchall()
            print("Patients table columns:")
            for col in columns:
                print(f"- {col['column_name']}: {col['data_type']} (default: {col['column_default']})")
    finally:
        conn.close()

if __name__ == "__main__":
    check_schema()
