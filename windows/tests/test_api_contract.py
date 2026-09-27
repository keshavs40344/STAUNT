"""
STAUNT / VASTUDA — Production API Contract Test Suite
Validates all public API endpoints on the active production backend.
"""
import unittest
import urllib.request
import json

PROD_BASE = "https://staunt.vercel.app"

def fetch(path, timeout=10):
    req = urllib.request.Request(
        PROD_BASE + path,
        headers={"User-Agent": "Staunt-API-Contract-Test/1.0"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


class TestProductionAPIContract(unittest.TestCase):

    def test_01_health_endpoint(self):
        status, data = fetch("/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "ok")
        self.assertTrue(data.get("search"))

    def test_02_search_endpoint(self):
        status, data = fetch("/api/search?q=python")
        self.assertEqual(status, 200)
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)
        self.assertGreater(len(data["results"]), 0)

    def test_03_entity_endpoint(self):
        status, data = fetch("/api/entity?q=Virat+Kohli")
        self.assertEqual(status, 200)
        self.assertIn("entity", data)
        self.assertIsNotNone(data["entity"])
        self.assertEqual(data["entity"].get("name"), "Virat Kohli")

    def test_04_suggest_endpoint(self):
        status, data = fetch("/api/suggest?q=py")
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_05_trending_endpoint(self):
        status, data = fetch("/api/trending")
        self.assertEqual(status, 200)
        self.assertIn("topics", data)

    def test_06_weather_endpoint(self):
        status, data = fetch("/api/weather")
        self.assertEqual(status, 200)
        self.assertIn("condition", data)

    def test_07_version_endpoint(self):
        status, data = fetch("/api/version")
        self.assertEqual(status, 200)
        self.assertIn("environment", data)


if __name__ == "__main__":
    unittest.main()
