"""
STAUNT — Multi-Cloud Contract Verification Test Suite (Phase 6.5)
Validates that the SAME Flask application satisfies Railway, Render, and Vercel
deployment requirements without duplicate codebases or routes.
"""
import unittest
import os
import sys
import json
import time

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
STAUNT_ROOT = os.path.dirname(TEST_DIR)
SEARCH_ENGINE_DIR = os.path.join(STAUNT_ROOT, "search-engine")
BACKEND_DIR = os.path.join(SEARCH_ENGINE_DIR, "backend")

for p in (BACKEND_DIR, SEARCH_ENGINE_DIR, STAUNT_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)


class TestMultiCloudArchitecture(unittest.TestCase):
    def test_canonical_root_wsgi_adapter(self):
        """Root wsgi.py must export the canonical Flask app and application alias."""
        import wsgi
        self.assertTrue(hasattr(wsgi, "app"), "root wsgi.py must export 'app'")
        self.assertTrue(hasattr(wsgi, "application"), "root wsgi.py must export 'application'")
        self.assertIs(wsgi.app, wsgi.application, "app and application must be identical")

    def test_canonical_search_engine_wsgi_adapter(self):
        """search-engine/wsgi.py must export the canonical Flask app and application alias."""
        import importlib.util
        spec = importlib.util.spec_from_file_location("se_wsgi", os.path.join(SEARCH_ENGINE_DIR, "wsgi.py"))
        se_wsgi = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(se_wsgi)
        self.assertTrue(hasattr(se_wsgi, "app"), "search-engine/wsgi.py must export 'app'")
        self.assertTrue(hasattr(se_wsgi, "application"), "search-engine/wsgi.py must export 'application'")
        self.assertIs(se_wsgi.app, se_wsgi.application)

    def test_canonical_vercel_adapter(self):
        """api/index.py must export the canonical Flask app for Vercel serverless runtime."""
        sys.path.insert(0, os.path.join(STAUNT_ROOT, "api"))
        import index as vercel_entry
        self.assertTrue(hasattr(vercel_entry, "app"), "api/index.py must export 'app'")
        self.assertTrue(hasattr(vercel_entry, "application"), "api/index.py must export 'application'")
        self.assertIs(vercel_entry.app, vercel_entry.application)

    def test_vercel_serverless_read_only_safety(self):
        """When VERCEL=1, database operations must operate safely without crashing on read-only mounts."""
        os.environ["VERCEL"] = "1"
        try:
            import db
            conn = db.get_db()
            self.assertIsNotNone(conn)
            cur = conn.cursor()
            cur.execute("SELECT count(*) FROM documents")
            count = cur.fetchone()[0]
            self.assertGreater(count, 0, "Bundled documents must be readable")
            
            # Write attempts should safely return without throwing
            db.record_search_history(999, "test_query_vercel")
            db.set_cached_search_result("key_vercel", "query", "all", 1, 10, "", {"test": 1})
        finally:
            os.environ.pop("VERCEL", None)


class TestAPIContractEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import wsgi
        cls.client = wsgi.app.test_client()

    def test_01_root_page(self):
        """GET / returns the search interface HTML."""
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/html", resp.content_type)
        html = resp.data.decode("utf-8", errors="replace")
        self.assertIn("STAUNT", html)

    def test_02_health_check_contract(self):
        """GET /health must return strict deterministic JSON schema without dependencies."""
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("version", data)
        self.assertIn("service", data)
        self.assertIn("timestamp", data)
        self.assertEqual(data.get("service"), "STAUNT Sovereign Search & Discovery Engine")

    def test_03_api_version(self):
        """GET /api/version returns version metadata."""
        resp = self.client.get("/api/version")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("version", data)
        self.assertIn("commit", data)

    def test_04_search_endpoint(self):
        """GET /api/search?q=python returns search results schema."""
        resp = self.client.get("/api/search?q=python")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("results", data)
        self.assertIn("provider", data)
        self.assertIn("query", data)
        self.assertEqual(data.get("query"), "python")

    def test_05_suggest_endpoint(self):
        """GET /api/suggest?q=py returns autocomplete suggestions list."""
        resp = self.client.get("/api/suggest?q=py")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_06_overview_endpoint_empty_handling(self):
        """POST /api/overview rejects empty requests with 400."""
        resp = self.client.post("/api/overview", json={})
        self.assertEqual(resp.status_code, 400)

    def test_07_downloads_exist(self):
        """Download endpoints serve valid files when binaries exist in releases/."""
        resp_win = self.client.get("/download/windows")
        self.assertIn(resp_win.status_code, (200, 404))
        if resp_win.status_code == 200:
            self.assertIn("application/", resp_win.content_type.lower())

        resp_apk = self.client.get("/download/android")
        self.assertIn(resp_apk.status_code, (200, 404))
        if resp_apk.status_code == 200:
            self.assertIn("application/", resp_apk.content_type.lower())

    def test_08_security_headers(self):
        """All responses must include standard security headers."""
        resp = self.client.get("/health")
        self.assertEqual(resp.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(resp.headers.get("X-Frame-Options"), "SAMEORIGIN")
        self.assertIn("Content-Security-Policy", resp.headers)


if __name__ == "__main__":
    unittest.main()
