#!/usr/bin/env python3
"""
VASTUDA 5.3 Step 31 Regression Verification Suite:
Covers all 13 regression tests against running server.
"""
import unittest
import sys
import time
import requests
import urllib.parse
import os

BASE = os.environ.get("STAUNT_SEARCH_URL", "http://127.0.0.1:5000")


class TestStep31Regression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            r = requests.get(f"{BASE}/health", timeout=3)
            if r.status_code != 200:
                raise unittest.SkipTest(f"Server not healthy at {BASE}")
        except Exception as e:
            raise unittest.SkipTest(f"Cannot reach server at {BASE}: {e}")

    def test_01_math_evaluation(self):
        math_checks = [("2+2", "4"), ("100/4", "25"), ("2^10", "1024"), ("sqrt(16)", "4")]
        for expr, exp in math_checks:
            q_enc = urllib.parse.quote_plus(expr)
            r = requests.get(f"{BASE}/api/search?q={q_enc}", timeout=5).json()
            ans = r.get("instant_answer", {}).get("result")
            prov = r.get("provider")
            self.assertEqual(ans, exp, f"Math check failed for {expr}: got {ans}, expected {exp}")
            self.assertEqual(prov, "local_calculator")

    def test_02_direct_url(self):
        url_checks = ["https://example.com", "www.python.org", "github.com"]
        for u in url_checks:
            r = requests.get(f"{BASE}/api/search?q={u}", timeout=3).json()
            prov = r.get("provider")
            target = r.get("direct_nav", {}).get("url")
            self.assertEqual(prov, "direct_nav")
            self.assertTrue(target)

    def test_03_autocomplete(self):
        r = requests.get(f"{BASE}/api/suggest?q=py", timeout=3)
        self.assertEqual(r.status_code, 200)
        suggs = r.json()
        self.assertIsInstance(suggs, list)
        self.assertGreater(len(suggs), 0)

    def test_04_category_news(self):
        r = requests.get(f"{BASE}/api/search?q=technology&category=news", timeout=5).json()
        self.assertEqual(r.get("category"), "news")
        self.assertIn("results", r)

    def test_05_category_images(self):
        r = requests.get(f"{BASE}/api/search?q=mountain&category=images", timeout=5).json()
        self.assertEqual(r.get("category"), "images")
        self.assertIn("images", r)

    def test_06_category_videos(self):
        r = requests.get(f"{BASE}/api/search?q=tutorial&category=videos", timeout=5).json()
        self.assertEqual(r.get("category"), "videos")
        self.assertIn("videos", r)

    def test_07_category_research(self):
        r = requests.get(f"{BASE}/api/search?q=quantum+computing&category=research", timeout=5).json()
        self.assertEqual(r.get("category"), "research")
        self.assertIn("results", r)

    def test_08_category_docs(self):
        r = requests.get(f"{BASE}/api/search?q=python&category=docs", timeout=10).json()
        self.assertEqual(r.get("category"), "docs")
        self.assertIn("documents", r)

    def test_09_category_code(self):
        r = requests.get(f"{BASE}/api/search?q=python&category=code", timeout=10).json()
        self.assertEqual(r.get("category"), "code")
        self.assertIn("repositories", r)

    def test_10_health_check(self):
        r = requests.get(f"{BASE}/health", timeout=3)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("status"), "ok")

    def test_11_version_endpoint(self):
        r = requests.get(f"{BASE}/api/version", timeout=3)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("app"), "VASTUDA")
        self.assertIn("commit", data)

    def test_12_static_assets(self):
        css_r = requests.get(f"{BASE}/static/css/style.css", timeout=3)
        js_r = requests.get(f"{BASE}/static/js/app.js", timeout=3)
        self.assertEqual(css_r.status_code, 200)
        self.assertEqual(js_r.status_code, 200)

    def test_13_search_fallback(self):
        r = requests.get(f"{BASE}/api/search?q=python", timeout=5).json()
        results = r.get("results", [])
        self.assertGreater(len(results), 0)


if __name__ == "__main__":
    unittest.main()
