import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.storage.db import create_user

if __name__ == "__main__":
    username = "testuser"
    password = "password123"
    try:
        user = create_user(username, password)
        print(f"User created successfully: {user}")
    except ValueError as e:
        print(f"Error: {e}")
