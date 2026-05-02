import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def check_zoho_status():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cur = conn.cursor()
        cur.execute("SELECT service_name, last_sync, token_expiry FROM integrations WHERE service_name = 'zoho_crm'")
        row = cur.fetchone()
        if row:
            print(f"Zoho Connection Found:")
            print(f"Service: {row[0]}")
            print(f"Last Sync: {row[1]}")
            print(f"Token Expiry: {row[2]}")
        else:
            print("No Zoho integration record found in the database.")
            
        cur.execute("SELECT count(*) FROM patients WHERE source = 'zoho'")
        count = cur.fetchone()[0]
        print(f"Total Zoho leads in patients table: {count}")
        
        cur.execute("SELECT count(*) FROM call_logs")
        logs_count = cur.fetchone()[0]
        print(f"Total call logs in database: {logs_count}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_zoho_status()
