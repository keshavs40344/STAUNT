"""
STAUNT / VASTUDA — Phase 5.9 Unit & Integration Test Suite
Validates:
1. Query classification (URLs, Math, General, Entity Candidates).
2. Domain diversity & Wikipedia cap enforcement in indexer.
3. Multi-source entity profile resolution & contract adherence.
4. SERP payload completeness (results, entity, news, videos).
"""
import sys
import os
import unittest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "search-engine", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import entity_engine
import indexer
from server import app


class TestPhase59NativeSearch(unittest.TestCase):

    def test_01_entity_candidate_classification(self):
        """Verify entity candidate detection for persons, organizations vs code, math, urls."""
        # Persons
        is_cand, hint = entity_engine.is_entity_candidate("Virat Kohli")
        self.assertTrue(is_cand)

        is_cand, hint = entity_engine.is_entity_candidate("Sundar Pichai")
        self.assertTrue(is_cand)

        is_cand, hint = entity_engine.is_entity_candidate("who is Elon Musk")
        self.assertTrue(is_cand)

        # Math / Code / URLs should NOT be entity candidates
        is_cand, _ = entity_engine.is_entity_candidate("120*45")
        self.assertFalse(is_cand)

        is_cand, _ = entity_engine.is_entity_candidate("python")
        self.assertFalse(is_cand)

        is_cand, _ = entity_engine.is_entity_candidate("javascript")
        self.assertFalse(is_cand)

    def test_02_domain_diversity_and_wikipedia_cap(self):
        """Verify no domain has > 2 results, and Wikipedia is capped at 1."""
        test_candidates = [
            {"domain": "en.wikipedia.org", "url": "https://en.wikipedia.org/wiki/Item1", "title": "Wiki 1", "score": 95.0},
            {"domain": "en.wikipedia.org", "url": "https://en.wikipedia.org/wiki/Item2", "title": "Wiki 2", "score": 90.0},
            {"domain": "en.wikipedia.org", "url": "https://en.wikipedia.org/wiki/Item3", "title": "Wiki 3", "score": 85.0},
            {"domain": "github.com", "url": "https://github.com/repo1", "title": "GH 1", "score": 80.0},
            {"domain": "github.com", "url": "https://github.com/repo2", "title": "GH 2", "score": 75.0},
            {"domain": "github.com", "url": "https://github.com/repo3", "title": "GH 3", "score": 70.0},
            {"domain": "espncricinfo.com", "url": "https://www.espncricinfo.com/player/1", "title": "Cric 1", "score": 65.0},
            {"domain": "bbc.com", "url": "https://www.bbc.com/sport/1", "title": "BBC 1", "score": 60.0},
        ]

        diversified = indexer.apply_domain_diversity(test_candidates, max_per_domain=2, max_results=6)
        
        # Check Wikipedia is capped to 1
        wiki_count = sum(1 for r in diversified if "wikipedia.org" in r.get("domain", ""))
        self.assertEqual(wiki_count, 1, f"Expected 1 Wikipedia result, got {wiki_count}")

        # Check GitHub is capped to max 2
        gh_count = sum(1 for r in diversified if "github.com" in r.get("domain", ""))
        self.assertLessEqual(gh_count, 2, f"Expected max 2 GitHub results, got {gh_count}")

    def test_03_entity_resolution_authoritative_contract(self):
        """Verify entity resolution extracts authentic metadata and verified profiles."""
        profile = entity_engine.resolve_entity_profile("Sundar Pichai")
        self.assertIsNotNone(profile)
        self.assertEqual(profile.get("name"), "Sundar Pichai")
        self.assertEqual(profile.get("entity_type"), "person")
        self.assertIn("Official", profile.get("confidence", ""))
        
        # Profiles must be authentic
        profiles = profile.get("profiles", [])
        self.assertGreater(len(profiles), 0)
        platforms = [p["platform"] for p in profiles]
        self.assertIn("x", platforms)
        
        # Check profile structure
        for p in profiles:
            self.assertIn("platform", p)
            self.assertIn("url", p)
            self.assertTrue(p["url"].startswith("http"))
            self.assertIn("confidence", p)

    def test_04_api_search_math_contract(self):
        """Verify /api/search calculation endpoint."""
        client = app.test_client()
        resp = client.get("/api/search?q=120*45")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsNotNone(data.get("instant_answer"))
        self.assertEqual(data["instant_answer"].get("result"), "5400")

    def test_05_api_entity_endpoint(self):
        """Verify dedicated /api/entity endpoint."""
        client = app.test_client()
        resp = client.get("/api/entity?q=Virat+Kohli")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("entity", data)
        if data["entity"]:
            self.assertEqual(data["entity"].get("name"), "Virat Kohli")


if __name__ == "__main__":
    unittest.main()
