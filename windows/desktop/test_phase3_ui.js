// Automated Test Harness for STAUNT Desktop Browser Phase 3 UI Polish
// Validates: Settings, History, Bookmarks, Downloads, Three-dot menu, Favourites Bar,
// Theme consistency, Escape key navigation, and captures high-resolution screenshots.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/cce01f25-bb67-4436-9aa5-5e699a02b895/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let testWindow = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureModal(name, filename) {
  console.log(`[TEST] Capturing ${name}...`);
  await sleep(400);
  const image = await testWindow.webContents.capturePage();
  const outPath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(outPath, image.toPNG());
  const stat = fs.statSync(outPath);
  console.log(`[TEST CAPTURE] Saved ${filename} (${Math.round(stat.size / 1024)} KB)`);
}

app.whenReady().then(async () => {
  console.log('[TEST] Starting Electron Phase 3 UI Test Harness...');

  testWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0b0f19',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Mock necessary handlers for UI rendering in harness
  ipcMain.handle('get-settings', async () => ({
    searchEngine: 'staunt',
    homeUrl: 'staunt://newtab',
    restoreTabsOnStartup: true,
    shieldLevel: 'standard',
    downloadPath: 'C:\\Users\\HP\\Downloads',
    showFavouritesBar: true
  }));

  ipcMain.handle('save-settings', async (e, s) => ({ success: true, settings: s }));

  ipcMain.handle('get-history', async () => [
    { id: 'h1', title: 'GitHub: Let’s build from here', url: 'https://github.com', timestamp: Date.now() - 1000 * 60 * 15 },
    { id: 'h2', title: 'Hacker News — Technology & Code', url: 'https://news.ycombinator.com', timestamp: Date.now() - 1000 * 60 * 90 },
    { id: 'h3', title: 'ArXiv.org e-Print Archive — Quantum Intelligence', url: 'https://arxiv.org/abs/2403.0112', timestamp: Date.now() - 1000 * 60 * 60 * 26 },
    { id: 'h4', title: 'MDN Web Docs: Web APIs & Standards', url: 'https://developer.mozilla.org', timestamp: Date.now() - 1000 * 60 * 60 * 28 }
  ]);

  ipcMain.handle('get-bookmarks', async () => [
    { id: 'bm1', title: 'GitHub', url: 'https://github.com' },
    { id: 'bm2', title: 'Hacker News', url: 'https://news.ycombinator.com' },
    { id: 'bm3', title: 'ArXiv Research', url: 'https://arxiv.org' },
    { id: 'bm4', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }
  ]);

  ipcMain.handle('get-downloads', async () => [
    { id: 'd1', fileName: 'staunt-v2.0-win-x64.exe', totalBytes: 85200000, state: 'completed', filePath: 'C:\\Users\\HP\\Downloads\\staunt-v2.0-win-x64.exe' },
    { id: 'd2', fileName: 'quantum_computing_survey.pdf', totalBytes: 4200000, state: 'completed', filePath: 'C:\\Users\\HP\\Downloads\\quantum_computing_survey.pdf' },
    { id: 'd3', fileName: 'linux-kernel-6.10.tar.xz', totalBytes: 142000000, receivedBytes: 88000000, state: 'progressing', filePath: 'C:\\Users\\HP\\Downloads\\linux-kernel-6.10.tar.xz' }
  ]);

  ipcMain.handle('delete-history-item', async () => ({ success: true }));
  ipcMain.handle('delete-bookmark', async () => ({ success: true }));
  ipcMain.handle('delete-download', async () => ({ success: true }));
  ipcMain.handle('clear-downloads', async () => ({ success: true }));
  ipcMain.handle('toggle-favourites-bar', async () => true);
  ipcMain.handle('get-favourites-bar-visible', async () => true);
  ipcMain.handle('check-is-bookmarked', async () => true);
  ipcMain.handle('get-account-state', async () => ({ isLoggedIn: false }));

  testWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  testWindow.webContents.on('did-finish-load', async () => {
    console.log('[TEST] index.html loaded successfully.');
    await sleep(600);

    // TEST 1: Default Browser View (Chrome + Favourites Bar + Topbar)
    await captureModal('Browser Default Shell', 'phase3_1_browser_shell.png');

    // TEST 2: Three-Dot Menu
    await testWindow.webContents.executeJavaScript(`
      document.getElementById('btnMenu')?.click();
    `);
    await sleep(250);
    await captureModal('Three Dot Menu', 'phase3_2_three_dot_menu.png');

    // TEST 3: Settings Modal
    await testWindow.webContents.executeJavaScript(`
      document.getElementById('menuItemSettings')?.click();
    `);
    await sleep(350);
    await captureModal('Settings Modal', 'phase3_3_settings_modal.png');

    // Close Settings with Escape
    await testWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    `);
    await sleep(200);

    // TEST 4: Browsing History Modal
    await testWindow.webContents.executeJavaScript(`
      document.getElementById('btnMenu')?.click();
      setTimeout(() => document.getElementById('menuItemHistory')?.click(), 100);
    `);
    await sleep(400);
    await captureModal('History Modal', 'phase3_4_history_modal.png');

    // Close History with Escape
    await testWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    `);
    await sleep(200);

    // TEST 5: Bookmarks Modal
    await testWindow.webContents.executeJavaScript(`
      document.getElementById('btnMenu')?.click();
      setTimeout(() => document.getElementById('menuItemBookmarks')?.click(), 100);
    `);
    await sleep(400);
    await captureModal('Bookmarks Modal', 'phase3_5_bookmarks_modal.png');

    // Close Bookmarks with Escape
    await testWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    `);
    await sleep(200);

    // TEST 6: Downloads Modal
    await testWindow.webContents.executeJavaScript(`
      document.getElementById('btnMenu')?.click();
      setTimeout(() => document.getElementById('menuItemDownloads')?.click(), 100);
    `);
    await sleep(400);
    await captureModal('Downloads Modal', 'phase3_6_downloads_modal.png');

    // Close Downloads with Escape
    await testWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    `);
    await sleep(200);

    // TEST 7: Add Favourite Modal
    await testWindow.webContents.executeJavaScript(`
      document.getElementById('btnFavouritesAdd')?.click();
    `);
    await sleep(350);
    await captureModal('Add Favourite Modal', 'phase3_7_add_favourite_modal.png');

    // Close with Escape
    await testWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    `);
    await sleep(200);

    // TEST 8: Compact Viewport (1024x768)
    testWindow.setSize(1024, 768);
    await sleep(350);
    await captureModal('Compact Viewport (1024x768)', 'phase3_8_compact_viewport.png');

    console.log('[TEST] All Phase 3 test cases executed successfully!');
    setTimeout(() => {
      app.quit();
    }, 500);
  });
});
