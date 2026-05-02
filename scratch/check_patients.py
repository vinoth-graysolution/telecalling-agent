import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def check_zoho_patients():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cur = conn.cursor()
        cur.execute("SELECT name, phone, external_id FROM patients WHERE source = 'zoho'")
        rows = cur.fetchall()
        for row in rows:
            print(f"Name: {row[0]}, Phone: {row[1]}, Zoho ID: {row[2]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_zoho_patients()
