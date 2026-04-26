import psycopg
import os
from dotenv import load_dotenv

load_dotenv(override=True)

DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

# Connect to default postgres database first
conn = psycopg.connect(
    dbname="postgres",
    user=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    autocommit=True
)

cur = conn.cursor()

# Check if DB exists
cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
exists = cur.fetchone()

if not exists:
    cur.execute(f'CREATE DATABASE {DB_NAME}')
    print(f"Database '{DB_NAME}' created successfully.")
else:
    print(f"Database '{DB_NAME}' already exists.")

cur.close()
conn.close()