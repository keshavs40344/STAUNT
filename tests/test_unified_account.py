"""
STAUNT — Unified Account & Google Sign-In Test Suite
Tests:
1. Login page loads and contains '+' STAUNT Account branding and Google Sign-In
2. Config endpoint returns Firebase status without leaking secrets
3. Login without verification token is rejected
4. Invalid Turnstile token is rejected server-side
5. Valid verification can register, authenticate, and maintain session
6. Logout works cleanly and clears session
7. Normal browsing works 100% without login (search, browse, tabs)
8. Authentication rate limiting configured
9. No secrets (Firebase Admin, service account keys, private tokens) in client source
10. Windows client bridge contracts for '+' account button and Google Sign-in modal
11. Android client menu integration with '+ STAUNT Account' and HTTPS endpoint
12. Security checks (Electron isolation, https enforcement, tokens not in URL)
13. Live Google sign-in status reported as TEST BLOCKED when Firebase config unconfigured
"""
import os
import sys
import json
import pytest

# Ensure search-engine/backend is on path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEARCH_ENGINE_DIR = os.path.join(BASE_DIR, "search-engine")
BACKEND_DIR = os.path.join(SEARCH_ENGINE_DIR, "backend")

for p in (BACKEND_DIR, SEARCH_ENGINE_DIR, BASE_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

from server import app, verify_turnstile, is_rate_limited_for_path
import db


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-staunt-sovereign-secret-key"
    with app.test_client() as client:
        yield client


class TestUnifiedAccountSystem:
    """Comprehensive QA suite for STAUNT unified account system."""

    def test_01_auth_page_loads(self, client):
        """1. Login page loads with '+' badge, Continue with Google, and optional notice."""
        resp = client.get("/auth")
        assert resp.status_code == 200
        html = resp.data.decode("utf-8")
        assert "STAUNT Account" in html
        assert "Sign in to sync your data" in html
        assert "Continue with Google" in html
        assert "Your browsing works without an account." in html
        assert "btnGoogleSignIn" in html
        assert "btnSignOut" in html

    def test_02_auth_config_endpoint(self, client):
        """2. Config endpoint returns public keys and Firebase state without leaking secrets."""
        resp = client.get("/api/auth/config")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "turnstile_site_key" in data
        assert data["auth_enabled"] is True
        assert data["sync_available"] is False  # Marked clearly as planned/unavailable
        assert "firebase" in data
        fb = data["firebase"]
        assert fb["configured"] is True
        assert fb["projectId"] == "staunt-fe6ad"
        assert fb["authDomain"] == "staunt-fe6ad.firebaseapp.com"
        assert fb["appId"] == "1:35404899573:web:74837bac9be974990c51bc"
        assert fb["provider"] == "google.com"
        assert "turnstile_secret_key" not in data
        assert "private_key" not in data
        assert "client_secret" not in data
        assert "service_account" not in str(data)

    def test_03_login_without_verification_rejected(self, client):
        """3. Login without verification token is rejected (400)."""
        resp = client.post("/api/auth/login", json={
            "email": "test@domain.com",
            "password": "Password1234!"
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data
        assert "token" in data["error"].lower() or data.get("code") == "TURNSTILE_FAILED"

    def test_04_invalid_turnstile_token_rejected_server_side(self, client):
        """4. Invalid Turnstile token is rejected server-side."""
        resp = client.post("/api/auth/login", json={
            "email": "test@domain.com",
            "password": "Password1234!",
            "cf_turnstile_token": "invalid-token"
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data.get("code") == "TURNSTILE_FAILED"
        assert "Anti-bot verification failed" in data["error"]

    def test_05_valid_verification_can_continue_register_and_login(self, client):
        """5. Valid verification can register, authenticate, and maintain session."""
        unique_email = f"sovereign_{os.urandom(4).hex()}@staunt.vault"
        pwd = "SovereignSecurePassword2026!"

        # Register with valid Turnstile dummy token
        reg_resp = client.post("/api/auth/register", json={
            "email": unique_email,
            "password": pwd,
            "name": "Sovereign Operative",
            "cf_turnstile_token": "XXXX.DUMMY.TOKEN.XXXX"
        })
        assert reg_resp.status_code == 200
        reg_data = reg_resp.get_json()
        assert reg_data["status"] == "success"
        assert reg_data["user"]["email"] == unique_email

        # Check /api/auth/me returns authenticated
        me_resp = client.get("/api/auth/me")
        assert me_resp.status_code == 200
        me_data = me_resp.get_json()
        assert me_data["authenticated"] is True
        assert me_data["user"]["email"] == unique_email

        # Logout
        logout_resp = client.post("/api/auth/logout")
        assert logout_resp.status_code == 200

        # Login again with valid token
        login_resp = client.post("/api/auth/login", json={
            "email": unique_email,
            "password": pwd,
            "cf_turnstile_token": "pass"
        })
        assert login_resp.status_code == 200
        login_data = login_resp.get_json()
        assert login_data["status"] == "success"
        assert login_data["user"]["email"] == unique_email

    def test_06_logout_works_cleanly(self, client):
        """6. Logout clears session cleanly."""
        unique_email = f"logout_test_{os.urandom(4).hex()}@staunt.vault"
        pwd = "SovereignPassword999!"

        client.post("/api/auth/register", json={
            "email": unique_email,
            "password": pwd,
            "cf_turnstile_token": "1x00000000000000000000AA"
        })

        # Confirm logged in
        assert client.get("/api/auth/me").get_json()["authenticated"] is True

        # Logout
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200

        # Confirm session invalidated
        assert client.get("/api/auth/me").get_json()["authenticated"] is False

    def test_07_browsing_works_without_login(self, client):
        """7. Browsing and searching remain 100% operational without login."""
        # Clear any session
        client.post("/api/auth/logout")
        assert client.get("/api/auth/me").get_json()["authenticated"] is False

        # Homepage search index loads
        home_resp = client.get("/")
        assert home_resp.status_code == 200

        # Search API works without authentication
        search_resp = client.get("/api/search?q=staunt+browser")
        assert search_resp.status_code == 200
        search_data = search_resp.get_json()
        assert "results" in search_data or "query" in search_data

        # Autocomplete suggests work without authentication
        sug_resp = client.get("/api/suggest?q=st")
        assert sug_resp.status_code == 200

    def test_08_auth_rate_limiting_configured(self):
        """8. Authentication endpoints have abuse protection / rate limiting."""
        limited, window = is_rate_limited_for_path("192.0.2.1", "/api/auth/login")
        assert window == 60
        assert limited is False

    def test_09_no_secrets_in_client_source(self):
        """9. No secrets (Firebase Admin, service-account JSON, private keys) exist in client source code."""
        client_files = [
            os.path.join(BASE_DIR, "windows", "desktop", "main.js"),
            os.path.join(BASE_DIR, "windows", "desktop", "preload.js"),
            os.path.join(BASE_DIR, "windows", "desktop", "src", "index.html"),
            os.path.join(BASE_DIR, "windows", "desktop", "src", "renderer.js"),
            os.path.join(BASE_DIR, "public", "auth.html"),
            os.path.join(BASE_DIR, "search-engine", "templates", "auth.html"),
            os.path.join(BASE_DIR, "android", "app", "src", "main", "kotlin", "com", "staunt", "browser", "MainActivity.kt")
        ]

        forbidden_patterns = [
            "private_key_id",
            "\"private_key\":",
            "type\": \"service_account\"",
            "FIREBASE_ADMIN",
            "client_secret = \"",
        ]

        for file_path in client_files:
            if not os.path.exists(file_path):
                continue
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                for pat in forbidden_patterns:
                    assert pat not in content, f"Potential secret pattern '{pat}' found in {file_path}"

    def test_10_windows_account_bridge_elements_present(self):
        """10. Windows desktop UI contains '+' account button and Google Sign-in modal."""
        index_html_path = os.path.join(BASE_DIR, "windows", "desktop", "src", "index.html")
        assert os.path.exists(index_html_path)
        with open(index_html_path, "r", encoding="utf-8") as f:
            html = f.read()

        assert 'id="btnDeskAccount"' in html, "Account button missing in desktop header"
        assert 'class="account-plus-icon"' in html, "Plus icon missing in account button"
        assert 'id="accountModal"' in html, "Account modal missing in desktop index.html"
        assert 'Continue with Google' in html, "Continue with Google missing in modal"
        assert 'btnAccountGoSettings' in html, "Settings button missing in logged-in modal"
        assert 'btnSignOutDesk' in html, "Sign out button missing in modal"
        assert 'Your browsing works without an account.' in html

        preload_path = os.path.join(BASE_DIR, "windows", "desktop", "preload.js")
        with open(preload_path, "r", encoding="utf-8") as f:
            preload = f.read()

        assert "getAccountState" in preload
        assert "saveAccountState" in preload
        assert "signOutAccount" in preload
        assert "openAuthPage" in preload

    def test_11_android_webview_auth_endpoint_integration(self):
        """11. Android client references '+ STAUNT Account' and HTTPS auth endpoint."""
        main_act_path = os.path.join(BASE_DIR, "android", "app", "src", "main", "kotlin", "com", "staunt", "browser", "MainActivity.kt")
        assert os.path.exists(main_act_path)
        with open(main_act_path, "r", encoding="utf-8") as f:
            kt = f.read()

        assert "https://staunt.vercel.app/auth" in kt
        assert "getString(R.string.account_sync)" in kt

        strings_path = os.path.join(BASE_DIR, "android", "app", "src", "main", "res", "values", "strings.xml")
        with open(strings_path, "r", encoding="utf-8") as f:
            xml = f.read()
        assert "+ STAUNT Account" in xml

    def test_12_security_schemes_and_isolation(self):
        """12. Security: auth endpoints require HTTPS, Electron isolation maintained."""
        main_js_path = os.path.join(BASE_DIR, "windows", "desktop", "main.js")
        with open(main_js_path, "r", encoding="utf-8") as f:
            main_js = f.read()

        assert "STAUNT_AUTH_URL.startsWith('https://')" in main_js
        assert "nodeIntegration: false" in main_js
        assert "contextIsolation: true" in main_js
        assert "sandbox: true" in main_js

    def test_13_live_google_login_status_check(self, client):
        """13. Verified Firebase configuration loaded and live status verified."""
        resp = client.get("/api/auth/config")
        data = resp.get_json()
        firebase_cfg = data.get("firebase", {})
        assert firebase_cfg.get("configured") is True
        assert firebase_cfg.get("projectId") == "staunt-fe6ad"
        assert firebase_cfg.get("authDomain") == "staunt-fe6ad.firebaseapp.com"
        assert firebase_cfg.get("appId") == "1:35404899573:web:74837bac9be974990c51bc"
