"""
STAUNT / VASTUDA — Phase 5.11 Test Suite
Production Hardening, Real Native E2E, SERP Quality & Resilience

Tests:
1. Active production endpoint (Vercel /health, /api/search, /api/entity)
2. No stale production endpoint in clients
3. General query response (valid titles, URLs, snippets)
4. Malformed result rejection (security, schemas, error titles)
5. URL normalization (canonicalization, tracking stripping, port stripping)
6. Domain diversity without relevance destruction (preserves results on backfill)
7. Ambiguous-query safety (Apple, Java, Mercury, Jaguar don't get hijacked)
8. API failure handling (resilient client handling of network / timeout errors)
"""
import os
import sys
import json
import urllib.parse
import urllib.request
import subprocess
import unittest

def find_repo_root():
    d = os.path.dirname(os.path.abspath(__file__))
    while d and os.path.dirname(d) != d:
        if os.path.exists(os.path.join(d, "search-engine")) or os.path.exists(os.path.join(d, "search_engine")):
            return d
        d = os.path.dirname(d)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROOT_DIR = find_repo_root()
BACKEND_DIR = os.path.join(ROOT_DIR, "search-engine", "backend")
if not os.path.isdir(BACKEND_DIR):
    BACKEND_DIR = os.path.join(ROOT_DIR, "search_engine")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from search_validator import normalize_url, validate_result, is_safe_public_url
import indexer

PROD_BASE_URL = "https://staunt.vercel.app"

def fetch_json(url, timeout=12):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Staunt-Phase5.11-Verification/1.0"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


class TestPhase511ProductionHardening(unittest.TestCase):

    def test_01_active_production_endpoint(self):
        """1. Verify active production endpoint is live and serving health, search, entity."""
        # /health
        health = fetch_json(f"{PROD_BASE_URL}/health", timeout=10)
        self.assertIn("status", health)
        self.assertEqual(health["status"], "ok")

        # /api/search
        search = fetch_json(f"{PROD_BASE_URL}/api/search?q=python", timeout=12)
        self.assertIn("results", search)
        self.assertIsInstance(search["results"], list)
        self.assertGreater(len(search["results"]), 0)

        # /api/entity
        entity = fetch_json(f"{PROD_BASE_URL}/api/entity?q=Virat+Kohli", timeout=10)
        self.assertIn("entity", entity)
        self.assertIsNotNone(entity["entity"])

    def test_02_no_stale_production_endpoint_in_clients(self):
        """2. Verify native search clients point only to active production endpoint."""
        js_path = os.path.join(ROOT_DIR, "windows", "desktop", "src", "search_client.js")
        if not os.path.exists(js_path):
            js_path = os.path.join(ROOT_DIR, "desktop", "src", "search_client.js")
        self.assertTrue(os.path.exists(js_path), "search_client.js must exist")

        with open(js_path, "r", encoding="utf-8") as f:
            js_code = f.read()
        self.assertIn("https://staunt.vercel.app", js_code)
        self.assertNotIn("https://staunt.onrender.com", js_code.split("SEARCH_API_BASE_URL")[1][:200])

        kt_path = os.path.join(ROOT_DIR, "android", "app", "src", "main", "kotlin", "com", "staunt", "browser", "NativeSearchClient.kt")
        if os.path.exists(kt_path):
            with open(kt_path, "r", encoding="utf-8") as f:
                kt_code = f.read()
            self.assertIn("https://staunt.vercel.app", kt_code)

    def test_03_general_query_response(self):
        """3. Verify general search query returns valid titles, URLs, and snippets."""
        data = fetch_json(f"{PROD_BASE_URL}/api/search?q=machine+learning", timeout=12)
        results = data.get("results", [])
        self.assertGreater(len(results), 0, "General query must return results")

        for r in results:
            self.assertTrue(r.get("url", "").startswith(("http://", "https://")), f"Invalid URL: {r.get('url')}")
            self.assertTrue(len(r.get("title", "").strip()) >= 3, f"Empty/too short title: {r.get('title')}")
            self.assertTrue(len(r.get("snippet", "").strip()) > 0, f"Empty snippet in result: {r.get('title')}")
            self.assertTrue(len(r.get("domain", "").strip()) > 0, f"Empty domain: {r.get('url')}")

    def test_04_malformed_result_rejection(self):
        """4. Verify search_validator rejects malformed, unsafe, or error results."""
        self.assertFalse(validate_result(None))
        self.assertFalse(validate_result("not a dict"))
        self.assertFalse(validate_result({}))
        self.assertFalse(validate_result({"title": "ab", "url": "https://example.com"}))
        self.assertFalse(validate_result({"title": "404 Not Found", "url": "https://example.com"}))
        self.assertFalse(validate_result({"title": "Valid Title", "url": "ftp://example.com/file"}))
        # SSRF private IP
        self.assertFalse(validate_result({"title": "Valid Title", "url": "http://169.254.169.254/metadata"}))
        self.assertFalse(validate_result({"title": "Valid Title", "url": "http://127.0.0.1:8000/secrets"}))
        self.assertFalse(validate_result({"title": "Valid Title", "url": "http://10.0.0.1/private"}))
        # Valid item
        self.assertTrue(validate_result({
            "title": "Python Official Documentation",
            "url": "https://docs.python.org/3/",
            "domain": "docs.python.org",
            "snippet": "Python language reference."
        }))

    def test_05_url_normalization(self):
        """5. Verify normalize_url strips tracking params, default ports, and fragments."""
        raw = "HTTPS://Example.COM:443/docs//intro/?utm_source=twitter&utm_medium=social&fbclid=123#summary"
        norm = normalize_url(raw)
        self.assertEqual(norm, "https://example.com/docs/intro")

        raw_port = "http://example.com:80/path/"
        self.assertEqual(normalize_url(raw_port), "http://example.com/path")

        raw_preserve = "https://example.com/search?q=test&page=1"
        self.assertEqual(normalize_url(raw_preserve), "https://example.com/search?page=1&q=test")

    def test_06_domain_diversity_without_relevance_destruction(self):
        """6. Verify domain diversity balances source variety without dropping results."""
        # Pool with sufficient diverse domains: Wikipedia cap of 1 enforced
        mixed_pool = [
            {"title": "Wiki 1", "url": "https://en.wikipedia.org/wiki/Item1", "domain": "en.wikipedia.org", "score": 90.0},
            {"title": "Wiki 2", "url": "https://en.wikipedia.org/wiki/Item2", "domain": "en.wikipedia.org", "score": 88.0},
            {"title": "GitHub 1", "url": "https://github.com/item1", "domain": "github.com", "score": 85.0},
            {"title": "Python 1", "url": "https://python.org/item1", "domain": "python.org", "score": 84.0},
            {"title": "StackOverflow", "url": "https://stackoverflow.com/q1", "domain": "stackoverflow.com", "score": 80.0},
            {"title": "MDN Web", "url": "https://developer.mozilla.org/doc1", "domain": "developer.mozilla.org", "score": 78.0},
        ]
        div_results = indexer.apply_domain_diversity(mixed_pool, max_per_domain=2, max_results=5)
        domains = [r["domain"] for r in div_results]
        self.assertIn("github.com", domains)
        self.assertIn("python.org", domains)
        self.assertLessEqual(domains.count("en.wikipedia.org"), 1, "Wikipedia should not dominate when alternatives exist")

        # Pool with only one domain: backfill preserves relevant results
        single_pool = [
            {"title": f"Doc {i}", "url": f"https://en.wikipedia.org/wiki/Doc{i}", "domain": "en.wikipedia.org", "score": 90.0 - i}
            for i in range(8)
        ]
        preserved = indexer.apply_domain_diversity(single_pool, max_per_domain=2, max_results=6)
        self.assertGreaterEqual(len(preserved), 5, "Backfill must preserve relevant results instead of discarding them")

    def test_07_ambiguous_query_safety(self):
        """7. Verify ambiguous queries (Apple, Java, Python, Mercury) do not get hijacked by low-confidence entities."""
        for q in ["Apple", "Java", "Python", "Mercury", "Jaguar"]:
            data = fetch_json(f"{PROD_BASE_URL}/api/search?q={urllib.parse.quote(q)}", timeout=12)
            entity = data.get("entity")
            if entity:
                # If an entity is present, confidence must be high/verified, never generic low-confidence guess
                conf = entity.get("confidence", "")
                self.assertIn(conf, ["Official", "Verified by linked source", "High"],
                              f"Ambiguous query '{q}' hijacked with insufficient confidence: {conf}")

    def test_08_api_failure_handling(self):
        """8. Verify NativeSearchClient cleanly handles network failures and timeouts."""
        js_path = os.path.join(ROOT_DIR, "windows", "desktop", "src", "search_client.js")
        if not os.path.exists(js_path):
            js_path = os.path.join(ROOT_DIR, "desktop", "src", "search_client.js")

        node_script = f"""
        const NativeSearchClient = require({json.dumps(js_path.replace('\\\\', '/'))});
        const client = new NativeSearchClient({{
            apiBaseUrl: 'http://127.0.0.1:54321', // Unreachable port
            connectTimeoutMs: 1500,
            readTimeoutMs: 1500
        }});

        client.search('python').then(res => {{
            console.log(JSON.stringify(res));
        }}).catch(err => {{
            console.log(JSON.stringify({{ success: false, error: {{ type: 'CRASH', message: err.message }} }}));
        }});
        """
        proc = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=8
        )
        self.assertEqual(proc.returncode, 0, f"Node script crashed: {proc.stderr}")
        res = json.loads(proc.stdout.strip())
        self.assertFalse(res.get("success"), "Must report failure on unreachable endpoint")
        self.assertIn("error", res, "Must include error payload")
        err_type = res["error"].get("type") if isinstance(res.get("error"), dict) else res.get("type")
        self.assertIn(err_type, ["NETWORK_FAILURE", "TIMEOUT", "HTTP_ERROR"])


if __name__ == "__main__":
    unittest.main()
