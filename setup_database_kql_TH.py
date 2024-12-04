import sqlite3

def setup_kql_threat_hunting_database():
    conn = sqlite3.connect('MS_KQL_ThreatHunting.db')
    cursor = conn.cursor()
    
    tables = ['Domains', 'IP', 'MD5_Hashes', 'SHA1_Hashes', 'SHA256_Hashes', 'URLs']
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
    CREATE TABLE IF NOT EXISTS Checked_KQL_Threat_Hunting_Queries (
        id INTEGER PRIMARY KEY,
        Type TEXT,
        Date_Checked TEXT,
        Hits TEXT
    )
    ''')
    
    conn.commit()
    conn.close()