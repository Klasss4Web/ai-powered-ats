#!/bin/bash
# Database readiness check script
# Usage: ./scripts/check-db.sh <db_endpoint> <db_username> <db_password> <db_name>

set -e

DB_ENDPOINT=$1
DB_USERNAME=$2
DB_PASSWORD=$3
DB_NAME=$4

echo "Checking database connectivity..."
echo "Endpoint: $DB_ENDPOINT"
echo "Database: $DB_NAME"

# Extract host and port
DB_HOST=$(echo $DB_ENDPOINT | cut -d: -f1)
DB_PORT=$(echo $DB_ENDPOINT | cut -d: -f2)

# Wait for database to be reachable
echo "Waiting for database to be reachable..."
timeout=60
elapsed=0

while ! nc -z $DB_HOST $DB_PORT 2>/dev/null; do
    if [ $elapsed -ge $timeout ]; then
        echo "Timeout waiting for database to be reachable"
        exit 1
    fi
    echo "Database not ready, waiting... ($elapsed/$timeout seconds)"
    sleep 5
    elapsed=$((elapsed + 5))
done

echo "Database is reachable!"

# Test database connection and basic operations
echo "Testing database connection..."
export PGPASSWORD=$DB_PASSWORD

# Try to connect and run a simple query
if psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
    echo "Database connection successful!"
    echo "Database is ready for application deployment."
    exit 0
else
    echo "Failed to connect to database"
    exit 1
fi