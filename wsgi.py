"""
STAUNT Root WSGI Entry Point (for hosts executing from repository root)
"""
import os
import sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SEARCH_ENGINE_DIR = os.path.join(ROOT_DIR, "search-engine")
BACKEND_DIR = os.path.join(SEARCH_ENGINE_DIR, "backend")

for p in (BACKEND_DIR, SEARCH_ENGINE_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

from server import app

# Authoritative WSGI references
application = app
app = application
import db

try:
    db.init_db()
    with db.get_db() as conn:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
except Exception as e:
    print(f"[Root WSGI Startup Note]: {e}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    try:
        from waitress import serve
        print(f"[STAUNT Root Server] Serving on 0.0.0.0:{port} via Waitress...")
        serve(app, host="0.0.0.0", port=port, threads=8)
    except ImportError:
        app.run(host="0.0.0.0", port=port, threaded=True)
