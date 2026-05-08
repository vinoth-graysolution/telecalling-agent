"""
database/run_migration.py
Run once to apply the Whitepoint Dental schema migration to AWS RDS.
Usage:  python -m database.run_migration
"""
import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Force UTF-8 output so box-drawing chars don't crash on Windows cp1252
sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

HOST     = os.getenv("DB_HOST")
PORT     = int(os.getenv("DB_PORT", 5432))
DBNAME   = os.getenv("DB_NAME", "postgres")
USER     = os.getenv("DB_USER")
PASSWORD = os.getenv("DB_PASSWORD")

SQL_FILE = Path(__file__).parent / "migrate_dental_schema.sql"

print(f"Connecting to {HOST}:{PORT}/{DBNAME} as {USER} ...")
conn = psycopg2.connect(host=HOST, port=PORT, dbname=DBNAME, user=USER, password=PASSWORD)
conn.autocommit = True
cur = conn.cursor()

sql = SQL_FILE.read_text(encoding="utf-8")
print(f"Executing {SQL_FILE.name} ...\n")

for stmt in sql.split(";"):
    stmt = stmt.strip()
    if not stmt or all(line.startswith("--") for line in stmt.splitlines() if line.strip()):
        continue
    try:
        cur.execute(stmt)
        first_line = stmt.splitlines()[0][:80]
        print(f"  OK  {first_line}")
    except Exception as e:
        print(f"  ERR {stmt[:80]!r}")
        print(f"      {e}")

# Verify appointments columns
print("\n--- appointments columns ---")
cur.execute("""
    SELECT column_name, data_type, column_default
    FROM   information_schema.columns
    WHERE  table_name = 'appointments'
    ORDER  BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  {row[0]:<25}  {row[1]:<20}  default={row[2]}")

# Verify tables
print("\n--- public tables ---")
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE  table_schema = 'public'
    ORDER  BY table_name
""")
for row in cur.fetchall():
    print(f"  {row[0]}")

cur.close()
conn.close()
print("\nMigration complete.")
