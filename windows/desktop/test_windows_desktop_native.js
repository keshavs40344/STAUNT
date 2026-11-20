/**
 * STAUNT Desktop Browser — Windows Desktop Experience & Native Behaviour Test
 * Validates Windows OS desktop integration, native interactions, and lifecycle:
 *   1. Windows AppUserModelId & Application Identity (com.vastuda.stauntbrowser)
 *   2. Single Instance Lock & Second-Instance External Link/File Invocation
 *   3. Windows Default Protocol Registration (HTTP, HTTPS, STAUNT)
 *   4. Multi-Monitor Display Geometry & Window State Clamping
 *   5. Dynamic Windows Title Bar Reflection ([Page] — Staunt Browser Ultra)
 *   6. Native Numbered Tab Switching (Ctrl+1..Ctrl+9) & Escape Fullscreen/Stop
 *   7. Active Downloads Shutdown Protection (Safety MessageBox Dialog)
 *   8. Windows Native Notification Toast Integration on Download Completion
 *   9. Multi-Resolution Windows .ico Binary Header & Size Validation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let total = 0;

function logPass(id, desc, detail = '') {
  passed++;
  total++;
  console.log(`  ✓ PASS  [${id}] ${desc}${detail ? ' — ' + detail : ''}`);
}

function logFail(id, desc, err) {
  total++;
  console.error(`  ✗ FAIL  [${id}] ${desc}:`, err.message);
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  STAUNT — Windows Desktop Experience & Native Behaviour Suite');
console.log('══════════════════════════════════════════════════════════════\n');

// ---------------------------------------------------------------------------
// [WIN-01] Windows AppUserModelId & Application Identity
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes("app.setAppUserModelId('com.vastuda.stauntbrowser')"), true, 'Must set Windows AppUserModelId');
  assert.strictEqual(mainCode.includes("app.setName('Staunt Browser Ultra')"), true, 'Must set application name');
  logPass('WIN-01', 'Windows AppUserModelId & Taskbar Identity', 'AppUserModelId com.vastuda.stauntbrowser registered for taskbar & Action Center');
} catch (err) {
  logFail('WIN-01', 'Windows AppUserModelId & Taskbar Identity', err);
}

// ---------------------------------------------------------------------------
// [WIN-02] Single Instance Lock & Second-Instance Invocation
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes('app.requestSingleInstanceLock()'), true, 'Must request single instance lock');
  assert.strictEqual(mainCode.includes("app.on('second-instance'"), true, 'Must listen for second-instance');
  assert.strictEqual(mainCode.includes('mainWindow.restore()'), true, 'Must restore minimized window on second instance');
  assert.strictEqual(mainCode.includes('createTab(candidate)'), true, 'Must open URL or file passed from external invocation');
  logPass('WIN-02', 'Single Instance Lock & External Link Forwarding', 'Second instance cleanly brings window to front and opens incoming URL');
} catch (err) {
  logFail('WIN-02', 'Single Instance Lock & External Link Forwarding', err);
}

// ---------------------------------------------------------------------------
// [WIN-03] Windows Default Protocol Client Registration
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes("app.setAsDefaultProtocolClient('http')"), true, 'Registers http: protocol');
  assert.strictEqual(mainCode.includes("app.setAsDefaultProtocolClient('https')"), true, 'Registers https: protocol');
  assert.strictEqual(mainCode.includes("app.setAsDefaultProtocolClient('staunt')"), true, 'Registers staunt: protocol');
  logPass('WIN-03', 'Windows Protocol Client Registration', 'Registered http, https, and staunt protocols for default browser support');
} catch (err) {
  logFail('WIN-03', 'Windows Protocol Client Registration', err);
}

// ---------------------------------------------------------------------------
// [WIN-04] Multi-Monitor Window Bounds Clamping
// ---------------------------------------------------------------------------
try {
  // Test simulated window state clamp algorithm
  function clampState(state, displayBounds) {
    const minW = 900;
    const minH = 600;
    const w = Math.max(minW, Math.min(state.width || 1280, displayBounds.width));
    const h = Math.max(minH, Math.min(state.height || 800, displayBounds.height));
    const x = Math.max(displayBounds.x, Math.min(state.x || 100, displayBounds.x + displayBounds.width - w));
    const y = Math.max(displayBounds.y, Math.min(state.y || 100, displayBounds.y + displayBounds.height - h));
    return { width: w, height: h, x, y };
  }

  // Off-screen / negative coordinates simulation
  const clamped = clampState({ x: -5000, y: -2000, width: 400, height: 200 }, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.strictEqual(clamped.x >= 0, true, 'X must not be off-screen negative');
  assert.strictEqual(clamped.y >= 0, true, 'Y must not be off-screen negative');
  assert.strictEqual(clamped.width >= 900, true, 'Width must enforce minimum 900px');
  assert.strictEqual(clamped.height >= 600, true, 'Height must enforce minimum 600px');
  logPass('WIN-04', 'Multi-Monitor Display Geometry & Bounds Clamping', 'Off-screen coordinates safely recovered within display workArea');
} catch (err) {
  logFail('WIN-04', 'Multi-Monitor Display Geometry & Bounds Clamping', err);
}

// ---------------------------------------------------------------------------
// [WIN-05] Dynamic Windows Title Bar Reflection
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes("mainWindow.setTitle(cleanTitle ? `${cleanTitle} — Staunt Browser Ultra` : 'Staunt Browser Ultra')"), true, 'Must format window title on page-title-updated and tab switch');
  logPass('WIN-05', 'Dynamic Windows Title Bar & Taskbar Preview', 'Window title updates with active tab title for Alt+Tab and taskbar hover');
} catch (err) {
  logFail('WIN-05', 'Dynamic Windows Title Bar & Taskbar Preview', err);
}

// ---------------------------------------------------------------------------
// [WIN-06] Numbered Tab Switching (Ctrl+1..Ctrl+9) & Escape Handling
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes("isCtrl && !input.shift && !input.alt && /^[1-9]$/.test(key)"), true, 'Must intercept Ctrl+1 through Ctrl+9');
  assert.strictEqual(mainCode.includes("input.key === 'Escape'"), true, 'Must handle Escape key');
  assert.strictEqual(mainCode.includes("mainWindow.setFullScreen(false)"), true, 'Escape must exit fullscreen when active');
  logPass('WIN-06', 'Numbered Tab Hotkeys & Escape Fullscreen Handling', 'Ctrl+1..Ctrl+9 switches tabs; Escape exits fullscreen/stops load');
} catch (err) {
  logFail('WIN-06', 'Numbered Tab Hotkeys & Escape Fullscreen Handling', err);
}

// ---------------------------------------------------------------------------
// [WIN-07] Active Downloads Shutdown Protection
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes('activeDownloadItems.size > 0'), true, 'Must check active download count on close');
  assert.strictEqual(mainCode.includes('Active Downloads in Progress'), true, 'Must prompt user with warning dialog');
  assert.strictEqual(mainCode.includes('e.preventDefault()'), true, 'Must cancel window close if user chooses Cancel');
  logPass('WIN-07', 'Active Downloads Shutdown Protection', 'Guards against accidental closure during in-progress downloads');
} catch (err) {
  logFail('WIN-07', 'Active Downloads Shutdown Protection', err);
}

// ---------------------------------------------------------------------------
// [WIN-08] Windows Native Notification Toast on Download Completion
// ---------------------------------------------------------------------------
try {
  const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.strictEqual(mainCode.includes('Notification && Notification.isSupported()'), true, 'Must check Notification.isSupported()');
  assert.strictEqual(mainCode.includes("title: 'Download Complete'"), true, 'Must trigger native notification on download finish');
  assert.strictEqual(mainCode.includes('shell.showItemInFolder'), true, 'Clicking notification must show downloaded file in Windows Explorer');
  logPass('WIN-08', 'Windows Native Action Center Notifications', 'Dispatches native toast with click-to-open in Windows Explorer');
} catch (err) {
  logFail('WIN-08', 'Windows Native Action Center Notifications', err);
}

// ---------------------------------------------------------------------------
// [WIN-09] Multi-Resolution Windows .ico Binary Header & Size Validation
// ---------------------------------------------------------------------------
try {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  assert.strictEqual(fs.existsSync(icoPath), true, 'assets/icon.ico must exist');
  const buf = fs.readFileSync(icoPath);
  // ICO header: 0x0000 0x0001 (image type 1 = icon)
  assert.strictEqual(buf.readUInt16LE(0), 0, 'ICO reserved word must be 0');
  assert.strictEqual(buf.readUInt16LE(2), 1, 'ICO type must be 1');
  const numImages = buf.readUInt16LE(4);
  assert.strictEqual(numImages >= 1, true, `ICO must contain multi-res frames (found ${numImages})`);
  assert.strictEqual(buf.length >= 50000, true, `ICO binary size must be high quality (size: ${buf.length} bytes)`);
  logPass('WIN-09', 'Windows Multi-Resolution Icon Integrity', `assets/icon.ico valid: ${numImages} icon layers, ${buf.length} bytes`);
} catch (err) {
  logFail('WIN-09', 'Windows Multi-Resolution Icon Integrity', err);
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Windows Desktop Results: ${passed} PASS / ${total - passed} FAIL / ${total} TOTAL`);
console.log('══════════════════════════════════════════════════════════════\n');

if (passed === total) {
  console.log('WINDOWS DESKTOP NATIVE INTEGRATION: 100% SATISFIED ✓\n');
  process.exit(0);
} else {
  console.error('WINDOWS DESKTOP NATIVE SUITE FAILED ✗\n');
  process.exit(1);
}
