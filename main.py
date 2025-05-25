from app import app, db
from sqlalchemy import text

# One-time patch: add 'last_seen' column if it doesn't exist
with db.engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE "user" ADD COLUMN last_seen TIMESTAMP DEFAULT NOW();'))
        conn.commit()
        print("Column 'last_seen' added successfully.")
    except Exception as e:
        print("Column might already exist or failed to add:", e)

if __name__ == '_main_':
    app.run(host='0.0.0.0', port=5000, debug=True)