# FortiLucyFox: Unified Threat Intelligence and Query Building Platform
![Project Work Flow](https://github.com/user-attachments/assets/9468bdf6-a3b7-45ca-9ea1-38e886b2149c)

## Project Overview

**FortiLucyFox** is an advanced cybersecurity solution that seamlessly integrates two powerful tools to revolutionize threat intelligence and hunting capabilities:

### FortiFox: Threat Intelligence Aggregation
- **Purpose**: A sophisticated threat intelligence aggregation tool
- **Core Functionality**: Extracts and maintains a comprehensive, dynamic database of Indicators of Compromise (IOCs) from ThreatFox
- **Key Benefit**: Provides real-time, continuously updated threat intelligence data

### FortiLucene: Query Building Ecosystem
- **Purpose**: An intuitive web application for constructing advanced FortiEDR threat hunting queries
- **Core Functionality**: Simplifies the creation of complex Lucene queries for FortiEDR
- **Key Benefit**: Streamlines log analysis and threat hunting processes with a user-friendly interface

## Unified Solution: FortiLucyFox

**FortiLucyFox** represents the next evolution in threat intelligence management by combining these powerful tools into a single, cohesive platform:

- **Centralized Threat Intelligence Database**: Populated with the latest IOCs from ThreatFox
- **Advanced Query Generation**: Automatic creation of:
  - Azure Sentinel KQL Threat Hunting queries
  - FortiEDR Lucene Threat Hunting queries
- **Seamless Integration**: A unified interface that transforms threat intelligence gathering and analysis
- **Automated Enrichment**: Continuously updates threat hunting capabilities with the most recent threat data


## ✨ Features

- **Interactive Query Building**: Easily select the queries depending on your case.
- **Category-based Query Selection**: Organized query options based on information categories
- **Query Validation**: Ensures syntactically correct queries
- **Copy to Clipboard**: Easy export of finished queries
- **Import Feature**: Bulk import values for query construction
- **Help Menu**: Built-in guide for query syntax and examples
- **Save Queries**: Ability to save built Queries in a dedicated Table in the backend.
- **Import & Export**: Easily Export your Saved Queries and for back up, or share it with a friend (this is where the Import option takes place :) )
- **Real-time threat intelligence aggregation**
- **Intuitive query building interface**
- **Automated query generation**
- **Comprehensive IOC database**
- **Simplified Threat Hunting workflow**



## 🏁 Getting Started

### Prerequisites

- Python 3.X
- Flask
- SQLite3


## Deployment

- Download the Full Threat Fox IOC DUMP -> https://threatfox.abuse.ch/export/json/full/
- Place downloaded .json Dump in a folder that must contain the database and the InsertDump.py script.
- Run InsertDump.py, this program will rapidly insert all the IOC's from the downloaded .json dump into the database.
- run FortiFox.py
- download the nessecary libraries in app.py
- Create the databases from the provided python scripts or download the nessecary database files from this repository.
- run app.py
- Apologies for the little info, please read the note at the very end.

## 📥 Import Feature

The import feature allows you to bulk import values for your queries. Here's how to use it:

1. Prepare a text file with your values, one per line.
2. In the query builder, click on the " ⋮ " next to the value input field.
3. Select "Import" from the dropdown.
4. Choose an operator for combining the imported values.
5. Select your prepared text file. (Make sure values inside text file are Bellow each other... seperated by new line)

Example import file content for IP addresses:


https://github.com/user-attachments/assets/146183ee-24f9-49a8-a126-f0bc48677fb4




After import, your query might look like:
```
NOT RemoteIP:(143.109.206.41 OR 192.98.127.57 OR 203.172.54.84 OR 58.183.240.171 OR 111.42.78.233 OR 150.123.98.207 OR 176.98.23.45 OR 207.66.142.89 OR 89.204.111.254 OR 62.185.30.14 OR 185.173.98.140 OR 94.199.7.120 OR 52.232.64.91 OR 139.87.123.220 OR 165.77.53.9 OR 
 200.88.29.182 OR 91.32.174.105 OR 215.120.65.240 OR 68.74.12.197 OR 159.189.77.32)
```

Note that the import feature is not strictly for IP's, it can be useful for anything. For example, creating a query to look for a handful of MTIRE TTP's.


## Note

Although this project was completed some time ago, I’ve put in my best effort to provide thorough documentation for deployment and usage. Revisiting an older project can be a challenge, especially after stepping away from its active development, but I’ll continue to add more details whenever possible. I’m just a cyber dude with some development skills, but if you’ve made it this far, I believe we are alike, a quick code review on FortiFox and FortiLucene should explain how to deploy the project.

To fully understand **FortiLucyFox**, it’s helpful to take a look at the two core components that this project integrates:

- **[FortiFox](https://github.com/DrPwner/FortiFox)**: A robust threat intelligence aggregation tool that pulls and maintains IOCs.
- **[FortiLucene](https://github.com/DrPwner/FortiLucene)**: A user-friendly web application designed for building complex Lucene queries for advanced threat hunting.

These projects provide essential context and details that will give you a deeper understanding of how **FortiLucyFox** brings their functionality together in a unified platform.

If you have any questions or need further information about **FortiLucyFox**, feel free to reach out to me on Linkedin listed on my profile. I truly appreciate your interest and understanding.

Thank you for checking out the project, and I hope it helps.

Long live The Open Source Community.
