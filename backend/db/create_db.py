import psycopg

DB_NAME = "ats_matcher"
DB_USER = "postgres"
DB_PASSWORD = "Gunners101"
DB_HOST = "localhost"
DB_PORT = "5432"

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