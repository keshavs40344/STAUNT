# STAUNT 2.0.0 — Privacy & Data Architecture

This document describes the privacy architecture, data handling practices, and technical security boundaries implemented in STAUNT Browser 2.0.0 across Windows and Android.

---

## 1. Principles & Commitments
STAUNT is built with a local-first, minimal-data footprint philosophy:
* **No Analytics SDKs:** Neither the Windows desktop browser nor the Android application includes Google Analytics, Firebase Analytics, Mixpanel, Segment, or any other telemetry/metrics reporting library.
* **No Behavioral Profiling:** Your browsing patterns, open tabs, bookmarks, and search queries are never processed into user behavioral profiles or sold to advertising exchanges.
* **No Telemetry Pings:** STAUNT does not transmit periodic heartbeat pings, software diagnostic telemetry, or crash reports to remote servers without explicit user invocation.
* **No Forced Authentication:** Using STAUNT does not require creating an account, logging in, or syncing data with cloud servers.

---

## 2. Local Data Storage

All persistent user data is stored strictly locally on your physical machine or device within operating system-protected directories.

### Windows (`Staunt Browser Ultra`)
User profile data is stored exclusively in `%APPDATA%\staunt-browser\`:
* `staunt_history_vault.json`: Local chronological browsing history and bookmarks list.
* `staunt_session_tabs.json`: URLs and active tab states restored across browser restarts.
* `staunt_settings.json`: User-configured preferences (e.g., ad blocker toggle, custom download directory, search engine selection).
* `window-state.json`: Window size, maximize state, and display screen coordinates.

*Note: In Private/Incognito windows, history and session records are held only in volatile memory and are purged upon window close.*

### Android (`Staunt Browser`)
User data is stored strictly in the private app sandbox (`/data/data/com.staunt.browser/databases/`):
* SQLite databases storing bookmarks and browsing history.
* Standard Android `SharedPreferences` storing local browser configuration.
* In Incognito mode, WebView data storage and history recording are disabled.

---

## 3. Network Requests & External Interactions

It is technically necessary for a web browser to transmit network requests to function. Here is an explicit breakdown of all network interactions:

### A. Web Navigation
* When you navigate to a third-party website (e.g., `https://example.com`), your computer connects directly to that website's hosting server via standard HTTP/HTTPS.
* The destination website and network intermediaries (ISP, local Wi-Fi router) can see your public IP address and the domain you are visiting, as is true for all standard web browsers.

### B. Search Queries & Autocomplete
* By default, search queries entered into the address bar route to the STAUNT Sovereign Search engine (`https://staunt.vercel.app`).
* When typing in the address bar with autocomplete active, prefix queries are queried against `https://staunt.vercel.app/api/suggest?q=...` to fetch suggested search completions.
* These requests do not send persistent identifiers, advertising IDs, or authentication cookies.
* Users can switch their default search provider in Settings to alternative search engines (such as DuckDuckGo, Bing, or Google) if desired.

### C. Ad & Tracker Blocking
* **Windows:** The browser bundles `@ghostery/adblocker-electron` to intercept network requests locally before they are transmitted, filtering out known tracker domains, third-party cookies, and ad scripts based on standard blocklists.
* **Android:** The browser runs a native regex-based `AdBlockEngine` inside `shouldInterceptRequest` to prevent known tracking scripts and advertising resources from loading.

---

## 4. Process Isolation & Security Architecture

* **Context Isolation:** All Electron web views run with `contextIsolation: true`. Web scripts cannot access the internal JavaScript environment of preload or main processes.
* **Node Integration Disabled:** All web views run with `nodeIntegration: false`. Web pages cannot execute native operating system calls or Node.js APIs.
* **Strict IPC Sender Verification:** Native IPC handlers verify the origin of all events (`verifyIpcSender`) ensuring web pages cannot forge commands to the browser's native layer.
* **Android Cleartext Policy:** Arbitrary HTTP cleartext connections are restricted via `network_security_config.xml`.

---

## 5. Scope & Transparent Technical Boundaries

* **No Claim of Anonymity:** STAUNT is a sovereign, tracker-free web browser, not an anonymity network like Tor. It does not route traffic through onion relays or disguise your IP address from destination servers.
* **Malicious Websites:** While ad and tracking filters block many malicious scripts, STAUNT cannot protect against user-authorized downloads of malicious files or phishing pages that mimic legitimate services.
