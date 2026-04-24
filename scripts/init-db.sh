#!/bin/bash
# Database migration/initialization script
# Usage: ./scripts/init-db.sh <db_endpoint> <db_username> <db_password> <db_name>

set -e

DB_ENDPOINT=$1
DB_USERNAME=$2
DB_PASSWORD=$3
DB_NAME=$4

echo "Initializing database schema..."
echo "Endpoint: $DB_ENDPOINT"
echo "Database: $DB_NAME"

# Extract host and port
DB_HOST=$(echo $DB_ENDPOINT | cut -d: -f1)
DB_PORT=$(echo $DB_ENDPOINT | cut -d: -f2)

export PGPASSWORD=$DB_PASSWORD

# Run database schema initialization
# This creates tables if they don't exist (idempotent operation)
echo "Creating database tables..."

psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME << 'EOF'
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    subscription_type TEXT DEFAULT 'free'
        CHECK (subscription_type IN ('free', 'premium')),
    subscription_expires_at TIMESTAMP NULL,
    reset_token TEXT,
    reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at ON usage_tracking(created_at);

-- Insert default data if needed
-- (Add any seed data here if required)

EOF

if [ $? -eq 0 ]; then
    echo "Database schema initialized successfully!"
else
    echo "Failed to initialize database schema"
    exit 1
fi