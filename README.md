# STAUNT — Sovereign Search Engine & Native Browsers

Official repository containing the three core STAUNT products:
1. **STAUNT Search Engine**: High-speed, private, neural-augmented web discovery and search API.
2. **STAUNT Browser for Windows**: Production-grade, custom-built native Chromium desktop browser.
3. **STAUNT Browser for Android**: Fast, battery-efficient Android browser powered by hardware-accelerated WebView and native ad-blocking.

---

## 🏛️ Target Product Architecture

```
                         STAUNT
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          SEARCH         WINDOWS       ANDROID
          ENGINE         BROWSER        BROWSER
             │             │             │
          Web UI          EXE            APK
             │             │             │
             └─────────────┴─────────────┘
                           │
                     STAUNT Search API
```

---

## 📂 Repository Structure

```
STAUNT/
    search-engine/
        backend/       # Flask search backend, FTS5 BM25 retrieval, query engine
        frontend/      # Static assets & scripts
        templates/     # Clean, search-first Web UI (no browser simulation)
        static/        # Icons, stylesheets, client JavaScript
        crawler/       # Discovery crawler, seed URLs, HTML parser
        index/         # SQLite/FTS5 persistent index storage
        tests/         # Automated unit & quality tests
        wsgi.py        # Production WSGI entry point (Waitress/Gunicorn)
        requirements.txt

    windows/
        desktop/       # Verified Electron & WebContentsView desktop engine
        installer/     # Windows Setup installer and portable packages
        tests/         # Regression, resilience, and UI contract tests

    android/
        app/           # Native Kotlin Android application
        gradle/        # Gradle build scripts and properties
        tests/         # Android unit & parity checks

    releases/          # Official release binaries and SHA-256 releases.json
    docs/              # Architectural documentation & manuals
    README.md
    .gitignore
```

---

## 🚀 Products Overview

### 1. STAUNT Search Engine
- **Search-First Web Interface**: Clean, minimalist Google/DuckDuckGo style interface. Zero decorative widget bloat, zero simulated browser chrome, zero fake stock/weather cards.
- **Backend Core**: Python Flask with SQLite/FTS5 full-text indexing, BM25 ranking, exact phrase matching, domain diversity damping, and AI summary overviews.
- **Security Hardened**: Non-wildcard CORS (strict origin reflection), Content-Security-Policy (CSP), HSTS over HTTPS, and per-endpoint rate limits returning HTTP 429 with `Retry-After`.
- **Verified Endpoints**:
  - `GET /` — Minimalist Search Homepage
  - `GET /health` — High-speed JSON health probe (`status`, `service`, `version`, `timestamp`)
  - `GET /api/search?q={query}` — Neural web search results
  - `GET /api/suggest?q={prefix}` — Fast autocomplete suggestions
  - `POST /api/overview` — Neural synthesis overview
  - `GET /download/windows` — Real Windows setup executable download
  - `GET /download/android` — Real Android APK package download

### 2. STAUNT Browser for Windows
- **Engine**: Genuine Chromium core running on Electron v33 runtime with multi-process architecture.
- **Viewport**: Real `WebContentsView` (no embedded iframes for web rendering).
- **Features**: Complete native tab lifecycle (new tab, close, middle-click, cycle, drag reorder), smart omnibox URL vs search routing, bookmarks vault, history vault, atomic JSON settings persistence, three-dot menu, and native window controls with 0px bounds drift protection.

### 3. STAUNT Browser for Android
- **Engine**: Native hardware-accelerated Android System WebView with Kotlin app architecture.
- **Features**: Network-level ad and tracker blocker, multi-tab manager, smart omnibox, and default routing to STAUNT Search.

---

## 📦 Official Releases & Checksums

All official binary packages are cataloged in `releases/releases.json`:

| Platform | Filename | Size | SHA-256 Hash |
| :--- | :--- | :--- | :--- |
| **Windows** | `STAUNT-Windows-Setup.exe` | 83,706,273 bytes | `79be7475a7ccd7752f942d0763eeb966b56c6f52414eabd1de730cf2aa4d1f32` |
| **Windows** | `STAUNT-Windows-Portable.zip` | 83,713,684 bytes | `768a33c24cf8f3cca7c67216b45d9cf6076bc50d52faed002a4cb0d0cd41aa6c` |
| **Android** | `STAUNT-Android.apk` | 2,220,762 bytes | `128f03c9b4e58dfbc1ed3a90b725b0ab61d241e71cc6f0e4d7fa79193d91c9cf` |

---

## 🧪 Verification & Test Suite

Run test suites from the root directory:

```bash
# 1. Search Engine Quality & Ranking
python search-engine/tests/test_phase5_3.py
python search-engine/tests/test_phase5_4.py

# 2. Search Engine Contract & Security
python search-engine/tests/test_phase5_8.py
python search-engine/tests/test_failure_simulations.py
python search-engine/tests/test_backup_restore.py

# 3. Windows Browser Architecture & Resilience
python windows/tests/test_browser_phase5_6.py
python windows/tests/test_browser_phase5_7.py
python windows/tests/test_browser_resilience.py
python windows/tests/test_step31_regression.py
```

---

## 📄 License & Attribution
&copy; 2026 STAUNT. Developed under Sovereign Open Standards.
