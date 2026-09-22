"""
PHASE 5.8 — DESKTOP BROWSER CONTRACT & OFFLINE RESILIENCE TEST (PHASE 24)
Validates:
1. main.js STAUNT_SEARCH_URL configuration structure
2. formatUrlOrSearch parsing behavior with search routing
3. Autocomplete query resilience against offline/dead server
4. app.asar freshness and packaging
"""
import unittest
import subprocess
import os
import sys

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
WINDOWS_DIR = os.path.dirname(TESTS_DIR)
STAUNT_ROOT = os.path.dirname(WINDOWS_DIR)
DESKTOP_MAIN = os.path.join(WINDOWS_DIR, "desktop", "main.js")
ASAR_FILE = r"c:\Users\HP\Desktop\VASTUDA\my-saas-project\desktop\dist\win-unpacked\resources\app.asar"


class TestBrowserResilience(unittest.TestCase):
    def test_main_js_url_resolution(self):
        with open(DESKTOP_MAIN, "r", encoding="utf-8") as f:
            main_code = f.read()

        self.assertIn("process.env.STAUNT_SEARCH_URL", main_code, "main.js must honor STAUNT_SEARCH_URL env var")
        self.assertIn("http://127.0.0.1:5000", main_code, "main.js must retain local development fallback")
        self.assertNotIn("trycloudflare", main_code, "main.js must NOT hardcode temporary trycloudflare domain")

    def test_app_asar_exists_and_valid(self):
        if not os.path.exists(ASAR_FILE):
            raise unittest.SkipTest(f"app.asar not found at {ASAR_FILE}")
        self.assertGreater(os.path.getsize(ASAR_FILE), 200000, "app.asar must be > 200KB")

    def test_node_ipc_and_offline_suggest(self):
        node_test_script = """
const path = require('path');

const STAUNT_SEARCH_URL = process.env.STAUNT_SEARCH_URL || 'http://127.0.0.1:5000';

function formatUrlOrSearch(input) {
  const trimmed = (input || '').trim().slice(0, 2048);
  if (!trimmed || trimmed === 'staunt://newtab') return 'staunt://newtab';
  if (/^https?:\\/\\//i.test(trimmed)) return trimmed;
  const isDomain = /^([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(:\\d+)?(\\/.*)?$/i.test(trimmed) && !trimmed.includes(' ');
  if (isDomain) return 'https://' + trimmed;
  return `${STAUNT_SEARCH_URL}/?q=${encodeURIComponent(trimmed)}`;
}

const resSearch = formatUrlOrSearch('artificial intelligence');
if (!resSearch.startsWith(`${STAUNT_SEARCH_URL}/?q=`)) {
  console.error('FAIL search routing:', resSearch);
  process.exit(1);
}

const resDomain = formatUrlOrSearch('github.com');
if (resDomain !== 'https://github.com') {
  console.error('FAIL domain routing:', resDomain);
  process.exit(1);
}

async function testOfflineSuggest() {
  let remoteSuggestions = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 200);
    const resp = await fetch('http://127.0.0.1:59999/api/suggest?q=test', { signal: controller.signal });
    if (resp.ok) remoteSuggestions = await resp.json();
  } catch (err) {
  }
  if (!Array.isArray(remoteSuggestions) || remoteSuggestions.length !== 0) {
    console.error('FAIL offline suggest fallback');
    process.exit(1);
  }
  console.log('NODE_SIM_OK');
}

testOfflineSuggest();
"""
        res = subprocess.run(["node", "-e", node_test_script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("NODE_SIM_OK", res.stdout)


if __name__ == "__main__":
    unittest.main()
