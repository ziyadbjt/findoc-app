import sqlite3
from datetime import datetime

conn = sqlite3.connect('findoc.db')
cursor = conn.cursor()

# Insert user
email = 'ziyad@cabinetchami.ma'
hashed_password = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPjYQmH1T8mC'  # for password123
nom = 'Ziyad'
role = 'admin'
created_at = datetime.utcnow().isoformat()

cursor.execute('''
INSERT INTO users (email, hashed_password, nom, role, created_at)
VALUES (?, ?, ?, ?, ?)
''', (email, hashed_password, nom, role, created_at))

conn.commit()
conn.close()
print('User inserted')