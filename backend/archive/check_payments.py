# Archived: Unused file Previously used when sqlite was the main database for tracking usage and payments. Now we are using DynamoDB, so this file is no longer needed. Keeping it here for reference in case we need to check old records or migrate data in the future.
import sqlite3
import json
conn = sqlite3.connect('ats_matcher.db')
cursor = conn.cursor()

# Check all records
cursor.execute('SELECT * FROM usage_tracking ORDER BY created_at DESC LIMIT 10')
rows = cursor.fetchall()
print("All usage tracking records:")
for row in rows:
    print(f'ID: {row[0]}, User: {row[1]}, Action: {row[2]}, Date: {row[3]}, Created: {row[4]}')
    if row[4]:
        try:
            metadata = json.loads(row[4])
            print(f'  Metadata: {metadata}')
        except:
            print(f'  Raw metadata: {row[4]}')
    print()

# Check distinct action types
cursor.execute('SELECT DISTINCT action_type FROM usage_tracking')
action_types = cursor.fetchall()
print("Distinct action types:")
for action_type in action_types:
    print(action_type[0])

conn.close()
