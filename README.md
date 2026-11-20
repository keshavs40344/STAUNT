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
- **Engine**: Genuine Chromium core running on Electron v33 runtime with multi-process architecture and `WebContentsView`.
- **Search Sovereignty**: 24 built-in global and privacy search engines with fully visible operational addresses, plus arbitrary custom search URL templates (`%s`, `{query}`, `{searchTerms}`).
- **Living Ambient Interface**: 8 offline living backdrop scenes with subtle natural motion (Living Sky, Mountain Escape, Aurora, Ocean Depths, Living Cosmos, Ambient Flow, Midnight Slate, Warm Cloud).
- **Features**: Complete native tab lifecycle, smart omnibox URL vs search classification, bookmarks vault, history vault, atomic two-phase commit JSON settings persistence, three-dot menu, and native window controls with 0px bounds drift protection.

### 3. STAUNT Browser for Android
- **Engine**: Native hardware-accelerated Android System WebView with Kotlin app architecture.
- **Desktop Site Mode**: Per-tab toggleable Desktop Mode delivering Linux x86_64 Desktop Chrome User Agent, wide viewport (`useWideViewPort = true`), and overview mode (`loadWithOverviewMode = true`).
- **Desktop Parity New Tab**: Embedded living ambient backdrop canvas with offline scenes, floating scene controller, multi-engine selector badge, and 10 squircle shortcuts.
- **Search Integration**: Full 24 search engines with visible operational addresses, URL query extraction in omnibox, and settings integration with custom template support.
- **Content Blocking**: In-process `AdBlockEngine` checking network requests against known tracking/ad host patterns before dispatch.

---

## 🏆 Competitive Strategy: How STAUNT Outperforms Big Tech Browsers

For the in-depth architectural blueprint and roadmap detailing how STAUNT surpasses **Google Chrome**, **Microsoft Edge**, and **Apple Safari**, see our dedicated technical document:

* 📄 **[STAUNT vs. Chrome, Edge & Safari: Architectural Supremacy & Roadmap](docs/CHROME_EDGE_SAFARI_COMPETITIVE_ROADMAP.md)**
  * **Privacy**: Zero corporate telemetry, offline ad-blocking that survives Manifest V3, and clean partition isolation.
  * **Resource Efficiency**: 8.4 MB mobile APK (vs Chrome's 150MB+), 85% RAM reduction on background tabs via intelligent hibernation.
  * **Search Sovereignty**: 24+ search engines with visible query addresses vs Google/Edge/Safari search monopoly lock-in.
  * **Aesthetics & Utility**: Living ambient scenes, native Command Palette (`Ctrl+Shift+P`), and split-view productivity.
* 🚀 **[Comprehensive Future Implementation Blueprint](docs/FUTURE_IMPLEMENTATIONS.md)**
  * **Deep Tab Sleep**: 85% memory compression for inactive tabs with instant state resurrection.
  * **Dual Viewport**: Side-by-side split screen with synchronized document scrolling.
  * **Chrome Extension Bridge**: Native Chrome Web Store extension loading with privacy permission firewalls.
  * **Sovereign P2P Sync**: Serverless zero-knowledge encrypted sync between Windows and Android using WebRTC.
  * **On-Device Private AI**: 100% offline local WebGPU page summarization and reader cleaning.
  * **Download Accelerator**: Multi-threaded parallel segmented chunk fetching with checksum validation.

---

## 📦 Current Release (STAUNT 2.1.0)

**Latest Release:** November 2026  
**Status:** General Availability (Public Release)

| Platform | Filename | Size | SHA-256 Hash / Status |
| :--- | :--- | :--- | :--- |
| **Windows x64** | `STAUNT-2.1.0-Windows-x64-Setup.exe` | ~85 MB | Verified via Automated Electron Test Suites (Audit & Search E2E) |
| **Android** | `app-debug.apk` | 8,473,101 bytes (8.47 MB) | Verified via `gradlew testDebugUnitTest` & `assembleDebug` |

### Release Documentation
* **[Release Notes](release/RELEASE_NOTES.md)**: Full changelog, supported capabilities, and verified browser features.
* **[Future Implementation Blueprint](docs/FUTURE_IMPLEMENTATIONS.md)**: Technical specifications for upcoming milestones.
* **[Competitive Roadmap](docs/CHROME_EDGE_SAFARI_COMPETITIVE_ROADMAP.md)**: Engineering plan for dominance over Chrome, Edge, and Safari.
* **[Installation Guide](release/INSTALLATION.md)**: Step-by-step installation instructions and checksum verification for Windows & Android.
* **[Privacy & Data Architecture](release/PRIVACY.md)**: Zero-telemetry policy, local storage layout, and network communication disclosure.
* **[Known Limitations](release/KNOWN_LIMITATIONS.md)**: Verified boundaries including unsigned Windows installer and Android Scoped Storage behavior.
* **[Checksums](release/SHA256SUMS.txt)**: Direct SHA-256 checksums file.

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
