from flask import Flask, render_template, request, jsonify, Response
import sqlite3
from query_builder import QueryBuilder
import io
import csv
from datetime import datetime
from werkzeug.utils import secure_filename
from setup_database_Lucene_TH import setup_threat_hunting_database
from setup_database_kql_TH import setup_kql_threat_hunting_database
from FortiFox_Visualization_Interaction import search_iocs, get_more_results, add_ioc, bulk_import_iocs, get_import_sample
import re
import logging


########################################
########################################
########################################
#########Query Builder Set-up###########
########################################
########################################
########################################
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
query_builder = QueryBuilder()


def get_db_connection():
    conn = sqlite3.connect(r'FortiLucene.db')
    conn.row_factory = sqlite3.Row
    return conn

# Map space-separated display names to actual table names
CATEGORY_MAP = {
    "Process Information Queries": "ProcessInformation",
    "Network Information Queries": "NetworkInformation",
    "Basic File Information Queries": "FileInformationBasic",
    "Advanced File Information Queries": "FileInformationAdvanced",
    "General Device Information Queries": "GeneralDeviceInformation",
    "Event Information Queries": "EventInformation",
    "Registry Information Queries": "RegistryInformation",
    "MITRE Queries": "MITREinformation",
    "Cloud Container Information Queries": "CloudContainerInformation"
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_categories')
def get_categories():
    # Return the display names (space-separated)
    categories = list(CATEGORY_MAP.keys())
    return jsonify(categories)

@app.route('/get_queries/<category>')
def get_queries(category):
    # Convert the display name to the actual table name
    table_name = CATEGORY_MAP.get(category)
   
    if not table_name:
        return jsonify({"error": "Invalid category"}), 400

    conn = get_db_connection()
    queries = conn.execute(f'SELECT FamilyFriendlyQuery, BuiltInQuery FROM {table_name}').fetchall()
    conn.close()
    return jsonify([{'friendly': q['FamilyFriendlyQuery'], 'builtin': q['BuiltInQuery']} for q in queries])

@app.route('/build_query', methods=['POST'])
def build_query():
    data = request.json
    query_builder.clear()
   
    for query_part in data['query_parts']:
        query_operator = query_part['queryOperator']
        builtin = query_part['builtin']
        value = query_part['value']
        operator = query_part['operator']

        # Split the value by operators while keeping the operators
        parts = re.split(r'(\s*(?:&&|\|\||TO)\s*)', value)
        
        quoted_values = []
        for part in parts:
            stripped_part = part.strip()
            if stripped_part in ['&&', '||', 'TO']:
                quoted_values.append(stripped_part)
            else:
                # Remove existing quotes if present and add new quotes
                cleaned_part = stripped_part.strip('"')
                quoted_values.append(f'"{cleaned_part}"')

        quoted_value = ' '.join(quoted_values)

        if query_operator != '→':
            if query_operator in ['-', '!']:
                builtin = f"{query_operator}{builtin}"
            elif query_operator == 'NOT':
                builtin = f"NOT {builtin}"
       
        query_builder.add_query_part(builtin, quoted_value, operator)
   
    query = query_builder.build_query()
   
    if not query_builder.validate_query(query):
        return jsonify({"error": "Invalid query constructed"}), 400
   
    return jsonify({"query": query})


########################################
########################################
########################################
######FortiLucene DB Visualization######
########################################
########################################
########################################

@app.route('/get_database_content')
def get_database_content():
    conn = get_db_connection()
    content = {}
    tables = ['SavedQueries', 'ProcessInformation', 'NetworkInformation', 'FileInformationBasic', 'FileInformationAdvanced', 'GeneralDeviceInformation', 'EventInformation', 'MITREinformation', 'CloudContainerInformation']
    
    for table in tables:
        rows = conn.execute(f'SELECT * FROM {table}').fetchall()
        content[table] = [dict(row) for row in rows]  # Convert Row objects to dictionaries
    
    conn.close()
    return jsonify(content)

@app.route('/edit_query', methods=['POST'])
def edit_query():
    data = request.json
    conn = get_db_connection()
    try:
        conn.execute(f"UPDATE {data['table']} SET FamilyFriendlyQuery = ?, BuiltInQuery = ? WHERE ID = ?",
                     (data['familyFriendly'], data['builtIn'], data['id']))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
    finally:
        conn.close()

@app.route('/delete_query', methods=['POST'])
def delete_query():
    data = request.json
    conn = get_db_connection()
    try:
        conn.execute(f"DELETE FROM {data['table']} WHERE ID = ?", (data['id'],))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
    finally:
        conn.close()

@app.route('/save_custom_query', methods=['POST'])
def save_custom_query():
    data = request.json
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO SavedQueries (FamilyFriendlyQuery, BuiltInQuery) VALUES (?, ?)",
                     (data['name'], data['query']))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
    finally:
        conn.close()


@app.route('/export_saved_queries')
def export_saved_queries():
    conn = get_db_connection()
    queries = conn.execute('SELECT FamilyFriendlyQuery, BuiltInQuery FROM SavedQueries').fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['FamilyFriendlyQuery', 'BuiltInQuery'])  # CSV Header
    for query in queries:
        writer.writerow([query['FamilyFriendlyQuery'], query['BuiltInQuery']])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=SavedQueries Export - {datetime.now().strftime('%Y-%m-%d - %H-%M-%S')}.csv"}
    )

@app.route('/import_saved_queries', methods=['POST'])
def import_saved_queries():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"})
    
    if file and file.filename.endswith('.csv'):
        try:
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_input = csv.reader(stream)
            header = next(csv_input)  # Skip the header row
            
            if header != ['FamilyFriendlyQuery', 'BuiltInQuery']:
                return jsonify({"success": False, "error": "Invalid CSV format"})

            conn = get_db_connection()
            for row in csv_input:
                conn.execute('INSERT INTO SavedQueries (FamilyFriendlyQuery, BuiltInQuery) VALUES (?, ?)', (row[0], row[1]))
            conn.commit()
            conn.close()

            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})
    else:
        return jsonify({"success": False, "error": "Invalid file type. Please upload a CSV file."})

########################################
########################################
########################################
#########Lucene TH Integration##########
########################################
########################################
########################################

@app.route('/get_threat_hunting_tables')
def get_threat_hunting_tables():
    tables = ['Domains', 'IP', 'MD5_Hashes', 'SHA1_Hashes', 'SHA256_Hashes', 'URLs', 'Checked_Threat_Hunting_Queries']
    return jsonify(tables)


@app.route('/get_threat_hunting_data/<table_name>')
def get_threat_hunting_data(table_name):
    conn = sqlite3.connect('FortiLuceneThreatHunting.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        if table_name == 'Checked_Threat_Hunting_Queries':
            cursor.execute('''SELECT * FROM Checked_Threat_Hunting_Queries''')
        else:
            cursor.execute(f'''SELECT 
                              id, 
                              CASE 
                                WHEN LENGTH(Query_Text) > 50 
                                THEN '{table_name} Threat Hunting Query #' || id
                                ELSE Query_Text 
                              END AS Query_Text, 
                              Created_At, 
                              Completed,
                              Hits
                           FROM {table_name}
                           WHERE Completed IS NULL OR Completed NOT LIKE 'Checked at%'
                           ORDER BY id''')
        
        data = [dict(row) for row in cursor.fetchall()]
        
        if not data:
            return jsonify({"message": f"No data found in {table_name}", "data": []})
        
        return jsonify({"message": "Data retrieved successfully", "data": data})
    except sqlite3.OperationalError as e:
        return jsonify({"error": str(e), "message": f"Error accessing {table_name}"})
    finally:
        conn.close()

@app.route('/update_threat_hunting_query', methods=['POST'])
def update_threat_hunting_query():
    data = request.json
    table_name = data['table_name']
    query_id = data['query_id']
    completed = data['completed']
    hits = data['hits']
    
    conn = sqlite3.connect('FortiLuceneThreatHunting.db')
    cursor = conn.cursor()
    
    # Update the original table
    cursor.execute(f'''UPDATE {table_name} 
                      SET Completed = ?, Hits = ? 
                      WHERE id = ?''', (completed, hits, query_id))
    
    # If marked as complete, insert into Checked_Threat_Hunting_Queries
    if completed:
        cursor.execute(f'''SELECT Query_Text FROM {table_name} WHERE id = ?''', (query_id,))
        query_text = cursor.fetchone()[0]
        cursor.execute('''INSERT INTO Checked_Threat_Hunting_Queries (Type, Date_Checked, Hits)
                          VALUES (?, ?, ?)''', (f"{table_name} Threat Hunting Query #{query_id}", completed, hits))
    
    conn.commit()
    conn.close()
    
    return jsonify({"success": True})

@app.route('/get_full_query_text/<table_name>/<int:query_id>')
def get_full_query_text(table_name, query_id):
    conn = sqlite3.connect('FortiLuceneThreatHunting.db')
    cursor = conn.cursor()
    
    cursor.execute(f'''SELECT Query_Text FROM {table_name} WHERE id = ?''', (query_id,))
    query_text = cursor.fetchone()[0]
    
    conn.close()
    
    return jsonify({"query_text": query_text})

# Add this to ensure the Checked_Threat_Hunting_Queries table exists
def create_checked_queries_table():
    conn = sqlite3.connect('FortiLuceneThreatHunting.db')
    cursor = conn.cursor()
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS Checked_Threat_Hunting_Queries
                      (id INTEGER PRIMARY KEY, 
                       Type TEXT, 
                       Date_Checked TEXT, 
                       Hits TEXT)''')
    
    conn.commit()
    conn.close()
    
    
########################################
########################################
########################################
###########KQL TH Integration###########
########################################
########################################
########################################

#get kql threathunting tables
@app.route('/get_kql_threat_hunting_tables')
def get_kql_threat_hunting_tables():
    tables = ['Domains', 'IP', 'MD5_Hashes', 'SHA1_Hashes', 'SHA256_Hashes', 'URLs', 'Checked_KQL_Threat_Hunting_Queries']
    return jsonify(tables)

#get kql threathunting data
@app.route('/get_kql_threat_hunting_data/<table_name>')
def get_kql_threat_hunting_data(table_name):
    conn = sqlite3.connect('MS_KQL_ThreatHunting.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        if table_name == 'Checked_KQL_Threat_Hunting_Queries':
            cursor.execute('''SELECT * FROM Checked_KQL_Threat_Hunting_Queries''')
        else:
            cursor.execute(f'''SELECT
                              id,
                              CASE
                                WHEN LENGTH(Query_Text) > 50
                                THEN '{table_name} KQL Threat Hunting Query #' || id
                                ELSE Query_Text
                              END AS Query_Text,
                              Created_At,
                              Completed,
                              Hits
                           FROM {table_name}
                           WHERE Completed IS NULL OR Completed NOT LIKE 'Checked at%'
                           ORDER BY id''')
        
        data = [dict(row) for row in cursor.fetchall()]
        
        if not data:
            return jsonify({"message": f"No data found in {table_name}", "data": []})
        
        return jsonify({"message": "Data retrieved successfully", "data": data})
    except sqlite3.OperationalError as e:
        return jsonify({"error": str(e), "message": f"Error accessing {table_name}"})
    finally:
        conn.close()

# to update kql threat hunting (when user marks as complete)
@app.route('/update_kql_threat_hunting_query', methods=['POST'])
def update_kql_threat_hunting_query():
    data = request.json
    table_name = data['table_name']
    query_id = data['query_id']
    completed = data['completed']
    hits = data['hits']
    
    conn = sqlite3.connect('MS_KQL_ThreatHunting.db')
    cursor = conn.cursor()
    
    # Update the original table
    cursor.execute(f'''UPDATE {table_name}
                      SET Completed = ?, Hits = ?
                      WHERE id = ?''', (completed, hits, query_id))
    
    # If marked as complete, insert into Checked_KQL_Threat_Hunting_Queries
    if completed:
        cursor.execute(f'''SELECT Query_Text FROM {table_name} WHERE id = ?''', (query_id,))
        query_text = cursor.fetchone()[0]
        cursor.execute('''INSERT INTO Checked_KQL_Threat_Hunting_Queries (Type, Date_Checked, Hits)
                          VALUES (?, ?, ?)''', (f"{table_name} KQL Threat Hunting Query #{query_id}", completed, hits))
    
    conn.commit()
    conn.close()
    
    return jsonify({"success": True})

#get full query text (for copy function in frontend)
@app.route('/get_full_kql_query_text/<table_name>/<int:query_id>')
def get_full_kql_query_text(table_name, query_id):
    conn = sqlite3.connect('MS_KQL_ThreatHunting.db')
    cursor = conn.cursor()
    
    cursor.execute(f'''SELECT Query_Text FROM {table_name} WHERE id = ?''', (query_id,))
    query_text = cursor.fetchone()[0]
    
    conn.close()
    
    return jsonify({"query_text": query_text})

########################################
########################################
########################################
##########FortiFox Integration##########
########################################
########################################
########################################



def get_db_connection_FortiFox():
    try:
        conn = sqlite3.connect('ioc_database.db')
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        logging.error(f"Database connection error: {str(e)}")
        raise


@app.route('/search_iocs')
def search_iocs_route():
    query = request.args.get('query', '')
    try:
        results, has_more = search_iocs(query, 0)
        return jsonify({"results": results, "has_more": has_more})
    except Exception as e:
        logging.error(f"Error in search_iocs_route: {str(e)}")
        return jsonify({"error": f"An error occurred while searching IOCs: {str(e)}"}), 500


def search_iocs(query, offset):
    try:
        conn = get_db_connection_FortiFox()
        cursor = conn.cursor()
        
        query = query.replace('*', '%').replace('?', '_')
        
        sql = """
        SELECT * FROM iocs
        WHERE LOWER(ioc_value) LIKE LOWER(?)
        ORDER BY ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc DESC
        LIMIT 101
        OFFSET ?
        """
        
        cursor.execute(sql, (f"%{query}%", offset))
        results = cursor.fetchall()
        
        has_more = len(results) > 100
        if has_more:
            results = results[:100]
        
        conn.close()
        
        return [dict(row) for row in results], has_more
    except Exception as e:
        logging.error(f"Error in search_iocs: {str(e)}")
        raise

@app.route('/check_db')
def check_db():
    try:
        conn = get_db_connection_FortiFox()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='iocs'")
        table_exists = cursor.fetchone() is not None
        conn.close()
        if table_exists:
            return jsonify({"status": "OK", "message": "iocs table exists"}), 200
        else:
            return jsonify({"status": "Error", "message": "iocs table does not exist"}), 404
    except Exception as e:
        logging.error(f"Error checking database: {str(e)}")
        return jsonify({"status": "Error", "message": str(e)}), 500


@app.route('/get_more_results')
def get_more_results_route():
    query = request.args.get('query', '')
    offset = int(request.args.get('offset', 0))
    results, has_more = search_iocs(query, offset)
    return jsonify({"results": results, "has_more": has_more})

@app.route('/add_ioc', methods=['POST'])
def add_ioc_route():
    return add_ioc(request.json)

@app.route('/bulk_import_iocs', methods=['POST'])
def bulk_import_iocs_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and file.filename.endswith('.csv'):
        return bulk_import_iocs(file)
    else:
        return jsonify({'error': 'Invalid file type. Please upload a CSV file.'}), 400

@app.route('/get_import_sample')
def get_import_sample_route():
    return Response(
        get_import_sample(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=ioc_import_sample.csv"}
    )


def init_app():
    setup_kql_threat_hunting_database()
    setup_threat_hunting_database()



if __name__ == '__main__':
    init_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
    #app.run(debug=True)
