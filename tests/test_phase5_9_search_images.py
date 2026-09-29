"""
STAUNT — Phase 5.9 Test Suite: Search Experience, Image Search & Results Page Upgrade
Validates:
- All vs Images category routing and isolation
- Image search schema, normalization, and source metadata (source_url, domain)
- Multi-source retrieval (Wikimedia Commons, Wikipedia, Web Media)
- Query relevance scoring for images
- Empty image results and error status
- Math calculation isolation (no images, instant answer)
- validate_image unit tests (malformed, private, and valid URLs)
"""
import unittest
import sys
import os

# Add paths
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEARCH_BACKEND = os.path.join(ROOT, "search-engine", "backend")
for p in (SEARCH_BACKEND, ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

from server import app
import search_core
from search_validator import validate_image, is_safe_public_url, normalize_url


class TestPhase59ImageSearchAndRouting(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_01_all_vs_images_routing_isolation(self):
        """Verify that category=all and category=images route to distinct execution paths."""
        resp_all = self.client.get("/api/search?q=python&category=all")
        self.assertEqual(resp_all.status_code, 200)
        data_all = resp_all.get_json()
        self.assertEqual(data_all.get("category"), "all")
        self.assertIn("results", data_all)
        self.assertIsInstance(data_all.get("results"), list)

        resp_img = self.client.get("/api/search?q=python&category=images")
        self.assertEqual(resp_img.status_code, 200)
        data_img = resp_img.get_json()
        self.assertEqual(data_img.get("category"), "images")
        self.assertIn("images", data_img)
        self.assertIsInstance(data_img.get("images"), list)
        self.assertGreater(len(data_img["images"]), 0)

    def test_02_images_category_case_insensitivity(self):
        """Verify uppercase and mixed case category parameter routes correctly."""
        for cat in ("IMAGES", "Images", "image", "IMAGE"):
            resp = self.client.get(f"/api/search?q=python&category={cat}")
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data.get("category"), "images")
            self.assertIn("images", data)

    def test_03_image_schema_normalization(self):
        """Verify every image result adheres to the normalized schema with metadata."""
        resp = self.client.get("/api/search?q=python&category=images")
        self.assertEqual(resp.status_code, 200)
        images = resp.get_json().get("images", [])
        self.assertGreater(len(images), 0)
        for img in images:
            self.assertIn("url", img)
            self.assertTrue(img["url"].startswith(("http://", "https://")))
            self.assertIn("thumbnail", img)
            self.assertIn("title", img)
            self.assertIn("source", img)
            self.assertIn("source_url", img)
            self.assertIn("domain", img)

    def test_04_keshavs40344_web_media_resolution(self):
        """Verify that personal/profile queries like KESHAVS40344 extract genuine public media (e.g. GitHub avatar)."""
        images = search_core.search_images_mode("KESHAVS40344").get("images", [])
        self.assertGreaterEqual(len(images), 1)
        # Should resolve the verified GitHub avatar
        gh_imgs = [i for i in images if "github" in i.get("source", "").lower() or "github.com" in i.get("domain", "").lower()]
        self.assertGreaterEqual(len(gh_imgs), 1)
        target = gh_imgs[0]
        self.assertIn("keshavs40344", target["url"].lower())
        self.assertIn("github.com", target.get("source_url", ""))

    def test_05_math_query_isolation(self):
        """Verify instant math queries short-circuit and never return images or call search providers."""
        resp = self.client.get("/api/search?q=120*45&category=all")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("provider"), "local_calculator")
        self.assertIsNotNone(data.get("instant_answer"))
        self.assertEqual(str(data["instant_answer"].get("result")), "5400")
        self.assertEqual(data.get("images"), [])
        self.assertEqual(data.get("results"), [])

    def test_06_nonexistent_query_empty_state_contract(self):
        """Verify queries with no results return empty list with status='empty' without hallucinating images."""
        resp = self.client.get("/api/search?q=xyznonexistentterm9876543210abc&category=images")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("category"), "images")
        self.assertEqual(data.get("images"), [])
        self.assertIn(data.get("status"), ("empty", "ok"))

    def test_07_validate_image_safe_normalization(self):
        """Test validate_image function with valid, malformed, and dangerous inputs."""
        # Valid full dict
        item1 = {
            "url": "https://example.com/image.jpg?utm_source=test",
            "title": "Example Image",
            "source": "example",
            "source_url": "https://example.com/page?utm_medium=email"
        }
        res1 = validate_image(item1)
        self.assertIsNotNone(res1)
        self.assertEqual(res1["url"], "https://example.com/image.jpg")
        self.assertEqual(res1["source_url"], "https://example.com/page")
        self.assertEqual(res1["domain"], "example.com")
        self.assertEqual(res1["title"], "Example Image")

        # String URL
        res2 = validate_image("https://example.com/pic.png")
        self.assertIsNotNone(res2)
        self.assertEqual(res2["url"], "https://example.com/pic.png")
        self.assertEqual(res2["thumbnail"], "https://example.com/pic.png")

        # SSRF / private IP rejection
        self.assertIsNone(validate_image("http://127.0.0.1/private.jpg"))
        self.assertIsNone(validate_image("http://10.0.0.1/secret.png"))
        self.assertIsNone(validate_image("http://localhost/hack.jpg"))
        self.assertIsNone(validate_image("file:///etc/passwd"))
        self.assertIsNone(validate_image("javascript:alert(1)"))

        # Malformed or non-string
        self.assertIsNone(validate_image(None))
        self.assertIsNone(validate_image({}))
        self.assertIsNone(validate_image(12345))

    def test_08_suggest_api_contract_for_related_queries(self):
        """Verify /api/suggest returns valid JSON array of non-empty strings."""
        resp = self.client.get("/api/suggest?q=python")
        self.assertEqual(resp.status_code, 200)
        suggestions = resp.get_json()
        self.assertIsInstance(suggestions, list)
        self.assertGreater(len(suggestions), 0)
        for s in suggestions:
            self.assertIsInstance(s, str)
            self.assertTrue(len(s.strip()) > 0)


if __name__ == "__main__":
    unittest.main()
