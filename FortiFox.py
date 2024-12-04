import json
import requests
import sqlite3
import csv
from datetime import datetime
import os
import uuid
import logging
import itertools
import re
from email.mime.text import MIMEText
import smtplib


# Setup logging
log_file = r"FortiFox.log"
logging.basicConfig(filename=log_file, level=logging.DEBUG, 
                    format='%(asctime)s %(levelname)s %(message)s')






###################################################################################################################
#DELETE THIS FUNCTION IF YOU DO NOT NEED EMAILS, ALSO DELETE send_mail FUNCTION FROM OTHER FUNCTIONS IF NOT NEEDED#
###################################################################################################################
# Function to send email
def send_mail(subject, body):
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = 'your.user@domain.com'
    msg['To'] = 'recipient@domain.com'

    try:
        smtp = smtplib.SMTP('mail.domain.com', 25)  # Initialize the SMTP object
        smtp.starttls()  # Secure the connection
        smtp.sendmail(msg['From'], msg['To'], msg.as_string())
        smtp.quit()
        logging.info(f'Email sent: {subject}')
    except Exception as e:
        logging.error(f'Error sending email: {e}')




# Function to defang IOC's
def defang_ioc(ioc):
    try:
        if '://' in ioc:
            parts = ioc.split('://', 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid URL format: {ioc}")
            protocol, domain_and_path = parts
            if '/' in domain_and_path:
                domain, path_and_query = domain_and_path.split('/', 1)
                path_and_query = '/' + path_and_query
            else:
                domain = domain_and_path
                path_and_query = ''
            defanged_domain = ' '.join(domain.replace('.', ' . ').split())
            defanged_ioc = f"{protocol}://{defanged_domain}{path_and_query}"
        else:
            defanged_ioc = ' '.join(ioc.replace('.', ' . ').split())
        return f"➸ {defanged_ioc}"
    except Exception as e:
        send_mail("Error in defanging IOC", f"The IOC that caused the problem: '{ioc}' \nThe error: {e}\n\n!!!!!!!!!!!!!ATTENTION!!!!!!!!!!!!!\nBECAREFUL TO NOT CLICK ON THE IOC, IT MAY BE CLICKABLE AS ITS MALFORMED ACCORDING TO THE PROGRAM, THEREFORE IT MIGHT NOT BE DEFANGED. YES THIS IS DrPwner SHOUTING AT U, PLEASE BECAREFUL.\n")
        logging.error(f"Error defanging IOC '{ioc}': {e}")
        return ioc  # Return the original IOC if defanging fails


# Database setup
try:
    conn = sqlite3.connect(r'ioc_database.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS iocs
                 (id INTEGER PRIMARY KEY, ioc_value TEXT, ioc_type TEXT, threat_type TEXT, malware TEXT, malware_alias TEXT, malware_printable TEXT, first_seen_utc TEXT, last_seen_utc TEXT, confidence_level INTEGER, reference TEXT, tags TEXT, anonymous TEXT, reporter TEXT, exported INTEGER DEFAULT 0, LuceneQueryCreated TEXT DEFAULT, KQLQueryCreated TEXT DEFAULT '0' '')''')
    logging.info('IOC database connected and table ensured')
except Exception as e:
    logging.error(f'Error connecting to IOC database: {e}')

# FortiLuceneThreatHunting database setup
try:
    conn_lucene = sqlite3.connect(r'FortiLuceneThreatHunting.db')
    c_lucene = conn_lucene.cursor()
    tables = ['SHA256_Hashes', 'SHA1_Hashes', 'MD5_Hashes', 'IP', 'Domains', 'URLs']
    for table in tables:
        c_lucene.execute(f'''CREATE TABLE IF NOT EXISTS {table}
                            (id INTEGER PRIMARY KEY, Query_Text TEXT, Created_At TEXT, Completed INTEGER DEFAULT 0, Hits INTEGER DEFAULT 0)''')
    logging.info('FortiLuceneThreatHunting database connected and tables ensured')
except Exception as e:
    send_mail('Error connecting to database', f'An error occurred while connecting to the database or creating the table:\n\n{str(e)}')
    logging.error(f'Error connecting to FortiLuceneThreatHunting database: {e}')

# Function to fetch recent IOCs from ThreatFox API
def fetch_recent_iocs():
    url = "https://threatfox.abuse.ch/export/json/recent/"
    response = requests.get(url)
    if response.status_code == 200:
        logging.info('Fetched recent IOCs successfully')
        return json.loads(response.text)
    else:
        error_msg = f"Error fetching recent IOCs: {response.status_code}"
        logging.error(error_msg)
        send_mail("Error fetching recent IOCs", f"There was an error in fetching ThreatFox API: {response.status_code}")
        
        return None

# Function to insert new IOCs into the database
def insert_new_iocs(iocs):
    new_iocs = []
    for ioc_id, ioc_data in iocs.items():
        for ioc in ioc_data:
            c.execute("SELECT id FROM iocs WHERE ioc_value = ?", (ioc["ioc_value"],))
            existing_ioc = c.fetchone()
            if not existing_ioc:
                c.execute("INSERT INTO iocs (ioc_value, ioc_type, threat_type, malware, malware_alias, malware_printable, first_seen_utc, last_seen_utc, confidence_level, reference, tags, anonymous, reporter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
                          (ioc["ioc_value"], ioc["ioc_type"], ioc["threat_type"], ioc["malware"], ioc["malware_alias"], ioc["malware_printable"], ioc["first_seen_utc"], ioc["last_seen_utc"], ioc["confidence_level"], ioc["reference"], ioc["tags"], ioc["anonymous"], ioc["reporter"]))
                new_iocs.append(ioc["ioc_value"])
    conn.commit()
    if new_iocs:
        logging.info(f"New IOCs to be defanged: {new_iocs}")
        defanged_iocs = "\n".join([defang_ioc(ioc) for ioc in new_iocs])
        send_mail("New IOCs added", f"New IOCs have been added to the database:\n\n{defanged_iocs}")
    else:
        send_mail("No new IOCs added", "No new IOCs were added to the database.")
        logging.info("No new IOCs were added to the database.")

# Function to generate CSV file for FortiEDR
def generate_csv_file():
    c.execute("SELECT ioc_value, malware_printable FROM iocs WHERE ioc_type = 'sha256_hash' AND exported = 0 AND (malware LIKE '%win%' OR malware = 'unknown')")
    iocs = c.fetchall()
    if not iocs:
        logging.info("No new SHA256 hashes to export.")
        return

    current_month_year = datetime.now().strftime("%Y-%m")
    top_level_folder = r"\IOC's"
    os.makedirs(top_level_folder, exist_ok=True)
    month_folder = os.path.join(top_level_folder, current_month_year)
    os.makedirs(month_folder, exist_ok=True)
    folder_name = f"FortiEDR_CSV_IOCs_{datetime.today().strftime('%Y-%m-%d')}"
    folder_path = os.path.join(month_folder, folder_name)
    os.makedirs(folder_path, exist_ok=True)

    current_datetime = datetime.now().strftime("%Y-%m-%d")
    uid = uuid.uuid4().hex[:8]
    filename = os.path.join(folder_path, f"{current_datetime}_TFOX-IOCs_TF{uid}.csv")
    
    try:
        csvfile = open(filename, 'w', newline='')
    except Exception as e:
        send_mail("Error creating CSV file", f"Could not create CSV file: {filename}\nError: {e}")
        logging.error(f"Error creating CSV file: {e}")
        return
    
    csv_writer = csv.writer(csvfile, delimiter=',')
    csv_writer.writerow(["Application name", "Hash", "Signer Thumbprint", "Signer name", "Path", "File name"])

    exported_iocs = []
    for i, ioc in enumerate(iocs, start=1):
        csv_writer.writerow([ioc[1], ioc[0], "", "", "", ""])
        exported_iocs.append(ioc[0])
        if i % 1997 == 0:
            csvfile.close()
            uid = uuid.uuid4().hex[:8]
            filename = os.path.join(folder_path, f"{current_datetime}_TFOX-IOCs_TF{uid}.csv")
            try:
                csvfile = open(filename, 'w', newline='')
            except Exception as e:
                logging.error(f"Error creating CSV file: {e}")
                send_mail("Error creating CSV file", f"Could not create CSV file: {filename}\nError: {e}")
                return
            csv_writer = csv.writer(csvfile, delimiter=',')
            csv_writer.writerow(["Application name", "Hash", "Signer Thumbprint", "Signer name", "Path", "File name"])

    csvfile.close()
    c.execute("UPDATE iocs SET exported = 1 WHERE ioc_type = 'sha256_hash' AND exported = 0 AND (malware LIKE '%win%' OR malware = 'unknown')")
    conn.commit()
    if exported_iocs:
        exported_iocs_str = "\n".join(exported_iocs)
        send_mail("CSV files created", f"CSV files with new IOCs have been created.\n\nExported IOCs:\n\n{exported_iocs_str}")
        logging.info("CSV files created and IOCs exported.")
    else:
        send_mail("No new IOCs exported", "No new IOCs were exported to CSV files.")
        logging.info("No new IOCs were exported to CSV files.")

# Function to generate Lucene queries and store them in FortiLuceneThreatHunting database
logging.basicConfig(filename='lucene_query_generation.log', level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')


def generate_kql_queries():
    log_file = r"kql_query_generation.log"
    logging.basicConfig(filename=log_file, level=logging.INFO,
                        format='%(asctime)s - %(levelname)s - %(message)s')
    templates = {
        
        'Domains': '''
        let malicious_domains = dynamic([
    {}
    // malicious domains added dynamically here
]);
union DnsEvents, DNSQueryLogs, DeviceNetworkEvents, EmailEvents, EmailUrlInfo, UrlClickEvents, ThreatIntelligenceIndicator
| where Name has_any (malicious_domains)
    or RemoteUrl has_any (malicious_domains)
    or Url has_any (malicious_domains)
    or DomainName has_any (malicious_domains)
| extend MatchedDomain = case(
    Name has_any (malicious_domains), Name,
    RemoteUrl has_any (malicious_domains), RemoteUrl,
    Url has_any (malicious_domains), Url,
    DomainName has_any (malicious_domains), DomainName,
    "Unknown"
)
| project TimeGenerated, Computer, ClientIP, SubType, Message, Name, RemoteUrl, Url, 
    Result, IPAddresses, MatchedDomain, DomainName
| sort by TimeGenerated desc

''',


        'IP': '''
        
        
let IPIOCs = dynamic([

    // malicious IP's added dynamically here
]);
union 
    DeviceNetworkEvents, 
    EmailEvents, 
    ThreatIntelligenceIndicator, 
    DnsEvents, 
    AzureActivity, 
    AzureNetworkAnalytics_CL, 
    VMConnection, 
    UrlClickEvents
| where RemoteIP in (IPIOCs)
    or SenderIPv4 in (IPIOCs)
    or SenderIPv6 in (IPIOCs)
    or NetworkIP in (IPIOCs)
    or NetworkSourceIP in (IPIOCs)
    or IPAddress in (IPIOCs)
    or CallerIPAddress in (IPIOCs)
    or PublicIPs_s in (IPIOCs)
| extend MatchedIP = case(
    RemoteIP in (IPIOCs), RemoteIP,
    SenderIPv4 in (IPIOCs), SenderIPv4,
    SenderIPv6 in (IPIOCs), SenderIPv6,
    NetworkIP in (IPIOCs), NetworkIP,
    NetworkSourceIP in (IPIOCs), NetworkSourceIP,
    IPAddress in (IPIOCs), IPAddress,
    CallerIPAddress in (IPIOCs), CallerIPAddress,
    PublicIPs_s in (IPIOCs), PublicIPs_s,
    "Unknown"
)
| project TimeGenerated, ActionType, DeviceName, RemoteIP, RemoteUrl, 
    SenderIPv4, SenderIPv6, InitiatingProcessFileName, InitiatingProcessFolderPath, 
    InitiatingProcessCommandLine, InitiatingProcessMD5, 
    SenderFromAddress, RecipientEmailAddress, Subject,
    MatchedIP, NetworkIP, NetworkSourceIP, IPAddress, 
    CallerIPAddress, PublicIPs_s
| sort by TimeGenerated desc
''',
        'MD5_Hashes': '''
let MD5_IOCs = dynamic([
    {}
    // Add more MD5 hashes here as needed
]);
union 
    (DeviceEvents 
    | where MD5 in~ (MD5_IOCs)
    | extend MatchedHash = MD5, EventType = "DeviceEvents"),
    (DeviceFileEvents 
    | where MD5 in~ (MD5_IOCs)
    | extend MatchedHash = MD5, EventType = "DeviceFileEvents"),
    (SecurityEvent 
    | where FileHash in~ (MD5_IOCs)
    | extend MatchedHash = FileHash, EventType = "SecurityEvent")
| project TimeGenerated, EventType, MatchedHash, 
    DeviceEvents_DeviceName = iif(EventType == "DeviceEvents", DeviceName, ""),
    DeviceFileEvents_DeviceName = iif(EventType == "DeviceFileEvents", DeviceName, ""),
    DeviceEvents_FileName = iif(EventType == "DeviceEvents", FileName, ""),
    DeviceFileEvents_FileName = iif(EventType == "DeviceFileEvents", FileName, ""),
    SecurityEvent_Computer = iif(EventType == "SecurityEvent", Computer, ""),
    InitiatingProcessFileName, InitiatingProcessCommandLine
| sort by TimeGenerated desc
''',
        'SHA1_Hashes': '''
let SHA1_IOCs = dynamic([
    {}
    // Add more SHA1 hashes here as needed
]);
union 
    (DeviceEvents 
    | where SHA1 in~ (SHA1_IOCs)
    | extend MatchedHash = SHA1, EventType = "DeviceEvents"),
    (DeviceFileCertificateInfo 
    | where SHA1 in~ (SHA1_IOCs)
    | extend MatchedHash = SHA1, EventType = "DeviceFileCertificateInfo"),
    (DeviceFileEvents 
    | where SHA1 in~ (SHA1_IOCs)
    | extend MatchedHash = SHA1, EventType = "DeviceFileEvents"),
    (SecurityEvent 
    | where FileHash in~ (SHA1_IOCs)
    | extend MatchedHash = FileHash, EventType = "SecurityEvent")
| project TimeGenerated, EventType, MatchedHash, 
    DeviceEvents_DeviceName = iif(EventType == "DeviceEvents", DeviceName, ""),
    DeviceFileEvents_DeviceName = iif(EventType == "DeviceFileEvents", DeviceName, ""),
    DeviceEvents_FileName = iif(EventType == "DeviceEvents", FileName, ""),
    DeviceFileEvents_FileName = iif(EventType == "DeviceFileEvents", FileName, ""),
    SecurityEvent_Computer = iif(EventType == "SecurityEvent", Computer, ""),
    InitiatingProcessFileName, InitiatingProcessCommandLine
| sort by TimeGenerated desc
''',
        'SHA256_Hashes': '''
let SHA256_IOCs = dynamic([
    {}
    // Add more SHA256 hashes here as needed
]);
union 
    (DeviceEvents 
    | where SHA256 in~ (SHA256_IOCs)
    | extend MatchedHash = SHA256, EventType = "DeviceEvents"),
    (DeviceFileEvents 
    | where SHA256 in~ (SHA256_IOCs)
    | extend MatchedHash = SHA256, EventType = "DeviceFileEvents"),
    (EmailAttachmentInfo 
    | where SHA256 in~ (SHA256_IOCs)
    | extend MatchedHash = SHA256, EventType = "EmailAttachmentInfo"),
    (SecurityEvent 
    | where FileHash in~ (SHA256_IOCs)
    | extend MatchedHash = FileHash, EventType = "SecurityEvent")
| project TimeGenerated, EventType, MatchedHash, 
    DeviceEvents_DeviceName = iif(EventType == "DeviceEvents", DeviceName, ""),
    DeviceFileEvents_DeviceName = iif(EventType == "DeviceFileEvents", DeviceName, ""),
    DeviceEvents_FileName = iif(EventType == "DeviceEvents", FileName, ""),
    DeviceFileEvents_FileName = iif(EventType == "DeviceFileEvents", FileName, ""),
    EmailAttachmentInfo_FileName = iif(EventType == "EmailAttachmentInfo", FileName, ""),
    SecurityEvent_Computer = iif(EventType == "SecurityEvent", Computer, ""),
    SenderFromAddress = iif(EventType == "EmailAttachmentInfo", SenderFromAddress, ""),
    RecipientEmailAddress = iif(EventType == "EmailAttachmentInfo", RecipientEmailAddress, ""),
    InitiatingProcessFileName, InitiatingProcessCommandLine
| sort by TimeGenerated desc
''',
        'URLs': '''
        
        
        
let IPIOCs = dynamic([
	{}
    // malicious IP's added dynamically here
]);
union 
    DeviceNetworkEvents, 
    EmailEvents, 
    ThreatIntelligenceIndicator, 
    DnsEvents, 
    AzureActivity, 
    AzureNetworkAnalytics_CL, 
    VMConnection, 
    UrlClickEvents
| where RemoteIP in (IPIOCs)
    or SenderIPv4 in (IPIOCs)
    or SenderIPv6 in (IPIOCs)
    or NetworkIP in (IPIOCs)
    or NetworkSourceIP in (IPIOCs)
    or IPAddress in (IPIOCs)
    or CallerIPAddress in (IPIOCs)
    or PublicIPs_s in (IPIOCs)
| extend MatchedIP = case(
    RemoteIP in (IPIOCs), RemoteIP,
    SenderIPv4 in (IPIOCs), SenderIPv4,
    SenderIPv6 in (IPIOCs), SenderIPv6,
    NetworkIP in (IPIOCs), NetworkIP,
    NetworkSourceIP in (IPIOCs), NetworkSourceIP,
    IPAddress in (IPIOCs), IPAddress,
    CallerIPAddress in (IPIOCs), CallerIPAddress,
    PublicIPs_s in (IPIOCs), PublicIPs_s,
    "Unknown"
)
| project TimeGenerated, ActionType, DeviceName, RemoteIP, RemoteUrl, 
    SenderIPv4, SenderIPv6, InitiatingProcessFileName, InitiatingProcessFolderPath, 
    InitiatingProcessCommandLine, InitiatingProcessMD5, 
    SenderFromAddress, RecipientEmailAddress, Subject,
    MatchedIP, NetworkIP, NetworkSourceIP, IPAddress, 
    CallerIPAddress, PublicIPs_s
| sort by TimeGenerated desc
'''
    }
    
    
    ioc_types = [
        ('ip:port', 'IP', 5000),
        ('url', 'URLs', 5000),
        ('domain', 'Domains', 5000),
        ('md5_hash', 'MD5_Hashes', 5000),
        ('sha1_hash', 'SHA1_Hashes', 5000),
        ('sha256_hash', 'SHA256_Hashes', 5000)
    ]

    conn = sqlite3.connect('ioc_database.db')
    c = conn.cursor()

    conn_kql = sqlite3.connect('MS_KQL_ThreatHunting.db')
    c_kql = conn_kql.cursor()

    for ioc_type, table_name, limit in ioc_types:
        logging.info(f"Processing {ioc_type} IOCs")
        
        while True:
            # Fetch a batch of IOCs
            c.execute(f"SELECT ioc_value FROM iocs WHERE ioc_type = ? AND KQLQueryCreated = '0' LIMIT ?", (ioc_type, limit))
            iocs = c.fetchall()
            
            if not iocs:
                logging.info(f"No more {ioc_type} IOCs to process.")
                break

            values = []
            for ioc in iocs:
                if ioc_type == 'ip:port':
                    ioc = ioc[0].split(':')[0]  # Remove port from IP
                else:
                    ioc = ioc[0]
                values.append(f'    "{ioc}"')

            # Generate KQL query
            ioc_list = ',\n'.join(values)
            query = templates[table_name].format(ioc_list)
            
            # Store KQL query
            c_kql.execute(f"INSERT INTO {table_name} (Query_Text, Created_At) VALUES (?, ?)",
                          (query, datetime.now().isoformat()))
            
            # Update processed IOCs
            placeholders = ','.join(['?'] * len(iocs))
            c.execute(f"UPDATE iocs SET KQLQueryCreated = '1' WHERE ioc_value IN ({placeholders})",
                      [ioc[0] for ioc in iocs])
            conn.commit()
            conn_kql.commit()
            
            logging.info(f"Processed batch of {len(iocs)} {ioc_type} IOCs")

    conn.close()
    conn_kql.close()
    logging.info("KQL queries generation completed")

def generate_lucene_queries():
    log_file = r"lucene_query_generation.log"
    logging.basicConfig(filename=log_file, level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
    ioc_types = [
        ('ip:port', 'IP', 'RemoteIP:({})', 900),
        ('url', 'URLs', 'Target.Network.DNS:("{}")', 800),
        ('domain', 'Domains', 'Target.Network.DNS:("{}")', 900),
        ('md5_hash', 'MD5_Hashes', 'Source.Process.File.MD5:({})', 800),
        ('sha1_hash', 'SHA1_Hashes', 'Source.Process.File.SHA1:({})', 800),
        ('sha256_hash', 'SHA256_Hashes', 'Source.Process.File.SHA256:({})', 700)
    ]

    conn = sqlite3.connect('ioc_database.db')
    c = conn.cursor()

    conn_lucene = sqlite3.connect('FortiLuceneThreatHunting.db')
    c_lucene = conn_lucene.cursor()

    for ioc_type, table_name, query_template, limit in ioc_types:
        logging.info(f"Processing {ioc_type} IOCs")
        
        while True:
            # Fetch a batch of IOCs
            c.execute(f"SELECT ioc_value FROM iocs WHERE ioc_type = ? AND LuceneQueryCreated = '0' LIMIT ?", (ioc_type, limit))
            iocs = c.fetchall()
            
            if not iocs:
                logging.info(f"No more {ioc_type} IOCs to process.")
                break

            values = []
            for ioc in iocs:
                if ioc_type == 'ip:port':
                    ioc = ioc[0].split(':')[0]  # Remove port from IP
                else:
                    ioc = ioc[0]
                values.append(ioc)

            # Generate and store Lucene query
            if ioc_type in ['url', 'domain']:
                query = query_template.format('" OR "'.join(values))
            else:
                query = query_template.format(' OR '.join(values))
            
            c_lucene.execute(f"INSERT INTO {table_name} (Query_Text, Created_At) VALUES (?, ?)",
                             (query, datetime.now().isoformat()))
            
            # Update processed IOCs
            placeholders = ','.join(['?'] * len(iocs))
            c.execute(f"UPDATE iocs SET LuceneQueryCreated = '1' WHERE ioc_value IN ({placeholders})", 
                      [ioc[0] for ioc in iocs])

            conn.commit()
            conn_lucene.commit()
            
            logging.info(f"Processed batch of {len(iocs)} {ioc_type} IOCs")

    conn.close()
    conn_lucene.close()
    logging.info("Lucene queries generation completed")
        
def main():
   logging.info("Script started.")
   recent_iocs = fetch_recent_iocs()
   if recent_iocs:
      insert_new_iocs(recent_iocs)
   generate_csv_file()
   generate_lucene_queries()
   generate_kql_queries()
   logging.info("Script finished.")

if __name__ == "__main__":
    main()