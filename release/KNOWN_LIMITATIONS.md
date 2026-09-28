# STAUNT 2.0.0 — Known Limitations

This document lists the verified technical and distribution limitations of STAUNT Browser 2.0.0.

---

## 1. Distribution & Code Signing
* **Unsigned Windows Installer:** The Windows executable (`STAUNT-2.0.0-Windows-x64-Setup.exe`) is not signed with a commercial Microsoft Authenticode Extended Validation (EV) certificate. As a result, Windows Defender SmartScreen may display an "Unknown Publisher" warning on initial installation. Users must verify the SHA-256 hash and click "More info -> Run anyway".
* **Direct APK Distribution (Android):** The Android release (`STAUNT-2.0.0-Android.apk`) is distributed directly as an APK and is not available through Google Play Store. Users must allow installation from "Unknown Sources" on Android.

---

## 2. Platform & OS Capabilities
* **Android Download Directory:** On Android 10 and higher, file downloads are managed by the Android system `DownloadManager` and adhere to Android's Scoped Storage security model. Downloads are stored in the public `Download/` folder; user-defined custom directory paths are not supported on Android.
* **Chrome Extensions / Web Store:** STAUNT does not support extensions from the Google Chrome Web Store (`.crx` extensions) or custom browser add-on frameworks.
* **DRM / Widevine Content:** Protected media streams requiring proprietary Widevine DRM (such as Netflix or Spotify Web Player) may not play due to the absence of proprietary Google DRM binaries in custom Electron builds.

---

## 3. Network & Cloud Services
* **Cross-Device Sync:** STAUNT is local-first and does not provide an integrated cloud account system to synchronize tabs, history, or bookmarks between Windows and Android devices.
* **Anonymity Limits:** STAUNT is not an anonymizing proxy or Tor client. While third-party trackers and ads are actively blocked, websites and ISPs still observe the user's public IP address during normal HTTPS browsing.
