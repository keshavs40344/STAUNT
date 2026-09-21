#!/usr/bin/env python3
"""
VASTUDA 5.3 Step 31 Regression Verification Suite:
Covers all 13 regression tests against running server.
"""

import sys
import time
import requests

BASE = "http://127.0.0.1:5000"
passed = 0
failed = 0

def record(name, condition, details=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name}: {details}")
    else:
        failed += 1
        print(f"  [FAIL] {name}: {details}")

print("==================================================")
print("VASTUDA 5.3 — STEP 31 REGRESSION TEST RUNNER")
print("==================================================")

# Wait for server to be responsive
time.sleep(1.0)

# 1. Math evaluation: 2+2, 100/4, 2^10, sqrt(16)
try:
    import urllib.parse
    math_checks = [("2+2", "4"), ("100/4", "25"), ("2^10", "1024"), ("sqrt(16)", "4")]
    all_math_ok = True
    details = []
    for expr, exp in math_checks:
        q_enc = urllib.parse.quote_plus(expr)
        r = requests.get(f"{BASE}/api/search?q={q_enc}", timeout=5).json()
        ans = r.get("instant_answer", {}).get("result")
        prov = r.get("provider")
        if ans != exp or prov != "local_calculator":
            all_math_ok = False
        details.append(f"{expr}={ans}")
    record("1. Math evaluation (2+2, 100/4, 2^10, sqrt(16))", all_math_ok, ", ".join(details))
except Exception as e:
    record("1. Math evaluation", False, str(e))

# 2. Direct URL: https://example.com, www.python.org, github.com
try:
    url_checks = ["https://example.com", "www.python.org", "github.com"]
    all_url_ok = True
    details = []
    for u in url_checks:
        r = requests.get(f"{BASE}/api/search?q={u}", timeout=3).json()
        prov = r.get("provider")
        target = r.get("direct_nav", {}).get("url")
        if prov != "direct_nav" or not target:
            all_url_ok = False
        details.append(f"{u}->{target}")
    record("2. Direct URL (https://example.com, www.python.org, github.com)", all_url_ok, ", ".join(details))
except Exception as e:
    record("2. Direct URL", False, str(e))

# 3. Autocomplete: /api/suggest?q=py
try:
    r = requests.get(f"{BASE}/api/suggest?q=py", timeout=3)
    suggs = r.json()
    record("3. Autocomplete (/api/suggest?q=py)", r.status_code == 200 and isinstance(suggs, list) and len(suggs) > 0, f"count={len(suggs)}")
except Exception as e:
    record("3. Autocomplete", False, str(e))

# 4. Category routing: news
try:
    r = requests.get(f"{BASE}/api/search?q=technology&category=news", timeout=5).json()
    record("4. Category routing: news", r.get("category") == "news" and "results" in r, f"provider={r.get('provider')}")
except Exception as e:
    record("4. Category routing: news", False, str(e))

# 5. Category routing: images
try:
    r = requests.get(f"{BASE}/api/search?q=mountain&category=images", timeout=5).json()
    record("5. Category routing: images", r.get("category") == "images" and "images" in r, f"images_count={len(r.get('images', []))}")
except Exception as e:
    record("5. Category routing: images", False, str(e))

# 6. Category routing: videos
try:
    r = requests.get(f"{BASE}/api/search?q=tutorial&category=videos", timeout=5).json()
    record("6. Category routing: videos", r.get("category") == "videos" and "videos" in r, f"videos_count={len(r.get('videos', []))}")
except Exception as e:
    record("6. Category routing: videos", False, str(e))

# 7. Category routing: research
try:
    r = requests.get(f"{BASE}/api/search?q=quantum+computing&category=research", timeout=5).json()
    record("7. Category routing: research", r.get("category") == "research" and "results" in r, f"provider={r.get('provider')}")
except Exception as e:
    record("7. Category routing: research", False, str(e))

# 8. Category routing: docs
try:
    r = requests.get(f"{BASE}/api/search?q=python&category=docs", timeout=5).json()
    record("8. Category routing: docs", r.get("category") == "docs" and "documents" in r, f"provider={r.get('provider')}")
except Exception as e:
    record("8. Category routing: docs", False, str(e))

# 9. Category routing: code
try:
    r = requests.get(f"{BASE}/api/search?q=python&category=code", timeout=5).json()
    record("9. Category routing: code", r.get("category") == "code" and "repositories" in r, f"repos={len(r.get('repositories', []))}")
except Exception as e:
    record("9. Category routing: code", False, str(e))

# 10. Health check: /health returns 200 with status ok
try:
    r = requests.get(f"{BASE}/health", timeout=3)
    data = r.json()
    record("10. Health check (/health)", r.status_code == 200 and data.get("status") == "ok" and data.get("version") in ("5.3", "5.4"), f"status={data.get('status')} v={data.get('version')}")
except Exception as e:
    record("10. Health check", False, str(e))

# 11. Version endpoint: /api/version returns version and commit
try:
    r = requests.get(f"{BASE}/api/version", timeout=3)
    data = r.json()
    record("11. Version endpoint (/api/version)", r.status_code == 200 and data.get("app") == "VASTUDA" and data.get("version") in ("5.3", "5.4") and "commit" in data, f"app={data.get('app')} v={data.get('version')} commit={data.get('commit')}")
except Exception as e:
    record("11. Version endpoint", False, str(e))

# 12. Static assets: CSS and JS load properly
try:
    css_r = requests.get(f"{BASE}/static/css/style.css", timeout=3)
    js_r = requests.get(f"{BASE}/static/js/app.js", timeout=3)
    record("12. Static assets (CSS/JS)", css_r.status_code == 200 and js_r.status_code == 200, f"css_bytes={len(css_r.content)}, js_bytes={len(js_r.content)}")
except Exception as e:
    record("12. Static assets", False, str(e))

# 13. Search with no API keys: falls back to local index / zero-auth providers gracefully
try:
    # Query local indexed content "python"
    r = requests.get(f"{BASE}/api/search?q=python", timeout=5).json()
    results = r.get("results", [])
    record("13. Search fallback (local index / zero-auth)", len(results) > 0 and r.get("provider") in ("local_index", "hybrid_vastuda", "wikipedia_fallback", "tavily", "multi_provider"), f"provider={r.get('provider')}, results={len(results)}")
except Exception as e:
    record("13. Search fallback", False, str(e))

print("==================================================")
print(f"Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
print("==================================================")

if failed > 0:
    sys.exit(1)
sys.exit(0)
