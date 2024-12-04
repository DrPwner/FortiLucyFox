import sqlite3

class QueryBuilder:
    def __init__(self):
        self.query_parts = []
        self.operators = ["AND", "OR", "NOT", "NULL"]

    def get_db_connection(self):
        conn = sqlite3.connect('FortiLucene.db')
        conn.row_factory = sqlite3.Row
        return conn

    def get_field_mapping(self, field_title):
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT BuiltInQuery FROM GeneralDeviceInformation
                UNION ALL
                SELECT BuiltInQuery FROM CloudContainerInformation
                UNION ALL
                SELECT BuiltInQuery FROM EventInformation
                UNION ALL
                SELECT BuiltInQuery FROM ProcessInformation
                UNION ALL
                SELECT BuiltInQuery FROM FileInformationBasic
                UNION ALL
                SELECT BuiltInQuery FROM FileInformationAdvanced
                UNION ALL
                SELECT BuiltInQuery FROM MITREinformation
                UNION ALL                
                SELECT BuiltInQuery FROM NetworkInformation
                UNION ALL
                SELECT BuiltInQuery FROM RegistryInformation
                WHERE BuiltInQuery = ?
            """, (field_title,))
            result = cursor.fetchone()
        return result['BuiltInQuery'] if result else None

    def add_query_part(self, field: str, value: str, operator: str = ""):
        if operator not in self.operators:
            raise ValueError(f"Invalid operator: {operator}")
        
        query_part = f"{field}:({value})"
        self.query_parts.append((query_part, operator))

    def build_query(self) -> str:
        if not self.query_parts:
            return ""

        query = self.query_parts[0][0]  # Start with the first query part
        
        for i in range(1, len(self.query_parts)):
            previous_operator = self.query_parts[i-1][1]
            current_part = self.query_parts[i][0]
            
            if previous_operator != "NULL":
                query += f" {previous_operator} "
            else:
                query += " "  # Add a space if the previous operator was NULL
            
            query += current_part

        return query

    def clear(self):
        self.query_parts = []

    def validate_query(self, query: str) -> bool:
        balanced_parentheses = query.count('(') == query.count(')')
        valid_operators = all(op in self.operators for op in query.split() if op.upper() in self.operators)
        return balanced_parentheses and valid_operators