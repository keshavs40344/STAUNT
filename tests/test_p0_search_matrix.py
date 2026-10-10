import sys
import os
import json

# Add search-engine/backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "search-engine", "backend")))

import search_core
import calculator_engine

def test_p0():
    print("=== Testing Search Engine End-to-End ===")
    
    # 1. Normal web search
    queries = ["Python tutorial", "machine learning", "artificial intelligence", "IIT Madras", "Indian government"]
    for q in queries:
        res = search_core.search_with_hybrid_ranking(q, max_results=10)
        results = res.get("results", [])
        print(f"[WEB] '{q}': {len(results)} results (provider: {res.get('provider')})")
        assert len(results) > 0, f"No web results for {q}"
        assert all("url" in r and r["url"].startswith("http") for r in results[:3]), "Invalid URLs in web results"

    # 2. Videos
    video_queries = ["Python tutorial", "machine learning course"]
    for q in video_queries:
        res = search_core.search_videos_mode(q)
        results = res.get("videos", [])
        print(f"[VIDEOS] '{q}': {len(results)} results (provider: {res.get('provider')})")
        assert len(results) > 0, f"No video results for {q}"
        for v in results[:3]:
            assert "url" in v and ("youtube.com" in v["url"] or "youtu.be" in v["url"] or v["url"].startswith("http"))
            assert "title" in v and len(v["title"].strip()) > 0

    # 3. Images
    img_queries = ["Python", "IIT Madras"]
    for q in img_queries:
        res = search_core.search_images_mode(q)
        results = res.get("images", [])
        print(f"[IMAGES] '{q}': {len(results)} results (provider: {res.get('provider')})")
        assert len(results) > 0, f"No image results for {q}"
        assert all("url" in r and r["url"].startswith("http") for r in results[:3]), "Invalid image URLs"

    # 4. News (Strict regression gate: never Wikipedia fallback)
    news_queries = ["artificial intelligence"]
    for q in news_queries:
        res = search_core.search_news_mode(q)
        results = res.get("results", [])
        print(f"[NEWS] '{q}': {len(results)} results (provider: {res.get('provider')})")
        assert len(results) > 0, f"No news results for {q}"
        assert res.get("provider") != "wikipedia_fallback", "News incorrectly fell back to Wikipedia"
        for n in results[:3]:
            assert "wikipedia.org" not in n.get("url", ""), "News result contains Wikipedia"
            assert "publisher" in n or "domain" in n

    # 5. Shopping (Strict regression gate: never Wikipedia fallback, valid merchant and prices)
    shop_queries = ["laptop", "smartphone"]
    for q in shop_queries:
        res = search_core.search_shopping_mode(q)
        results = res.get("products", [])
        print(f"[SHOPPING] '{q}': {len(results)} results (provider: {res.get('provider')})")
        assert len(results) > 0, f"No shopping results for {q}"
        assert res.get("provider") != "wikipedia_fallback", "Shopping incorrectly fell back to Wikipedia"
        for s in results[:3]:
            assert "wikipedia.org" not in s.get("url", ""), "Shopping result contains Wikipedia"
            assert "merchant" in s and s["merchant"], "Shopping product lacks merchant"
            assert "rating" not in s or s["rating"] is None, "Found unverified rating"
            assert "reviews" not in s or s["reviews"] is None, "Found unverified reviews"

    # 6. Maps
    map_queries = ["IIT Madras", "India Gate", "Connaught Place"]
    for q in map_queries:
        res = search_core.search_maps_mode(q)
        print(f"[MAPS] '{q}': status: {res.get('status')}, osm: {res.get('osm_url')}, gmaps: {res.get('google_maps_url')}")
        assert res.get("osm_url") and "openstreetmap.org" in res.get("osm_url")
        assert res.get("google_maps_url") and "maps.google.com" in res.get("google_maps_url")
        assert res.get("place") is not None

    # 7. Utility / Calculator
    calc_queries = ["120*45", "25+75", "50 * (10 + 2)", "sqrt(144)"]
    for q in calc_queries:
        res = calculator_engine.evaluate_calculator_query(q)
        print(f"[CALC] '{q}' -> {res.get('result')}")
        assert res is not None, f"Calculator failed for {q}"
        assert res.get("result") is not None
        assert res.get("error") is None

    print("\nALL P0 DETERMINISTIC SEARCH TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_p0()
