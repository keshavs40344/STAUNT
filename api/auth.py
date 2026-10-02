"""
STAUNT — Vercel Serverless WSGI Adapter for Auth Endpoints
Handles /api/auth/config, /api/auth/session, /api/auth/me, /api/auth/logout, etc.
"""
import os
import sys
import urllib.parse

API_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(API_DIR)
SEARCH_ENGINE_DIR = os.path.join(ROOT_DIR, "search-engine")
BACKEND_DIR = os.path.join(SEARCH_ENGINE_DIR, "backend")

for p in (BACKEND_DIR, SEARCH_ENGINE_DIR, ROOT_DIR, API_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("VERCEL", "1")

from server import app as flask_app


class AuthWSGIAdapter:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        environ["SCRIPT_NAME"] = ""
        candidates = [
            environ.get("HTTP_X_FORWARDED_URI"),
            environ.get("REQUEST_URI"),
            environ.get("RAW_URI"),
            environ.get("HTTP_X_MATCHED_PATH"),
            environ.get("HTTP_X_VERCEL_MATCHED_PATH"),
            environ.get("PATH_INFO"),
        ]
        target = None
        for c in candidates:
            if c:
                clean_c = c.split("?", 1)[0]
                if clean_c and clean_c not in ("/api/auth", "/api/auth.py") and "/api/auth" in clean_c:
                    target = clean_c
                    break

        if not target:
            qs = environ.get("QUERY_STRING", "")
            if qs:
                params = urllib.parse.parse_qs(qs)
                sub = params.get("path", [""])[0]
                if sub:
                    target = f"/api/auth/{sub.lstrip('/')}"

        if not target or target in ("/api/auth", "/api/auth.py"):
            target = "/api/auth/config"

        environ["PATH_INFO"] = target
        return self.wsgi_app(environ, start_response)

    def __getattr__(self, name):
        return getattr(self.wsgi_app, name)


application = AuthWSGIAdapter(flask_app)
app = application
