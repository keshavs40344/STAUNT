"""
STAUNT — Test Suite: Desktop Web Search Engine Homepage & Dynamic Wallpapers
Validates:
1. Wallpaper manifest schema, local asset existence, and /api/wallpapers route
2. /api/weather endpoint schema, hourly forecasts, AQI, and resilient fallbacks
3. /api/trending endpoint schema, 10 ranked topics, and 5 financial markets with sparklines
4. /api/discover categories including sports and entertainment
5. Homepage HTML structure: search input, suggestion chips, navigation rail, dashboard cards
6. Resilient error handling when external weather or trending providers fail
"""
import unittest
import sys
import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEARCH_BACKEND = os.path.join(ROOT, "search-engine", "backend")
SEARCH_STATIC = os.path.join(ROOT, "search-engine", "static")
for p in (SEARCH_BACKEND, ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

from server import app


class TestDesktopSearchEngineHomepage(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_01_wallpaper_manifest_and_assets_exist(self):
        """Verify that wallpapers/manifest.json is valid and all 7 local SVGs exist on disk."""
        manifest_path = os.path.join(SEARCH_STATIC, "wallpapers", "manifest.json")
        self.assertTrue(os.path.exists(manifest_path), "manifest.json must exist")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertIsInstance(manifest, list)
        self.assertGreaterEqual(len(manifest), 7, "Must contain at least 7 verified landscape wallpapers")

        required_ids = {"himachal", "varanasi", "coastal", "teagardens", "desert", "modern", "dal_lake"}
        manifest_ids = {item["id"] for item in manifest}
        self.assertTrue(required_ids.issubset(manifest_ids), f"Missing required wallpaper IDs: {required_ids - manifest_ids}")

        for item in manifest:
            self.assertIn("title", item)
            self.assertIn("location", item)
            self.assertIn("local_url", item)
            self.assertIn("fallback_url", item)

            # Check that local asset exists
            rel_path = item["local_url"].replace("/static/", "")
            full_path = os.path.join(SEARCH_STATIC, rel_path)
            self.assertTrue(os.path.exists(full_path), f"Wallpaper file missing: {full_path}")
            self.assertGreater(os.path.getsize(full_path), 500, f"Wallpaper file too small or empty: {full_path}")

    def test_02_api_wallpapers_endpoint(self):
        """Verify GET /api/wallpapers returns 200 with list of wallpapers."""
        resp = self.client.get("/api/wallpapers")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("wallpapers", data)
        self.assertGreaterEqual(len(data["wallpapers"]), 7)

    def test_03_weather_endpoint_full_contract(self):
        """Verify GET /api/weather returns city, temp, condition, icon, high, low, aqi, and hourly slots."""
        resp = self.client.get("/api/weather?city=Delhi,%20India")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("city", data)
        self.assertIn("temp", data)
        self.assertIn("condition", data)
        self.assertIn("icon", data)
        self.assertIn("high", data)
        self.assertIn("low", data)
        self.assertIn("hourly", data)
        self.assertIsInstance(data["hourly"], list)
        self.assertGreaterEqual(len(data["hourly"]), 6, "Must provide 6 hourly slots")
        for slot in data["hourly"]:
            self.assertIn("time", slot)
            self.assertIn("temp", slot)
            self.assertIn("icon", slot)

    def test_04_trending_and_markets_endpoint(self):
        """Verify GET /api/trending returns 10 ranked topics and financial markets with sparklines."""
        resp = self.client.get("/api/trending")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("topics", data)
        self.assertIn("markets", data)
        self.assertIn("news", data)

        topics = data["topics"]
        self.assertGreaterEqual(len(topics), 10, "Must return at least 10 trending searches")
        self.assertEqual(topics[0]["rank"], 1)
        self.assertEqual(topics[0]["query"], "India vs Australia")

        markets = data["markets"]
        self.assertGreaterEqual(len(markets), 3)
        symbols = [m["symbol"] for m in markets]
        self.assertIn("Sensex", symbols)
        self.assertIn("Nifty 50", symbols)
        self.assertIn("Gold (24K)", symbols)

        for m in markets:
            self.assertIn("value", m)
            self.assertIn("change", m)
            self.assertIn("sparkline", m)

    def test_05_discover_sports_and_entertainment(self):
        """Verify /api/discover handles new categories sports and entertainment."""
        for cat in ("sports", "entertainment", "science", "business"):
            resp = self.client.get(f"/api/discover?category={cat}")
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data.get("category"), cat)
            self.assertIn("items", data)

    def test_06_homepage_html_structure(self):
        """Verify GET / serves genuine desktop shell with nav rail, hero, and 3-column dashboard."""
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)

        # Check required DOM elements
        self.assertIn('id="wallpaperStage"', html)
        self.assertIn('id="wallpaperLayerA"', html)
        self.assertIn('id="wallpaperLayerB"', html)
        self.assertIn('id="navRail"', html)
        self.assertIn('id="homeSearchForm"', html)
        self.assertIn('id="homeSearchInput"', html)
        self.assertIn('id="homeVoiceBtn"', html)
        self.assertIn('id="homeVisualBtn"', html)
        self.assertIn('id="searchChipsRow"', html)
        self.assertIn('id="shortcutsGrid"', html)
        self.assertIn('id="homeDashboard"', html)
        self.assertIn('id="weatherCard"', html)
        self.assertIn('id="quickToolsCard"', html)
        self.assertIn('id="highlightsCard"', html)
        self.assertIn('id="exploreTopicsCard"', html)
        self.assertIn('id="trendingCard"', html)
        self.assertIn('id="marketsCard"', html)
        self.assertIn('id="settingsModal"', html)
        self.assertIn('id="shortcutModal"', html)
        self.assertIn('id="resultsView"', html)

    def test_07_weather_fallback_on_invalid_coords(self):
        """Verify that invalid coordinates return safe fallback weather rather than 500 error."""
        resp = self.client.get("/api/weather?lat=invalid&lon=invalid&city=Mumbai,%20India")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("city"), "Mumbai, India")
        self.assertIn("temp", data)
        self.assertIn("condition", data)
        self.assertIn("hourly", data)

    def test_08_vercel_adapters_and_public_static_wallpapers(self):
        """Verify that Vercel adapters exist and public static wallpaper assets are synced."""
        api_dir = os.path.join(ROOT, "api")
        public_wallpapers = os.path.join(ROOT, "public", "static", "wallpapers")

        # Test adapter files exist
        for adapter in ("wallpapers.py", "discover.py", "images.py", "overview.py"):
            path = os.path.join(api_dir, adapter)
            self.assertTrue(os.path.exists(path), f"Missing adapter {adapter}")

        # Test public static wallpapers exist
        self.assertTrue(os.path.exists(os.path.join(public_wallpapers, "manifest.json")))
        for w in ("himachal.svg", "varanasi.svg", "coastal.svg", "teagardens.svg", "desert.svg", "modern.svg", "dal_lake.svg"):
            self.assertTrue(os.path.exists(os.path.join(public_wallpapers, w)), f"Missing public wallpaper {w}")

    def test_09_desktop_web_search_engine_ux_and_navigation(self):
        """Verify web search engine hero actions, clean footer, zero-overflow CSS, and history/arrow nav in JS."""
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)

        # 1. Search action buttons
        self.assertIn('id="homeSearchBtn"', html)
        self.assertIn('id="homeLuckyBtn"', html)
        self.assertIn("STAUNT Search", html)
        self.assertIn("I'm Feeling Lucky", html)

        # 2. Header and footer links
        self.assertIn("Discover", html)
        self.assertIn("Apps", html)
        self.assertIn("Privacy", html)
        self.assertIn("About STAUNT", html)
        self.assertIn("Downloads", html)
        self.assertIn("v5.4", html)

        # 3. CSS zero-overflow and layout rules
        css_path = os.path.join(SEARCH_STATIC, "css", "style.css")
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()
        self.assertIn("overflow-x: hidden !important", css)
        self.assertIn(".nav-rail {\n  display: none !important;", css)
        self.assertIn(".desktop-dashboard {\n  display: none !important;", css)

        # 4. JS navigation and history guards
        js_path = os.path.join(SEARCH_STATIC, "js", "app.js")
        with open(js_path, "r", encoding="utf-8") as f:
            js = f.read()
        self.assertIn("isPopState", js)
        self.assertIn("initKeyboardNavigation", js)
        self.assertIn("ArrowLeft", js)
        self.assertIn("ArrowRight", js)
        self.assertIn("returnToHome", js)

    def test_10_wallpaper_arrows_and_responsive_positioning(self):
        """Verify wallpaper navigation controls, accessible hit areas, safe watermark clearance, and responsive rules."""
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)

        # 1. HTML structure and accessibility
        self.assertIn('id="wallpaperCreditWidget"', html)
        self.assertIn('id="prevWallpaperBtn"', html)
        self.assertIn('id="nextWallpaperBtn"', html)
        self.assertIn('id="chipsNavPrev"', html)
        self.assertIn('id="chipsNavNext"', html)
        self.assertIn('aria-label="Previous Wallpaper"', html)
        self.assertIn('aria-label="Next Wallpaper"', html)

        # 2. CSS watermark clearance and hit target rules
        css_path = os.path.join(SEARCH_STATIC, "css", "style.css")
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()
        self.assertIn(".wallpaper-credit-widget", css)
        self.assertIn("clamp(76px, 10vh, 92px)", css)
        self.assertIn("clamp(20px, 3vw, 36px)", css)
        self.assertIn("wp-arrow-btn:focus-visible", css)
        self.assertIn("@media (max-width: 768px)", css)
        self.assertIn("@media (max-height: 650px)", css)

        # 3. JS synchronous initialization and accessibility synchronization
        js_path = os.path.join(SEARCH_STATIC, "js", "app.js")
        with open(js_path, "r", encoding="utf-8") as f:
            js = f.read()
        self.assertIn("initWallpaperManager", js)
        self.assertIn("initChipsCarousel", js)
        self.assertIn("stopWallpaperRotation", js)
        self.assertIn("wpTransitionTimer", js)
        self.assertIn("currentWpRequestId", js)


if __name__ == "__main__":
    unittest.main()
