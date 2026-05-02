import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def check_call_logs():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cur = conn.cursor()
        cur.execute("SELECT caller_phone, status, transcript_summary FROM call_logs")
        rows = cur.fetchall()
        for row in rows:
            print(f"Phone: {row[0]}, Status: {row[1]}, Summary: {row[2][:50]}...")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_call_logs()
