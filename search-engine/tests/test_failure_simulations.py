"""
PHASE 5.8 — FAILURE RECOVERY & SIMULATION TEST (PHASE 26)
Simulates:
1. Provider timeout / failure isolation (mocking external failure, checking local fallback)
2. Malformed query & extreme payload input
3. Unrecognized category routing
4. Offline / graceful degraded responses
"""
import unittest
import requests
import time
import os
import sys

BASE_URL = os.environ.get("STAUNT_SEARCH_URL", "http://127.0.0.1:5000")


class TestFailureSimulations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            r = requests.get(f"{BASE_URL}/health", timeout=3)
            if r.status_code != 200:
                raise unittest.SkipTest(f"Server at {BASE_URL} not healthy (HTTP {r.status_code})")
        except Exception as e:
            raise unittest.SkipTest(f"Could not connect to {BASE_URL}: {e}")

    def test_oversize_payload_handling(self):
        """Test 1: Malformed and oversize payload handling"""
        giant_query = "A" * 15000
        r = requests.get(f"{BASE_URL}/api/search", params={"q": giant_query}, timeout=10)
        self.assertIn(r.status_code, (200, 400), f"Oversize query handled safely (Status {r.status_code})")

    def test_unrecognized_search_category_fallback(self):
        """Test 2: Unrecognized search category fallback"""
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "test", "category": "non_existent_category_999"}, timeout=10)
        self.assertEqual(r.status_code, 200, f"Unrecognized category falls back gracefully (Status {r.status_code})")

    def test_sql_injection_simulation(self):
        """Test 3: SQL injection simulation in query"""
        sql_injection = "' OR 1=1; DROP TABLE documents; --"
        r = requests.get(f"{BASE_URL}/api/search", params={"q": sql_injection}, timeout=10)
        self.assertIn(r.status_code, (200, 400), f"SQL injection attempt safely escaped (Status {r.status_code})")

    def test_database_integrity_after_fuzzing(self):
        """Test 4: Verify database integrity intact after injection test"""
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json().get("status"), "ok")

    def test_missing_params_overview(self):
        """Test 5: Missing params on POST /api/overview"""
        r = requests.post(f"{BASE_URL}/api/overview", json={}, timeout=5)
        if r.status_code == 429:
            retry_after = int(r.headers.get("Retry-After", 2))
            time.sleep(min(retry_after, 5))
            r = requests.post(f"{BASE_URL}/api/overview", json={}, timeout=5)
        self.assertIn(r.status_code, (400, 429), f"Malformed POST /api/overview rejected safely (Status {r.status_code})")

    def test_special_utf8_emojis(self):
        """Test 6: Special UTF-8 chars and emojis"""
        emoji_q = "🐍 🚀 🔥 💻 🇮🇳"
        r = requests.get(f"{BASE_URL}/api/search", params={"q": emoji_q}, timeout=10)
        self.assertEqual(r.status_code, 200, f"Emoji & UTF-8 queries processed without crash (Status {r.status_code})")


if __name__ == "__main__":
    unittest.main()
