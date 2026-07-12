#!/usr/bin/env python3
import argparse
import os
import sqlite3
from pathlib import Path
import secrets
import string

def generate_key():
    # Format: FRIS-XXXX-XXXX-XXXX
    parts = []
    for _ in range(3):
        parts.append("".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4)))
    return "FRIS-" + "-".join(parts)

def main():
    parser = argparse.ArgumentParser(description="Generate and add a license key to FrisFrame database")
    parser.add_argument("--key", help="Specific license key to add (default: auto-generated)")
    parser.add_argument("--owner", default="Custom User", help="Name of the license owner")
    args = parser.parse_args()

    key = args.key or generate_key()
    
    root = Path(__file__).resolve().parent
    db_path = os.environ.get("PREVIS_DB_PATH", str(root / "previs_projects.db"))
    
    try:
        conn = sqlite3.connect(db_path, timeout=10.0)
        cursor = conn.cursor()
        
        # Ensure licenses table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS licenses (
                key TEXT PRIMARY KEY,
                owner TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        cursor.execute("SELECT 1 FROM licenses WHERE key = ?", (key,))
        if cursor.fetchone():
            print(f"Error: License key '{key}' already exists in the database.")
            conn.close()
            return
            
        cursor.execute("INSERT INTO licenses (key, owner, is_active) VALUES (?, ?, 1)", (key, args.owner))
        conn.commit()
        conn.close()
        
        print("\n" + "="*50)
        print("🎉 새로운 라이센스가 성공적으로 생성되었습니다!")
        print(f"🔑 라이센스 키: {key}")
        print(f"👤 소유자: {args.owner}")
        print("="*50 + "\n")
        
    except Exception as e:
        print(f"Error adding license to database: {e}")

if __name__ == "__main__":
    main()
