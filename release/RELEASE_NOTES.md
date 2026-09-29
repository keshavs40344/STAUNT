# STAUNT 2.0.0 — Release Notes

**Release Date:** September 28, 2026  
**Product Version:** 2.0.0  
**Status:** General Availability (Public Release)

---

## 1. Overview
STAUNT is a lightweight, privacy-focused sovereign web browser built for Windows and Android. Designed to provide autonomous, tracker-free web browsing with built-in ad-blocking, local session persistence, and tight integration with the STAUNT sovereign search engine, STAUNT 2.0.0 delivers an enterprise-hardened browsing experience without commercial telemetry, third-party analytics, or forced cloud accounts.

---

## 2. Windows Features (Staunt Browser Ultra)
* **Architecture:** Electron 33.4.11 / Chromium 130 runtime packaged as a 64-bit NSIS installer.
* **Modern Tab Interface:** Multi-tab browsing with dynamic title resolution, favicon loading, tab closing/switching, and split-screen viewing capability.
* **Navigation Controls:** Back, forward, reload/stop, home, and intelligent omnibox address bar.
* **In-Page Tools:** Native Find-in-Page (`Ctrl+F`), zoom controls (`Ctrl+` / `Ctrl-` / `Ctrl+0`), fullscreen toggle (`F11`), and PDF printing/export (`Ctrl+P`).
* **Session Persistence:** Remembers open tabs across app launches; saves window geometry and state cleanly in user profile.
* **Local Data Management:** Full local bookmarks system, searchable browsing history vault, and customizable settings modal.
* **Custom Download Destination:** User-selectable download directory in Settings with native folder picker and automatic fallback to standard OS Downloads if the custom folder is removed.

---

## 3. Android Features (Staunt Browser)
* **Architecture:** Native Kotlin Android application built against Android 14 (API 34) with compatibility down to Android 8.0 (API 26).
* **Tab Management:** Integrated grid-based tab switcher with tab count indicator and real-time tab thumbnail previews.
* **Navigation:** Responsive omnibox with progress indication, swipe-to-refresh, security indicator, and hardware back-button navigation handling.
* **Tools:** Native Find-in-Page modal with match count and next/previous jumping; local bookmarks and history tracking.
* **Downloads:** Built-in download manager using Android DownloadManager and Scoped Storage without demanding broad legacy storage permissions.
* **Incognito Mode:** Private browsing session support leaving zero persistent records in local history databases.

---

## 4. STAUNT Search Integration
* **Production Endpoint:** Directly connected to `https://staunt.vercel.app` for web search and query suggestions.
* **Intelligent Omnibox Classification:**
  * Full URLs (`https://...`, `file://...`, `staunt://...`) navigate directly.
  * Domain names (`github.com`, `wikipedia.org`, `localhost:3000`) resolve directly with protocol normalization.
  * Mathematical expressions (`120*45`, `250/5`) trigger instant calculation.
  * Keyword queries (`python`, `Virat Kohli`) route to STAUNT Sovereign Search.
* **Search Autocomplete:** Fast suggestion suggestions via `/api/suggest` with zero tracking cookies or identifier transmission.
* **Resilient SERP Fallbacks:** Graceful multi-provider fallbacks and custom branded error recovery when offline.

---

## 5. Privacy & Security
* **Zero Telemetry:** No analytics SDKs, no behavioral tracking beacons, no cloud telemetry pings.
* **No Profiling:** Search queries and navigation history are never bound to an identity or monetized.
* **Process Sandboxing:** Windows `WebContentsView` instances run with `contextIsolation: true` and `nodeIntegration: false`.
* **IPC Channel Hardening:** All inter-process communication is validated with `verifyIpcSender` checks to prevent unauthorized DOM-level escalation.
* **Built-in Ad & Tracker Blocker:** Ghostery AdBlocker integrated into Windows network request pipeline; native regex-based `AdBlockEngine` on Android.
* **Isolated Private Storage:** Windows user profiles remain isolated in `%APPDATA%\staunt-browser`; Android profiles remain strictly in app-private sandbox `/data/data/com.staunt.browser`.

---

## 6. Downloads
* **Windows:**
  * Configurable download folder in Settings > General > Download Location.
  * Real-time download progress tracking in the Downloads panel.
  * Directory validation with graceful, crash-free fallback to standard OS Downloads folder (`app.getPath('downloads')`).
* **Android:**
  * Downloads route through Android's system DownloadManager into the standard `Downloads` directory using Scoped Storage guidelines.

---

## 7. Verified Browser Functionality
The following core capabilities have been implemented and verified:
- [x] Omnibox URL navigation & domain resolution
- [x] Multi-tab lifecycle (create, switch, close, restore)
- [x] Search query classification & autocomplete
- [x] Bookmarks storage & quick launch
- [x] Searchable browsing history vault
- [x] Private / Incognito browsing
- [x] File downloads with progress & folder customizer (Windows)
- [x] Find-in-page (`Ctrl+F` / in-page bar)
- [x] Page zoom (in, out, reset)
- [x] Fullscreen mode toggle
- [x] PDF printing & export
- [x] Math expression evaluation
- [x] Branded offline & network error recovery

---

## 8. Release Artifacts
| Platform | Artifact Name | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **Windows x64** | `STAUNT-2.0.0-Windows-x64-Setup.exe` | 83,219,252 bytes | `c30ff799012600a3f964d02402c15d80605e0678e0b3d69ebaea1d223b8a22c7` |
| **Android** | `STAUNT-2.0.0-Android.apk` | 2,364,332 bytes | `04c54718b7881cff9d29006deefc659696d2d01b93c592b09fbfe0affc9eead8` |

---

## 9. Known Limitations
1. **Windows Authenticode Signing:** The Windows installer is currently unsigned (built without a commercial EV certificate). Windows SmartScreen may present an "Unknown Publisher" prompt upon first launch.
2. **Android Distribution:** The Android APK is distributed as a standalone APK file for direct sideloading and is not hosted on the Google Play Store.
3. **Android Download Path:** Due to Android's strict Scoped Storage architecture, Android downloads always target the system `Download` folder and cannot be pointed to arbitrary external paths.
4. **Chrome Extensions:** Third-party Chrome Web Store extensions are not supported.

---

## 10. Verification & Checksums
All release binaries can be verified using the provided `SHA256SUMS.txt` file or via standard command-line tools:

**Windows (PowerShell):**
```powershell
Get-FileHash -Algorithm SHA256 .\STAUNT-2.0.0-Windows-x64-Setup.exe
```

**Linux / macOS / Android Termux:**
```bash
sha256sum -c SHA256SUMS.txt
```
