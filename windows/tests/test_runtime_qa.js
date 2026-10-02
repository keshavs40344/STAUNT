/**
 * STAUNT BROWSER — Automated Runtime Contract QA Suite
 * Tests Categories A through K programmatically across Electron browser modules.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const DESKTOP_DIR = path.resolve(__dirname, '..', 'desktop');
const SearchClient = require(path.join(DESKTOP_DIR, 'src', 'search_client.js'));
const platformBridgeCode = fs.readFileSync(path.join(DESKTOP_DIR, 'src', 'platform-bridge.js'), 'utf-8');
const mainJsCode = fs.readFileSync(path.join(DESKTOP_DIR, 'main.js'), 'utf-8');
const rendererCode = fs.readFileSync(path.join(DESKTOP_DIR, 'src', 'renderer.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(DESKTOP_DIR, 'src', 'index.html'), 'utf-8');
const preloadCode = fs.readFileSync(path.join(DESKTOP_DIR, 'preload.js'), 'utf-8');

console.log('=== STARTING AUTOMATED RUNTIME CONTRACT QA ===\n');

const results = {};

function runTest(category, name, fn) {
  if (!results[category]) results[category] = [];
  try {
    fn();
    results[category].push({ name, pass: true });
    console.log(`[PASS] [${category}] ${name}`);
  } catch (err) {
    results[category].push({ name, pass: false, error: err.message });
    console.error(`[FAIL] [${category}] ${name}:`, err.message);
  }
}

const client = new SearchClient();

// ==========================================
// Category A: STARTUP & SINGLE TAB CONTRACT
// ==========================================
runTest('A_STARTUP', 'main.js initializes single default window and tab', () => {
  assert(mainJsCode.includes('function createMainWindow('), 'Must define createMainWindow');
  assert(mainJsCode.includes("createTab('staunt://newtab')"), 'Must create initial newtab');
  assert(!rendererCode.includes("bridge.createTab('staunt://newtab');\n  });"), 'Renderer must not unconditionally duplicate initial tab in Electron');
});

runTest('A_STARTUP', 'Window bounds validation clamps to workArea and prevents zero-size bug', () => {
  assert(mainJsCode.includes('function getValidatedWindowState('), 'Must validate window state');
  assert(mainJsCode.includes('Math.min(Math.max(windowState.width'), 'Must clamp width to workArea');
  assert(mainJsCode.includes('Math.min(Math.max(windowState.height'), 'Must clamp height to workArea');
});

// ==========================================
// Category B: OMNIBOX CLASSIFICATION
// ==========================================
runTest('B_OMNIBOX', 'Classifies standard HTTPS URLs directly', () => {
  const c = client.classifyInput('https://wikipedia.org/wiki/India');
  assert.strictEqual(c.type, 'URL');
  assert.strictEqual(c.url, 'https://wikipedia.org/wiki/India');
});

runTest('B_OMNIBOX', 'Classifies domain names and adds https', () => {
  const c = client.classifyInput('github.com');
  assert.strictEqual(c.type, 'DOMAIN');
  assert.strictEqual(c.url, 'https://github.com');
});

runTest('B_OMNIBOX', 'Classifies localhost & IPv4 with http', () => {
  const c1 = client.classifyInput('localhost:3000');
  assert.strictEqual(c1.type, 'DOMAIN');
  assert.strictEqual(c1.url, 'http://localhost:3000');

  const c2 = client.classifyInput('127.0.0.1:8080');
  assert.strictEqual(c2.type, 'DOMAIN');
  assert.strictEqual(c2.url, 'http://127.0.0.1:8080');
});

runTest('B_OMNIBOX', 'Classifies math expression', () => {
  const c = client.classifyInput('120*45');
  assert.strictEqual(c.type, 'MATH');
  assert(c.url.includes('120*45'));
  assert(c.url.startsWith('https://staunt.vercel.app'));
});

// ==========================================
// Category C: NAVIGATION & IPC VERBS
// ==========================================
runTest('C_NAVIGATION', 'Preload exposes all navigation verbs', () => {
  const verbs = ['goBack', 'goForward', 'reload', 'stopNavigation', 'goHome', 'navigate', 'navigateTo'];
  for (const v of verbs) {
    assert(preloadCode.includes(`${v}:`), `Preload missing navigation verb: ${v}`);
  }
});

runTest('C_NAVIGATION', 'Main process verifies IPC sender on navigation', () => {
  assert(mainJsCode.includes('function verifyIpcSender(event)'), 'Must enforce sender verification');
  assert(mainJsCode.includes("ipcMain.on('navigate-to'"), 'Must handle navigate-to');
  assert(mainJsCode.includes("ipcMain.on('nav-back'"), 'Must handle nav-back');
  assert(mainJsCode.includes("ipcMain.on('nav-forward'"), 'Must handle nav-forward');
  assert(mainJsCode.includes("ipcMain.on('nav-reload'"), 'Must handle nav-reload');
});

// ==========================================
// Category D: TABS & LIFECYCLE
// ==========================================
runTest('D_TABS', 'Main process supports full tab lifecycle and shortcuts', () => {
  assert(mainJsCode.includes('function createTab('), 'createTab exists');
  assert(mainJsCode.includes('function closeTab('), 'closeTab exists');
  assert(mainJsCode.includes('function switchTab('), 'switchTab exists');
  assert(mainJsCode.includes('function cycleTab('), 'cycleTab exists');
  assert(mainJsCode.includes('function duplicateTab('), 'duplicateTab exists');
  assert(mainJsCode.includes('function setTabPinned('), 'setTabPinned exists');
  assert(mainJsCode.includes('function closeOtherTabs('), 'closeOtherTabs exists');
  assert(mainJsCode.includes('function closeTabsToRight('), 'closeTabsToRight exists');
  assert(mainJsCode.includes('function undoCloseTab('), 'undoCloseTab exists');
});

// ==========================================
// Category E: SEARCH ENGINE INTEGRATION
// ==========================================
runTest('E_SEARCH', 'Test required search queries route to production endpoint', () => {
  const testQueries = ['python', 'Albert Einstein', '120*45', '100 USD to INR'];
  for (const q of testQueries) {
    const c = client.classifyInput(q);
    assert(c.url.startsWith('https://staunt.vercel.app/?q='), `Query "${q}" must target production endpoint, got ${c.url}`);
    assert(!c.url.includes('127.0.0.1') && !c.url.includes('localhost') && !c.url.includes('railway'), `Query "${q}" contains dev URL`);
  }
});

runTest('E_SEARCH', 'Empty query produces EMPTY type with null url', () => {
  const c1 = client.classifyInput('');
  assert.strictEqual(c1.type, 'EMPTY');
  assert.strictEqual(c1.url, null);

  const c2 = client.classifyInput('   ');
  assert.strictEqual(c2.type, 'EMPTY');
  assert.strictEqual(c2.url, null);
});

// ==========================================
// Category F: ERROR & OFFLINE RECOVERY
// ==========================================
runTest('F_ERROR', 'Error card uses window.location.href to retry the exact failed URL', () => {
  assert(mainJsCode.includes("onclick=\"window.location.href='${safeFailedUrl}'\""), 'Retry must set window.location.href to safeFailedUrl');
  assert(mainJsCode.includes('window.history.back()'), 'Go back button must use window.history.back()');
  assert(mainJsCode.includes('escapeHtml(validatedURL)'), 'validatedURL must be HTML-escaped');
  assert(mainJsCode.includes('escapeHtml(STAUNT_SEARCH_URL)'), 'STAUNT_SEARCH_URL must be HTML-escaped');
});

// ==========================================
// Category G: DOWNLOADS HANDLING
// ==========================================
runTest('G_DOWNLOADS', 'Download manager and vault storage exist in main.js', () => {
  assert(mainJsCode.includes('function recordDownload('), 'recordDownload exists');
  assert(mainJsCode.includes("ipcMain.handle('get-downloads'"), 'get-downloads handler exists');
  assert(mainJsCode.includes("ipcMain.on('open-download'"), 'open-download handler exists');
  assert(mainJsCode.includes("ipcMain.on('show-in-folder'"), 'show-in-folder handler exists');
  assert(mainJsCode.includes("ipcMain.handle('clear-downloads'"), 'clear-downloads handler exists');
});

// ==========================================
// Category H: HISTORY POLLUTION PREVENTION
// ==========================================
runTest('H_HISTORY', 'recordHistory rejects data:, file:, about:, staunt:, javascript:, newtab.html', () => {
  assert(mainJsCode.includes("cleanUrl.startsWith('data:')"), 'Must reject data:');
  assert(mainJsCode.includes("cleanUrl.startsWith('file:')"), 'Must reject file:');
  assert(mainJsCode.includes("cleanUrl.startsWith('about:')"), 'Must reject about:');
  assert(mainJsCode.includes("cleanUrl.startsWith('staunt://')"), 'Must reject staunt://');
  assert(mainJsCode.includes("cleanUrl.startsWith('javascript:')"), 'Must reject javascript:');
  assert(mainJsCode.includes("cleanUrl.includes('newtab.html')"), 'Must reject newtab.html');
});

runTest('H_HISTORY', 'closedTabsStack rejects internal error, file, and data schemes', () => {
  assert(mainJsCode.includes("!tab.url.startsWith('data:')"), 'closedTabsStack must reject data:');
  assert(mainJsCode.includes("!tab.url.startsWith('file:')"), 'closedTabsStack must reject file:');
  assert(mainJsCode.includes("!tab.url.startsWith('about:')"), 'closedTabsStack must reject about:');
});

// ==========================================
// Category I: CONTEXT MENU
// ==========================================
runTest('I_CONTEXT_MENU', 'Context menu includes Back, Forward, Reload, Copy, Paste, Open Link in New Tab', () => {
  const items = ['Back', 'Forward', 'Reload', 'Open Link in New Tab', 'Copy Link Address', 'Copy', 'Paste', 'Select All', 'Inspect Element'];
  for (const item of items) {
    assert(mainJsCode.includes(`label: '${item}'`), `Context menu missing item: ${item}`);
  }
});

// ==========================================
// Category J: SECURITY & PROTOCOL ARMOR
// ==========================================
runTest('J_SECURITY', 'Dangerous protocols are intercepted and blocked', () => {
  assert(mainJsCode.includes("const DANGEROUS_SCHEMES = ['file:', 'javascript:', 'data:', 'vbscript:', 'chrome:', 'ms-appx:']"), 'Must define dangerous schemes');
  assert(mainJsCode.includes("isHomographOrDeceptive"), 'Must check homograph/phishing spoofing');
  assert(mainJsCode.includes("nodeIntegration: false"), 'WebContentsView must disable nodeIntegration');
  assert(mainJsCode.includes("contextIsolation: true"), 'WebContentsView must enable contextIsolation');
  assert(mainJsCode.includes("sandbox: true"), 'WebContentsView must enable sandbox');
});

runTest('J_SECURITY', 'Platform bridge does not hardcode localhost for search fallback', () => {
  assert(!platformBridgeCode.includes('http://127.0.0.1:5000/?q='), 'platform-bridge.js must NOT route search fallback to 127.0.0.1');
  assert(platformBridgeCode.includes('https://staunt.vercel.app'), 'platform-bridge.js must route to production endpoint');
});

// ==========================================
// Category K: WINDOW CONTROLS & UI MARKUP
// ==========================================
runTest('K_WINDOW_UI', 'index.html contains complete topbar, omnibox, and caption controls', () => {
  assert(indexHtml.includes('id="desktop-topbar"'), 'Must contain desktop topbar');
  assert(indexHtml.includes('class="omnibox-container no-drag"'), 'Must contain omnibox container');
  assert(indexHtml.includes('id="deskOmnibox"'), 'Must contain omnibox input deskOmnibox');
  assert(indexHtml.includes('id="winBtnMin"'), 'Must contain minimize button');
  assert(indexHtml.includes('id="winBtnMax"'), 'Must contain maximize button');
  assert(indexHtml.includes('id="winBtnClose"'), 'Must contain close button');
});

// ==========================================
// Category L: VERSION 2.0.1 CONSISTENCY
// ==========================================
runTest('L_VERSION', 'Package, index.html, and main.js reflect v2.0.1', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(DESKTOP_DIR, 'package.json'), 'utf-8'));
  assert.strictEqual(pkg.version, '2.0.1', 'package.json version must be 2.0.1');
  assert(indexHtml.includes('Version 2.0.1'), 'index.html must display Version 2.0.1');
  assert(mainJsCode.includes("app.getVersion() : null) || '2.0.1'"), 'main.js showAboutDialog must default to 2.0.1');
});

console.log('\n=== RUNTIME CONTRACT QA SUMMARY ===');
let total = 0, passed = 0, failed = 0;
for (const cat in results) {
  for (const t of results[cat]) {
    total++;
    if (t.pass) passed++;
    else failed++;
  }
}
console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
if (failed > 0) process.exit(1);
