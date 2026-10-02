# STAUNT Browser v2.0.1

### Improvements
- Dynamic application version resolution in About dialog via Electron runtime API.
- Tab navigation resilience: automatic waking of sleeping/hibernated background tabs prior to omnibox navigation.
- Silent suppression of unhandled navigation promise rejections on aborted/superseded page loads.

### Bug Fixes
- Resolved history vault pollution: internal schemes (`data:`, `file:`, `about:`, `staunt:`, `javascript:`, and `newtab.html`) are strictly rejected from `recordHistory`, `isUrlBookmarked`, and `closedTabsStack`.
- Fixed connection error card: Retry button now navigates directly via `window.location.href = '${safeFailedUrl}'` instead of reloading the internal `data:` URI.
- Prevented duplicate tab initialization on startup by gating renderer fallback tab creation behind non-Electron environment checks.
- Replaced hardcoded localhost search fallback URL in `platform-bridge.js` with production `STAUNT_PRODUCTION_URL` (`https://staunt.vercel.app`).

### Security
- Defense-in-depth IPC sender verification enforced across all navigation and vault channels.
- Strict isolation preserved: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Zero commercial telemetry, zero analytics tracking SDKs, and zero third-party profiling cookies.
- Navigational guard blocks dangerous schemes (`javascript:`, `vbscript:`, `chrome:`, `ms-appx:`).

### Windows
- Binary: `windows/desktop/dist/Staunt Browser Ultra Setup 2.0.1.exe`
- Architecture: x64 NSIS Installer
- Electron Runtime: 33.4.11 / Chromium 130
- Size: 83,225,704 bytes
- SHA-256: `870F3370CFE3F0ABA06569724FFCE37C0749941F369CC3058BAFF0EA5782A29F`
- Automated QA: 20/20 runtime contract tests passed, 91 passed in full pytest regression suite.

### Android
- Preserved Release Package: `release/STAUNT-2.0.0-Android.apk` (v2.0.1 binary build blocked pending release signing credentials)
- Package Name: `com.staunt.browser`
- Min SDK: 26 | Target SDK: 34
- Signature: v2 Scheme Verified (`CN=Staunt Browser, OU=Engineering, O=VASTUDA Sovereign Systems, L=Global, ST=Global, C=IN`)
- SHA-256: `04C54718B7881CFF9D29006DEEFC659696D2D01B93C592B09FBFE0AFFC9EEAD8`
- Source Status: Kotlin sources verified and compiled cleanly (`compileDebugKotlin` passed).

### Verification
- Automated tests: 20/20 Runtime Contract QA PASS, 91 passed / 13 skipped / 0 failed in pytest suite.
- Android signature: Verified (v2 scheme valid, 4096-bit RSA key).
- Windows installer SHA-256: `870F3370CFE3F0ABA06569724FFCE37C0749941F369CC3058BAFF0EA5782A29F`
- Android APK SHA-256: `04C54718B7881CFF9D29006DEEFC659696D2D01B93C592B09FBFE0AFFC9EEAD8`
