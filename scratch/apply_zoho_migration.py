import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

def apply_migration():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            sslmode="require"
        )
        with conn.cursor() as cur:
            print("Adding user_id column...")
            cur.execute("ALTER TABLE integrations ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);")
            
            print("Dropping old unique constraint...")
            cur.execute("ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_service_name_key;")
            
            print("Adding new unique constraint...")
            cur.execute("ALTER TABLE integrations ADD CONSTRAINT integrations_service_user_unique UNIQUE (service_name, user_id);")
            
            conn.commit()
            print("Migration successful!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    apply_migration()
