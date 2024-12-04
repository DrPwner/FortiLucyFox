import sqlite3
from flask import jsonify, request
import re
import csv
import io
import logging

logging.basicConfig(level=logging.DEBUG)

def get_db_connection():
    conn = sqlite3.connect('ioc_database.db')
    conn.row_factory = sqlite3.Row
    return conn

def search_iocs(query):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Convert wildcards to SQL LIKE syntax
    query = query.replace('*', '%').replace('?', '_')
    
    logging.debug(f"Searching with query: {query}")

    # Use LOWER() for case-insensitive search
    sql = """
    SELECT * FROM iocs
    WHERE LOWER(ioc_value) LIKE LOWER(?)
    ORDER BY ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc DESC
    LIMIT 100
    """
    
    cursor.execute(sql, (f"%{query}%",))
    results = cursor.fetchall()
    
    logging.debug(f"Found {len(results)} results")

    conn.close()
    
    return [dict(row) for row in results]

def get_more_results(query, offset):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = query.replace('*', '%').replace('?', '_')
    
    sql = """
    SELECT * FROM iocs
    WHERE LOWER(ioc_value) LIKE LOWER(?)
    ORDER BY ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc DESC
    LIMIT 100 OFFSET ?
    """
    
    cursor.execute(sql, (query, offset))
    results = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in results]

def add_ioc(data):
    conn = get_db_connection()
    cursor = conn.cursor()

    required_fields = ['ioc_value', 'ioc_type', 'threat_type', 'malware', 'malware_alias', 'malware_printable', 'first_seen_utc', 'confidence_level', 'tags', 'reporter']
    for field in required_fields:
        if field not in data or not data[field]:
            conn.close()
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Validate ioc_type
    valid_ioc_types = ['url', 'ip:port', 'domain', 'md5_hash', 'sha256_hash', 'sha1_hash', 'sha3_384_hash']
    if data['ioc_type'] not in valid_ioc_types:
        conn.close()
        return jsonify({'error': 'Invalid ioc_type'}), 400

    # Validate confidence_level
    if int(data['confidence_level']) not in range(10, 101, 10):
        conn.close()
        return jsonify({'error': 'Invalid confidence_level'}), 400

    sql = """
    INSERT INTO iocs (ioc_value, ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc, confidence_level, tags, reporter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    cursor.execute(sql, (
        data['ioc_value'], data['ioc_type'], data['threat_type'], data['malware'],
        data['malware_alias'], data['malware_printable'], data['first_seen_utc'],
        data['confidence_level'], data['tags'], data['reporter']
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'IOC added successfully'}), 200

def bulk_import_iocs(file):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        content = file.read().decode('utf-8')
        csv_reader = csv.reader(content.splitlines())
        next(csv_reader)  # Skip header row

        for row in csv_reader:
            if len(row) != 10:  # Ensure all fields are present
                raise ValueError(f"Invalid row: {row}")

            ioc_value, ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc, confidence_level, tags, reporter = row

            # Validate ioc_type
            if ioc_type not in ['url', 'ip:port', 'domain', 'md5_hash', 'sha256_hash', 'sha1_hash', 'sha3_384_hash']:
                raise ValueError(f"Invalid ioc_type: {ioc_type}")

            # Validate confidence_level
            if int(confidence_level) not in range(10, 101, 10):
                raise ValueError(f"Invalid confidence_level: {confidence_level}")

            sql = """
            INSERT INTO iocs (ioc_value, ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc, confidence_level, tags, reporter)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.execute(sql, (ioc_value, ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc, confidence_level, tags, reporter))

        conn.commit()
        conn.close()
        return jsonify({'message': 'Bulk import successful'}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 400

def get_import_sample():
    sample_data = [
        ['ioc_value', 'ioc_type', 'threat_type', 'malware', 'malware_alias', 'malware_printable', 'first_seen_utc', 'confidence_level', 'tags', 'reporter'],
        ['example.com', 'domain', 'botnet', 'win', 'ExampleBot', 'Example Botnet', '2023-08-26T12:00:00Z', '80', 'botnet,malware', 'John Doe'],
        ['192.168.1.1', 'ip:port', 'c2', 'elf', 'LinuxMalware', 'Linux Malware', '2023-08-26T13:00:00Z', '90', 'linux,c2', 'Jane Smith'],
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(sample_data)
    return output.getvalue()