# STAUNT — System Architecture Document

## Overview

STAUNT is an integrated, sovereign web ecosystem comprising three distinct products:
1. **STAUNT Search Engine**: Fast, privacy-first, neural-augmented web discovery platform.
2. **STAUNT Browser for Windows**: Custom Chromium desktop browser built on Electron `WebContentsView`.
3. **STAUNT Browser for Android**: Lightweight, hardware-accelerated Kotlin mobile browser with built-in ad blocking.

---

## 1. System Topology

```
                              ┌─────────────────────────┐
                              │     Internet Clients    │
                              └───────────┬─────────────┘
                                          │ HTTPS
                                          ▼
                              ┌─────────────────────────┐
                              │  Render / Cloudflare    │
                              │    Reverse Proxy        │
                              └───────────┬─────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
  ┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
  │  STAUNT Web UI    │         │ STAUNT Windows    │         │  STAUNT Android   │
  │  (Search-First)   │         │ Desktop Browser   │         │  Mobile Browser   │
  └─────────┬─────────┘         └─────────┬─────────┘         └─────────┬─────────┘
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────────┐
                              │   STAUNT Search API     │
                              │ (Flask / WSGI Gunicorn) │
                              └───────────┬─────────────┘
                                          │
               ┌──────────────────────────┴──────────────────────────┐
               ▼                                                     ▼
     ┌───────────────────┐                                 ┌───────────────────┐
     │  SQLite / FTS5    │                                 │   Neural Augment  │
     │  BM25 Index & DB  │                                 │  (Groq / Llama)   │
     └───────────────────┘                                 └───────────────────┘
```

---

## 2. Component Specifications

### A. STAUNT Search Engine (`search-engine/`)
- **Backend**: Python 3.12+ / Flask / WSGI.
- **Index Engine**: SQLite 3 with FTS5 virtual tables and BM25 ranking algorithm.
- **Query Pipeline**:
  1. Input normalization & spell correction.
  2. Local index retrieval (FTS5 match + BM25 score + domain diversity penalty).
  3. External web fallbacks (Tavily/Wikipedia) when local coverage is sparse.
  4. Neural overview synthesis with TTL caching.
- **Security**:
  - Non-wildcard CORS with origin reflection.
  - Strict Content-Security-Policy (CSP).
  - HTTPS-aware HSTS headers.
  - Per-endpoint rate limiting (`/api/search`: 60 rpm, `/api/overview`: 30 rpm, `/api/suggest`: 200 rpm) returning HTTP 429 with integer `Retry-After`.

### B. STAUNT Browser for Windows (`windows/`)
- **Runtime**: Electron v33+ with Chromium core.
- **Rendering Architecture**: Native `WebContentsView` instances managed directly by the main process (no embedded iframes).
- **Window Management**: Custom frameless window with native DPI-aware bounds calculation ensuring 0px drift across 10+ resize/minimize/maximize cycles.
- **Storage Vaults**: Atomic two-phase commit writes (`.tmp` -> `.bak` -> `.json`) with self-healing on parse corruption.
- **Lifecycle GC**: Explicit tab destruction sequence (`stop()` -> `close()` -> `destroy()`) preventing memory leaks during 50+ tab stress.

### C. STAUNT Browser for Android (`android/`)
- **Language & Runtime**: 100% Kotlin on Android SDK 26-34.
- **View Engine**: Hardware-accelerated `WebView` with custom `WebViewClient`.
- **Content Blocking**: In-process `AdBlockEngine` checking network requests against known tracking/ad host patterns before dispatch.
- **Search Integration**: Default omnibox routing points to the live STAUNT Search API.

---

## 3. Storage & Persistence
- **Index Database**: `search-engine/backend/vastuda.db` (WAL mode enabled for concurrent read/write throughput).
- **Release Manifest**: `releases/releases.json` tracking authentic binary packages with SHA-256 hashes.
- **Desktop Vaults**: Encrypted/isolated user data stored in `%APPDATA%\staunt-browser\`.
