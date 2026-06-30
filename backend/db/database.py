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
        g.db = psycopg.connect(DATABASE_URL, row_factory=dict_row)
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
        DATABASE_URL.rsplit("/", 1)[0] + "/postgres", autocommit=True
    )

    try:
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))

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
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)

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

            # Expand subscription_type CHECK constraint to include the 'pro' tier.
            # We drop the old constraint (whatever it was named) and add the new one.
            # This is idempotent: if the constraint already includes 'pro' the DROP
            # will remove it and the ADD will recreate it with the full set.
            cur.execute("""
                DO $$
                DECLARE
                    c_name TEXT;
                BEGIN
                    -- Find and drop any existing check constraint on subscription_type
                    SELECT conname INTO c_name
                    FROM pg_constraint
                    WHERE conrelid = 'users'::regclass
                      AND contype = 'c'
                      AND pg_get_constraintdef(oid) LIKE '%subscription_type%';

                    IF c_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(c_name);
                    END IF;

                    -- Re-add with the full allowed set including 'pro'
                    ALTER TABLE users
                        ADD CONSTRAINT users_subscription_type_check
                        CHECK (subscription_type IN ('free', 'premium', 'pro'));
                END
                $$;
            """)

            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS reset_token TEXT
            """)

            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP
            """)

            # Add role column for admin access
            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
                    CHECK (role IN ('user', 'admin'))
            """)

            # Track when subscription was last changed
            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP
            """)

            # -------------------------
            # SUBSCRIPTIONS (history of every subscription event)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'premium', 'pro', 'pay_as_you_go')),
                    amount NUMERIC,
                    currency TEXT,
                    gateway TEXT,
                    reference TEXT UNIQUE,
                    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_subscriptions_reference ON subscriptions(reference)
            """)

            # Expand plan_type CHECK constraint if table already exists
            cur.execute("""
                DO $$
                DECLARE
                    c_name TEXT;
                BEGIN
                    SELECT conname INTO c_name
                    FROM pg_constraint
                    WHERE conrelid = 'subscriptions'::regclass
                      AND contype = 'c'
                      AND pg_get_constraintdef(oid) LIKE '%plan_type%';

                    IF c_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE subscriptions DROP CONSTRAINT ' || quote_ident(c_name);
                    END IF;

                    ALTER TABLE subscriptions
                        ADD CONSTRAINT subscriptions_plan_type_check
                        CHECK (plan_type IN ('free', 'premium', 'pro', 'pay_as_you_go'));
                END
                $$;
            """)

            # -------------------------
            # API METRICS TRACKING (for observability)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS api_metrics (
                    id SERIAL PRIMARY KEY,
                    endpoint TEXT NOT NULL,
                    method TEXT NOT NULL,
                    status_code INTEGER,
                    response_time_ms REAL,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    tokens_used INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # TOKEN USAGE TRACKING (for LLM costs)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS token_usage (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    endpoint TEXT NOT NULL,
                    model TEXT,
                    prompt_tokens INTEGER DEFAULT 0,
                    completion_tokens INTEGER DEFAULT 0,
                    total_tokens INTEGER DEFAULT 0,
                    estimated_cost REAL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
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
            # CV PROFILES (CV Builder)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cv_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    profile_data JSONB NOT NULL DEFAULT '{}',
                    template_id INTEGER DEFAULT 1,
                    is_master BOOLEAN DEFAULT false,
                    target_job_description TEXT,
                    tailored_from_id INTEGER REFERENCES cv_profiles(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_cv_profiles_user_id ON cv_profiles(user_id)"
            )

            # -------------------------
            # SCREENING SESSIONS (Recruiter Feature)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS screening_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    job_title TEXT,
                    job_description TEXT NOT NULL,
                    total_candidates INTEGER DEFAULT 0,
                    results JSONB,
                    report TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # SAVED ANALYSES (My Analysis feature)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS analyses (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    job_description TEXT NOT NULL,
                    result JSONB NOT NULL,
                    overall_match_score INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # SAVED COVER LETTERS
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cover_letters (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    company_name TEXT,
                    job_title TEXT,
                    cover_letter TEXT NOT NULL,
                    word_count INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # SAVED INTERVIEW PREPS
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS interview_preps (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    company_name TEXT,
                    job_title TEXT,
                    result JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # INDEXES
            # -------------------------
            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_tracking(user_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_screening_user_id ON screening_sessions(user_id)"
            )

            # Indexes for admin metrics
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_api_metrics_created ON api_metrics(created_at)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics(endpoint)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON cover_letters(user_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_interview_preps_user_id ON interview_preps(user_id)"
            )

            # -------------------------
            # BACKGROUND JOBS
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    job_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
                    payload JSONB,
                    result JSONB,
                    progress INTEGER DEFAULT 0,
                    total INTEGER DEFAULT 0,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at)"
            )

            # -------------------------
            # JOB APPLICATIONS (Kanban Tracker)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS job_applications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    company_name TEXT NOT NULL,
                    job_title TEXT NOT NULL,
                    job_description TEXT,
                    stage TEXT NOT NULL DEFAULT 'applied'
                        CHECK (stage IN ('applied', 'phone_screen', 'interview', 'offer', 'accepted', 'rejected', 'ghosted')),
                    salary_min INTEGER,
                    salary_max INTEGER,
                    currency TEXT DEFAULT 'USD',
                    location TEXT,
                    remote_type TEXT,
                    application_date DATE DEFAULT CURRENT_DATE,
                    contact_name TEXT,
                    contact_email TEXT,
                    notes TEXT,
                    resume_id INTEGER REFERENCES saved_resumes(id) ON DELETE SET NULL,
                    analysis_id INTEGER REFERENCES analyses(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_job_apps_user ON job_applications(user_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_job_apps_stage ON job_applications(stage)"
            )

            # -------------------------
            # APPLICATION STAGE HISTORY
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS application_stage_history (
                    id SERIAL PRIMARY KEY,
                    application_id INTEGER NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
                    from_stage TEXT,
                    to_stage TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # -------------------------
            # EMAIL TEMPLATES (Recruiter)
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS email_templates (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    email_type TEXT NOT NULL CHECK (email_type IN ('acceptance', 'rejection', 'custom')),
                    subject_template TEXT,
                    body_template TEXT NOT NULL,
                    is_default BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_email_templates_user ON email_templates(user_id)"
            )

            # =========================================================
            # FULL-TEXT SEARCH (tsvector + GIN indexes)
            # =========================================================

            # Analyses
            cur.execute("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS search_vector tsvector")
            cur.execute("""
                UPDATE analyses SET search_vector = to_tsvector('english', COALESCE(job_description,''))
                WHERE search_vector IS NULL
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_analyses_search ON analyses USING GIN(search_vector)")
            cur.execute("""
                CREATE OR REPLACE FUNCTION analyses_search_update() RETURNS trigger AS $$
                BEGIN
                  NEW.search_vector := to_tsvector('english', COALESCE(NEW.job_description,''));
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """)
            cur.execute("DROP TRIGGER IF EXISTS analyses_search_trigger ON analyses")
            cur.execute("""
                CREATE TRIGGER analyses_search_trigger BEFORE INSERT OR UPDATE ON analyses
                FOR EACH ROW EXECUTE FUNCTION analyses_search_update()
            """)

            # Cover Letters
            cur.execute("ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS search_vector tsvector")
            cur.execute("""
                UPDATE cover_letters SET search_vector = to_tsvector('english',
                    COALESCE(cover_letter,'') || ' ' || COALESCE(company_name,'') || ' ' || COALESCE(job_title,''))
                WHERE search_vector IS NULL
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_cover_letters_search ON cover_letters USING GIN(search_vector)")
            cur.execute("""
                CREATE OR REPLACE FUNCTION cover_letters_search_update() RETURNS trigger AS $$
                BEGIN
                  NEW.search_vector := to_tsvector('english',
                    COALESCE(NEW.cover_letter,'') || ' ' || COALESCE(NEW.company_name,'') || ' ' || COALESCE(NEW.job_title,''));
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """)
            cur.execute("DROP TRIGGER IF EXISTS cover_letters_search_trigger ON cover_letters")
            cur.execute("""
                CREATE TRIGGER cover_letters_search_trigger BEFORE INSERT OR UPDATE ON cover_letters
                FOR EACH ROW EXECUTE FUNCTION cover_letters_search_update()
            """)

            # Interview Preps
            cur.execute("ALTER TABLE interview_preps ADD COLUMN IF NOT EXISTS search_vector tsvector")
            cur.execute("""
                UPDATE interview_preps SET search_vector = to_tsvector('english',
                    COALESCE(result::text,'') || ' ' || COALESCE(company_name,'') || ' ' || COALESCE(job_title,''))
                WHERE search_vector IS NULL
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_interview_preps_search ON interview_preps USING GIN(search_vector)")
            cur.execute("""
                CREATE OR REPLACE FUNCTION interview_preps_search_update() RETURNS trigger AS $$
                BEGIN
                  NEW.search_vector := to_tsvector('english',
                    COALESCE(NEW.result::text,'') || ' ' || COALESCE(NEW.company_name,'') || ' ' || COALESCE(NEW.job_title,''));
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """)
            cur.execute("DROP TRIGGER IF EXISTS interview_preps_search_trigger ON interview_preps")
            cur.execute("""
                CREATE TRIGGER interview_preps_search_trigger BEFORE INSERT OR UPDATE ON interview_preps
                FOR EACH ROW EXECUTE FUNCTION interview_preps_search_update()
            """)

            # Screening Sessions
            cur.execute("ALTER TABLE screening_sessions ADD COLUMN IF NOT EXISTS search_vector tsvector")
            cur.execute("""
                UPDATE screening_sessions SET search_vector = to_tsvector('english',
                    COALESCE(job_title,'') || ' ' || COALESCE(job_description,''))
                WHERE search_vector IS NULL
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_screening_sessions_search ON screening_sessions USING GIN(search_vector)")
            cur.execute("""
                CREATE OR REPLACE FUNCTION screening_sessions_search_update() RETURNS trigger AS $$
                BEGIN
                  NEW.search_vector := to_tsvector('english',
                    COALESCE(NEW.job_title,'') || ' ' || COALESCE(NEW.job_description,''));
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """)
            cur.execute("DROP TRIGGER IF EXISTS screening_sessions_search_trigger ON screening_sessions")
            cur.execute("""
                CREATE TRIGGER screening_sessions_search_trigger BEFORE INSERT OR UPDATE ON screening_sessions
                FOR EACH ROW EXECUTE FUNCTION screening_sessions_search_update()
            """)

            # -------------------------
            # FEATURE FLAGS
            # -------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS feature_flags (
                    id SERIAL PRIMARY KEY,
                    flag_key TEXT UNIQUE NOT NULL,
                    enabled BOOLEAN DEFAULT true,
                    rollout_pct INTEGER DEFAULT 100
                        CHECK (rollout_pct BETWEEN 0 AND 100),
                    variant TEXT DEFAULT 'control',
                    metadata JSONB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key)"
            )

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise e

        finally:
            cur.close()
            conn.close()
