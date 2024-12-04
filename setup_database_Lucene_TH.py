import sqlite3

def setup_threat_hunting_database():
    conn = sqlite3.connect('FortiLuceneThreatHunting.db')
    cursor = conn.cursor()

    # Create tables if they don't exist
    tables = ['Domain', 'IP', 'MD5_Hashes', 'SHA1_Hashes', 'SHA256_Hashes', 'URLs']
    for table in tables:
        cursor.execute(f'''
        CREATE TABLE IF NOT EXISTS {table} (
            id INTEGER PRIMARY KEY,
            Query_Text TEXT,
            Created_At TEXT,
            Completed TEXT,
            Hits TEXT
        )
        ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Checked_Threat_Hunting_Queries (
        id INTEGER PRIMARY KEY,
        Type TEXT,
        Date_Checked TEXT,
        Hits TEXT
    )
    ''')

    conn.commit()
    conn.close()

if __name__ == "__main__":
    setup_threat_hunting_database()