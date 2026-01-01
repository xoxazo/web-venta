import http.server
import socketserver
import json
import sqlite3
import os

PORT = int(os.environ.get("PORT", 8000))
DB_NAME = "ventas.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Tabla de configuraciones globales (tema, grupo activo)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Tabla de grupos (lotes de venta)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            name TEXT,
            date TEXT,
            exchangeRate REAL,
            manualTotalUsd REAL,
            manualExpensesUsd REAL
        )
    ''')
    
    # Tabla de artículos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            groupId TEXT,
            name TEXT,
            totalQuantity INTEGER,
            soldQuantity INTEGER,
            costUsd REAL,
            priceUsd REAL,
            FOREIGN KEY (groupId) REFERENCES groups (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/load':
            conn = sqlite3.connect(DB_NAME)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            try:
                # Cargar settings
                cursor.execute('SELECT * FROM settings')
                settings = {row['key']: row['value'] for row in cursor.fetchall()}
                
                # Cargar grupos
                cursor.execute('SELECT * FROM groups')
                groups_rows = cursor.fetchall()
                
                state = {
                    "activeGroupId": settings.get('activeGroupId', 'default'),
                    "theme": settings.get('theme', 'light'),
                    "groups": {}
                }
                
                for g_row in groups_rows:
                    g_id = g_row['id']
                    state['groups'][g_id] = {
                        "id": g_id,
                        "name": g_row['name'],
                        "date": g_row['date'],
                        "exchangeRate": g_row['exchangeRate'],
                        "manualTotalUsd": g_row['manualTotalUsd'],
                        "manualExpensesUsd": g_row['manualExpensesUsd'],
                        "articles": []
                    }
                    
                    # Cargar artículos de este grupo
                    cursor.execute('SELECT * FROM articles WHERE groupId = ?', (g_id,))
                    for a_row in cursor.fetchall():
                        state['groups'][g_id]['articles'].append({
                            "name": a_row['name'],
                            "totalQuantity": a_row['totalQuantity'],
                            "soldQuantity": a_row['soldQuantity'],
                            "costUsd": a_row['costUsd'],
                            "priceUsd": a_row['priceUsd']
                        })
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(state).encode())
                
            except Exception as e:
                print(f"Error loading: {e}")
                self.send_response(500)
                self.end_headers()
            finally:
                conn.close()
        else:
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            state = json.loads(post_data)
            
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            
            try:
                # Guardar settings
                cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('theme', state['theme']))
                cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('activeGroupId', state['activeGroupId']))
                
                # Guardar grupos y sus artículos
                cursor.execute('DELETE FROM articles')
                cursor.execute('DELETE FROM groups')
                
                for group_id, group in state['groups'].items():
                    cursor.execute('''
                        INSERT INTO groups (id, name, date, exchangeRate, manualTotalUsd, manualExpensesUsd)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (group['id'], group['name'], group['date'], group['exchangeRate'], group['manualTotalUsd'], group['manualExpensesUsd']))
                    
                    for art in group['articles']:
                        cursor.execute('''
                            INSERT INTO articles (groupId, name, totalQuantity, soldQuantity, costUsd, priceUsd)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', (group['id'], art['name'], art['totalQuantity'], art['soldQuantity'], art['costUsd'], art['priceUsd']))
                
                conn.commit()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode())
                
            except Exception as e:
                print(f"Error saving: {e}")
                self.send_response(500)
                self.end_headers()
            finally:
                conn.close()
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    init_db()
    print(f"Servidor SQL iniciado en http://localhost:{PORT}")
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        httpd.serve_forever()
