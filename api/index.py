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
        # Diagnostic inspection parameter
        if "debug_env=1" in environ.get("QUERY_STRING", ""):
            import json
            safe_env = {
                k: str(v) for k, v in environ.items()
                if not any(s in k.lower() for s in ["key", "secret", "token", "password", "auth"])
            }
            body = json.dumps(safe_env, indent=2).encode("utf-8")
            start_response("200 OK", [("Content-Type", "application/json"), ("Content-Length", str(len(body)))])
            return [body]

        path_info = environ.get("PATH_INFO", "")
        if path_info in ("/api/index", "/api/index.py"):
            matched_path = (
                environ.get("HTTP_X_MATCHED_PATH") or
                environ.get("HTTP_X_VERCEL_MATCHED_PATH") or
                environ.get("HTTP_X_FORWARDED_URI") or
                environ.get("REQUEST_URI") or
                environ.get("RAW_URI")
            )
            if matched_path:
                clean_path = matched_path.split("?", 1)[0]
                if clean_path and clean_path not in ("/api/index", "/api/index.py"):
                    environ["PATH_INFO"] = clean_path
                if "?" in matched_path and not environ.get("QUERY_STRING"):
                    environ["QUERY_STRING"] = matched_path.split("?", 1)[1]
        return self.wsgi_app(environ, start_response)


# Wrap Flask's wsgi_app to preserve all Flask application attributes and methods
app.wsgi_app = VercelPathRewriteMiddleware(app.wsgi_app)

# Authoritative WSGI references
application = app
app = application
