# STAUNT Search Engine — API Reference

## Base URL
- Production: Configured via `$STAUNT_PUBLIC_URL` (e.g. `https://staunt-search.onrender.com` or custom domain once deployment is verified)
- Local Development: `http://127.0.0.1:5000`

---

## 1. Health Check

### `GET /health`
Returns service vitality and current operational status.

**Response `200 OK`:**
```json
{
  "service": "VASTUDA Sovereign Search & Discovery Engine",
  "status": "ok",
  "timestamp": 1790069641,
  "version": "5.4"
}
```

---

## 2. Search Endpoints

### `GET /api/search`
Executes full-text web discovery across sovereign index and external providers.

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `q` | string | Yes | Search query string |
| `page` | integer | No | Page number (default: `1`) |
| `limit` | integer | No | Results per page (default: `10`, max: `50`) |
| `category` | string | No | `all`, `images`, `news` (default: `all`) |

**Rate Limit:** 60 requests / minute per IP. Returns `429 Too Many Requests` with `Retry-After: 60`.

**Response `200 OK`:**
```json
{
  "status": "success",
  "query": "wikipedia",
  "total_found": 89,
  "page": 1,
  "results": [
    {
      "title": "Wikipedia, the free encyclopedia",
      "url": "https://en.wikipedia.org/wiki/Main_Page",
      "snippet": "Wikipedia is a free online encyclopedia...",
      "domain": "wikipedia.org",
      "score": 12.45
    }
  ]
}
```

---

### `GET /api/suggest`
High-speed prefix completion for omnibox and search bar.

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `q` | string | Yes | Query prefix |

**Rate Limit:** 200 requests / minute per IP.

**Response `200 OK`:**
```json
[
  "wikipedia",
  "wikipedia english",
  "wikipedia search",
  "wikipedia india"
]
```

---

### `POST /api/overview`
Generates an AI-synthesized, source-grounded answer for the query.

**Headers:** `Content-Type: application/json`

**Body:**
```json
{
  "query": "what is quantum computing",
  "results": [...]
}
```

**Rate Limit:** 30 requests / minute per IP.

**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "overview": "Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics to solve problems too complex for classical computers [1].",
    "sources": [
      {
        "index": 1,
        "title": "What is Quantum Computing? | IBM",
        "url": "https://www.ibm.com/topics/quantum-computing"
      }
    ]
  }
}
```

---

## 3. Releases & Distribution

### `GET /api/releases`
Returns all verified release packages with cryptographic SHA-256 checksums.

**Response `200 OK`:**
```json
[
  {
    "platform": "Windows",
    "filename": "STAUNT-Windows-Setup.exe",
    "version": "1.0.0",
    "size_bytes": 83706273,
    "sha256": "79be7475a7ccd7752f942d0763eeb966b56c6f52414eabd1de730cf2aa4d1f32",
    "release_date": "2026-09-21"
  },
  {
    "platform": "Windows",
    "filename": "STAUNT-Windows-Portable.zip",
    "version": "1.0.0",
    "size_bytes": 83713684,
    "sha256": "768a33c24cf8f3cca7c67216b45d9cf6076bc50d52faed002a4cb0d0cd41aa6c",
    "release_date": "2026-09-21"
  },
  {
    "platform": "Android",
    "filename": "STAUNT-Android.apk",
    "version": "1.0.0",
    "size_bytes": 2220762,
    "sha256": "128f03c9b4e58dfbc1ed3a90b725b0ab61d241e71cc6f0e4d7fa79193d91c9cf",
    "release_date": "2026-09-21"
  }
]
```

### `GET /download/windows`
Downloads the official Windows Setup installer executable (`STAUNT-Windows-Setup.exe`).

### `GET /download/windows-portable`
Downloads the portable Windows package (`STAUNT-Windows-Portable.zip`).

### `GET /download/android`
Downloads the official Android APK (`STAUNT-Android.apk`).
