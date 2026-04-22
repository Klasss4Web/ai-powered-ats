"""
Database utilities for ATS Matcher Backend
"""

import sqlite3
from flask import g
from config import DATABASE


def get_db():
    """Get database connection."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


def close_db_connection(app):
    """Create a function to close the database connection."""
    def close_connection(exception):
        """Close database connection."""
        db = getattr(g, '_database', None)
        if db is not None:
            db.close()
    return close_connection


def init_db(app):
    """Initialize database tables."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()

        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                subscription_type TEXT DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium')),
                subscription_expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Add reset_token and reset_expires columns if they don't exist
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN reset_token TEXT')
        except:
            pass
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN reset_expires TIMESTAMP')
        except:
            pass

        # Create usage tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                date_created DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Add metadata column if it doesn't exist (for existing databases)
        try:
            cursor.execute('ALTER TABLE usage_tracking ADD COLUMN metadata TEXT')
        except:
            pass  # Column might already exist

        # Create sessions table for refresh tokens (optional)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Create saved resumes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS saved_resumes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        db.commit()
