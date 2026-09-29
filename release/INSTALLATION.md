# STAUNT 2.0.0 — Installation Guide

This document provides step-by-step instructions for installing and verifying STAUNT Browser 2.0.0 on Windows and Android.

---

## 1. Windows Installation (Staunt Browser Ultra)

### Step 1: Download the Installer
Download the official 64-bit setup package:
* File: `STAUNT-2.0.0-Windows-x64-Setup.exe` (or `Staunt Browser Ultra Setup 2.0.0.exe`)
* Size: ~79.3 MB (83,218,284 bytes)

### Step 2: Verify Checksum (Recommended)
Before running the executable, verify that the downloaded binary is authentic and untampered:
1. Open PowerShell in the folder where the file was downloaded.
2. Run:
   ```powershell
   Get-FileHash -Algorithm SHA256 .\STAUNT-2.0.0-Windows-x64-Setup.exe
   ```
3. Confirm that the output matches:
   ```
   C30FF799012600A3F964D02402C15D80605E0678E0B3D69EBAEA1D223B8A22C7
   ```

### Step 3: Run the Installer
1. Double-click `STAUNT-2.0.0-Windows-x64-Setup.exe`.
2. Follow the NSIS setup wizard prompts to select an installation folder (defaults to `%LOCALAPPDATA%\Programs\Staunt Browser Ultra`).
3. Complete the installation. Desktop and Start Menu shortcuts ("Staunt Browser") will be created automatically.

### Notice Concerning Windows SmartScreen
Because this is an independent, open-source build that does not currently embed an expensive commercial Authenticode EV code-signing certificate, Microsoft Defender SmartScreen may display an informational dialog stating:
> *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

**What this means:**
Windows displays this notice for newly released or independently compiled applications that haven't yet accumulated widespread cryptographic reputation across Microsoft servers. It does not indicate the presence of malware.

**How to proceed:**
* Always verify the SHA-256 checksum first against the official release list.
* If the hash matches the official release hash, you can safely proceed by clicking **"More info"** and then selecting **"Run anyway"**.

---

## 2. Android Installation (Staunt Browser)

### Step 1: Download the APK
Download the Android release package:
* File: `STAUNT-2.0.0-Android.apk` (or `Staunt Browser 2.0.0.apk`)
* Size: ~2.17 MB (2,277,262 bytes)
* Minimum Requirements: Android 8.0 (API 26) or higher.

### Step 2: Verify Checksum (Recommended)
You can verify the file hash on your device using a terminal app (such as Termux) or on your computer before transferring:
```bash
sha256sum STAUNT-2.0.0-Android.apk
```
Confirm the hash matches:
```
ad8f1097e07c1eee690f2a43b89345832b19476cce48a3595addbdddf99a528f
```

### Step 3: Sideload & Install the APK
STAUNT is distributed directly as an APK and is **not** hosted on the Google Play Store.
1. Tap the downloaded `.apk` file in your browser or file manager.
2. If prompted by Android about installing apps from unknown sources:
   * Android may notify you: *"For your security, your phone is not allowed to install unknown apps from this source."*
   * Tap **Settings** on the prompt.
   * Toggle **"Allow from this source"** for your file manager or browser.
   * Return to the installer and tap **Install**.
3. Once installation completes, tap **Open** to launch Staunt Browser.

---

## 3. Upgrades and Reinstallation
* **Data Safety:** Reinstalling or running a newer version installer will preserve your bookmarks, history vault, open session tabs, and settings.
* **Windows Data Location:** `%APPDATA%\staunt-browser`
* **Android Data Location:** `/data/data/com.staunt.browser`
* Running the uninstaller on Windows will remove the program binaries without deleting your user profile data.
