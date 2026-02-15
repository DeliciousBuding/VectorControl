import sqlite3
conn = sqlite3.connect('/opt/VectorControl/deploy/data/backend/app.db')
cursor = conn.cursor()
cursor.execute("SELECT DISTINCT user_id FROM holdings")
print("User IDs:", [r[0] for r in cursor.fetchall()])
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [r[0] for r in cursor.fetchall()])
conn.close()
