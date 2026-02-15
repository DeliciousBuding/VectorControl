import sqlite3

conn = sqlite3.connect('/app/backend/data/app.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get all unique user_ids from holdings
cursor.execute("SELECT DISTINCT user_id FROM holdings")
user_ids = cursor.fetchall()
print("User IDs in holdings:")
for row in user_ids:
    print(f"  {row[0]}")

# Check if users table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("\nTables in database:")
for row in tables:
    print(f"  {row[0]}")

# Check sessions table
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
if cursor.fetchone():
    cursor.execute("SELECT COUNT(*) FROM sessions")
    count = cursor.fetchone()[0]
    print(f"\nSessions count: {count}")
    if count > 0:
        cursor.execute("SELECT user_id, token, created_at FROM sessions LIMIT 5")
        rows = cursor.fetchall()
        print("Sample sessions:")
        for row in rows:
            print(f"  {dict(row)}")

conn.close()
