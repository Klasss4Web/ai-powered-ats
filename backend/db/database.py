"""
Database utilities for ATS Matcher Backend (PostgreSQL)
"""

import psycopg
from psycopg.rows import dict_row
from flask import g
from config import DATABASE_URL


# =========================================================
# 1. DATABASE CONNECTION (REQUEST LEVEL)
# =========================================================

def get_db():
    """Get database connection (one per request)."""
    if "db" not in g:
        g.db = psycopg.connect(
            DATABASE_URL,
            row_factory=dict_row
        )
    return g.db


def close_db_connection(e=None):
    """Close DB connection after request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


# =========================================================
# 2. DATABASE CREATION (SERVER LEVEL)
# =========================================================

def create_database_if_not_exists():
    """
    Creates the PostgreSQL database if it does not exist.
    MUST run before init_db().
    """

    # Extract DB name from URL
    # Example: postgresql://user:pass@localhost:5432/ats_matcher
    db_name = DATABASE_URL.split("/")[-1]

    # Connect to default postgres database
    conn = psycopg.connect(
        DATABASE_URL.rsplit("/", 1)[0] + "/postgres",
        autocommit=True
    )

    try:
        cur = conn.cursor()

        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (db_name,)
        )

        exists = cur.fetchone()

        if not exists:
            cur.execute(f'CREATE DATABASE "{db_name}"')
            print(f"Database '{db_name}' created successfully.")
        else:
            print(f"Database '{db_name}' already exists.")

    finally:
        cur.close()
        conn.close()


# =========================================================
# 3. TABLE INITIALIZATION (SCHEMA LEVEL)
# =========================================================

def init_db(app):
    """Initialize database tables."""

    with app.app_context():
        conn = psycopg.connect(
            DATABASE_URL,
            row_factory=dict_row
        )

        try:
            cur = conn.cursor()

            # -------------------------
            # USERS
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    subscription_type TEXT DEFAULT 'free'
                        CHECK (subscription_type IN ('free', 'premium')),
                    subscription_expires_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS reset_token TEXT
            """)

            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP
            """)

            # -------------------------
            # USAGE TRACKING
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS usage_tracking (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    action_type TEXT NOT NULL,
                    date_created DATE DEFAULT CURRENT_DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB
                )
            """)

            # -------------------------
            # SESSIONS
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # SAVED RESUMES
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS saved_resumes (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL,
                    resume_text TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # INDEXES
            # -------------------------
            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_tracking(user_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)")

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise e

        finally:
            cur.close()
            conn.close()