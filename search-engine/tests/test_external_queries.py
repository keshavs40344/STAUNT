"""
PHASE 5.8 — REAL EXTERNAL TESTS (PHASE 23)
Tests endpoints and actual queries against public endpoint.
"""
import unittest
import requests
import time
import json
import os

LIVE_URL_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "LIVE_URL.txt")


class TestExternalQueries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_url = None
        if os.path.exists(LIVE_URL_FILE):
            with open(LIVE_URL_FILE, "r", encoding="utf-8") as f:
                cls.base_url = f.read().strip()
        elif os.environ.get("STAUNT_SEARCH_URL"):
            cls.base_url = os.environ.get("STAUNT_SEARCH_URL").strip()

        if not cls.base_url:
            raise unittest.SkipTest("No live search endpoint configured (LIVE_URL.txt or STAUNT_SEARCH_URL)")

        try:
            r = requests.get(f"{cls.base_url}/health", timeout=5)
            if r.status_code != 200:
                raise unittest.SkipTest(f"Live search endpoint at {cls.base_url} returned HTTP {r.status_code}")
        except Exception as e:
            raise unittest.SkipTest(f"Live search endpoint at {cls.base_url} unreachable: {e}")

    def test_endpoints_contract(self):
        endpoints = [
            ("/", 200),
            ("/health", 200),
            ("/api/suggest?q=python", 200),
            ("/api/search?q=python", 200),
        ]
        for ep, expected_status in endpoints:
            r = requests.get(f"{self.base_url}{ep}", timeout=15)
            self.assertEqual(r.status_code, expected_status, f"Endpoint {ep} failed with {r.status_code}")

    def test_sample_queries(self):
        queries = ["python", "India", "Delhi", "machine learning"]
        for q in queries:
            r = requests.get(f"{self.base_url}/api/search", params={"q": q}, timeout=15)
            self.assertEqual(r.status_code, 200)
            data = r.json()
            self.assertIn("results", data)


if __name__ == "__main__":
    unittest.main()
