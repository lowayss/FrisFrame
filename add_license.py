#!/usr/bin/env python3
import argparse
import sqlite3
import secrets
import string

from server import database_path, initialize_database, legacy_license_digest, license_digest

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
    compact_key = "".join(character for character in key.upper() if character.isalnum())
    if len(compact_key) < 14:
        raise SystemExit("라이센스 키는 영문과 숫자를 합쳐 14자 이상이어야 합니다.")
    
    db_path = database_path()
    
    try:
        initialize_database(db_path)
        conn = sqlite3.connect(db_path, timeout=10.0)
        cursor = conn.cursor()
        stored_key = license_digest(key)
        legacy_key = legacy_license_digest(key)
        cursor.execute("SELECT 1 FROM licenses WHERE key IN (?, ?)", (stored_key, legacy_key))
        if cursor.fetchone():
            print(f"Error: License key '{key}' already exists in the database.")
            conn.close()
            return
            
        cursor.execute("INSERT INTO licenses (key, owner, is_active) VALUES (?, ?, 1)", (stored_key, args.owner))
        conn.commit()
        conn.close()
        
        print("\n" + "="*50)
        print("새로운 라이센스가 성공적으로 생성되었습니다.")
        print(f"라이센스 키: {key}")
        print(f"소유자: {args.owner}")
        print("="*50 + "\n")
        
    except Exception as e:
        print(f"Error adding license to database: {e}")

if __name__ == "__main__":
    main()
