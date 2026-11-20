// =============================================================================
// STAUNT DESKTOP — FINAL LOOK: COMPREHENSIVE VISUAL INSPECTION HARNESS
// Automated visual verification and screenshot capture for all core screens
// =============================================================================

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/cce01f25-bb67-4436-9aa5-5e699a02b895/screenshots/final_look';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let testWindow = null;
const consoleErrors = [];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreen(label, filename) {
  await sleep(400);
  const image = await testWindow.webContents.capturePage();
  const outPath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(outPath, image.toPNG());
  const stat = fs.statSync(outPath);
  console.log(`  ✓ Captured [${label}] -> ${filename} (${Math.round(stat.size / 1024)} KB)`);
}

app.whenReady().then(async () => {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  STAUNT — Final Look: Visual Inspection & Screenshot Suite');
  console.log('══════════════════════════════════════════════════════════════\n');

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

  testWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 3) {
      consoleErrors.push(message);
    }
  });

  // Comprehensive IPC Mocks for visual rendering
  ipcMain.handle('get-window-state', async () => 'NORMAL');

  ipcMain.handle('get-settings', async () => ({
    searchEngine: 'staunt',
    homeUrl: 'staunt://newtab',
    restoreTabsOnStartup: true,
    shieldLevel: 'standard',
    downloadPath: 'C:\\Users\\HP\\Downloads',
    showFavouritesBar: true,
    theme: 'dark',
    accentColor: '#d4a359'
  }));

  ipcMain.handle('save-settings', async (_e, s) => ({ success: true, settings: s }));

  ipcMain.handle('get-history', async () => [
    { id: 'h1', title: 'GitHub — Build software better, together', url: 'https://github.com', timestamp: Date.now() - 1000 * 60 * 12 },
    { id: 'h2', title: 'Hacker News — Technology, Engineering & Startups', url: 'https://news.ycombinator.com', timestamp: Date.now() - 1000 * 60 * 45 },
    { id: 'h3', title: 'Stripe Documentation — Modern Payment APIs', url: 'https://docs.stripe.com', timestamp: Date.now() - 1000 * 60 * 60 * 2 },
    { id: 'h4', title: 'ArXiv.org — Neural Architectures for Fast Synthesis', url: 'https://arxiv.org/abs/2611.0821', timestamp: Date.now() - 1000 * 60 * 60 * 24 }
  ]);

  ipcMain.handle('get-bookmarks', async () => [
    { id: 'bm1', title: 'GitHub: Let’s build from here', url: 'https://github.com', folder: 'Development' },
    { id: 'bm2', title: 'Hacker News', url: 'https://news.ycombinator.com', folder: 'News' },
    { id: 'bm3', title: 'Google Gemini AI', url: 'https://gemini.google.com', folder: 'Research' },
    { id: 'bm4', title: 'Stripe Dashboard', url: 'https://dashboard.stripe.com', folder: 'Finance' }
  ]);

  ipcMain.handle('get-downloads', async () => [
    { id: 'd1', fileName: 'STAUNT-2.0.1-Windows-x64-Setup.exe', totalBytes: 87342000, state: 'completed', filePath: 'C:\\Users\\HP\\Downloads\\STAUNT-2.0.1-Windows-x64-Setup.exe' },
    { id: 'd2', fileName: 'research-paper-quantum-sim.pdf', totalBytes: 4210000, state: 'completed', filePath: 'C:\\Users\\HP\\Downloads\\research-paper-quantum-sim.pdf' },
    { id: 'd3', fileName: 'system-assets-bundle.tar.gz', totalBytes: 154000000, receivedBytes: 98000000, state: 'progressing', filePath: 'C:\\Users\\HP\\Downloads\\system-assets-bundle.tar.gz' }
  ]);

  ipcMain.handle('get-reading-list', async () => [
    { id: 'rl1', title: 'High-Performance Rust Memory Models', url: 'https://blog.rust-lang.org/2026/memory-models', read: false, addedAt: Date.now() - 1000 * 60 * 120 },
    { id: 'rl2', title: 'Modern CSS Architecture & Subgrid Systems', url: 'https://web.dev/articles/css-subgrid', read: true, addedAt: Date.now() - 1000 * 60 * 60 * 48 }
  ]);

  ipcMain.handle('get-account-state', async () => ({ isLoggedIn: false }));

  // Vault mock state
  let isVaultLocked = true;
  ipcMain.handle('is-vault-locked', async () => ({ locked: isVaultLocked, hasMasterPassword: true }));
  ipcMain.handle('unlock-vault', async () => { isVaultLocked = false; return { ok: true }; });
  ipcMain.handle('lock-vault', async () => { isVaultLocked = true; return { ok: true }; });
  ipcMain.handle('get-all-credentials', async () => [
    { id: 'c1', origin: 'https://github.com', username: 'keshavs40344' },
    { id: 'c2', origin: 'https://accounts.google.com', username: 'keshav.developer@gmail.com' },
    { id: 'c3', origin: 'https://dashboard.stripe.com', username: 'billing@staunt.com' }
  ]);

  ipcMain.handle('get-global-permissions', async () => ({
    camera: 'ask',
    microphone: 'ask',
    location: 'ask',
    notifications: 'ask',
    'clipboard-read': 'ask',
    popups: 'block',
    fullscreen: 'allow',
    'pointer-lock': 'allow'
  }));

  ipcMain.handle('get-all-site-permissions', async () => ({
    'https://meet.google.com': { camera: 'allow', microphone: 'allow', shield: 'enabled' },
    'https://github.com': { 'clipboard-read': 'allow', shield: 'enabled' },
    'https://bank.example.com': { popups: 'allow', shield: 'disabled' }
  }));

  ipcMain.handle('get-website-data-summary', async () => [
    { origin: 'https://github.com', cacheBytes: 1540000, cookiesCount: 8 },
    { origin: 'https://news.ycombinator.com', cacheBytes: 320000, cookiesCount: 2 }
  ]);

  ipcMain.handle('get-memory-stats', async () => ({
    processCount: 4,
    totalWorkingSetMb: 142
  }));

  ipcMain.handle('toggle-favourites-bar', async () => true);
  ipcMain.handle('get-favourites-bar-visible', async () => true);
  ipcMain.handle('check-is-bookmarked', async () => false);

  testWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  testWindow.webContents.on('did-finish-load', async () => {
    console.log('[STAGE 1] Base UI Shell Loaded. Commencing Visual Screen Inspections...\n');
    await sleep(600);

    // 1. Main Browser Window (Chrome, Tab Rail, Address Bar, Favourites Bar)
    await captureScreen('Main Browser Chrome', '01_main_browser_window.png');

    // 2. Three-Dot Main Menu
    await testWindow.webContents.executeJavaScript('document.getElementById("btnMenu")?.click();');
    await captureScreen('Three-Dot Menu', '02_three_dot_menu.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("btnMenu")?.click();');
    await sleep(200);

    // 3. Settings Modal — General Tab
    await testWindow.webContents.executeJavaScript('if (typeof openSettingsModal === "function") openSettingsModal(); else document.getElementById("settingsModal")?.classList.add("active");');
    await captureScreen('Settings — General', '03_settings_general.png');

    // 4. Settings Modal — Privacy & Permissions Tab
    await testWindow.webContents.executeJavaScript('const tabs = document.querySelectorAll(".settings-tab-btn"); if (tabs.length > 1) tabs[1].click();');
    await captureScreen('Settings — Privacy & Permissions', '04_settings_permissions.png');

    // Close Settings
    await testWindow.webContents.executeJavaScript('document.getElementById("settingsModal")?.classList.remove("active");');
    await sleep(200);

    // 5. Bookmarks Manager Modal
    await testWindow.webContents.executeJavaScript('if (typeof openBookmarksModal === "function") openBookmarksModal(); else document.getElementById("bookmarksModal")?.classList.add("active");');
    await captureScreen('Bookmarks Manager', '05_bookmarks_manager.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("bookmarksModal")?.classList.remove("active");');
    await sleep(200);

    // 6. History Manager Modal
    await testWindow.webContents.executeJavaScript('if (typeof openHistoryModal === "function") openHistoryModal(); else document.getElementById("historyModal")?.classList.add("active");');
    await captureScreen('History Manager', '06_history_manager.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("historyModal")?.classList.remove("active");');
    await sleep(200);

    // 7. Downloads Manager Modal
    await testWindow.webContents.executeJavaScript('if (typeof openDownloadsModal === "function") openDownloadsModal(); else document.getElementById("downloadsModal")?.classList.add("active");');
    await captureScreen('Downloads Manager', '07_downloads_manager.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("downloadsModal")?.classList.remove("active");');
    await sleep(200);

    // 8. Password Manager — Locked Vault
    await testWindow.webContents.executeJavaScript('if (typeof openPasswordManagerModal === "function") openPasswordManagerModal(); else document.getElementById("passwordManagerModal")?.classList.add("active");');
    await captureScreen('Password Manager (Locked)', '08_password_vault_locked.png');

    // 9. Password Manager — Unlocked Vault
    await testWindow.webContents.executeJavaScript('if (typeof api !== "undefined" && typeof api.unlockVault === "function") api.unlockVault("test").then(() => renderPasswordManagerList());');
    await captureScreen('Password Manager (Unlocked)', '09_password_vault_unlocked.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("passwordManagerModal")?.classList.remove("active");');
    await sleep(200);

    // 10. Command Palette (Ctrl+K)
    await testWindow.webContents.executeJavaScript('if (typeof openCommandPalette === "function") openCommandPalette(); else document.getElementById("commandPaletteModal")?.classList.add("active");');
    await captureScreen('Command Palette', '10_command_palette.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("commandPaletteModal")?.classList.remove("active");');
    await sleep(200);

    // 11. Tab Search (Ctrl+Shift+A)
    await testWindow.webContents.executeJavaScript('if (typeof openTabSearch === "function") openTabSearch(); else document.getElementById("tabSearchModal")?.classList.add("active");');
    await captureScreen('Tab Search', '11_tab_search.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("tabSearchModal")?.classList.remove("active");');
    await sleep(200);

    // 12. Reading List Modal
    await testWindow.webContents.executeJavaScript('if (typeof openReadingListModal === "function") openReadingListModal(); else document.getElementById("readingListModal")?.classList.add("active");');
    await captureScreen('Reading List', '12_reading_list.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("readingListModal")?.classList.remove("active");');
    await sleep(200);

    // 13. Reader Mode Modal
    await testWindow.webContents.executeJavaScript(`
      document.getElementById("readerModeModal")?.classList.add("active");
      const title = document.getElementById("readerTitle");
      const content = document.getElementById("readerContent");
      if (title) title.innerText = "Inside Chromium: High-Performance Architecture for Modern Web Apps";
      if (content) content.innerHTML = "<p>Modern web engineering relies on aggressive multi-process isolation and zero-copy rendering pipelines. Browsers partition network requests, GPU rasterization, and sandboxed execution across independent OS threads...</p><p>By utilizing hardware acceleration and proactive layout caching, STAUNT ensures web applications render seamlessly without frame drops or memory leaks.</p>";
    `);
    await captureScreen('Reader Mode', '13_reader_mode.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("readerModeModal")?.classList.remove("active");');
    await sleep(200);

    // 14. Site Permissions & Shield Details
    await testWindow.webContents.executeJavaScript('if (typeof openSitePermissionsModal === "function") openSitePermissionsModal(); else document.getElementById("sitePermissionsModal")?.classList.add("active");');
    await captureScreen('Site Permissions & Privacy Shield', '14_site_permissions.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("sitePermissionsModal")?.classList.remove("active");');
    await sleep(200);

    // 15. Keyboard Shortcuts Sheet
    await testWindow.webContents.executeJavaScript('if (typeof openShortcutsModal === "function") openShortcutsModal(); else document.getElementById("shortcutsModal")?.classList.add("active");');
    await captureScreen('Keyboard Shortcuts Sheet', '15_keyboard_shortcuts.png');
    await testWindow.webContents.executeJavaScript('document.getElementById("shortcutsModal")?.classList.remove("active");');
    await sleep(200);

    // 16. Responsive Viewport Check: 1024x768 (Compact Laptop Layout)
    testWindow.setBounds({ x: 100, y: 100, width: 1024, height: 768 });
    await sleep(350);
    await captureScreen('Responsive Layout (1024x768)', '16_responsive_1024x768.png');

    // 17. Dedicated New Tab View
    const newTabWin = new BrowserWindow({
      width: 1440,
      height: 900,
      show: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    newTabWin.loadFile(path.join(__dirname, 'src', 'newtab.html'));
    await new Promise(r => newTabWin.webContents.on('did-finish-load', r));
    await sleep(600);
    const newtabImg = await newTabWin.webContents.capturePage();
    const newtabPath = path.join(SCREENSHOT_DIR, '17_newtab_page.png');
    fs.writeFileSync(newtabPath, newtabImg.toPNG());
    console.log(`  ✓ Captured [New Tab Page & Living Scene] -> 17_newtab_page.png (${Math.round(fs.statSync(newtabPath).size / 1024)} KB)`);
    newTabWin.destroy();

    // 18. Error & Offline Recovery Page
    const errorWin = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    errorWin.loadFile(path.join(__dirname, 'src', 'error.html'));
    await new Promise(r => errorWin.webContents.on('did-finish-load', r));
    await sleep(400);
    const errorImg = await errorWin.webContents.capturePage();
    const errorPath = path.join(SCREENSHOT_DIR, '18_error_page.png');
    fs.writeFileSync(errorPath, errorImg.toPNG());
    console.log(`  ✓ Captured [Error & Offline Recovery Screen] -> 18_error_page.png (${Math.round(fs.statSync(errorPath).size / 1024)} KB)`);
    errorWin.destroy();

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('VISUAL INSPECTION COMPLETE: 18/18 High-Resolution Artifacts Captured!');
    console.log(`Console Errors Encountered: ${consoleErrors.length}`);
    console.log('══════════════════════════════════════════════════════════════\n');

    testWindow.destroy();
    app.quit();
  });
});
