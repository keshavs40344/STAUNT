"""
STAUNT — Vercel Serverless WSGI Adapter
Imports the ONE canonical Flask application instance.
"""
import os
import sys

API_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(API_DIR)
SEARCH_ENGINE_DIR = os.path.join(ROOT_DIR, "search-engine")
BACKEND_DIR = os.path.join(SEARCH_ENGINE_DIR, "backend")

for p in (BACKEND_DIR, SEARCH_ENGINE_DIR, ROOT_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("VERCEL", "1")

from server import app


class VercelPathRewriteMiddleware:
    """
    Ensures that if Vercel routes using the rewritten destination path (/api/index)
    instead of the original path, Flask uses the actual original requested path
    from 'x-matched-path' or 'x-forwarded-uri'.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path_info = environ.get("PATH_INFO", "")
        if path_info in ("/api/index", "/api/index.py"):
            matched_path = (
                environ.get("HTTP_X_MATCHED_PATH") or
                environ.get("HTTP_X_VERCEL_MATCHED_PATH") or
                environ.get("HTTP_X_FORWARDED_URI")
            )
            if matched_path:
                if "?" in matched_path:
                    matched_path = matched_path.split("?", 1)[0]
                environ["PATH_INFO"] = matched_path
            else:
                environ["PATH_INFO"] = "/"
        return self.wsgi_app(environ, start_response)


# Wrap Flask's wsgi_app to preserve all Flask application attributes and methods
app.wsgi_app = VercelPathRewriteMiddleware(app.wsgi_app)

# Authoritative WSGI references
application = app
app = application
