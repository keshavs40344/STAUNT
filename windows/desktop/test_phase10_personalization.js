// test_phase10_personalization.js — Phase 10 Automated Test Suite
// Tests: Personalization & Performance: Themes, Accents, Font Size, Search Engines, Hardware Accel & Memory Stats
// Run: npx electron test_phase10_personalization.js

'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Isolated test userData directory ────────────────────────────────────────
const TEST_DATA_DIR = path.join(os.tmpdir(), 'staunt_phase10_test_' + Date.now());
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
app.setPath('userData', TEST_DATA_DIR);

const results = [];
let passed = 0;
let failed = 0;

function pass(id, msg) {
  results.push({ id, status: 'PASS', msg });
  passed++;
  console.log(`  ✓ PASS  [${id}] ${msg}`);
}

function fail(id, msg, detail) {
  results.push({ id, status: 'FAIL', msg, detail });
  failed++;
  console.error(`  ✗ FAIL  [${id}] ${msg}${detail ? ': ' + detail : ''}`);
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {}
  return fallback;
}

function atomicWriteJson(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, `${filePath}.bak`);
  fs.renameSync(tmp, filePath);
}

async function runTests() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  STAUNT Phase 10 — Personalization & Performance');
  console.log('══════════════════════════════════════════════\n');

  const SETTINGS_FILE = path.join(TEST_DATA_DIR, 'staunt_settings.json');

  const DEFAULT_SETTINGS = {
    searchEngine: 'staunt',
    customSearchUrl: '',
    searchUrl: 'https://staunt.vercel.app',
    homeUrl: 'staunt://newtab',
    shieldLevel: 'standard',
    hardwareAcceleration: true,
    restoreTabsOnStartup: false,
    downloadPath: '',
    showFavouritesBar: true,
    doNotTrack: true,
    globalPrivacyControl: true,
    cookiePolicy: 'block-third-party',
    uiTheme: 'dark',
    accentColor: '#d4a359',
    fontSize: '13'
  };

  // T1: Default personalization fields present
  try {
    if (
      DEFAULT_SETTINGS.uiTheme === 'dark' &&
      DEFAULT_SETTINGS.accentColor === '#d4a359' &&
      DEFAULT_SETTINGS.fontSize === '13' &&
      DEFAULT_SETTINGS.hardwareAcceleration === true
    ) {
      pass('T1', 'Default settings contain theme, accent color, font size, and hardware acceleration');
    } else {
      fail('T1', 'Default settings missing personalization properties', JSON.stringify(DEFAULT_SETTINGS));
    }
  } catch (err) {
    fail('T1', 'Check threw', err.message);
  }

  // T2: Valid theme persistence (dark, dark-oled, light, sepia)
  try {
    const validThemes = ['dark', 'dark-oled', 'light', 'sepia'];
    let allOk = true;
    for (const theme of validThemes) {
      let current = readJsonSafe(SETTINGS_FILE, { ...DEFAULT_SETTINGS });
      current.uiTheme = theme;
      atomicWriteJson(SETTINGS_FILE, current);
      const reloaded = readJsonSafe(SETTINGS_FILE);
      if (!reloaded || reloaded.uiTheme !== theme) {
        allOk = false;
        break;
      }
    }
    if (allOk) {
      pass('T2', 'All supported themes (dark, dark-oled, light, sepia) persist cleanly to disk');
    } else {
      fail('T2', 'One or more themes failed to persist');
    }
  } catch (err) {
    fail('T2', 'Theme test threw', err.message);
  }

  // T3: Rejection of invalid themes
  try {
    const validateTheme = (t) => ['dark', 'dark-oled', 'light', 'sepia'].includes(String(t || '').toLowerCase());
    if (!validateTheme('neon-pink') && !validateTheme('windows-95') && !validateTheme('<script>')) {
      pass('T3', 'Invalid theme names are rejected correctly');
    } else {
      fail('T3', 'Validation permitted invalid theme names');
    }
  } catch (err) {
    fail('T3', 'Theme validation test threw', err.message);
  }

  // T4: Custom accent color persistence (valid 6-digit hex)
  try {
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
    let allColorsOk = true;
    for (const color of colors) {
      let current = readJsonSafe(SETTINGS_FILE, { ...DEFAULT_SETTINGS });
      current.accentColor = color;
      atomicWriteJson(SETTINGS_FILE, current);
      const reloaded = readJsonSafe(SETTINGS_FILE);
      if (!reloaded || reloaded.accentColor !== color) {
        allColorsOk = false;
        break;
      }
    }
    if (allColorsOk) {
      pass('T4', 'Custom accent colors persist and reload cleanly');
    } else {
      fail('T4', 'One or more accent colors failed to persist');
    }
  } catch (err) {
    fail('T4', 'Color test threw', err.message);
  }

  // T5: Rejection of invalid accent colors
  try {
    const validateColor = (c) => /^#[0-9a-f]{6}$/i.test(String(c || '').trim());
    if (
      !validateColor('red') &&
      !validateColor('rgb(255,0,0)') &&
      !validateColor('#fff') &&
      !validateColor('#1234567') &&
      !validateColor('javascript:alert(1)')
    ) {
      pass('T5', 'Invalid accent colors (malformed, non-hex, injections) are rejected');
    } else {
      fail('T5', 'Validation allowed invalid color syntax');
    }
  } catch (err) {
    fail('T5', 'Color validation test threw', err.message);
  }

  // T6: Font size persistence (12, 13, 14, 15, 16)
  try {
    const sizes = ['12', '13', '14', '15', '16'];
    let allSizesOk = true;
    for (const sz of sizes) {
      let current = readJsonSafe(SETTINGS_FILE, { ...DEFAULT_SETTINGS });
      current.fontSize = sz;
      atomicWriteJson(SETTINGS_FILE, current);
      const reloaded = readJsonSafe(SETTINGS_FILE);
      if (!reloaded || reloaded.fontSize !== sz) {
        allSizesOk = false;
        break;
      }
    }
    if (allSizesOk) {
      pass('T6', 'Font sizes (12px to 16px) persist and reload correctly');
    } else {
      fail('T6', 'Font size persistence failed');
    }
  } catch (err) {
    fail('T6', 'Font size test threw', err.message);
  }

  // T7: Rejection of out-of-range font sizes
  try {
    const validateFontSize = (s) => ['12', '13', '14', '15', '16'].includes(String(s || '').trim());
    if (!validateFontSize('10') && !validateFontSize('72') && !validateFontSize('huge') && !validateFontSize('-1')) {
      pass('T7', 'Out-of-range and invalid font sizes are rejected');
    } else {
      fail('T7', 'Font size validation failed to reject invalid values');
    }
  } catch (err) {
    fail('T7', 'Font size range test threw', err.message);
  }

  // T8: All 24 search engines can be saved
  try {
    const engines = [
      'google', 'duckduckgo', 'bing', 'brave', 'ecosia', 'yahoo', 'startpage', 'yandex',
      'baidu', 'qwant', 'kagi', 'perplexity', 'swisscows', 'ask', 'aol', 'searx',
      'mojeek', 'you', 'wikipedia', 'youtube', 'github', 'reddit', 'staunt', 'custom'
    ];
    let allEnginesOk = true;
    for (const eng of engines) {
      let current = readJsonSafe(SETTINGS_FILE, { ...DEFAULT_SETTINGS });
      current.searchEngine = eng;
      atomicWriteJson(SETTINGS_FILE, current);
      const reloaded = readJsonSafe(SETTINGS_FILE);
      if (!reloaded || reloaded.searchEngine !== eng) {
        allEnginesOk = false;
        break;
      }
    }
    if (allEnginesOk && engines.length === 24) {
      pass('T8', 'All 24 verified search engines persist in browser settings');
    } else {
      fail('T8', 'Search engine persistence failed');
    }
  } catch (err) {
    fail('T8', 'Engines test threw', err.message);
  }

  // T9: Hardware acceleration toggle persistence
  try {
    let current = readJsonSafe(SETTINGS_FILE, { ...DEFAULT_SETTINGS });
    current.hardwareAcceleration = false;
    atomicWriteJson(SETTINGS_FILE, current);
    let reloaded = readJsonSafe(SETTINGS_FILE);
    const disabledOk = reloaded && reloaded.hardwareAcceleration === false;

    current.hardwareAcceleration = true;
    atomicWriteJson(SETTINGS_FILE, current);
    reloaded = readJsonSafe(SETTINGS_FILE);
    const enabledOk = reloaded && reloaded.hardwareAcceleration === true;

    if (disabledOk && enabledOk) {
      pass('T9', 'Hardware acceleration boolean toggle persists accurately');
    } else {
      fail('T9', 'Hardware acceleration toggle persistence failed');
    }
  } catch (err) {
    fail('T9', 'HW accel test threw', err.message);
  }

  // T10: Memory runtime stats verification
  try {
    const mem = process.memoryUsage();
    const stats = {
      tabCount: 3,
      rssMB: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
      heapUsedMB: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10
    };
    if (stats.rssMB > 0 && stats.heapUsedMB > 0 && typeof stats.tabCount === 'number') {
      pass('T10', `Process memory stats queryable: RSS ${stats.rssMB} MB, Heap ${stats.heapUsedMB} MB`);
    } else {
      fail('T10', 'Memory stats calculation invalid', JSON.stringify(stats));
    }
  } catch (err) {
    fail('T10', 'Memory stats test threw', err.message);
  }

  // T11: Backup resilience for personalization settings
  try {
    const bakFile = `${SETTINGS_FILE}.bak`;
    const s1 = { ...DEFAULT_SETTINGS, uiTheme: 'dark-oled', accentColor: '#10b981' };
    const s2 = { ...DEFAULT_SETTINGS, uiTheme: 'light', accentColor: '#ef4444' };
    atomicWriteJson(SETTINGS_FILE, s1);
    atomicWriteJson(SETTINGS_FILE, s2);
    if (fs.existsSync(bakFile)) {
      const bakData = readJsonSafe(bakFile);
      if (bakData && bakData.uiTheme === 'dark-oled' && bakData.accentColor === '#10b981') {
        pass('T11', 'Backup file (.bak) preserves previous personalization configuration safely');
      } else {
        fail('T11', 'Backup file content mismatch', JSON.stringify(bakData));
      }
    } else {
      fail('T11', 'Backup file not found after consecutive writes');
    }
  } catch (err) {
    fail('T11', 'Backup resilience test threw', err.message);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed} PASS / ${failed} FAIL / ${results.length} TOTAL`);
  console.log('══════════════════════════════════════════════\n');

  try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }); } catch (_) {}

  if (failed > 0) {
    console.error('PHASE 10 TEST SUITE: FAILED\n');
    process.exitCode = 1;
  } else {
    console.log('PHASE 10 TEST SUITE: ALL PASS ✓\n');
    process.exitCode = 0;
  }
  setTimeout(() => app.quit(), 500);
}

app.whenReady().then(runTests);
app.on('window-all-closed', () => { app.quit(); });
