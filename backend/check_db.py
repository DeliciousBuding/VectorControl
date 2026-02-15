import sqlite3
import os

# Check both possible paths
paths = [
    '/app/data/vectorcontrol.db',
    '/app/backend/data/app.db',
]

for db_path in paths:
    print(f"\n=== Checking: {db_path} ===")
    print(f"  Exists: {os.path.exists(db_path)}")
    
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check holdings table
            cursor.execute("SELECT COUNT(*) FROM holdings")
            count = cursor.fetchone()[0]
            print(f"  Holdings count: {count}")
            
            if count > 0:
                cursor.execute("SELECT user_id, fund_id, name, bucket FROM holdings LIMIT 3")
                rows = cursor.fetchall()
                print("  Sample holdings:")
                for row in rows:
                    print(f"    {row}")
            
            # Check users table
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            print(f"  Users count: {user_count}")
            
            conn.close()
        except Exception as e:
            print(f"  Error: {e}")
