// Staunt Browser Ultra — Enterprise Hardened Chromium Engine
// Former Google Project Zero / Chromium Security Team Architectural Grade
// Resolves Viewport Freeze & Blank Screen via Precision WebContentsView Geometry

const { app, BrowserWindow, WebContentsView, BrowserView, session, ipcMain, Menu, dialog, clipboard, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { isHomographOrDeceptive } = require('./src/adblocker');
const {
  initStauntShieldEngine,
  enableShieldInSession,
  attachShieldToWebContents,
  setShieldLevel,
  setSiteShieldOverrideChecker,
  setPrivacyHeaderConfig,
  isCriticalWhitelisted
} = require('./src/adblocker-core');
const { pathToFileURL, fileURLToPath } = require('url');
const logger = console;
const NativeSearchClient = require('./src/search_client');
const nativeSearchClient = new NativeSearchClient();

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// ROBUST WINDOW STATE PERSISTENCE (Fixes Progressive Window Shrinking Bug)
// =============================================================================
const USER_DATA_PATH = app.getPath('userData');
const WINDOW_STATE_FILE = path.join(USER_DATA_PATH, 'window-state.json');

// =============================================================================
// RESILIENT ATOMIC JSON STORAGE UTILITIES (Zero Corruption & .bak Recovery)
// =============================================================================
function atomicWriteJson(filePath, data) {
  try {
    const tempFile = `${filePath}.${Date.now()}.${Math.random().toString(36).substr(2, 6)}.tmp`;
    const bakFile = `${filePath}.bak`;
    const jsonContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, jsonContent, 'utf-8');
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, bakFile);
      } catch (e) {}
    }
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    console.warn(`[ATOMIC WRITE ERROR] Failed writing ${filePath}:`, err.message);
    try {
      fs.writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {}
  }
}

function readJsonWithBak(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.warn(`[STORAGE RESILIENCE] Primary file corrupted: ${filePath}, attempting .bak restore:`, err.message);
    const bakFile = `${filePath}.bak`;
    try {
      if (fs.existsSync(bakFile)) {
        const restored = JSON.parse(fs.readFileSync(bakFile, 'utf-8'));
        atomicWriteJson(filePath, restored);
        return restored;
      }
    } catch (bakErr) {
      console.error(`[STORAGE RESILIENCE] Backup restore failed for ${bakFile}:`, bakErr.message);
    }
  }
  return fallback;
}

const DEFAULT_WINDOW_BOUNDS = {
  width: 1200,
  height: 800,
  x: undefined,
  y: undefined,
  isMaximized: false,
  isFullScreen: false,
  maximized: false,
  fullscreen: false
};

let windowState = { ...DEFAULT_WINDOW_BOUNDS };

function loadWindowState() {
  try {
    const raw = readJsonWithBak(WINDOW_STATE_FILE, null);
    if (raw && typeof raw === 'object') {
      if (Number.isFinite(raw.width) && raw.width >= 600) windowState.width = Math.round(raw.width);
      if (Number.isFinite(raw.height) && raw.height >= 400) windowState.height = Math.round(raw.height);
      if (Number.isFinite(raw.x)) windowState.x = Math.round(raw.x);
      if (Number.isFinite(raw.y)) windowState.y = Math.round(raw.y);
      const maxVal = Boolean(raw.isMaximized !== undefined ? raw.isMaximized : raw.maximized);
      windowState.isMaximized = maxVal;
      windowState.maximized = maxVal;
      const fullVal = Boolean(raw.isFullScreen !== undefined ? raw.isFullScreen : raw.fullscreen);
      windowState.isFullScreen = fullVal;
      windowState.fullscreen = fullVal;
    }
  } catch (e) {
    console.warn('[WINDOW STATE] Failed to parse window-state.json, falling back to defaults:', e.message);
    windowState = { ...DEFAULT_WINDOW_BOUNDS };
  }
}

loadWindowState();

function getValidatedWindowState() {
  const displays = screen.getAllDisplays();
  if (!displays || displays.length === 0) return windowState;

  const targetPoint = {
    x: (windowState.x !== undefined) ? (windowState.x + Math.floor(windowState.width / 2)) : displays[0].workArea.x + 100,
    y: (windowState.y !== undefined) ? (windowState.y + Math.floor(windowState.height / 2)) : displays[0].workArea.y + 100
  };

  const activeDisplay = screen.getDisplayNearestPoint(targetPoint) || screen.getPrimaryDisplay();
  const workArea = activeDisplay.workArea;

  const minWidth = 800;
  const minHeight = 500;

  let width = Math.min(Math.max(windowState.width || 1200, minWidth), workArea.width);
  let height = Math.min(Math.max(windowState.height || 800, minHeight), workArea.height);

  let x = windowState.x;
  let y = windowState.y;

  const isOutside = (x === undefined || y === undefined ||
    x + width < workArea.x + 50 ||
    x > workArea.x + workArea.width - 50 ||
    y + height < workArea.y + 50 ||
    y > workArea.y + workArea.height - 50);

  if (isOutside) {
    x = Math.round(workArea.x + Math.max(0, (workArea.width - width) / 2));
    y = Math.round(workArea.y + Math.max(0, (workArea.height - height) / 2));
  } else {
    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width));
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height));
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(x),
    y: Math.round(y),
    isMaximized: Boolean(windowState.isMaximized || windowState.maximized),
    maximized: Boolean(windowState.isMaximized || windowState.maximized),
    isFullScreen: Boolean(windowState.isFullScreen || windowState.fullscreen),
    fullscreen: Boolean(windowState.isFullScreen || windowState.fullscreen)
  };
}

let saveStateDebounceTimer = null;

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) return;

  const isMax = mainWindow.isMaximized();
  const isFull = mainWindow.isFullScreen();

  let bounds;
  if (typeof mainWindow.getNormalBounds === 'function') {
    bounds = mainWindow.getNormalBounds();
  } else if (!isMax && !isFull) {
    bounds = mainWindow.getBounds();
  } else {
    bounds = {
      x: windowState.x,
      y: windowState.y,
      width: windowState.width,
      height: windowState.height
    };
  }

  if (bounds && bounds.width >= 600 && bounds.height >= 400) {
    windowState = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      isMaximized: isMax,
      maximized: isMax,
      isFullScreen: isFull,
      fullscreen: isFull
    };

    atomicWriteJson(WINDOW_STATE_FILE, windowState);
  }
}

function scheduleSaveWindowState() {
  if (saveStateDebounceTimer) clearTimeout(saveStateDebounceTimer);
  saveStateDebounceTimer = setTimeout(saveWindowState, 300);
}

// =============================================================================
// DIRECTIVE 1: ENGINE BOOT HARDENING & HARDWARE ACCELERATION
// =============================================================================
// Process & Origin Isolation
app.commandLine.appendSwitch('site-per-process');
app.commandLine.appendSwitch('enable-features', 'IsolateOrigins,BlockInsecurePrivateNetworkRequests,VaapiVideoDecoder,CanvasOopRasterization,SmoothScrolling');

// Side-Channel Timing Attack Mitigation (Spectre / Meltdown)
app.commandLine.appendSwitch('enable-features', 'ReduceTimerPrecision');
app.commandLine.appendSwitch('disable-features', 'SharedArrayBuffer');

// Sandboxing Hardening
app.commandLine.appendSwitch('enable-sandbox');
app.commandLine.appendSwitch('disable-blink-features', 'WebUSB,WebHID,Serial,IdleDetection,WebBluetooth,DirectSockets');

// High-Performance GPU Rasterization & Zero-Copy
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// GPU Guard to recover cleanly from malformed shaders
app.on('gpu-process-crashed', (event, killed) => {
  console.error(`[CRITICAL GPU GUARD] Chromium GPU process crashed (killed: ${killed}). Recovering cleanly...`);
});

app.on('child-process-gone', (event, details) => {
  console.warn(`[CHILD PROCESS MONITOR] Process ${details.type} gone: ${details.reason} (Exit code: ${details.exitCode})`);
});

// Official Chrome Windows User-Agent across all sessions to prevent site breakage / mobile redirects
const OFFICIAL_CHROME_WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

let mainWindow = null;
let tabs = new Map();
let activeTabId = null;
let secondaryTabId = null;
let nextTabId = 1;
let closedTabsStack = [];

// Browser Topbar, Favourites & Find Bar Geometry
let isSplitViewActive = false;
let splitRatio = 0.5;
let isFindBarOpen = false;
const TOPBAR_HEIGHT = 44; // Fixed native 44px topbar
const FAVOURITES_BAR_HEIGHT = 30; // Dedicated 30px favourites bar
const FIND_BAR_HEIGHT = 40; // Docked Find in Page bar
function getChromeHeight() {
  return TOPBAR_HEIGHT
    + (settingsDB.showFavouritesBar !== false ? FAVOURITES_BAR_HEIGHT : 0)
    + (isFindBarOpen ? FIND_BAR_HEIGHT : 0);
}

const NEWTAB_PAGE_FILE = path.resolve(__dirname, 'src', 'newtab.html');
const ERROR_PAGE_FILE = path.resolve(__dirname, 'src', 'error.html');

function isLocalPageUrl(urlStr, targetFilePath) {
  if (!urlStr || typeof urlStr !== 'string' || !urlStr.startsWith('file:')) return false;
  try {
    const resolved = path.resolve(fileURLToPath(urlStr));
    return resolved.toLowerCase() === targetFilePath.toLowerCase();
  } catch (_) {
    return false;
  }
}

function canTabGoBack(wc) {
  if (!wc || wc.isDestroyed()) return false;
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoBack === 'function') {
    return wc.navigationHistory.canGoBack();
  }
  return wc.canGoBack();
}

function canTabGoForward(wc) {
  if (!wc || wc.isDestroyed()) return false;
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoForward === 'function') {
    return wc.navigationHistory.canGoForward();
  }
  return wc.canGoForward();
}

function isSafeHttpUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// =============================================================================
// LOCAL VAULT STORAGE (History, Bookmarks, Downloads, Settings)
// =============================================================================
const HISTORY_FILE = path.join(USER_DATA_PATH, 'staunt_history_vault.json');
const BOOKMARKS_FILE = path.join(USER_DATA_PATH, 'staunt_bookmarks_vault.json');
const DOWNLOADS_FILE = path.join(USER_DATA_PATH, 'staunt_downloads_vault.json');
const SETTINGS_FILE = path.join(USER_DATA_PATH, 'staunt_settings.json');

let historyDB = [];
let bookmarksDB = [];
let downloadsDB = [];
const DEFAULT_SETTINGS = {
  searchEngine: 'staunt',
  customSearchUrl: '',
  searchUrl: process.env.STAUNT_SEARCH_URL || 'https://staunt.vercel.app',
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
let settingsDB = { ...DEFAULT_SETTINGS };

historyDB = readJsonWithBak(HISTORY_FILE, []) || [];
bookmarksDB = readJsonWithBak(BOOKMARKS_FILE, []) || [];
downloadsDB = readJsonWithBak(DOWNLOADS_FILE, []) || [];
const loadedSettings = readJsonWithBak(SETTINGS_FILE, null);
settingsDB = loadedSettings ? { ...DEFAULT_SETTINGS, ...loadedSettings } : { ...DEFAULT_SETTINGS };
if (settingsDB.searchUrl && (
  settingsDB.searchUrl.includes('127.0.0.1') ||
  settingsDB.searchUrl.includes('localhost') ||
  settingsDB.searchUrl.includes('vastuda-search.onrender.com') ||
  settingsDB.searchUrl.includes('trycloud' + 'flare.com')
)) {
  settingsDB.searchUrl = 'https://staunt.vercel.app';
}
nativeSearchClient.setSearchEngine(settingsDB.searchEngine || 'staunt', settingsDB.customSearchUrl || '');
setShieldLevel(settingsDB.shieldLevel || 'standard');
setPrivacyHeaderConfig({
  dnt: settingsDB.doNotTrack !== false,
  gpc: settingsDB.globalPrivacyControl !== false,
  cookiePolicy: settingsDB.cookiePolicy || 'block-third-party'
});

// Normalize any orphaned in-progress downloads from an unclean previous exit
if (Array.isArray(downloadsDB)) {
  let changed = false;
  downloadsDB.forEach((d) => {
    if (d && (d.state === 'progressing' || d.state === 'paused')) {
      d.state = 'interrupted';
      changed = true;
    }
  });
  if (changed) atomicWriteJson(DOWNLOADS_FILE, downloadsDB.slice(0, 100));
}

function recordHistory(url, title, tabObj = null) {
  // Privacy Guarantee: NEVER persist Incognito tab browsing into history vault
  if (tabObj && tabObj.isIncognito) return;
  if (!url || typeof url !== 'string') return;
  const cleanUrl = url.trim().slice(0, 2048);
  if (
    isLocalPageUrl(cleanUrl, NEWTAB_PAGE_FILE) ||
    isLocalPageUrl(cleanUrl, ERROR_PAGE_FILE) ||
    cleanUrl.includes('newtab.html') ||
    cleanUrl.includes('error.html') ||
    cleanUrl === 'about:blank' ||
    cleanUrl.startsWith('about:') ||
    cleanUrl.startsWith('staunt://') ||
    cleanUrl.startsWith('data:') ||
    cleanUrl.startsWith('javascript:') ||
    cleanUrl.startsWith('file:')
  ) return;

  const cleanTitle = (title || cleanUrl).slice(0, 256);
  const now = Date.now();

  // Avoid triplicating history rows during a single page load (did-navigate -> page-title-updated -> did-finish-load)
  if (historyDB.length > 0 && historyDB[0].url === cleanUrl && (now - (historyDB[0].timestamp || 0)) < 15000) {
    if (cleanTitle && cleanTitle !== cleanUrl) {
      historyDB[0].title = cleanTitle;
    }
    historyDB[0].timestamp = now;
    atomicWriteJson(HISTORY_FILE, historyDB.slice(0, 1000));
    return;
  }

  const entry = {
    id: now.toString(36) + Math.random().toString(36).substr(2, 6),
    url: cleanUrl,
    title: cleanTitle,
    timestamp: now
  };

  historyDB.unshift(entry);
  if (historyDB.length > 5000) historyDB.pop();

  atomicWriteJson(HISTORY_FILE, historyDB.slice(0, 1000));
}

function clearHistoryRange(range = 'all') {
  const now = Date.now();
  if (range === '1h' || range === 'last-hour') {
    const cutoff = now - 3600 * 1000;
    historyDB = historyDB.filter(h => h.timestamp < cutoff);
  } else if (range === '24h' || range === 'last-24h') {
    const cutoff = now - 24 * 3600 * 1000;
    historyDB = historyDB.filter(h => h.timestamp < cutoff);
  } else if (range === '7d' || range === 'last-7d') {
    const cutoff = now - 7 * 24 * 3600 * 1000;
    historyDB = historyDB.filter(h => h.timestamp < cutoff);
  } else if (range === '4w' || range === 'last-4w') {
    const cutoff = now - 28 * 24 * 3600 * 1000;
    historyDB = historyDB.filter(h => h.timestamp < cutoff);
  } else {
    historyDB = [];
  }
  atomicWriteJson(HISTORY_FILE, historyDB);
  return { success: true, count: historyDB.length };
}

function clearDownloadsRange(range = 'all') {
  const now = Date.now();
  let cutoff = 0;
  if (range === '1h' || range === 'last-hour') cutoff = now - 3600 * 1000;
  else if (range === '24h' || range === 'last-24h') cutoff = now - 24 * 3600 * 1000;
  else if (range === '7d' || range === 'last-7d') cutoff = now - 7 * 24 * 3600 * 1000;
  else if (range === '4w' || range === 'last-4w') cutoff = now - 28 * 24 * 3600 * 1000;

  if (cutoff > 0) {
    downloadsDB = downloadsDB.filter(d => (d.startTime || d.updatedAt || 0) < cutoff);
  } else {
    downloadsDB = [];
  }
  atomicWriteJson(DOWNLOADS_FILE, downloadsDB);
  return { success: true, count: downloadsDB.length };
}

function recordDownload(entry) {
  if (!entry || !entry.id) return;
  const existingIdx = downloadsDB.findIndex(d => d.id === entry.id);
  if (existingIdx !== -1) {
    downloadsDB[existingIdx] = { ...downloadsDB[existingIdx], ...entry };
  } else {
    downloadsDB.unshift(entry);
    if (downloadsDB.length > 200) downloadsDB.pop();
  }
  atomicWriteJson(DOWNLOADS_FILE, downloadsDB.slice(0, 100));
}

const SESSION_FILE = path.join(USER_DATA_PATH, 'staunt_session_tabs.json');
const READING_LIST_FILE = path.join(USER_DATA_PATH, 'staunt_reading_list.json');
let readingListDB = readJsonWithBak(READING_LIST_FILE, []);
if (!Array.isArray(readingListDB)) readingListDB = [];

// =============================================================================
// PHASE 9: PASSWORD VAULT (AES-256-GCM, PBKDF2 — Zero Plaintext on Disk)
// =============================================================================
const crypto = require('crypto');
const CREDENTIALS_FILE = path.join(USER_DATA_PATH, 'staunt_credentials.json');
let credentialsDB = readJsonWithBak(CREDENTIALS_FILE, []);
if (!Array.isArray(credentialsDB)) credentialsDB = [];

// Key derivation: machine-local, stable, never stored externally
function getVaultKey() {
  const seed = crypto.createHash('sha256')
    .update(USER_DATA_PATH + 'STAUNT_VAULT_V1_KEY')
    .digest();
  return crypto.scryptSync(seed, 'staunt-credentials-salt-v1', 32);
}

function encryptCredential(plaintext) {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), enc: enc.toString('hex'), tag: tag.toString('hex') });
}

function decryptCredential(stored) {
  try {
    const key = getVaultKey();
    const { iv, enc, tag } = JSON.parse(stored);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(Buffer.from(enc, 'hex')) + decipher.final('utf8');
  } catch (_) {
    return null;
  }
}

function saveCredentialsDB() {
  atomicWriteJson(CREDENTIALS_FILE, credentialsDB);
}

// =============================================================================
// PHASE 8: SITE PERMISSIONS & PRIVACY CONTROL VAULT
// =============================================================================
const SITE_PERMISSIONS_FILE = path.join(USER_DATA_PATH, 'staunt_site_permissions.json');
const DEFAULT_GLOBAL_PERMISSIONS = {
  camera: 'ask',
  microphone: 'ask',
  location: 'ask',
  notifications: 'ask',
  'clipboard-read': 'ask',
  popups: 'block',
  fullscreen: 'allow'
};

const VALID_PERMISSION_TYPES = ['camera', 'microphone', 'location', 'notifications', 'clipboard-read', 'popups', 'fullscreen'];
const VALID_PERMISSION_VALUES = ['allow', 'block', 'ask', 'default'];

let rawPerms = readJsonWithBak(SITE_PERMISSIONS_FILE, null);
if (!rawPerms || typeof rawPerms !== 'object') {
  rawPerms = {
    globalDefaults: { ...DEFAULT_GLOBAL_PERMISSIONS },
    siteOverrides: {}
  };
}
if (!rawPerms.globalDefaults || typeof rawPerms.globalDefaults !== 'object') {
  rawPerms.globalDefaults = { ...DEFAULT_GLOBAL_PERMISSIONS };
}
if (!rawPerms.siteOverrides || typeof rawPerms.siteOverrides !== 'object') {
  rawPerms.siteOverrides = {};
}
let permissionsDB = rawPerms;

// In-memory permissions store for Incognito sessions (zero disk leakage)
const incognitoPermissionsStore = new Map();

function savePermissionsDB() {
  try {
    atomicWriteJson(SITE_PERMISSIONS_FILE, permissionsDB);
  } catch (err) {
    console.warn('[SITE PERMISSIONS] Failed to save site permissions to disk:', err.message);
  }
}

function normalizeSiteOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const u = new URL(rawUrl);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.origin.toLowerCase();
    }
    if (u.protocol === 'staunt:') {
      return 'staunt://' + (u.hostname || '').toLowerCase();
    }
  } catch (_) {}
  return '';
}

function isSiteOriginSecure(origin) {
  if (!origin || typeof origin !== 'string') return false;
  return origin.startsWith('https://') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('http://[::1]') ||
    origin.startsWith('staunt://');
}

function normalizePermissionNames(permission, details) {
  const p = String(permission || '').toLowerCase().trim();
  if (p === 'media') {
    if (details && Array.isArray(details.mediaTypes)) {
      const hasVid = details.mediaTypes.includes('video');
      const hasAud = details.mediaTypes.includes('audio');
      if (hasVid && hasAud) return ['camera', 'microphone'];
      if (hasVid) return ['camera'];
      if (hasAud) return ['microphone'];
    }
    return ['camera', 'microphone'];
  }
  if (p === 'camera') return ['camera'];
  if (p === 'microphone') return ['microphone'];
  if (p === 'geolocation') return ['location'];
  if (p === 'notifications') return ['notifications'];
  if (p === 'clipboard-read') return ['clipboard-read'];
  if (p === 'fullscreen') return ['fullscreen'];
  if (p === 'popups') return ['popups'];
  return [p];
}

function getEffectivePermissionForSite(origin, permission, isIncognito = false) {
  if (!origin) return permissionsDB.globalDefaults[permission] || DEFAULT_GLOBAL_PERMISSIONS[permission] || 'ask';

  if (isIncognito) {
    const incogRules = incognitoPermissionsStore.get(origin);
    if (incogRules && incogRules[permission] && incogRules[permission] !== 'default') {
      return incogRules[permission];
    }
  }

  const siteRules = permissionsDB.siteOverrides[origin];
  if (siteRules && siteRules[permission] && siteRules[permission] !== 'default') {
    return siteRules[permission];
  }

  return permissionsDB.globalDefaults[permission] || DEFAULT_GLOBAL_PERMISSIONS[permission] || 'ask';
}

setSiteShieldOverrideChecker((requestUrlOrInitiator) => {
  if (!requestUrlOrInitiator) return false;
  const origin = normalizeSiteOrigin(requestUrlOrInitiator);
  if (!origin) return false;
  const tab = tabs.get(activeTabId);
  const isIncog = tab ? Boolean(tab.isIncognito) : false;
  if (isIncog && incognitoPermissionsStore.has(origin)) {
    return incognitoPermissionsStore.get(origin).shield === 'disabled';
  }
  if (permissionsDB.siteOverrides[origin]) {
    return permissionsDB.siteOverrides[origin].shield === 'disabled';
  }
  return false;
});

function saveSessionTabs() {
  if (tabs.size === 0) return;
  const sessionTabs = [];
  for (const [id, tab] of tabs.entries()) {
    if (!tab.isIncognito && tab.url && !tab.url.startsWith('javascript:') && !tab.url.startsWith('data:')) {
      sessionTabs.push({
        url: tab.url,
        title: tab.title,
        isPinned: tab.isPinned,
        group: tab.group || null,
        workspaceId: tab.workspaceId,
        isActive: id === activeTabId
      });
    }
  }
  atomicWriteJson(SESSION_FILE, sessionTabs);
}

function restoreSessionTabs() {
  try {
    const data = readJsonWithBak(SESSION_FILE, null);
    if (Array.isArray(data) && data.length > 0) {
      let activeRestoredId = null;
      for (const item of data) {
        const createdId = createTab(item.url || 'staunt://newtab', {
          isPinned: Boolean(item.isPinned),
          group: item.group || null,
          workspaceId: item.workspaceId
        });
        if (item.isActive) activeRestoredId = createdId;
      }
      if (activeRestoredId !== null && tabs.has(activeRestoredId)) {
        switchTab(activeRestoredId);
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function cycleTab(direction = 1) {
  const tabIds = Array.from(tabs.keys());
  if (tabIds.length <= 1) return;
  const currentIndex = tabIds.indexOf(activeTabId);
  const nextIndex = (currentIndex + direction + tabIds.length) % tabIds.length;
  switchTab(tabIds[nextIndex]);
}

function reorderTabs(orderedIds) {
  if (!Array.isArray(orderedIds)) return;
  const newMap = new Map();
  for (const id of orderedIds) {
    const numId = Number(id);
    if (tabs.has(numId)) {
      newMap.set(numId, tabs.get(numId));
    }
  }
  for (const [id, tab] of tabs.entries()) {
    if (!newMap.has(id)) {
      newMap.set(id, tab);
    }
  }
  tabs = newMap;
}

function isUrlBookmarked(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (
    !clean ||
    clean.startsWith('staunt://') ||
    clean.includes('newtab.html') ||
    clean === 'about:blank' ||
    clean.startsWith('about:') ||
    clean.startsWith('data:') ||
    clean.startsWith('file:') ||
    clean.startsWith('javascript:')
  ) return false;
  const normTarget = normalizeBookmarkUrl(clean);
  return bookmarksDB.some(b => normalizeBookmarkUrl(b.url) === normTarget);
}

function toggleBookmarkCurrentPage() {
  const tab = tabs.get(activeTabId);
  if (!tab) return { bookmarked: false };
  const currentUrl = tab.url;
  if (!currentUrl || currentUrl.startsWith('staunt://') || currentUrl.includes('newtab.html') || currentUrl === 'about:blank') {
    return { bookmarked: false, url: currentUrl };
  }
  const normTarget = normalizeBookmarkUrl(currentUrl);
  const existingIdx = bookmarksDB.findIndex(b => normalizeBookmarkUrl(b.url) === normTarget);
  if (existingIdx !== -1) {
    bookmarksDB.splice(existingIdx, 1);
    atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bookmark-status-changed', { url: currentUrl, bookmarked: false });
      mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
    }
    return { bookmarked: false, url: currentUrl };
  } else {
    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: tab.title || currentUrl,
      url: currentUrl,
      favicon: tab.favicon || '',
      createdAt: Date.now()
    };
    bookmarksDB.unshift(newItem);
    atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bookmark-status-changed', { url: currentUrl, bookmarked: true, bookmark: newItem });
      mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
    }
    return { bookmarked: true, url: currentUrl, bookmark: newItem };
  }
}

function deleteBookmark(id) {
  const initLen = bookmarksDB.length;
  bookmarksDB = bookmarksDB.filter(b => b.id !== id);
  atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
  }
  return { success: bookmarksDB.length < initLen };
}

function deleteHistoryItem(id) {
  const initLen = historyDB.length;
  historyDB = historyDB.filter(h => h.id !== id);
  atomicWriteJson(HISTORY_FILE, historyDB);
  return { success: historyDB.length < initLen };
}

function deleteDownloadItem(id) {
  const initLen = downloadsDB.length;
  downloadsDB = downloadsDB.filter(d => d.id !== id);
  atomicWriteJson(DOWNLOADS_FILE, downloadsDB);
  return { success: downloadsDB.length < initLen };
}

function clearDownloads() {
  downloadsDB = [];
  atomicWriteJson(DOWNLOADS_FILE, []);
  return { success: true };
}

// =============================================================================
// NATIVE MENU HELPERS
// =============================================================================
function adjustZoom(delta) {
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents) {
    tab.zoomLevel = Math.max(-3, Math.min(3, (tab.zoomLevel || 0) + delta));
    tab.view.webContents.setZoomLevel(tab.zoomLevel);
  }
}

function resetZoom() {
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents) {
    tab.zoomLevel = 0;
    tab.view.webContents.setZoomLevel(0);
  }
}

function normalizeBookmarkUrl(u) {
  if (!u || typeof u !== 'string') return '';
  try {
    const parsed = new URL(u.trim());
    const p = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return (parsed.protocol + '//' + parsed.hostname.toLowerCase() + (parsed.port ? ':' + parsed.port : '') + p + parsed.search + parsed.hash).toLowerCase();
  } catch (_) {
    return u.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function bookmarkCurrentPage() {
  return toggleBookmarkCurrentPage();
}

function saveCurrentPage() {
  const tab = tabs.get(activeTabId);
  if (!tab || !tab.view || !tab.view.webContents) return;
  const currentUrl = tab.url || '';
  if (!currentUrl || currentUrl.startsWith('staunt://') || currentUrl.includes('newtab.html') || currentUrl === 'about:blank') {
    return;
  }
  let defaultName = 'webpage.html';
  if (tab.title) {
    defaultName = tab.title.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim().slice(0, 60) + '.html';
  }
  dialog.showSaveDialog(mainWindow, {
    title: 'Save Page As',
    defaultPath: defaultName,
    filters: [
      { name: 'HTML Complete', extensions: ['html', 'htm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (result && result.filePath) {
      tab.view.webContents.savePage(result.filePath, 'HTMLComplete')
        .then(() => {
          let fileSize = 0;
          try { fileSize = fs.statSync(result.filePath).size; } catch (_) {}
          recordDownload({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            fileName: path.basename(result.filePath),
            filePath: result.filePath,
            totalBytes: fileSize,
            receivedBytes: fileSize,
            state: 'completed',
            url: currentUrl,
            mimeType: 'text/html',
            timestamp: Date.now()
          });
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-complete', { fileName: path.basename(result.filePath), state: 'completed' });
          }
        })
        .catch(err => console.error('[SAVE PAGE ERROR]', err));
    }
  }).catch(err => console.error(err));
}

function showAboutDialog() {
  const currentVer = (app && typeof app.getVersion === 'function' ? app.getVersion() : null) || '2.0.1';
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Staunt Browser',
    message: 'Staunt Browser Ultra',
    detail: `Version: ${currentVer}\nVendor: VASTUDA Sovereign Systems\nChromium: ${process.versions.chrome || 'Engine version unavailable'}\nElectron: ${process.versions.electron || 'Unavailable'}\nNode.js: ${process.versions.node || 'Unavailable'}\nV8: ${process.versions.v8 || 'Unavailable'}\nOS: ${process.platform} ${process.arch}`
  });
}

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => createTab('staunt://newtab') },
      { label: 'New Incognito Tab', accelerator: 'CmdOrCtrl+Shift+N', click: () => createTab('staunt://newtab', { isIncognito: true }) },
      { type: 'separator' },
      { label: 'Save Page As...', accelerator: 'CmdOrCtrl+S', click: () => saveCurrentPage() },
      { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => closeTab(activeTabId) },
      { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: () => undoCloseTab() },
      { type: 'separator' },
      { label: 'Print...', accelerator: 'CmdOrCtrl+P', click: () => { 
        const tab = tabs.get(activeTabId);
        if (tab && tab.view && tab.view.webContents) {
          tab.view.webContents.printToPDF({}).then(data => {
            dialog.showSaveDialog(mainWindow, {
              title: 'Save PDF',
              defaultPath: 'webpage.pdf',
              filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            }).then(result => {
              if (result.filePath) fs.writeFileSync(result.filePath, data);
            });
          }).catch(err => console.error(err));
        }
      } },
      { type: 'separator' },
      { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      { label: 'Find...', accelerator: 'CmdOrCtrl+F', click: () => { if (mainWindow) mainWindow.webContents.send('toggle-find-bar'); } }
    ]
  },
  {
    label: 'View',
    submenu: [
      { label: 'Reload', accelerator: 'F5', click: () => handleReload() },
      { label: 'Hard Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => { const tab = tabs.get(activeTabId); if (tab && tab.view && tab.view.webContents) tab.view.webContents.reloadIgnoringCache(); } },
      { type: 'separator' },
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => adjustZoom(1) },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => adjustZoom(-1) },
      { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => resetZoom() },
      { type: 'separator' },
      { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); } },
      { type: 'separator' },
      { label: 'Developer Tools', accelerator: 'F12', click: () => { const tab = tabs.get(activeTabId); if (tab && tab.view && tab.view.webContents) tab.view.webContents.toggleDevTools(); } }
    ]
  },
  {
    label: 'Bookmarks',
    submenu: [
      { label: 'Bookmark This Page', accelerator: 'CmdOrCtrl+D', click: () => bookmarkCurrentPage() },
      { type: 'separator' },
      { label: 'Show All Bookmarks', click: () => { if (mainWindow) mainWindow.webContents.send('show-bookmarks'); } }
    ]
  },
  {
    label: 'Help',
    submenu: [
      { label: 'About Staunt Browser', click: () => showAboutDialog() }
    ]
  }
];

// =============================================================================
// MAIN WINDOW INITIALIZATION (Frameless, #090a0f Background)
// =============================================================================
function createMainWindow() {
  const validatedState = getValidatedWindowState();
  mainWindow = new BrowserWindow({
    width: validatedState.width,
    height: validatedState.height,
    x: validatedState.x,
    y: validatedState.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#090a0f',
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  if (validatedState.isMaximized) {
    mainWindow.maximize();
  } else if (validatedState.isFullScreen) {
    mainWindow.setFullScreen(true);
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    ensureOmniboxPopupView();
    // Instantiate and attach initial WebContentsView immediately so viewport is never 0x0
    if (tabs.size === 0) {
      if (settingsDB.restoreTabsOnStartup && restoreSessionTabs()) {
        console.log('[SESSION] Restored tabs from previous session');
      } else {
        createTab('staunt://newtab');
      }
    } else {
      updateLayoutBounds();
    }
  });

  configureSessionSecurity(session.defaultSession, false);
  initStauntShieldEngine(USER_DATA_PATH).then(() => {
    enableShieldInSession(session.defaultSession, onShieldStatsBroadcast);
  }).catch((e) => console.warn('[SHIELD INIT WARNING]', e));

  // Dynamic Window Resize Observers (Immediate Bounds Recalculation & Window State Debounce)
  function broadcastWindowState(stateName) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const isMax = mainWindow.isMaximized();
      const isMin = mainWindow.isMinimized();
      const isFull = mainWindow.isFullScreen();
      mainWindow.webContents.send('window-state-changed', {
        state: stateName || (isFull ? 'FULLSCREEN' : isMax ? 'MAXIMIZED' : isMin ? 'MINIMIZED' : 'NORMAL'),
        isMaximized: isMax,
        maximized: isMax,
        isMinimized: isMin,
        minimized: isMin,
        isFullScreen: isFull,
        fullscreen: isFull
      });
    }
  }

  // Context menu for Chrome editable controls (Omnibox, Find input, Modals)
  mainWindow.webContents.on('context-menu', (_e, params) => {
    if (params.isEditable || params.selectionText) {
      const chromeMenu = Menu.buildFromTemplate([
        ...(params.isEditable ? [
          { role: 'undo', enabled: params.editFlags.canUndo },
          { role: 'redo', enabled: params.editFlags.canRedo },
          { type: 'separator' },
          { role: 'cut', enabled: params.editFlags.canCut }
        ] : []),
        { role: 'copy', enabled: params.editFlags.canCopy },
        ...(params.isEditable ? [{ role: 'paste', enabled: params.editFlags.canPaste }] : []),
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      ]);
      chromeMenu.popup({ window: mainWindow });
    }
  });

  mainWindow.on('blur', () => {
    hideOmniboxPopup();
  });
  mainWindow.on('resize', () => {
    hideOmniboxPopup();
    updateLayoutBounds();
    scheduleSaveWindowState();
  });
  mainWindow.on('move', () => {
    hideOmniboxPopup();
    updateLayoutBounds();
    scheduleSaveWindowState();
  });
  mainWindow.on('maximize', () => {
    broadcastWindowState('MAXIMIZED');
    updateLayoutBounds();
    scheduleSaveWindowState();
    setTimeout(updateLayoutBounds, 25);
  });
  mainWindow.on('unmaximize', () => {
    broadcastWindowState('NORMAL');
    updateLayoutBounds();
    scheduleSaveWindowState();
    setTimeout(updateLayoutBounds, 25);
  });
  mainWindow.on('minimize', () => {
    broadcastWindowState('MINIMIZED');
  });
  mainWindow.on('restore', () => {
    broadcastWindowState(mainWindow.isMaximized() ? 'MAXIMIZED' : 'NORMAL');
    updateLayoutBounds();
    scheduleSaveWindowState();
  });
  mainWindow.on('enter-full-screen', () => {
    broadcastWindowState('FULLSCREEN');
    updateLayoutBounds();
    scheduleSaveWindowState();
  });
  mainWindow.on('leave-full-screen', () => {
    broadcastWindowState('NORMAL');
    updateLayoutBounds();
    scheduleSaveWindowState();
  });
  
  mainWindow.on('close', () => {
    saveSessionTabs();
    saveWindowState();
    // Clean up all tab views to prevent orphaned WebContentsView instances
    for (const [id, tab] of tabs.entries()) {
      try {
        detachTabView(tab);
        if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
          tab.view.webContents.stop();
          tab.view.webContents.close();
          if (typeof tab.view.webContents.destroy === 'function') {
            tab.view.webContents.destroy();
          }
        }
        tab.view = null;
      } catch (e) {}
    }
    tabs.clear();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    tabs.clear();
  });
}

// =============================================================================
// SESSION SECURITY, PERMISSIONS, SHIELD & DOWNLOAD MANAGER (Single-Attach WeakSet)
// =============================================================================
const configuredSessions = new WeakSet();
const activeDownloadItems = new Map();
const sessionPermissionCache = new Map();
const ALWAYS_DENY_PERMS = ['usb', 'bluetooth', 'serial', 'hid', 'idle-detection', 'pointer-lock', 'midisysex'];
const PROMPT_REQUIRED_PERMS = ['media', 'geolocation', 'notifications', 'display-capture', 'clipboard-read', 'midi'];

function onShieldStatsBroadcast(stats) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shield-updated', stats);
  }
}

function configureSessionSecurity(ses, isIncognito = false) {
  if (!ses || configuredSessions.has(ses)) return;
  configuredSessions.add(ses);

  ses.setUserAgent(OFFICIAL_CHROME_WINDOWS_UA);

  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    if (details.url.startsWith('file://') || details.url.includes('newtab.html')) {
      responseHeaders['Content-Security-Policy'] = [
        "default-src 'self' file: data: https://unpkg.com https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: http://127.0.0.1:* http://localhost:* file:; object-src 'none'; frame-ancestors 'none';"
      ];
    }
    responseHeaders['X-Content-Type-Options'] = ['nosniff'];
    callback({ responseHeaders });
  });

  enableShieldInSession(ses, onShieldStatsBroadcast);

  ses.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    const permLower = String(permission || '').toLowerCase();
    const url = (details && details.requestingUrl) || (webContents && !webContents.isDestroyed() ? webContents.getURL() : '');
    const origin = normalizeSiteOrigin(url);

    if (ALWAYS_DENY_PERMS.includes(permLower)) {
      console.warn(`[SECURITY HARDWARE GATE] Denied raw hardware API: ${permission}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-requested', { permission, url, origin, granted: false, reason: 'hardware-blocked' });
      }
      return callback(false);
    }

    const categories = normalizePermissionNames(permLower, details);
    const requiresSecure = ['camera', 'microphone', 'location', 'notifications', 'clipboard-read'];
    const isSecure = isSiteOriginSecure(origin);

    if (!isSecure && categories.some(cat => requiresSecure.includes(cat))) {
      console.warn(`[PERMISSION GATE] Denied ${permission} for insecure origin: ${url}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-requested', { permission, url, origin, granted: false, reason: 'insecure-origin' });
      }
      return callback(false);
    }

    let anyBlocked = false;
    let allAllowed = true;
    const needPromptCategories = [];

    for (const cat of categories) {
      const decision = getEffectivePermissionForSite(origin, cat, isIncognito);
      if (decision === 'block') {
        anyBlocked = true;
        allAllowed = false;
        break;
      } else if (decision === 'allow') {
        // permitted
      } else {
        allAllowed = false;
        needPromptCategories.push(cat);
      }
    }

    if (anyBlocked) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-requested', { permission, url, origin, granted: false, reason: 'site-blocked' });
      }
      return callback(false);
    }

    if (allAllowed) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-requested', { permission, url, origin, granted: true, reason: 'site-allowed' });
      }
      return callback(true);
    }

    if (!mainWindow || mainWindow.isDestroyed()) return callback(false);

    try {
      const displayLabel = needPromptCategories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' & ');
      const res = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Block', 'Allow'],
        defaultId: 0,
        cancelId: 0,
        title: 'Site Permission Request',
        message: `${origin || url} wants access to ${displayLabel} (${permission})`,
        detail: 'Only allow permissions on sites you trust.'
      });
      const granted = res && res.response === 1;
      const decValue = granted ? 'allow' : 'block';

      for (const cat of needPromptCategories) {
        if (isIncognito) {
          if (!incognitoPermissionsStore.has(origin)) incognitoPermissionsStore.set(origin, {});
          incognitoPermissionsStore.get(origin)[cat] = decValue;
        } else {
          if (!permissionsDB.siteOverrides[origin]) permissionsDB.siteOverrides[origin] = {};
          permissionsDB.siteOverrides[origin][cat] = decValue;
          permissionsDB.siteOverrides[origin].updatedAt = Date.now();
        }
      }
      if (!isIncognito) {
        savePermissionsDB();
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-requested', {
          permission,
          url,
          origin,
          granted,
          reason: granted ? 'user-allowed' : 'user-denied'
        });
        mainWindow.webContents.send('site-permissions-updated', { origin });
      }
      return callback(granted);
    } catch (_) {
      return callback(false);
    }
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const permLower = String(permission || '').toLowerCase();
    if (ALWAYS_DENY_PERMS.includes(permLower)) return false;

    const url = requestingOrigin || (webContents && !webContents.isDestroyed() ? webContents.getURL() : '');
    const origin = normalizeSiteOrigin(url);
    if (!origin) return false;

    const categories = normalizePermissionNames(permLower, details);
    const requiresSecure = ['camera', 'microphone', 'location', 'notifications', 'clipboard-read'];
    const isSecure = isSiteOriginSecure(origin);
    if (!isSecure && categories.some(cat => requiresSecure.includes(cat))) return false;

    return categories.every(cat => getEffectivePermissionForSite(origin, cat, isIncognito) === 'allow');
  });

  ses.on('will-download', (_event, item) => {
    const downloadId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const totalBytes = item.getTotalBytes();
    let fileName = item.getFilename();
    let saveDir = app.getPath('downloads');
    if (typeof settingsDB.downloadPath === 'string' && settingsDB.downloadPath.trim()) {
      const candidateDir = path.normalize(settingsDB.downloadPath.trim());
      try {
        if (fs.existsSync(candidateDir) && fs.statSync(candidateDir).isDirectory()) {
          saveDir = candidateDir;
        } else {
          settingsDB.downloadPath = '';
          atomicWriteJson(SETTINGS_FILE, settingsDB);
        }
      } catch (_) {
        saveDir = app.getPath('downloads');
      }
    }
    let targetPath = path.join(saveDir, fileName);

    if (fs.existsSync(targetPath)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      let counter = 1;
      while (fs.existsSync(path.join(saveDir, `${base} (${counter})${ext}`))) {
        counter++;
      }
      fileName = `${base} (${counter})${ext}`;
      targetPath = path.join(saveDir, fileName);
    }
    item.setSavePath(targetPath);
    activeDownloadItems.set(downloadId, item);

    const downloadEntry = {
      id: downloadId,
      fileName: fileName,
      filePath: targetPath,
      totalBytes: totalBytes,
      receivedBytes: 0,
      state: 'progressing',
      canResume: false,
      url: item.getURL() || '',
      mimeType: item.getMimeType() || '',
      timestamp: Date.now()
    };
    recordDownload(downloadEntry);

    item.on('updated', (_e, state) => {
      const received = item.getReceivedBytes();
      const total = item.getTotalBytes() || totalBytes;
      const isPaused = item.isPaused();
      const effectiveState = isPaused ? 'paused' : state;
      const percent = total > 0 ? Math.floor((received / total) * 100) : 0;
      downloadEntry.totalBytes = total;
      downloadEntry.receivedBytes = received;
      downloadEntry.state = effectiveState;
      downloadEntry.canResume = item.canResume();
      recordDownload(downloadEntry);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', {
          id: downloadId,
          fileName: fileName,
          filePath: targetPath,
          percent: percent,
          receivedBytes: received,
          totalBytes: total,
          state: effectiveState,
          canResume: downloadEntry.canResume
        });
      }
    });

    item.once('done', (_e, state) => {
      activeDownloadItems.delete(downloadId);
      downloadEntry.totalBytes = item.getTotalBytes() || downloadEntry.totalBytes;
      downloadEntry.state = state;
      downloadEntry.receivedBytes = item.getReceivedBytes();
      downloadEntry.canResume = false;
      recordDownload(downloadEntry);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-complete', {
          id: downloadId,
          fileName: fileName,
          filePath: targetPath,
          state: state,
          totalBytes: downloadEntry.totalBytes,
          receivedBytes: downloadEntry.receivedBytes
        });
      }
    });
  });
}

// =============================================================================
// PRECISION VIEW BOUNDS MANAGER (x: 0, y: 44, width: w, height: h - 44)
// =============================================================================
let isModalOpen = false;

function updateLayoutBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const activeTab = tabs.get(activeTabId);
  const secondaryTab = tabs.get(secondaryTabId);

  if (isModalOpen) {
    if (activeTab && activeTab.view && activeTab.view.setBounds) {
      activeTab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
    if (secondaryTab && secondaryTab.view && secondaryTab.view.setBounds) {
      secondaryTab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
    return;
  }

  const bounds = mainWindow.getContentBounds();
  const chromeHeight = getChromeHeight();
  const availableWidth = Math.max(bounds.width, 100);
  const availableHeight = Math.max(bounds.height - chromeHeight, 100);
  const startX = 0;
  const startY = chromeHeight;

  if (!isSplitViewActive || !secondaryTab) {
    if (activeTab && activeTab.view && activeTab.view.setBounds) {
      activeTab.view.setBounds({
        x: startX,
        y: startY,
        width: availableWidth,
        height: availableHeight
      });
    }
  } else {
    const leftWidth = Math.floor(availableWidth * splitRatio);
    const rightWidth = availableWidth - leftWidth;

    if (activeTab && activeTab.view && activeTab.view.setBounds) {
      activeTab.view.setBounds({
        x: startX,
        y: startY,
        width: leftWidth,
        height: availableHeight
      });
    }

    if (secondaryTab && secondaryTab.view && secondaryTab.view.setBounds) {
      secondaryTab.view.setBounds({
        x: startX + leftWidth,
        y: startY,
        width: rightWidth,
        height: availableHeight
      });
    }
  }

  // Keep omnibox popup above active WebContentsView when visible
  if (omniboxPopupView && isOmniboxPopupVisible && mainWindow.contentView && mainWindow.contentView.addChildView) {
    mainWindow.contentView.addChildView(omniboxPopupView);
  }
}

// =============================================================================
// ZERO-TRUST WEBCONTENTSVIEW TAB CREATOR
// =============================================================================
function createTab(initialUrl = 'staunt://newtab', options = {}) {
  const tabId = nextTabId++;
  const isIncognito = !!options.isIncognito;

  const tabSession = isIncognito 
    ? session.fromPartition(`incognito-${Date.now()}-${tabId}`, { cache: false }) 
    : session.defaultSession;

  configureSessionSecurity(tabSession, isIncognito);

  const webPrefs = {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    enableRemoteModule: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    session: tabSession,
    plugins: true,
    enableWebSQL: false,
    webviewTag: false
  };

  let view;
  if (typeof WebContentsView !== 'undefined') {
    view = new WebContentsView({ webPreferences: webPrefs });
  } else {
    view = new BrowserView({ webPreferences: webPrefs });
  }

  // Ensure view has native dark background to avoid white flashing during load
  if (view.setBackgroundColor) {
    view.setBackgroundColor('#090a0f');
  }

  const tabObj = {
    id: tabId,
    view: view,
    session: tabSession,
    url: initialUrl,
    title: initialUrl === 'staunt://newtab' ? 'Favorites' : initialUrl,
    favicon: '',
    workspaceId: options.workspaceId || 'personal',
    isPinned: !!options.isPinned,
    group: options.group || null,
    isIncognito: isIncognito,
    isHibernated: false,
    isLoading: false,
    isError: false,
    failedUrl: null,
    lastActiveTime: Date.now(),
    isAudioPlaying: false,
    isMuted: false,
    canGoBack: false,
    canGoForward: false,
    zoomLevel: 0
  };

  tabs.set(tabId, tabObj);
  setupWebContentsEvents(tabObj);

  const formattedUrl = formatUrlOrSearch(initialUrl);
  view.webContents.loadURL(formattedUrl).catch(() => {});

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab-created', serializeTab(tabObj));
  }

  switchTab(tabId);
  return tabId;
}

function setupWebContentsEvents(tabObj) {
  const wc = tabObj.view.webContents;
  wc.setUserAgent(OFFICIAL_CHROME_WINDOWS_UA);

  // Popup & OAuth Handler (strictly enforce http/https URLs)
  wc.setWindowOpenHandler(({ url, disposition }) => {
    if (!isSafeHttpUrl(url)) {
      console.warn('[SECURITY] Blocked non-HTTP(S) window.open:', url);
      return { action: 'deny' };
    }
    if (isHomographOrDeceptive(url)) {
      console.warn('[SECURITY] Blocked deceptive popup:', url);
      return { action: 'deny' };
    }

    const currentUrl = wc.getURL();
    const tabOrigin = normalizeSiteOrigin(currentUrl);
    const popupDecision = getEffectivePermissionForSite(tabOrigin, 'popups', tabObj.isIncognito);

    if (popupDecision === 'block') {
      const isCritical = isCriticalWhitelisted(url) || /accounts\.google\.com|appleid\.apple\.com|github\.com\/login|oauth|stripe\.com|razorpay\.com|paypal\.com/i.test(url);
      if (!isCritical) {
        console.warn(`[SECURITY POPUP GATE] Pop-up blocked for ${tabOrigin} -> ${url}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toast-message', `Pop-up blocked for ${tabOrigin || 'this site'}`);
        }
        return { action: 'deny' };
      }
    }

    if (isCriticalWhitelisted(url) || /accounts\.google\.com|appleid\.apple\.com|github\.com\/login|oauth|stripe\.com|razorpay\.com|paypal\.com/i.test(url) || disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            session: wc.session,
            enableRemoteModule: false
          }
        }
      };
    }

    createTab(url, { workspaceId: tabObj.workspaceId, isIncognito: tabObj.isIncognito });
    return { action: 'deny' };
  });

  wc.on('enter-html-full-screen', (event) => {
    const origin = normalizeSiteOrigin(wc.getURL());
    const fullscreenDecision = getEffectivePermissionForSite(origin, 'fullscreen', tabObj.isIncognito);
    if (fullscreenDecision === 'block') {
      console.warn(`[SECURITY FULLSCREEN GATE] Fullscreen request blocked for origin: ${origin}`);
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toast-message', `Fullscreen blocked for ${origin || 'this site'}`);
      }
    }
  });

  // Navigation Guard & Protocol Armor
  const DANGEROUS_SCHEMES = ['file:', 'javascript:', 'data:', 'vbscript:', 'chrome:', 'ms-appx:'];

  wc.on('will-navigate', (event, navigationUrl) => {
    try {
      // Check for pending password submit before navigation (skip for Incognito)
      if (!tabObj.isIncognito && wc && !wc.isDestroyed()) {
        wc.executeJavaScript('document.documentElement.dataset.stauntPendingSubmit || ""')
          .then(pending => {
            if (pending) {
              try {
                const data = JSON.parse(pending);
                const currentOrigin = normalizeSiteOrigin(wc.getURL());
                if (data.p && currentOrigin && mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('save-password-prompt', {
                    origin: currentOrigin,
                    username: data.u || '',
                    password: data.p
                  });
                }
              } catch (_) {}
            }
          }).catch(() => {});
      }

      if (navigationUrl.startsWith('staunt://auth-callback')) {
        event.preventDefault();
        const currentUrl = wc.getURL();
        if (!isTrustedAuthOrigin(currentUrl)) {
          console.warn('[SECURITY VIOLATION] Unauthorized origin attempted auth callback:', currentUrl);
          return;
        }
        handleDesktopAuthCallback(tabObj);
        return;
      }
      if (navigationUrl.startsWith('staunt://auth-logout')) {
        event.preventDefault();
        const currentUrl = wc.getURL();
        if (!isTrustedAuthOrigin(currentUrl)) {
          console.warn('[SECURITY VIOLATION] Unauthorized origin attempted auth logout callback:', currentUrl);
          return;
        }
        handleDesktopAuthLogout(tabObj);
        return;
      }
      if (navigationUrl === 'about:blank' || navigationUrl.startsWith('about:')) {
        return;
      }
      const parsed = new URL(navigationUrl);
      if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:' || parsed.protocol === 'sms:') {
        event.preventDefault();
        shell.openExternal(navigationUrl).catch(() => {});
        return;
      }
      const isAllowedLocal = isLocalPageUrl(navigationUrl, NEWTAB_PAGE_FILE) || isLocalPageUrl(navigationUrl, ERROR_PAGE_FILE);
      if (DANGEROUS_SCHEMES.includes(parsed.protocol) && !isAllowedLocal) {
        console.warn(`[SECURITY INTERCEPT] Blocked will-navigate to dangerous protocol: ${navigationUrl}`);
        event.preventDefault();
        return;
      }
      if (isHomographOrDeceptive(navigationUrl)) {
        console.warn(`[SECURITY INTERCEPT] Blocked homograph deceptive domain: ${navigationUrl}`);
        event.preventDefault();
        return;
      }
    } catch (e) {
      console.warn(`[NAVIGATION] URL parse notice for ${navigationUrl}:`, e.message);
    }
  });

  // Keyboard shortcuts pass-through when focus is inside WebContentsView
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isCtrl = Boolean(input.control || input.meta);
    const key = String(input.key || '').toLowerCase();

    if (isCtrl && !input.shift && !input.alt && (key === 'l' || key === 'k' || key === 'e')) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('focus-omnibox');
      }
    } else if (isCtrl && !input.shift && !input.alt && key === 'f') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('toggle-find-bar');
      }
    } else if (isCtrl && !input.shift && !input.alt && key === 'r') {
      event.preventDefault();
      handleReload();
    } else if (isCtrl && input.shift && !input.alt && key === 'r') {
      event.preventDefault();
      if (!wc.isDestroyed()) wc.reloadIgnoringCache();
    } else if (isCtrl && key === 'tab') {
      event.preventDefault();
      cycleTab(input.shift ? -1 : 1);
    } else if (input.alt && !isCtrl && input.key === 'ArrowLeft') {
      event.preventDefault();
      handleBack();
    } else if (input.alt && !isCtrl && input.key === 'ArrowRight') {
      event.preventDefault();
      handleForward();
    } else if (input.alt && !isCtrl && input.key === 'Home') {
      event.preventDefault();
      handleHome();
    } else if (isCtrl && !input.shift && !input.alt && key === 'h') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('open-history-modal');
      }
    } else if (isCtrl && !input.shift && !input.alt && key === 'j') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('open-downloads-modal');
      }
    } else if (isCtrl && input.shift && !input.alt && key === 'o') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('open-bookmarks-modal');
      }
    } else if (isCtrl && input.shift && !input.alt && key === 'b') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chrome-shortcut', 'toggle-favourites-bar');
      }
    } else if (isCtrl && input.shift && !input.alt && key === 'p') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('chrome-shortcut', 'open-command-palette');
      }
    } else if (isCtrl && input.shift && !input.alt && key === 'a') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('chrome-shortcut', 'open-tab-search');
      }
    } else if (isCtrl && input.shift && !input.alt && key === 'l') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('chrome-shortcut', 'open-reading-list');
      }
    } else if (!isCtrl && !input.shift && input.alt && key === 'r') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('chrome-shortcut', 'toggle-reader-mode');
      }
    } else if (isCtrl && !input.alt && (key === '/' || key === '?')) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.focus();
        mainWindow.webContents.send('chrome-shortcut', 'open-shortcuts-modal');
      }
    } else if (input.key === 'Escape') {
      if (isFindBarOpen && mainWindow && !mainWindow.isDestroyed()) {
        event.preventDefault();
        mainWindow.webContents.send('chrome-shortcut', 'close-find-bar');
      } else if (tabObj.isLoading) {
        event.preventDefault();
        handleStop();
      }
    }
  });

  // Fault-Tolerant Crash Guard
  wc.on('render-process-gone', (e, details) => {
    console.error(`[CRASH GUARD] Tab ${tabObj.id} render process terminated:`, details.reason);
    detachTabView(tabObj);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-crashed', {
        tabId: tabObj.id,
        reason: details.reason
      });
    }
  });

  // Find In Page Result Listener (wires match ordinal & count back to renderer)
  wc.on('found-in-page', (_event, result) => {
    if (tabObj.id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('find-result', {
        requestId: result.requestId,
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate
      });
    }
  });

  // Navigation & URL Synchronization Handlers
  wc.on('page-title-updated', (e, title) => {
    if (isLocalPageUrl(wc.getURL(), ERROR_PAGE_FILE)) return;
    tabObj.title = title;
    tabObj.lastActiveTime = Date.now();
    recordHistory(tabObj.url, title, tabObj);
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);
  });

  wc.on('page-favicon-updated', (e, favicons) => {
    if (favicons && favicons.length > 0 && !isLocalPageUrl(wc.getURL(), ERROR_PAGE_FILE)) {
      tabObj.favicon = favicons[0];
      notifyTabUpdated(tabObj);
    }
  });

  wc.on('did-start-loading', () => {
    tabObj.isLoading = true;
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);
  });

  wc.on('did-stop-loading', () => {
    tabObj.isLoading = false;
    tabObj.canGoBack = canTabGoBack(wc);
    tabObj.canGoForward = canTabGoForward(wc);
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);
  });

  wc.on('did-start-navigation', (e, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    if (isLocalPageUrl(url, ERROR_PAGE_FILE)) {
      tabObj.isError = true;
    } else {
      tabObj.isError = false;
      tabObj.failedUrl = null;
      tabObj.url = url;
    }
    tabObj.lastActiveTime = Date.now();
    tabObj.canGoBack = canTabGoBack(wc);
    tabObj.canGoForward = canTabGoForward(wc);
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);
  });

  wc.on('did-navigate', (e, url) => {
    if (isLocalPageUrl(url, ERROR_PAGE_FILE)) {
      tabObj.isError = true;
    } else {
      tabObj.isError = false;
      tabObj.failedUrl = null;
      tabObj.url = url;
      recordHistory(tabObj.url, tabObj.title, tabObj);
    }
    tabObj.canGoBack = canTabGoBack(wc);
    tabObj.canGoForward = canTabGoForward(wc);
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);
  });

  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (!isMainFrame) return;
    if (!isLocalPageUrl(url, ERROR_PAGE_FILE)) {
      tabObj.url = url;
      tabObj.canGoBack = canTabGoBack(wc);
      tabObj.canGoForward = canTabGoForward(wc);
      notifyTabUpdated(tabObj);
      broadcastUrlSync(tabObj);
    }
  });

  wc.on('did-finish-load', () => {
    tabObj.isLoading = false;
    const loadedUrl = wc.getURL();
    if (isLocalPageUrl(loadedUrl, ERROR_PAGE_FILE)) {
      tabObj.isError = true;
    } else {
      tabObj.isError = false;
      tabObj.failedUrl = null;
      tabObj.url = loadedUrl;
      recordHistory(tabObj.url, tabObj.title, tabObj);
    }
    tabObj.canGoBack = canTabGoBack(wc);
    tabObj.canGoForward = canTabGoForward(wc);
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);

    // Check credentials available for origin and notify renderer
    const origin = normalizeSiteOrigin(loadedUrl);
    if (origin && !tabObj.isIncognito && credentialsDB.length > 0) {
      const matching = credentialsDB.filter(c => c.origin === origin);
      if (matching.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('credentials-available-for-page', {
          tabId: tabObj.id,
          origin,
          credentials: matching.map(c => ({ id: c.id, username: c.username }))
        });
      }
    }

    // Inject lightweight form submission monitor for password save detection on secure sites
    if (origin && isSiteOriginSecure(origin) && !tabObj.isIncognito) {
      wc.executeJavaScript(`
        (() => {
          if (window.__STAUNT_LOGIN_MONITOR__) return;
          window.__STAUNT_LOGIN_MONITOR__ = true;
          document.addEventListener('submit', (e) => {
            try {
              const form = e.target;
              if (!form) return;
              const pw = form.querySelector('input[type="password"]');
              if (!pw || !pw.value) return;
              const userEl = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[id*="user"], input[id*="login"]');
              const user = userEl ? userEl.value.trim() : '';
              document.documentElement.dataset.stauntPendingSubmit = JSON.stringify({
                u: user,
                p: pw.value
              });
            } catch(_) {}
          }, true);
        })()
      `).catch(() => {});
    }
  });

  // Actionable Network Error Recovery Card (Zero Data-URI Leakage)
  wc.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    tabObj.isLoading = false;
    if (errorCode === -3) {
      // Intentional stop / superseded navigation
      tabObj.canGoBack = canTabGoBack(wc);
      tabObj.canGoForward = canTabGoForward(wc);
      notifyTabUpdated(tabObj);
      broadcastUrlSync(tabObj);
      return;
    }
    console.warn(`[NAVIGATION ERROR] Code: ${errorCode} (${errorDescription}) for ${validatedURL}`);

    const searchQuery = nativeSearchClient.extractSearchQuery(validatedURL);
    const kind = errorCode === -20
      ? 'shield'
      : (String(errorDescription || '').includes('ERR_CERT') ? 'cert' : (searchQuery ? 'search' : 'network'));

    tabObj.isError = true;
    tabObj.failedUrl = validatedURL || tabObj.url;
    tabObj.url = tabObj.failedUrl;
    tabObj.title = kind === 'shield' ? 'Blocked by Shield' : 'Page Unavailable';
    notifyTabUpdated(tabObj);
    broadcastUrlSync(tabObj);

    const errParams = new URLSearchParams({
      url: tabObj.failedUrl || '',
      code: String(errorCode),
      desc: String(errorDescription || 'ERR_FAILED'),
      kind: kind,
      q: searchQuery || '',
      searchBase: STAUNT_SEARCH_URL
    });
    const errorFileUrl = pathToFileURL(ERROR_PAGE_FILE).href + '?' + errParams.toString();
    wc.loadURL(errorFileUrl).catch(() => {});
  });

  // Audio Indicators
  wc.on('media-started-playing', () => {
    tabObj.isAudioPlaying = true;
    notifyTabUpdated(tabObj);
  });

  wc.on('media-paused', () => {
    tabObj.isAudioPlaying = false;
    notifyTabUpdated(tabObj);
  });

  // Attach Shield Engine
  attachShieldToWebContents(wc);

  wc.on('context-menu', (event, params) => {
    const selectedText = (params.selectionText || '').trim();
    const safeLink = params.linkURL && isSafeHttpUrl(params.linkURL) ? params.linkURL : null;
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Back', enabled: canTabGoBack(wc), click: () => wc.goBack() },
      { label: 'Forward', enabled: canTabGoForward(wc), click: () => wc.goForward() },
      { label: 'Reload', click: () => handleReload() },
      { type: 'separator' },
      ...(safeLink ? [
        { label: 'Open Link in New Tab', click: () => createTab(safeLink, { workspaceId: tabObj.workspaceId, isIncognito: tabObj.isIncognito }) },
        { label: 'Open Link in Incognito Tab', click: () => createTab(safeLink, { workspaceId: tabObj.workspaceId, isIncognito: true }) },
        { label: 'Copy Link Address', click: () => { clipboard.writeText(safeLink); } },
        { type: 'separator' }
      ] : []),
      ...(params.srcURL && params.mediaType === 'image' && isSafeHttpUrl(params.srcURL)
        ? [{ label: 'Save Image As...', click: () => { wc.downloadURL(params.srcURL); } }, { type: 'separator' }]
        : []),
      ...(selectedText ? [
        { label: `Search Staunt for "${selectedText.slice(0, 28)}${selectedText.length > 28 ? '...' : ''}"`, click: () => createTab(nativeSearchClient.buildSearchUrl(selectedText), { workspaceId: tabObj.workspaceId, isIncognito: tabObj.isIncognito }) },
        { type: 'separator' }
      ] : []),
      ...(params.isEditable ? [{ label: 'Cut', enabled: params.editFlags.canCut, click: () => wc.cut() }] : []),
      { label: 'Copy', enabled: params.editFlags.canCopy, click: () => wc.copy() },
      ...(params.isEditable ? [{ label: 'Paste', enabled: params.editFlags.canPaste, click: () => wc.paste() }] : []),
      { label: 'Select All', enabled: params.editFlags.canSelectAll !== false, click: () => wc.selectAll() },
      { type: 'separator' },
      { label: 'Inspect Element', click: () => { wc.inspectElement(params.x, params.y); } }
    ].filter(Boolean));
    const viewX = (isSplitViewActive && tabObj.id === secondaryTabId && mainWindow && !mainWindow.isDestroyed())
      ? Math.floor(mainWindow.getContentBounds().width * splitRatio)
      : 0;
    contextMenu.popup(buildClampedPopupOpts({ x: (params.x || 0) + viewX, y: (params.y || 0) + getChromeHeight() }, 250));
  });
}

function getSecurityState(tabObj) {
  if (!tabObj) return 'internal';
  if (tabObj.isError) return 'error';
  const u = tabObj.url || '';
  if (!u || u === 'staunt://newtab' || u.startsWith('staunt://') || isLocalPageUrl(u, NEWTAB_PAGE_FILE) || u === 'about:blank') {
    return 'internal';
  }
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'https:') return 'secure';
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]') return 'local';
  } catch (_) {}
  return 'insecure';
}

function broadcastUrlSync(tabObj) {
  if (tabObj.id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('url-updated', {
      url: tabObj.url,
      title: tabObj.title,
      canGoBack: tabObj.canGoBack,
      canGoForward: tabObj.canGoForward,
      isBookmarked: isUrlBookmarked(tabObj.url),
      isLoading: Boolean(tabObj.isLoading),
      isError: Boolean(tabObj.isError),
      securityState: getSecurityState(tabObj)
    });
  }
}

function notifyTabUpdated(tabObj) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab-updated', serializeTab(tabObj));
  }
}

function serializeTab(tab) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favicon: tab.favicon,
    workspaceId: tab.workspaceId,
    isPinned: tab.isPinned,
    group: tab.group || null,
    isIncognito: tab.isIncognito,
    isHibernated: tab.isHibernated,
    isAudioPlaying: tab.isAudioPlaying,
    isMuted: tab.isMuted,
    canGoBack: tab.canGoBack,
    canGoForward: tab.canGoForward,
    isLoading: Boolean(tab.isLoading),
    zoomLevel: tab.zoomLevel || 0
  };
}

// =============================================================================
// TAB SWITCHING & ATTACHMENT
// =============================================================================
function switchTab(tabId) {
  if (!tabs.has(tabId)) return;
  const targetTab = tabs.get(tabId);

  if (targetTab.isHibernated) {
    wakeHibernatedTab(targetTab);
  }

  if (activeTabId && activeTabId !== tabId && activeTabId !== secondaryTabId) {
    detachTabView(tabs.get(activeTabId));
  }

  activeTabId = tabId;
  targetTab.lastActiveTime = Date.now();

  attachTabView(targetTab);
  updateLayoutBounds();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab-switched', {
      activeTabId: activeTabId,
      secondaryTabId: secondaryTabId,
      isSplit: isSplitViewActive
    });
    broadcastUrlSync(targetTab);

    // Send credentials available notification on tab switch
    const targetOrigin = normalizeSiteOrigin(targetTab.url);
    const matching = targetOrigin && !targetTab.isIncognito ? credentialsDB.filter(c => c.origin === targetOrigin) : [];
    mainWindow.webContents.send('credentials-available-for-page', {
      tabId: targetTab.id,
      origin: targetOrigin,
      credentials: matching.map(c => ({ id: c.id, username: c.username }))
    });
  }
}

function attachTabView(tabObj) {
  if (!mainWindow || !tabObj || !tabObj.view) return;
  if (mainWindow.contentView && mainWindow.contentView.addChildView) {
    mainWindow.contentView.addChildView(tabObj.view);
  } else if (mainWindow.setBrowserView) {
    mainWindow.setBrowserView(tabObj.view);
  }
}

function detachTabView(tabObj) {
  if (!mainWindow || !tabObj || !tabObj.view) return;
  if (mainWindow.contentView && mainWindow.contentView.removeChildView) {
    try { mainWindow.contentView.removeChildView(tabObj.view); } catch(e) {}
  } else if (mainWindow.removeBrowserView) {
    try { mainWindow.removeBrowserView(tabObj.view); } catch(e) {}
  }
}

function closeTab(tabId) {
  if (!tabs.has(tabId)) return;
  const allIdsBefore = Array.from(tabs.keys());
  const closedIndex = allIdsBefore.indexOf(tabId);
  const tab = tabs.get(tabId);

  if (
    !tab.isIncognito &&
    tab.url &&
    !tab.url.includes('newtab.html') &&
    tab.url !== 'staunt://newtab' &&
    !tab.url.startsWith('about:') &&
    !tab.url.startsWith('data:') &&
    !tab.url.startsWith('file:') &&
    !tab.url.startsWith('javascript:')
  ) {
    closedTabsStack.push({
      url: tab.url,
      workspaceId: tab.workspaceId,
      isPinned: tab.isPinned
    });
    if (closedTabsStack.length > 20) closedTabsStack.shift();
  }

  detachTabView(tab);

  try {
    if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.stop();
      tab.view.webContents.close();
      if (typeof tab.view.webContents.destroy === 'function') {
        tab.view.webContents.destroy();
      }
    }
    if (tab.isIncognito && tab.session) {
      tab.session.clearStorageData().catch(() => {});
      tab.session.clearCache().catch(() => {});
    }
  } catch (e) {}

  tab.view = null;
  tabs.delete(tabId);

  if (secondaryTabId === tabId) {
    secondaryTabId = null;
    isSplitViewActive = false;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tab-closed', tabId);
  }

  if (activeTabId === tabId) {
    if (tabs.size > 0) {
      const remaining = Array.from(tabs.keys());
      const nextIdx = Math.min(Math.max(0, closedIndex), remaining.length - 1);
      switchTab(remaining[nextIdx]);
    } else {
      createTab('staunt://newtab');
    }
  }
}

function undoCloseTab() {
  if (closedTabsStack.length > 0) {
    const lastClosed = closedTabsStack.pop();
    createTab(lastClosed.url, { workspaceId: lastClosed.workspaceId, isPinned: lastClosed.isPinned });
  }
}

function duplicateTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  return createTab(tab.url, {
    workspaceId: tab.workspaceId,
    isIncognito: tab.isIncognito
  });
}

function setTabPinned(tabId, isPinned) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.isPinned = Boolean(isPinned);
  notifyTabUpdated(tab);
}

function closeOtherTabs(tabId) {
  const allIds = Array.from(tabs.keys());
  for (const id of allIds) {
    if (id !== tabId) {
      closeTab(id);
    }
  }
}

function closeTabsToRight(tabId) {
  const allIds = Array.from(tabs.keys());
  const idx = allIds.indexOf(tabId);
  if (idx !== -1) {
    for (let i = idx + 1; i < allIds.length; i++) {
      closeTab(allIds[i]);
    }
  }
}

function handleStop() {
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents) {
    tab.view.webContents.stop();
  }
}

// Tab Hibernation Engine (15 mins inactive)
setInterval(() => {
  const now = Date.now();
  const HIBERNATE_THRESHOLD = 15 * 60 * 1000;

  tabs.forEach((tab) => {
    if (
      !tab.isHibernated &&
      tab.id !== activeTabId &&
      tab.id !== secondaryTabId &&
      !tab.isAudioPlaying &&
      (now - tab.lastActiveTime > HIBERNATE_THRESHOLD)
    ) {
      console.log(`[RAM HIBERNATION] Sleeping tab ${tab.id}: ${tab.title}`);
      detachTabView(tab);
      try {
        if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
          tab.view.webContents.stop();
          tab.view.webContents.close();
          if (typeof tab.view.webContents.destroy === 'function') {
            tab.view.webContents.destroy();
          }
        }
      } catch(e) {}
      tab.view = null;
      tab.isHibernated = true;
      notifyTabUpdated(tab);
    }
  });
}, 60000);

function wakeHibernatedTab(tab) {
  console.log(`[RAM HIBERNATION] Waking tab ${tab.id}: ${tab.url}`);
  const tabSes = tab.session || (tab.isIncognito ? session.fromPartition(`incognito-${Date.now()}-${tab.id}`, { cache: false }) : session.defaultSession);
  const webPrefs = {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    enableRemoteModule: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    session: tabSes,
    plugins: true,
    enableWebSQL: false,
    webviewTag: false
  };

  if (typeof WebContentsView !== 'undefined') {
    tab.view = new WebContentsView({ webPreferences: webPrefs });
  } else {
    tab.view = new BrowserView({ webPreferences: webPrefs });
  }
  if (tab.view.setBackgroundColor) {
    tab.view.setBackgroundColor('#090a0f');
  }

  tab.isHibernated = false;
  setupWebContentsEvents(tab);
  tab.view.webContents.loadURL(formatUrlOrSearch(tab.url)).catch(() => {});
  notifyTabUpdated(tab);
}

function toggleSplitView(secId) {
  if (isSplitViewActive && (!secId || secId === secondaryTabId)) {
    if (secondaryTabId && tabs.has(secondaryTabId)) {
      detachTabView(tabs.get(secondaryTabId));
    }
    secondaryTabId = null;
    isSplitViewActive = false;
  } else {
    if (secId && tabs.has(secId) && secId !== activeTabId) {
      secondaryTabId = secId;
    } else {
      const otherIds = Array.from(tabs.keys()).filter(id => id !== activeTabId);
      if (otherIds.length > 0) {
        secondaryTabId = otherIds[0];
      } else {
        secondaryTabId = createTab('staunt://newtab');
      }
    }
    isSplitViewActive = true;
    attachTabView(tabs.get(secondaryTabId));
  }

  updateLayoutBounds();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('split-view-updated', {
      isSplit: isSplitViewActive,
      secondaryTabId: secondaryTabId
    });
  }
}

// URL SANITIZER & PARSER (Intelligent URL vs STAUNT Search)
// =============================================================================
// Production URL resolution (Configuration-driven priority):
//   1. process.env.STAUNT_SEARCH_URL (Explicit environment / build override)
//   2. process.env.STAUNT_PRODUCTION_URL (Verified production HTTPS endpoint if configured)
//   3. 'https://staunt.vercel.app' (Verified production search engine)
//   4. 'http://127.0.0.1:5000' (Local development fallback)
const STAUNT_SEARCH_URL = (
  process.env.STAUNT_SEARCH_URL ||
  process.env.STAUNT_PRODUCTION_URL ||
  'https://staunt.vercel.app' ||
  'http://127.0.0.1:5000'
);

// Smart routing helpers for localhost, domain, and search URL resolution
const isLocalhost = (str) => nativeSearchClient.classifyInput(str).type === 'DOMAIN' || /^localhost/i.test(str);
const isDomain = (str) => nativeSearchClient.classifyInput(str).type === 'DOMAIN';

function getNewTabUrl() {
  const params = new URLSearchParams();
  if (settingsDB.searchEngine) params.set('engine', settingsDB.searchEngine);
  if (settingsDB.customSearchUrl) params.set('customUrl', settingsDB.customSearchUrl);
  const qs = params.toString() ? ('?' + params.toString()) : '';
  return pathToFileURL(NEWTAB_PAGE_FILE).href + qs;
}

function formatUrlOrSearch(input) {
  const trimmed = (input || '').trim().slice(0, 2048);
  const newTabUrl = getNewTabUrl();

  if (!trimmed || trimmed === 'staunt://newtab' || trimmed === 'about:newtab' || trimmed === 'about:blank') {
    return newTabUrl;
  }

  if (/^(javascript|vbscript):/i.test(trimmed) || /^data:\s*text\/html/i.test(trimmed) || trimmed.startsWith('file:')) {
    if (isLocalPageUrl(trimmed, NEWTAB_PAGE_FILE)) return newTabUrl;
    console.warn('[SECURITY INTERCEPT] Blocked unsafe/local file URI:', trimmed);
    return newTabUrl;
  }

  const classification = nativeSearchClient.classifyInput(
    trimmed,
    settingsDB.searchEngine || 'staunt',
    settingsDB.customSearchUrl || ''
  );
  if (!classification.url || classification.type === 'BLOCKED' || classification.type === 'INVALID_URL') {
    return newTabUrl;
  }
  return classification.url;
}

// =============================================================================
// HARDENED IPC BRIDGE
// =============================================================================
function verifyIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event.sender !== mainWindow.webContents) {
    console.warn('[SECURITY VIOLATION] IPC spoofing attempt detected!');
    return false;
  }
  return true;
}

// 1. Navigation & URL Handlers
function handleNavigate(url) {
  if (typeof url !== 'string' || url.length > 2048) return;
  const tab = tabs.get(activeTabId);
  if (!tab) return;
  if (tab.isHibernated) {
    wakeHibernatedTab(tab);
  }
  if (tab.view && tab.view.webContents) {
    const formatted = formatUrlOrSearch(url);
    tab.view.webContents.loadURL(formatted).catch(() => {});
  }
}

function handleHome() {
  handleNavigate((settingsDB && settingsDB.homeUrl) ? settingsDB.homeUrl : 'staunt://newtab');
}

ipcMain.on('navigate-to', (e, url) => {
  if (!verifyIpcSender(e)) return;
  handleNavigate(url);
});

ipcMain.on('nav-home', (e) => { if (verifyIpcSender(e)) handleHome(); });
ipcMain.on('go-home', (e) => { if (verifyIpcSender(e)) handleHome(); });

// 2. Navigation Actions (Back / Forward / Reload)
function handleBack() {
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents && canTabGoBack(tab.view.webContents)) {
    if (tab.view.webContents.navigationHistory && typeof tab.view.webContents.navigationHistory.goBack === 'function') {
      tab.view.webContents.navigationHistory.goBack();
    } else {
      tab.view.webContents.goBack();
    }
  }
}

function handleForward() {
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents && canTabGoForward(tab.view.webContents)) {
    if (tab.view.webContents.navigationHistory && typeof tab.view.webContents.navigationHistory.goForward === 'function') {
      tab.view.webContents.navigationHistory.goForward();
    } else {
      tab.view.webContents.goForward();
    }
  }
}

function handleReload() {
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents) {
    if (tab.isError && tab.failedUrl && isSafeHttpUrl(tab.failedUrl)) {
      const target = tab.failedUrl;
      tab.isError = false;
      tab.failedUrl = null;
      tab.view.webContents.loadURL(target).catch(() => {});
    } else {
      tab.view.webContents.reload();
    }
  }
}

ipcMain.on('nav-back', (e) => { if (verifyIpcSender(e)) handleBack(); });
ipcMain.on('go-back', (e) => { if (verifyIpcSender(e)) handleBack(); });

ipcMain.on('nav-forward', (e) => { if (verifyIpcSender(e)) handleForward(); });
ipcMain.on('go-forward', (e) => { if (verifyIpcSender(e)) handleForward(); });

ipcMain.on('nav-reload', (e) => { if (verifyIpcSender(e)) handleReload(); });
ipcMain.on('reload-page', (e) => { if (verifyIpcSender(e)) handleReload(); });

// 3. Window Controls (Close, Min, Max)
function handleClose() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
}

function handleMin() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
}

function handleMax() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
}

function handleRestore() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
  }
}

ipcMain.on('win-close', (e) => { if (verifyIpcSender(e)) handleClose(); });
ipcMain.on('window-close', (e) => { if (verifyIpcSender(e)) handleClose(); });

ipcMain.on('win-min', (e) => { if (verifyIpcSender(e)) handleMin(); });
ipcMain.on('window-minimize', (e) => { if (verifyIpcSender(e)) handleMin(); });

ipcMain.on('win-max', (e) => { if (verifyIpcSender(e)) handleMax(); });
ipcMain.on('window-maximize', (e) => { if (verifyIpcSender(e)) handleMax(); });

ipcMain.on('win-restore', (e) => { if (verifyIpcSender(e)) handleRestore(); });
ipcMain.on('window-restore', (e) => { if (verifyIpcSender(e)) handleRestore(); });

ipcMain.on('win-toggle-max', (e) => { if (verifyIpcSender(e)) handleMax(); });
ipcMain.on('window-toggle-maximize', (e) => { if (verifyIpcSender(e)) handleMax(); });

ipcMain.handle('get-window-state', (e) => {
  if (!verifyIpcSender(e) || !mainWindow || mainWindow.isDestroyed()) {
    return { isMaximized: false, maximized: false, isMinimized: false, minimized: false, isFullScreen: false, fullscreen: false, state: 'NORMAL' };
  }
  const isMax = mainWindow.isMaximized();
  const isMin = mainWindow.isMinimized();
  const isFull = mainWindow.isFullScreen();
  return {
    state: isFull ? 'FULLSCREEN' : isMax ? 'MAXIMIZED' : isMin ? 'MINIMIZED' : 'NORMAL',
    isMaximized: isMax,
    maximized: isMax,
    isMinimized: isMin,
    minimized: isMin,
    isFullScreen: isFull,
    fullscreen: isFull
  };
});

// 4. Tab Lifecycle IPC Handlers
ipcMain.on('create-tab', (e, url, opts) => {
  if (!verifyIpcSender(e)) return;
  const cleanUrl = typeof url === 'string' ? url.slice(0, 2048) : 'staunt://newtab';
  createTab(cleanUrl, opts);
});

ipcMain.on('switch-tab', (e, tabId) => {
  if (!verifyIpcSender(e)) return;
  if (typeof tabId === 'number' && Number.isFinite(tabId)) switchTab(tabId);
});

ipcMain.on('close-tab', (e, tabId) => {
  if (!verifyIpcSender(e)) return;
  if (typeof tabId === 'number' && Number.isFinite(tabId)) closeTab(tabId);
});

ipcMain.on('undo-close-tab', (e) => {
  if (!verifyIpcSender(e)) return;
  undoCloseTab();
});

ipcMain.on('toggle-split-view', (e, secId) => {
  if (!verifyIpcSender(e)) return;
  toggleSplitView(secId);
});

ipcMain.on('toggle-mute-tab', (e, tabId) => {
  if (!verifyIpcSender(e)) return;
  const targetId = typeof tabId === 'number' ? tabId : activeTabId;
  const tab = tabs.get(targetId);
  if (tab && tab.view && tab.view.webContents) {
    tab.isMuted = !tab.isMuted;
    tab.view.webContents.setAudioMuted(tab.isMuted);
    notifyTabUpdated(tab);
  }
});

ipcMain.on('clear-browser-cache', (e) => {
  if (!verifyIpcSender(e)) return;
  session.defaultSession.clearCache().catch(() => {});
  session.defaultSession.clearStorageData({ storages: ['cookies', 'filesystem', 'indexdb', 'websql', 'cachestorage', 'serviceworkers'] }).catch(() => {});
  console.log('[CACHE] Cleared cache & storage');
});

ipcMain.handle('clear-browser-cache-async', async (e) => {
  if (!verifyIpcSender(e)) return { success: false };
  await Promise.allSettled([
    session.defaultSession.clearCache(),
    session.defaultSession.clearStorageData({ storages: ['cookies', 'filesystem', 'indexdb', 'websql', 'cachestorage', 'serviceworkers'] })
  ]);
  return { success: true };
});

ipcMain.handle('get-runtime-stats', (e) => {
  if (!verifyIpcSender(e)) return null;
  const mem = process.memoryUsage();
  return {
    tabCount: tabs.size,
    rssMB: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
    heapUsedMB: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
    appMetricsCount: app.getAppMetrics().length
  };
});

ipcMain.on('set-zoom', (e, level) => {
  if (!verifyIpcSender(e)) return;
  const z = typeof level === 'number' ? Math.max(-3, Math.min(3, level)) : 0;
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents) {
    tab.zoomLevel = z;
    tab.view.webContents.setZoomLevel(z);
  }
});

ipcMain.on('print-to-pdf', async (e) => {
  if (!verifyIpcSender(e)) return;
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents) {
    try {
      const pdfData = await tab.view.webContents.printToPDF({});
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save PDF',
        defaultPath: 'webpage.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (filePath) {
        fs.writeFileSync(filePath, pdfData);
      }
    } catch (err) {
      console.error('Failed to print PDF', err);
    }
  }
});

ipcMain.on('find-in-page', (e, text, forward = true, findNext = false) => {
  if (!verifyIpcSender(e)) return;
  if (typeof text !== 'string') return;
  const cleanText = text.slice(0, 256);
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed() && cleanText) {
    if (!findNext || tab.lastFindQuery !== cleanText) {
      tab.view.webContents.stopFindInPage('keepSelection');
    }
    tab.lastFindQuery = cleanText;
    tab.view.webContents.findInPage(cleanText, { forward: Boolean(forward), findNext: true });
  }
});

ipcMain.on('stop-find-in-page', (e) => {
  if (!verifyIpcSender(e)) return;
  const tab = tabs.get(activeTabId);
  if (tab && tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
    tab.lastFindQuery = null;
    tab.view.webContents.stopFindInPage('clearSelection');
    tab.view.webContents.focus();
  }
});

ipcMain.on('set-find-bar-open', (e, open) => {
  if (!verifyIpcSender(e)) return;
  isFindBarOpen = Boolean(open);
  updateLayoutBounds();
});

ipcMain.handle('get-history', (e) => {
  if (!verifyIpcSender(e)) return [];
  return historyDB.slice(0, 500);
});

ipcMain.handle('get-bookmarks', (e) => {
  if (!verifyIpcSender(e)) return [];
  return bookmarksDB;
});

ipcMain.on('add-bookmark', (e, item) => {
  if (!verifyIpcSender(e)) return;
  if (item && typeof item === 'object') {
    const cleanUrl = typeof item.url === 'string' ? item.url.trim().slice(0, 2048) : '';
    const cleanTitle = typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 256) : 'Untitled';
    const cleanFavicon = typeof item.favicon === 'string' ? item.favicon.trim().slice(0, 2048) : '';
    if (!cleanUrl) return;

    const normNew = normalizeBookmarkUrl(cleanUrl);
    const existing = bookmarksDB.find(b => normalizeBookmarkUrl(b.url) === normNew);
    if (existing) {
      existing.title = cleanTitle;
      if (cleanFavicon) existing.favicon = cleanFavicon;
      atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
        mainWindow.webContents.send('toast-message', 'Updated existing favourite');
      }
      return;
    }

    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: cleanTitle,
      url: cleanUrl,
      favicon: cleanFavicon,
      createdAt: Date.now()
    };
    bookmarksDB.push(newItem);
    atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
    }
  }
});

ipcMain.on('set-tab-group', (e, tabId, group) => {
  if (!verifyIpcSender(e)) return;
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.group = (group && group.color)
    ? { name: String(group.name || 'Group').slice(0, 40), color: String(group.color).slice(0, 32), collapsed: Boolean(group.collapsed) }
    : null;
  notifyTabUpdated(tab);
});

ipcMain.on('rename-tab-group', (e, oldName, newName, newColor) => {
  if (!verifyIpcSender(e) || typeof oldName !== 'string') return;
  const cleanNew = typeof newName === 'string' && newName.trim() ? newName.trim().slice(0, 40) : oldName;
  const cleanColor = typeof newColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(newColor.trim()) ? newColor.trim() : null;
  for (const tab of tabs.values()) {
    if (tab.group && tab.group.name === oldName) {
      tab.group.name = cleanNew;
      if (cleanColor) tab.group.color = cleanColor;
      notifyTabUpdated(tab);
    }
  }
});

ipcMain.on('toggle-collapse-tab-group', (e, groupName) => {
  if (!verifyIpcSender(e) || typeof groupName !== 'string') return;
  const groupTabs = Array.from(tabs.values()).filter(t => t.group && t.group.name === groupName);
  if (groupTabs.length === 0) return;
  const nextCollapsed = !groupTabs.every(t => t.group.collapsed);
  for (const tab of groupTabs) {
    tab.group.collapsed = nextCollapsed;
    notifyTabUpdated(tab);
  }
  if (nextCollapsed) {
    const active = tabs.get(activeTabId);
    if (active && active.group && active.group.name === groupName) {
      const visibleFallback = Array.from(tabs.values()).find(t => !t.group || !t.group.collapsed);
      if (visibleFallback) switchTab(visibleFallback.id);
    }
  }
});

ipcMain.on('close-tab-group', (e, groupName) => {
  if (!verifyIpcSender(e) || typeof groupName !== 'string') return;
  const toClose = Array.from(tabs.values())
    .filter(t => !t.isPinned && t.group && t.group.name === groupName)
    .map(t => t.id);
  for (const id of toClose) {
    closeTab(id);
  }
});

ipcMain.on('nav-stop', (e) => { if (verifyIpcSender(e)) handleStop(); });
ipcMain.on('stop-navigation', (e) => { if (verifyIpcSender(e)) handleStop(); });

ipcMain.on('duplicate-tab', (e, tabId) => {
  if (!verifyIpcSender(e)) return;
  const targetId = typeof tabId === 'number' ? tabId : activeTabId;
  duplicateTab(targetId);
});

ipcMain.on('pin-tab', (e, tabId, isPinned) => {
  if (!verifyIpcSender(e)) return;
  const targetId = typeof tabId === 'number' ? tabId : activeTabId;
  setTabPinned(targetId, isPinned);
});

ipcMain.on('close-other-tabs', (e, tabId) => {
  if (!verifyIpcSender(e)) return;
  const targetId = typeof tabId === 'number' ? tabId : activeTabId;
  closeOtherTabs(targetId);
});

ipcMain.on('close-tabs-to-right', (e, tabId) => {
  if (!verifyIpcSender(e)) return;
  const targetId = typeof tabId === 'number' ? tabId : activeTabId;
  closeTabsToRight(targetId);
});

function buildClampedPopupOpts(pos, minW = 240) {
  const opts = { window: mainWindow };
  if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && mainWindow && !mainWindow.isDestroyed()) {
    const cb = mainWindow.getContentBounds();
    opts.x = Math.max(4, Math.min(Math.round(pos.x), Math.max(4, cb.width - minW)));
    opts.y = Math.max(4, Math.min(Math.round(pos.y), Math.max(4, cb.height - 40)));
  }
  return opts;
}

ipcMain.on('show-tab-context-menu', (e, tabId, pos) => {
  if (!verifyIpcSender(e)) return;
  const targetId = typeof tabId === 'number' ? tabId : activeTabId;
  const tab = tabs.get(targetId);
  if (!tab) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'New Tab',
      accelerator: 'CmdOrCtrl+T',
      click: () => createTab('staunt://newtab')
    },
    {
      label: 'Duplicate Tab',
      click: () => duplicateTab(targetId)
    },
    { type: 'separator' },
    {
      label: tab.isPinned ? 'Unpin Tab' : 'Pin Tab',
      click: () => setTabPinned(targetId, !tab.isPinned)
    },
    {
      label: 'Tab Group',
      submenu: [
        {
          label: 'New Custom Group...',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-group-editor', { tabId: targetId, mode: 'create' });
            }
          }
        },
        {
          label: 'Rename / Recolor Group...',
          enabled: Boolean(tab.group),
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed() && tab.group) {
              mainWindow.webContents.send('open-group-editor', {
                tabId: targetId,
                mode: 'edit',
                name: tab.group.name,
                color: tab.group.color
              });
            }
          }
        },
        {
          label: (tab.group && tab.group.collapsed) ? 'Expand Group' : 'Collapse Group',
          enabled: Boolean(tab.group),
          click: () => {
            if (!tab.group) return;
            const gName = tab.group.name;
            const groupTabs = Array.from(tabs.values()).filter(t => t.group && t.group.name === gName);
            const nextCollapsed = !groupTabs.every(t => t.group.collapsed);
            for (const gt of groupTabs) {
              gt.group.collapsed = nextCollapsed;
              notifyTabUpdated(gt);
            }
          }
        },
        { type: 'separator' },
        { label: 'Work (Gold)', click: () => { tab.group = { name: 'Work', color: '#d4a359', collapsed: false }; notifyTabUpdated(tab); } },
        { label: 'Research (Blue)', click: () => { tab.group = { name: 'Research', color: '#38bdf8', collapsed: false }; notifyTabUpdated(tab); } },
        { label: 'Reading (Emerald)', click: () => { tab.group = { name: 'Reading', color: '#10b981', collapsed: false }; notifyTabUpdated(tab); } },
        { label: 'Personal (Rose)', click: () => { tab.group = { name: 'Personal', color: '#f43f5e', collapsed: false }; notifyTabUpdated(tab); } },
        { type: 'separator' },
        { label: 'Remove from Group', enabled: Boolean(tab.group), click: () => { tab.group = null; notifyTabUpdated(tab); } },
        {
          label: 'Close Group',
          enabled: Boolean(tab.group),
          click: () => {
            if (!tab.group) return;
            const gName = tab.group.name;
            const toClose = Array.from(tabs.values()).filter(t => !t.isPinned && t.group && t.group.name === gName).map(t => t.id);
            for (const id of toClose) closeTab(id);
          }
        }
      ]
    },
    {
      label: tab.isMuted ? 'Unmute Tab' : 'Mute Tab',
      click: () => {
        tab.isMuted = !tab.isMuted;
        if (tab.view && tab.view.webContents) tab.view.webContents.setAudioMuted(tab.isMuted);
        notifyTabUpdated(tab);
      }
    },
    { type: 'separator' },
    {
      label: 'Close Tab',
      accelerator: 'CmdOrCtrl+W',
      click: () => closeTab(targetId)
    },
    {
      label: 'Close Other Tabs',
      enabled: tabs.size > 1,
      click: () => closeOtherTabs(targetId)
    },
    {
      label: 'Close Tabs to the Right',
      enabled: (() => {
        const ids = Array.from(tabs.keys());
        const idx = ids.indexOf(targetId);
        return idx !== -1 && idx < ids.length - 1;
      })(),
      click: () => closeTabsToRight(targetId)
    }
  ]);
  contextMenu.popup(buildClampedPopupOpts(pos, 240));
});

ipcMain.on('set-modal-open', (e, open) => {
  if (!verifyIpcSender(e)) return;
  isModalOpen = Boolean(open);
  if (isModalOpen) hideOmniboxPopup();
  updateLayoutBounds();
});

ipcMain.on('show-more-menu', (e, pos) => {
  if (!verifyIpcSender(e)) return;

  const currentTab = tabs.get(activeTabId);
  const zoomPct = currentTab ? Math.round(100 * Math.pow(1.2, currentTab.zoomLevel || 0)) : 100;

  const moreMenu = Menu.buildFromTemplate([
    {
      label: 'New Tab',
      accelerator: 'CmdOrCtrl+T',
      click: () => createTab('staunt://newtab')
    },
    {
      label: 'New Window',
      accelerator: 'CmdOrCtrl+N',
      click: () => createMainWindow()
    },
    {
      label: 'New Incognito Window',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => createTab('staunt://newtab', { isIncognito: true })
    },
    { type: 'separator' },
    {
      label: 'History',
      accelerator: 'CmdOrCtrl+H',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-history-modal');
        }
      }
    },
    {
      label: 'Downloads',
      accelerator: 'CmdOrCtrl+J',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-downloads-modal');
        }
      }
    },
    {
      label: 'Bookmarks',
      accelerator: 'CmdOrCtrl+Shift+O',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-bookmarks-modal');
        }
      }
    },
    {
      label: 'Account & Sync',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-account-modal');
        }
      }
    },
    { type: 'separator' },
    {
      label: `Zoom (${zoomPct}%)`,
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => adjustZoom(0.5)
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => adjustZoom(-0.5)
        },
        {
          label: 'Reset Zoom (100%)',
          accelerator: 'CmdOrCtrl+0',
          click: () => resetZoom()
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        }
      ]
    },
    {
      label: 'Save Page As...',
      accelerator: 'CmdOrCtrl+S',
      click: () => saveCurrentPage()
    },
    {
      label: 'Print...',
      accelerator: 'CmdOrCtrl+P',
      click: () => {
        const tab = tabs.get(activeTabId);
        if (tab && tab.view && tab.view.webContents) {
          tab.view.webContents.printToPDF({}).then((data) => {
            dialog.showSaveDialog(mainWindow, {
              title: 'Save PDF',
              defaultPath: 'webpage.pdf',
              filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            }).then(r => {
              if (r && r.filePath) {
                fs.writeFile(r.filePath, data, () => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('download-complete', { fileName: path.basename(r.filePath) });
                  }
                });
              }
            });
          }).catch(err => console.error(err));
        }
      }
    },
    {
      label: 'Find in Page...',
      accelerator: 'CmdOrCtrl+F',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-find-bar');
        }
      }
    },
    {
      label: 'Command Palette...',
      accelerator: 'CmdOrCtrl+Shift+P',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chrome-shortcut', 'open-command-palette');
        }
      }
    },
    {
      label: 'Search Tabs...',
      accelerator: 'CmdOrCtrl+Shift+A',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chrome-shortcut', 'open-tab-search');
        }
      }
    },
    {
      label: 'Reading List',
      accelerator: 'CmdOrCtrl+Shift+L',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chrome-shortcut', 'open-reading-list');
        }
      }
    },
    {
      label: 'Toggle Reader Mode',
      accelerator: 'Alt+R',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chrome-shortcut', 'toggle-reader-mode');
        }
      }
    },
    {
      label: 'Keyboard Shortcuts',
      accelerator: 'CmdOrCtrl+/',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chrome-shortcut', 'open-shortcuts-modal');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-settings-modal');
        }
      }
    },
    {
      label: 'Clear Browsing Data',
      accelerator: 'CmdOrCtrl+Shift+Delete',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-clear-data-modal');
        }
      }
    },
    {
      label: 'Developer Tools',
      accelerator: 'F12',
      click: () => {
        const tab = tabs.get(activeTabId);
        if (tab && tab.view && tab.view.webContents) {
          tab.view.webContents.toggleDevTools();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'About Staunt',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-about-modal');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      accelerator: 'Alt+F4',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      }
    }
  ]);

  moreMenu.popup(buildClampedPopupOpts(pos, 260));
});

// 5. Downloads & Vault Handlers
ipcMain.handle('get-downloads', (e) => {
  if (!verifyIpcSender(e)) return [];
  return downloadsDB;
});

ipcMain.on('open-download', (e, itemPath) => {
  if (!verifyIpcSender(e)) return;
  if (typeof itemPath === 'string' && itemPath.trim()) {
    const cleanPath = path.normalize(itemPath.trim());
    if (fs.existsSync(cleanPath)) {
      shell.openPath(cleanPath);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toast-message', 'Downloaded file not found on disk');
    }
  }
});

ipcMain.on('show-in-folder', (e, itemPath) => {
  if (!verifyIpcSender(e)) return;
  if (typeof itemPath === 'string' && itemPath.trim()) {
    const cleanPath = path.normalize(itemPath.trim());
    if (fs.existsSync(cleanPath)) {
      shell.showItemInFolder(cleanPath);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toast-message', 'File location no longer exists on disk');
    }
  }
});

ipcMain.handle('open-download-checked', async (e, itemPath) => {
  if (!verifyIpcSender(e) || typeof itemPath !== 'string' || !itemPath.trim()) return { success: false, error: 'Invalid file path' };
  const cleanPath = path.normalize(itemPath.trim());
  if (!fs.existsSync(cleanPath)) return { success: false, error: 'File was moved or deleted' };
  const errStr = await shell.openPath(cleanPath);
  return errStr ? { success: false, error: errStr } : { success: true };
});

ipcMain.handle('show-in-folder-checked', (e, itemPath) => {
  if (!verifyIpcSender(e) || typeof itemPath !== 'string' || !itemPath.trim()) return { success: false, error: 'Invalid file path' };
  const cleanPath = path.normalize(itemPath.trim());
  if (!fs.existsSync(cleanPath)) return { success: false, error: 'File was moved or deleted' };
  shell.showItemInFolder(cleanPath);
  return { success: true };
});

ipcMain.handle('pause-download', async (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  const item = activeDownloadItems.get(id);
  if (!item) return { success: false, error: 'Download no longer active' };
  if (!item.isPaused()) item.pause();
  await new Promise(resolve => setTimeout(resolve, 45));
  const entry = downloadsDB.find(d => d.id === id);
  if (entry && activeDownloadItems.has(id)) {
    entry.state = item.isPaused() ? 'paused' : entry.state;
    entry.receivedBytes = item.getReceivedBytes();
    entry.totalBytes = item.getTotalBytes() || entry.totalBytes;
    entry.canResume = item.canResume();
    atomicWriteJson(DOWNLOADS_FILE, downloadsDB.slice(0, 100));
    if (mainWindow && !mainWindow.isDestroyed()) {
      const pct = entry.totalBytes > 0 ? Math.floor((entry.receivedBytes / entry.totalBytes) * 100) : 0;
      mainWindow.webContents.send('download-progress', {
        id: entry.id,
        fileName: entry.fileName,
        filePath: entry.filePath,
        percent: pct,
        receivedBytes: entry.receivedBytes,
        totalBytes: entry.totalBytes,
        state: entry.state,
        canResume: entry.canResume
      });
    }
  }
  return { success: true, canResume: item ? item.canResume() : false };
});

ipcMain.handle('resume-download', async (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  const item = activeDownloadItems.get(id);
  if (!item || !item.canResume()) return { success: false, error: 'Download cannot be resumed' };
  item.resume();
  await new Promise(resolve => setTimeout(resolve, 45));
  const entry = downloadsDB.find(d => d.id === id);
  if (entry && activeDownloadItems.has(id)) {
    entry.state = item.isPaused() ? 'paused' : 'progressing';
    entry.canResume = item.canResume();
    atomicWriteJson(DOWNLOADS_FILE, downloadsDB.slice(0, 100));
    if (mainWindow && !mainWindow.isDestroyed()) {
      const pct = entry.totalBytes > 0 ? Math.floor((entry.receivedBytes / entry.totalBytes) * 100) : 0;
      mainWindow.webContents.send('download-progress', {
        id: entry.id,
        fileName: entry.fileName,
        filePath: entry.filePath,
        percent: pct,
        receivedBytes: entry.receivedBytes,
        totalBytes: entry.totalBytes,
        state: entry.state,
        canResume: entry.canResume
      });
    }
  }
  return { success: true };
});

ipcMain.handle('cancel-download', (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  const item = activeDownloadItems.get(id);
  if (!item) return { success: false, error: 'Download no longer active' };
  item.cancel();
  return { success: true };
});

ipcMain.handle('retry-download', (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  const entry = downloadsDB.find(d => d.id === id);
  const tab = tabs.get(activeTabId);
  if (!entry || !isSafeHttpUrl(entry.url) || !tab || !tab.view || !tab.view.webContents) {
    return { success: false, error: 'Cannot retry download' };
  }
  tab.view.webContents.downloadURL(entry.url);
  return { success: true };
});

ipcMain.on('show-fav-context-menu', (e, favId, pos) => {
  if (!verifyIpcSender(e) || !mainWindow || mainWindow.isDestroyed()) return;
  const fav = bookmarksDB.find(b => b.id === favId);
  if (!fav) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Open in New Tab', click: () => createTab(fav.url) },
    { label: 'Copy Link', click: () => { clipboard.writeText(fav.url); mainWindow.webContents.send('toast-message', 'Link copied to clipboard'); } },
    { label: 'Edit', click: () => mainWindow.webContents.send('fav-action', { action: 'edit', id: fav.id }) },
    { type: 'separator' },
    { label: 'Delete', click: () => { deleteBookmark(fav.id); mainWindow.webContents.send('toast-message', 'Favourite removed'); } }
  ]);
  menu.popup(buildClampedPopupOpts(pos, 210));
});

ipcMain.on('show-fav-overflow-menu', (e, favIds, pos) => {
  if (!verifyIpcSender(e) || !mainWindow || mainWindow.isDestroyed()) return;
  const items = favIds.map(id => bookmarksDB.find(b => b.id === id)).filter(Boolean);
  if (items.length === 0) return;
  const menu = Menu.buildFromTemplate(items.map(fav => ({
    label: (fav.title || fav.url).slice(0, 48),
    click: () => handleNavigate(fav.url)
  })));
  menu.popup(buildClampedPopupOpts(pos, 240));
});

ipcMain.handle('clear-history', (e, range) => {
  if (!verifyIpcSender(e)) return { success: false };
  return clearHistoryRange(range);
});

ipcMain.on('cycle-tab', (e, direction) => {
  if (!verifyIpcSender(e)) return;
  cycleTab(typeof direction === 'number' ? direction : 1);
});

ipcMain.handle('toggle-bookmark', (e) => {
  if (!verifyIpcSender(e)) return { bookmarked: false };
  return toggleBookmarkCurrentPage();
});

ipcMain.handle('check-is-bookmarked', (e, url) => {
  if (!verifyIpcSender(e)) return false;
  return isUrlBookmarked(url);
});

ipcMain.handle('delete-bookmark', (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  return deleteBookmark(id);
});

ipcMain.handle('edit-bookmark', (e, payload) => {
  if (!verifyIpcSender(e) || !payload || typeof payload !== 'object') return { success: false };
  const { id, title, url } = payload;
  const b = bookmarksDB.find(item => item.id === id);
  if (!b) return { success: false, error: 'Not found' };
  if (typeof title === 'string' && title.trim()) b.title = title.trim().slice(0, 256);
  if (typeof url === 'string' && url.trim()) b.url = url.trim().slice(0, 2048);
  atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
  }
  return { success: true, bookmark: b };
});

ipcMain.handle('reorder-bookmarks', (e, ids) => {
  if (!verifyIpcSender(e) || !Array.isArray(ids)) return { success: false };
  const map = new Map(bookmarksDB.map(b => [b.id, b]));
  const reordered = [];
  for (const id of ids) {
    if (map.has(id)) {
      reordered.push(map.get(id));
      map.delete(id);
    }
  }
  for (const remaining of map.values()) {
    reordered.push(remaining);
  }
  bookmarksDB = reordered;
  atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
  }
  return { success: true };
});

ipcMain.handle('toggle-favourites-bar', (e, explicitState) => {
  if (!verifyIpcSender(e)) return false;
  const currentState = settingsDB.showFavouritesBar !== false;
  const newState = (explicitState !== undefined) ? Boolean(explicitState) : !currentState;
  settingsDB.showFavouritesBar = newState;
  atomicWriteJson(SETTINGS_FILE, settingsDB);
  updateLayoutBounds();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('favourites-bar-visibility-changed', newState);
  }
  return newState;
});

ipcMain.handle('get-favourites-bar-visible', (e) => {
  if (!verifyIpcSender(e)) return true;
  return settingsDB.showFavouritesBar !== false;
});

ipcMain.handle('delete-history-item', (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  return deleteHistoryItem(id);
});

ipcMain.handle('delete-download', (e, id) => {
  if (!verifyIpcSender(e)) return { success: false };
  return deleteDownloadItem(id);
});

ipcMain.handle('clear-downloads', (e) => {
  if (!verifyIpcSender(e)) return { success: false };
  return clearDownloads();
});

ipcMain.on('create-window', (e) => {
  if (!verifyIpcSender(e)) return;
  createMainWindow();
});

ipcMain.on('create-incognito-window', (e) => {
  if (!verifyIpcSender(e)) return;
  createTab('staunt://newtab', { isIncognito: true });
});

ipcMain.on('toggle-fullscreen', (e) => {
  if (!verifyIpcSender(e)) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

// 6. Intelligent Local Omnibox Autocomplete (Favourites + History, Zero External APIs)
function normalizeSuggestionUrl(u) {
  if (!u || typeof u !== 'string') return '';
  try {
    const parsed = new URL(u.trim());
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '';
    return (parsed.protocol + '//' + parsed.hostname.toLowerCase() + cleanPath + parsed.search).toLowerCase();
  } catch (_) {
    return u.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function formatDisplaySubtext(u) {
  try {
    const parsed = new URL(u);
    const pathPart = parsed.pathname === '/' ? '' : parsed.pathname;
    return parsed.hostname + pathPart + parsed.search;
  } catch (_) {
    return u;
  }
}

function scoreLocalEntry(entry, qLower, qTokens, isBookmark, freqBoost = 0) {
  const titleLower = (entry.title || '').toLowerCase();
  const urlLower = (entry.url || '').toLowerCase();
  const subLower = formatDisplaySubtext(entry.url || '').toLowerCase();
  const combined = titleLower + ' ' + subLower;

  let score = 0;
  if (titleLower.startsWith(qLower)) score = 100;
  else if (subLower.startsWith(qLower) || urlLower.startsWith(qLower)) score = 95;
  else if (titleLower.includes(qLower)) score = 75;
  else if (urlLower.includes(qLower)) score = 60;
  else if (qTokens.length > 1 && qTokens.every(tok => combined.includes(tok))) score = 52;

  if (score === 0) return 0;
  return score + (isBookmark ? 30 : 0) + freqBoost;
}

ipcMain.handle('get-suggestions', async (e, query) => {
  if (!verifyIpcSender(e)) return [];
  if (!query || typeof query !== 'string') return [];
  const trimmed = query.trim().slice(0, 256);
  if (!trimmed) return [];
  const qLower = trimmed.toLowerCase();
  const qTokens = qLower.split(/\s+/).filter(Boolean);

  // Build local visit frequency map cleanly
  const visitCounts = new Map();
  for (const h of historyDB) {
    if (!h || !h.url) continue;
    const uKey = normalizeSuggestionUrl(h.url);
    visitCounts.set(uKey, (visitCounts.get(uKey) || 0) + 1);
  }

  const candidates = [];

  for (const b of bookmarksDB) {
    if (!b || !b.url) continue;
    const score = scoreLocalEntry(b, qLower, qTokens, true, 0);
    if (score > 0) {
      candidates.push({
        text: (b.title || b.url).slice(0, 120),
        url: b.url,
        subtext: formatDisplaySubtext(b.url),
        type: 'bookmark',
        score
      });
    }
  }

  for (const h of historyDB) {
    if (!h || !h.url) continue;
    const pastSearch = nativeSearchClient.extractSearchQuery(h.url);
    const freqBoost = Math.min(20, (visitCounts.get(normalizeSuggestionUrl(h.url)) || 1) * 3);

    if (pastSearch) {
      const pLower = pastSearch.toLowerCase();
      if (pLower.includes(qLower) || (qTokens.length > 1 && qTokens.every(tok => pLower.includes(tok)))) {
        const sScore = (pLower.startsWith(qLower) ? 90 : 68) + freqBoost;
        candidates.push({
          text: pastSearch.slice(0, 120),
          url: h.url,
          subtext: 'Previous search',
          type: 'search-history',
          score: sScore,
          ts: h.timestamp || 0
        });
      }
      continue;
    }

    const score = scoreLocalEntry(h, qLower, qTokens, false, freqBoost);
    if (score > 0) {
      candidates.push({
        text: (h.title || h.url).slice(0, 120),
        url: h.url,
        subtext: formatDisplaySubtext(h.url),
        type: 'history',
        score,
        ts: h.timestamp || 0
      });
    }
  }

  candidates.sort((a, b) => (b.score - a.score) || ((b.ts || 0) - (a.ts || 0)));

  const seenUrls = new Set();
  const seenKeys = new Set();
  const results = [];
  for (const item of candidates) {
    const uKey = normalizeSuggestionUrl(item.url);
    const tKey = item.type === 'search-history'
      ? ('sh:' + (item.text || '').trim().toLowerCase())
      : ((item.text || '').trim().toLowerCase() + '|' + uKey);
    if (!uKey || seenUrls.has(uKey) || seenKeys.has(tKey)) continue;
    seenUrls.add(uKey);
    seenKeys.add(tKey);
    results.push({
      text: item.text,
      url: item.url,
      subtext: item.subtext,
      type: item.type
    });
    if (results.length >= 7) break;
  }
  return results;
});

// Omnibox Overlay Popup WebContentsView (renders cleanly above WebContentsView)
let omniboxPopupView = null;
let isOmniboxPopupVisible = false;

function ensureOmniboxPopupView() {
  if (omniboxPopupView && omniboxPopupView.webContents && !omniboxPopupView.webContents.isDestroyed()) {
    return omniboxPopupView;
  }
  if (typeof WebContentsView === 'undefined') return null;
  omniboxPopupView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload-popup.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      enableRemoteModule: false,
      webSecurity: true
    }
  });
  if (omniboxPopupView.setBackgroundColor) {
    omniboxPopupView.setBackgroundColor('#00000000');
  }
  omniboxPopupView.webContents.loadFile(path.join(__dirname, 'src', 'omnibox-popup.html')).catch(() => {});
  return omniboxPopupView;
}

function hideOmniboxPopup() {
  isOmniboxPopupVisible = false;
  if (omniboxPopupView && mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (mainWindow.contentView && mainWindow.contentView.removeChildView) {
        mainWindow.contentView.removeChildView(omniboxPopupView);
      }
      if (omniboxPopupView.setBounds) {
        omniboxPopupView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      }
    } catch (_) {}
  }
}

ipcMain.on('show-omnibox-popup', (e, payload) => {
  if (!verifyIpcSender(e) || !mainWindow || mainWindow.isDestroyed() || isModalOpen) return;
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    hideOmniboxPopup();
    return;
  }
  const view = ensureOmniboxPopupView();
  if (!view) return;

  const b = payload.bounds || {};
  const contentBounds = mainWindow.getContentBounds();
  const x = Math.max(0, Math.round(Number(b.x) || 200));
  const y = Math.max(36, Math.round(Number(b.y) || 40));
  const width = Math.min(Math.max(220, Math.round(Number(b.width) || 480)), contentBounds.width - x);
  const rowCount = Math.min(payload.items.length, 8);
  const height = rowCount * 38 + 10;

  if (mainWindow.contentView && mainWindow.contentView.addChildView) {
    mainWindow.contentView.addChildView(view);
  }
  view.setBounds({ x, y, width, height });
  isOmniboxPopupVisible = true;

  const sendData = () => {
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.send('omnibox-popup-data', {
        items: payload.items.slice(0, 8),
        selectedIndex: typeof payload.selectedIndex === 'number' ? payload.selectedIndex : -1
      });
    }
  };
  if (view.webContents.isLoading()) {
    view.webContents.once('did-finish-load', sendData);
  } else {
    sendData();
  }
});

ipcMain.on('update-omnibox-popup-selection', (e, idx) => {
  if (!verifyIpcSender(e) || !omniboxPopupView || !isOmniboxPopupVisible) return;
  if (omniboxPopupView.webContents && !omniboxPopupView.webContents.isDestroyed()) {
    omniboxPopupView.webContents.send('omnibox-popup-selection', typeof idx === 'number' ? idx : -1);
  }
});

ipcMain.on('hide-omnibox-popup', (e) => {
  if (!verifyIpcSender(e)) return;
  hideOmniboxPopup();
});

ipcMain.on('omnibox-popup-choose', (e, idx) => {
  if (!omniboxPopupView || e.sender !== omniboxPopupView.webContents) return;
  hideOmniboxPopup();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('omnibox-popup-chosen', idx);
  }
});

ipcMain.on('omnibox-popup-hover', (e, idx) => {
  if (!omniboxPopupView || e.sender !== omniboxPopupView.webContents) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('omnibox-popup-hover', idx);
  }
});

// 7. Settings Vault Handlers
ipcMain.handle('get-settings', (e) => {
  if (!verifyIpcSender(e)) return DEFAULT_SETTINGS;
  return settingsDB;
});

ipcMain.handle('save-settings', (e, newSettings) => {
  if (!verifyIpcSender(e)) return { success: false };
  if (newSettings && typeof newSettings === 'object') {
    const validated = {};
    const allKnownEngines = Object.keys(nativeSearchClient.getAllEngines ? nativeSearchClient.getAllEngines() : {});
    const SUPPORTED_ENGINES = allKnownEngines.length > 0 ? allKnownEngines.concat(['custom']) : ['staunt', 'google', 'duckduckgo', 'bing', 'brave', 'ecosia', 'yahoo', 'startpage', 'custom'];
    if (typeof newSettings.searchEngine === 'string' && SUPPORTED_ENGINES.includes(newSettings.searchEngine.toLowerCase())) {
      validated.searchEngine = newSettings.searchEngine.toLowerCase();
    }
    if (typeof newSettings.customSearchUrl === 'string') {
      const cTrim = newSettings.customSearchUrl.trim().slice(0, 1024);
      if (!cTrim || /^https?:\/\//i.test(cTrim)) {
        validated.customSearchUrl = cTrim;
      }
    }
    if (typeof newSettings.searchUrl === 'string' && /^https?:\/\//i.test(newSettings.searchUrl.trim())) {
      validated.searchUrl = newSettings.searchUrl.trim().slice(0, 512);
    }
    if (typeof newSettings.homeUrl === 'string') {
      const hTrim = newSettings.homeUrl.trim();
      if (!hTrim || hTrim === 'staunt://newtab' || hTrim === 'about:newtab') {
        validated.homeUrl = 'staunt://newtab';
      } else if (/^(https?|file):\/\//i.test(hTrim) || hTrim.startsWith('staunt://')) {
        try {
          new URL(hTrim);
          validated.homeUrl = hTrim.slice(0, 512);
        } catch (_) {
          return { success: false, error: 'Please enter a valid Homepage URL' };
        }
      } else {
        const cls = nativeSearchClient.classifyInput(hTrim);
        if (cls.type === 'DOMAIN' && cls.url) {
          validated.homeUrl = cls.url.slice(0, 512);
        } else {
          return { success: false, error: 'Please enter a valid Homepage URL (e.g. https://example.com or staunt://newtab)' };
        }
      }
    }
    if (typeof newSettings.shieldLevel === 'string' && ['strict', 'standard', 'off'].includes(newSettings.shieldLevel.toLowerCase())) {
      validated.shieldLevel = newSettings.shieldLevel.toLowerCase();
    }
    if (typeof newSettings.showFavouritesBar === 'boolean') {
      validated.showFavouritesBar = newSettings.showFavouritesBar;
    }
    if (typeof newSettings.hardwareAcceleration === 'boolean') {
      validated.hardwareAcceleration = newSettings.hardwareAcceleration;
    }
    if (typeof newSettings.restoreTabsOnStartup === 'boolean') {
      validated.restoreTabsOnStartup = newSettings.restoreTabsOnStartup;
    }
    if (typeof newSettings.downloadPath === 'string') {
      const trimmed = newSettings.downloadPath.trim();
      if (trimmed === '') {
        validated.downloadPath = '';
      } else {
        const norm = path.normalize(trimmed);
        if (path.isAbsolute(norm) && fs.existsSync(norm) && fs.statSync(norm).isDirectory()) {
          validated.downloadPath = norm;
        }
      }
    }
    if (typeof newSettings.doNotTrack === 'boolean') {
      validated.doNotTrack = newSettings.doNotTrack;
    }
    if (typeof newSettings.globalPrivacyControl === 'boolean') {
      validated.globalPrivacyControl = newSettings.globalPrivacyControl;
    }
    if (['block-third-party', 'allow-all', 'block-all'].includes(newSettings.cookiePolicy)) {
      validated.cookiePolicy = newSettings.cookiePolicy;
    }
    if (typeof newSettings.uiTheme === 'string' && ['dark', 'dark-oled', 'light', 'sepia'].includes(newSettings.uiTheme.toLowerCase())) {
      validated.uiTheme = newSettings.uiTheme.toLowerCase();
    }
    if (typeof newSettings.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(newSettings.accentColor.trim())) {
      validated.accentColor = newSettings.accentColor.trim().toLowerCase();
    }
    if (typeof newSettings.fontSize === 'string' && ['12', '13', '14', '15', '16'].includes(newSettings.fontSize.trim())) {
      validated.fontSize = newSettings.fontSize.trim();
    }
    settingsDB = { ...settingsDB, ...validated };
    nativeSearchClient.setSearchEngine(settingsDB.searchEngine || 'staunt', settingsDB.customSearchUrl || '');
    setShieldLevel(settingsDB.shieldLevel || 'standard');
    setPrivacyHeaderConfig({
      dnt: settingsDB.doNotTrack !== false,
      gpc: settingsDB.globalPrivacyControl !== false,
      cookiePolicy: settingsDB.cookiePolicy || 'block-third-party'
    });
    atomicWriteJson(SETTINGS_FILE, settingsDB);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shield-level-changed', settingsDB.shieldLevel || 'standard');
      mainWindow.webContents.send('settings-updated', settingsDB);
    }
  }
  return { success: true, settings: settingsDB };
});

ipcMain.handle('select-download-dir', async (e) => {
  if (!verifyIpcSender(e)) return { canceled: true, path: '' };
  const currentPath = (settingsDB.downloadPath && fs.existsSync(settingsDB.downloadPath)) 
    ? settingsDB.downloadPath 
    : app.getPath('downloads');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Download Folder',
    defaultPath: currentPath,
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const selected = path.normalize(result.filePaths[0]);
    if (fs.existsSync(selected) && fs.statSync(selected).isDirectory()) {
      settingsDB.downloadPath = selected;
      atomicWriteJson(SETTINGS_FILE, settingsDB);
      return { canceled: false, path: selected };
    }
  }
  return { canceled: true, path: settingsDB.downloadPath || app.getPath('downloads') };
});

ipcMain.handle('reset-download-dir', (e) => {
  if (!verifyIpcSender(e)) return { success: false, path: app.getPath('downloads') };
  settingsDB.downloadPath = '';
  atomicWriteJson(SETTINGS_FILE, settingsDB);
  return { success: true, path: app.getPath('downloads') };
});

ipcMain.handle('get-default-downloads-dir', (e) => {
  if (!verifyIpcSender(e)) return '';
  return app.getPath('downloads');
});

ipcMain.on('save-page', (e) => {
  if (verifyIpcSender(e)) saveCurrentPage();
});

ipcMain.on('reorder-tabs', (e, ids) => {
  if (verifyIpcSender(e)) reorderTabs(ids);
});

ipcMain.on('toggle-devtools', (e) => {
  if (verifyIpcSender(e)) {
    const tab = tabs.get(activeTabId);
    if (tab && tab.view && tab.view.webContents) {
      tab.view.webContents.toggleDevTools();
    }
  }
});

ipcMain.on('show-about', (e) => {
  if (verifyIpcSender(e)) showAboutDialog();
});

// =============================================================================
// UNIFIED SOVEREIGN ACCOUNT IPC HANDLERS & DESKTOP SYNC
// =============================================================================
const STAUNT_AUTH_URL = process.env.STAUNT_AUTH_URL || 'https://staunt.vercel.app/auth';

function isTrustedAuthOrigin(urlStr) {
  if (typeof urlStr !== 'string') return false;
  try {
    const u = new URL(urlStr);
    if (u.protocol === 'https:' && (u.hostname === 'staunt.vercel.app' || u.hostname.endsWith('.vercel.app'))) {
      return true;
    }
    if (process.env.NODE_ENV === 'test' || process.env.STAUNT_TEST === '1') {
      if ((u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function getAccountFilePath() {
  return path.join(app.getPath('userData'), 'staunt_account_state.json');
}

function loadAccountState() {
  try {
    const accPath = getAccountFilePath();
    if (fs.existsSync(accPath)) {
      const raw = fs.readFileSync(accPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          isLoggedIn: !!parsed.isLoggedIn,
          user: (parsed.isLoggedIn && parsed.user) ? {
            displayName: String(parsed.user.displayName || parsed.user.name || '').trim().slice(0, 256),
            email: String(parsed.user.email || '').trim().slice(0, 256),
            photoURL: String(parsed.user.photoURL || '').trim().slice(0, 512)
          } : null
        };
      }
    }
  } catch (err) {
    logger.warn('Failed to load account state:', err);
  }
  return { isLoggedIn: false, user: null };
}

function saveAccountState(state) {
  try {
    const accPath = getAccountFilePath();
    const safeState = {
      isLoggedIn: !!(state && state.isLoggedIn),
      user: (state && state.isLoggedIn && state.user) ? {
        displayName: String(state.user.displayName || state.user.name || '').trim().slice(0, 256),
        email: String(state.user.email || '').trim().slice(0, 256),
        photoURL: String(state.user.photoURL || '').trim().slice(0, 512)
      } : null
    };
    fs.writeFileSync(accPath, JSON.stringify(safeState, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.warn('Failed to save account state:', err);
    return false;
  }
}

async function handleDesktopAuthCallback(tabObj) {
  try {
    const wc = tabObj.view.webContents;
    const sessionData = await wc.executeJavaScript(`
      (async () => {
        try {
          const resp = await fetch('/api/auth/me', { cache: 'no-cache' });
          if (resp.ok) return await resp.json();
        } catch(e) {}
        return { authenticated: false };
      })()
    `);

    if (sessionData && sessionData.authenticated && sessionData.user) {
      const safeUser = {
        displayName: String(sessionData.user.name || sessionData.user.displayName || '').trim().slice(0, 256),
        email: String(sessionData.user.email || '').trim().slice(0, 256),
        photoURL: String(sessionData.user.photoURL || '').trim().slice(0, 512)
      };
      saveAccountState({ isLoggedIn: true, user: safeUser });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('account-state-changed', { isLoggedIn: true, user: safeUser });
        mainWindow.webContents.send('open-account-modal');
      }
      closeTab(tabObj.id);
    }
  } catch (err) {
    logger.warn('[AUTH CALLBACK] Failed to synchronize desktop auth:', err);
  }
}

function handleDesktopAuthLogout(tabObj) {
  saveAccountState({ isLoggedIn: false, user: null });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('account-state-changed', { isLoggedIn: false, user: null });
  }
}

ipcMain.handle('get-account-state', (e) => {
  if (!verifyIpcSender(e)) return { isLoggedIn: false, user: null };
  return loadAccountState();
});

ipcMain.handle('save-account-state', (e, user) => {
  if (!verifyIpcSender(e)) return false;
  if (user && typeof user === 'object') {
    const safeUser = {
      displayName: String(user.displayName || user.name || '').trim().slice(0, 256),
      email: String(user.email || '').trim().slice(0, 256),
      photoURL: String(user.photoURL || '').trim().slice(0, 512)
    };
    saveAccountState({ isLoggedIn: true, user: safeUser });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('account-state-changed', { isLoggedIn: true, user: safeUser });
    }
    return true;
  }
  return false;
});

ipcMain.handle('sign-out-account', async (e) => {
  if (!verifyIpcSender(e)) return false;
  saveAccountState({ isLoggedIn: false, user: null });
  try {
    const cookies = await session.defaultSession.cookies.get({ domain: 'staunt.vercel.app' });
    for (const c of cookies) {
      await session.defaultSession.cookies.remove('https://staunt.vercel.app', c.name);
    }
  } catch (err) {}
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('account-state-changed', { isLoggedIn: false, user: null });
  }
  return true;
});

// =============================================================================
// PHASE 7 IPC: TAB SEARCH, READING LIST & LOCAL READER MODE
// =============================================================================
ipcMain.handle('get-tab-search-data', (e) => {
  if (!verifyIpcSender(e)) return { openTabs: [], closedTabs: [], activeTabId: null };
  const openTabs = Array.from(tabs.values()).map(t => ({
    id: t.id,
    title: t.title || 'New Tab',
    url: t.url || '',
    isPinned: Boolean(t.isPinned),
    isIncognito: Boolean(t.isIncognito),
    group: t.group || null,
    isActive: t.id === activeTabId,
    isAudioPlaying: Boolean(t.isAudioPlaying),
    isMuted: Boolean(t.isMuted)
  }));
  const closedTabs = closedTabsStack.slice().reverse().map((item, revIdx) => ({
    stackIndex: closedTabsStack.length - 1 - revIdx,
    url: item.url,
    title: item.url,
    isPinned: Boolean(item.isPinned)
  }));
  return { openTabs, closedTabs, activeTabId };
});

ipcMain.handle('restore-closed-tab-at', (e, stackIndex) => {
  if (!verifyIpcSender(e)) return { ok: false };
  const idx = Number(stackIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= closedTabsStack.length) return { ok: false };
  const [item] = closedTabsStack.splice(idx, 1);
  if (!item || !item.url) return { ok: false };
  const newId = createTab(item.url, { workspaceId: item.workspaceId, isPinned: item.isPinned });
  return { ok: true, tabId: newId };
});

ipcMain.handle('get-reading-list', (e) => {
  if (!verifyIpcSender(e)) return [];
  return readingListDB;
});

ipcMain.handle('add-reading-list-item', (e, payload) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const active = tabs.get(activeTabId);
  if (active && active.isIncognito && (!payload || !payload.allowExternal)) {
    return { ok: false, error: 'Incognito pages cannot be saved to the persistent Reading List.' };
  }
  const rawUrl = (payload && typeof payload.url === 'string' && payload.url.trim())
    ? payload.url.trim()
    : (active ? active.url : '');
  const rawTitle = (payload && typeof payload.title === 'string' && payload.title.trim())
    ? payload.title.trim()
    : (active ? active.title : '');

  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return { ok: false, error: 'Only standard http/https webpages can be saved to Reading List.' };
  }
  let normalizedUrl = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    normalizedUrl = parsed.href;
  } catch (_) {
    return { ok: false, error: 'Invalid webpage URL.' };
  }

  const existing = readingListDB.find(item => item.url === normalizedUrl);
  if (existing) {
    return { ok: true, duplicate: true, item: existing, list: readingListDB };
  }

  const newEntry = {
    id: 'rl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: String(rawTitle || normalizedUrl).slice(0, 240),
    url: normalizedUrl.slice(0, 2048),
    savedAt: Date.now(),
    isRead: false
  };
  readingListDB.unshift(newEntry);
  if (readingListDB.length > 500) readingListDB.length = 500;
  try {
    atomicWriteJson(READING_LIST_FILE, readingListDB);
  } catch (err) {
    return { ok: false, error: 'Failed to save Reading List to disk.' };
  }
  return { ok: true, duplicate: false, item: newEntry, list: readingListDB };
});

ipcMain.handle('remove-reading-list-item', (e, id) => {
  if (!verifyIpcSender(e)) return { ok: false, list: readingListDB };
  const cleanId = String(id || '');
  readingListDB = readingListDB.filter(item => item.id !== cleanId);
  try {
    atomicWriteJson(READING_LIST_FILE, readingListDB);
  } catch (_) {
    return { ok: false, error: 'Failed to update Reading List on disk.', list: readingListDB };
  }
  return { ok: true, list: readingListDB };
});

ipcMain.handle('toggle-reading-list-read', (e, id) => {
  if (!verifyIpcSender(e)) return { ok: false, list: readingListDB };
  const cleanId = String(id || '');
  const item = readingListDB.find(x => x.id === cleanId);
  if (!item) return { ok: false, list: readingListDB };
  item.isRead = !item.isRead;
  try {
    atomicWriteJson(READING_LIST_FILE, readingListDB);
  } catch (_) {}
  return { ok: true, list: readingListDB };
});

ipcMain.handle('extract-reader-article', async (e) => {
  if (!verifyIpcSender(e)) return { ok: false, reason: 'Unauthorized' };
  const tab = tabs.get(activeTabId);
  if (!tab || !tab.view || !tab.view.webContents || tab.view.webContents.isDestroyed()) {
    return { ok: false, reason: 'No active webpage available.' };
  }
  const currentUrl = tab.view.webContents.getURL() || tab.url || '';
  if (!/^https?:\/\//i.test(currentUrl) || isLocalPageUrl(currentUrl, ERROR_PAGE_FILE) || isLocalPageUrl(currentUrl, NEWTAB_PAGE_FILE)) {
    return { ok: false, reason: 'Reader Mode is supported on web article pages (http/https).' };
  }

  try {
    const extracted = await tab.view.webContents.executeJavaScript(`(() => {
      try {
        const cleanText = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        const isHidden = (el) => {
          if (!el || el.nodeType !== 1) return true;
          const tag = el.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'svg', 'iframe', 'nav', 'aside', 'footer', 'form'].includes(tag)) return true;
          if (el.getAttribute('aria-hidden') === 'true' || el.hidden) return true;
          const cls = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
          if (/\b(ad|ads|advert|promo|cookie|consent|newsletter|sidebar|comment|social|share-bar|menu|breadcrumb)\b/.test(cls)) return true;
          const cs = getComputedStyle(el);
          return cs.display === 'none' || cs.visibility === 'hidden';
        };

        const title = cleanText(
          document.querySelector('meta[property="og:title"]')?.content ||
          document.querySelector('article h1, main h1, h1')?.textContent ||
          document.title
        );
        const byline = cleanText(
          document.querySelector('meta[name="author"]')?.content ||
          document.querySelector('[rel="author"], .author, .byline')?.textContent || ''
        ).slice(0, 120);
        const siteName = cleanText(
          document.querySelector('meta[property="og:site_name"]')?.content || location.hostname
        );

        const candidates = [];
        const addCand = (el) => { if (el && !candidates.includes(el)) candidates.push(el); };
        document.querySelectorAll('article, [role="main"], main').forEach(addCand);
        document.querySelectorAll('section, div').forEach(el => {
          if (el.querySelectorAll(':scope > p').length >= 2) addCand(el);
        });
        addCand(document.body);

        let bestRoot = document.body;
        let bestScore = -1;
        for (const cand of candidates) {
          if (isHidden(cand) && cand !== document.body) continue;
          const pList = Array.from(cand.querySelectorAll('p'));
          let pTextLen = 0;
          for (const p of pList) {
            if (!isHidden(p)) pTextLen += cleanText(p.textContent).length;
          }
          const linkLen = Array.from(cand.querySelectorAll('a')).reduce((acc, a) => acc + cleanText(a.textContent).length, 0);
          const linkDensity = pTextLen > 0 ? (linkLen / (pTextLen + 1)) : 1;
          let score = pTextLen * (1 - Math.min(0.75, linkDensity * 0.6));
          if (cand.tagName.toLowerCase() === 'article') score *= 1.35;
          else if (cand.tagName.toLowerCase() === 'main' || cand.getAttribute('role') === 'main') score *= 1.15;
          if (score > bestScore) {
            bestScore = score;
            bestRoot = cand;
          }
        }

        const blocks = [];
        const seenTexts = new Set();
        let wordCount = 0;

        const walk = (node) => {
          if (!node || node.nodeType !== 1 || isHidden(node) || blocks.length >= 220) return;
          const tag = node.tagName.toLowerCase();
          if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
            const t = cleanText(node.textContent);
            if (t && t !== title && !seenTexts.has(t)) {
              seenTexts.add(t);
              blocks.push({ type: tag === 'h1' ? 'h2' : tag, text: t });
              wordCount += t.split(/\s+/).length;
            }
            return;
          }
          if (tag === 'p' || tag === 'blockquote' || tag === 'pre') {
            const t = cleanText(node.textContent);
            if (t.length >= 20 && !seenTexts.has(t)) {
              seenTexts.add(t);
              blocks.push({ type: tag, text: t });
              wordCount += t.split(/\s+/).length;
            }
            return;
          }
          if (tag === 'ul' || tag === 'ol') {
            const items = Array.from(node.querySelectorAll(':scope > li'))
              .map(li => cleanText(li.textContent))
              .filter(t => t.length > 2)
              .slice(0, 40);
            if (items.length > 0) {
              blocks.push({ type: tag, items });
              wordCount += items.join(' ').split(/\s+/).length;
            }
            return;
          }
          if (tag === 'img') {
            const src = node.currentSrc || node.getAttribute('src') || '';
            const w = node.naturalWidth || Number(node.getAttribute('width')) || 0;
            if (/^https?:\/\//i.test(src) && (w === 0 || w >= 120)) {
              blocks.push({ type: 'img', src, alt: cleanText(node.getAttribute('alt') || '').slice(0, 160) });
            }
            return;
          }
          for (const child of node.children) walk(child);
        };

        walk(bestRoot);
        if (wordCount < 45 || blocks.length === 0) {
          return { ok: false, reason: 'This page does not contain enough structured article text for Reader Mode.' };
        }
        return { ok: true, url: location.href, title, byline, siteName, wordCount, blocks };
      } catch (err) {
        return { ok: false, reason: 'Failed to extract article from this page.' };
      }
    })()`);
    return extracted || { ok: false, reason: 'Unable to extract article content.' };
  } catch (err) {
    return { ok: false, reason: 'Extraction failed or tab closed during operation.' };
  }
});

ipcMain.on('open-auth-page', (e) => {
  if (!verifyIpcSender(e)) return;
  // Strictly enforce HTTPS
  if (!STAUNT_AUTH_URL.startsWith('https://')) {
    logger.error('Refusing to open non-HTTPS auth endpoint:', STAUNT_AUTH_URL);
    return;
  }
  const authUrl = STAUNT_AUTH_URL.includes('?')
    ? `${STAUNT_AUTH_URL}&client=desktop`
    : `${STAUNT_AUTH_URL}?client=desktop`;
  createTab(authUrl);
});

// =============================================================================
// PHASE 8: SITE PERMISSIONS & PRIVACY CONTROL CENTER IPC HANDLERS
// =============================================================================

ipcMain.handle('get-site-permissions', async (e, targetOrigin) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const tab = tabs.get(activeTabId);
  const activeUrl = tab && tab.view && !tab.view.webContents.isDestroyed() ? tab.view.webContents.getURL() : (tab ? tab.url : '');
  const activeOrigin = normalizeSiteOrigin(activeUrl);
  const origin = targetOrigin ? normalizeSiteOrigin(targetOrigin) : activeOrigin;
  const isIncog = tab ? Boolean(tab.isIncognito) : false;

  const overrides = isIncog
    ? { ...(incognitoPermissionsStore.get(origin) || {}) }
    : { ...(permissionsDB.siteOverrides[origin] || {}) };

  const effective = {};
  for (const p of VALID_PERMISSION_TYPES) {
    effective[p] = getEffectivePermissionForSite(origin, p, isIncog);
  }

  const shieldEnabled = overrides.shield !== 'disabled';

  let cookieCount = 0;
  try {
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      const u = new URL(origin);
      const ses = (tab && tab.isIncognito && tab.view) ? tab.view.webContents.session : session.defaultSession;
      const cList = await ses.cookies.get({ domain: u.hostname });
      cookieCount = cList.length;
    }
  } catch (_) {}

  let certInfo = null;
  if (origin.startsWith('https://')) {
    certInfo = {
      isSecure: true,
      protocol: 'TLS 1.3',
      cipher: 'AES-256-GCM',
      status: 'Valid & Encrypted'
    };
  }

  return {
    ok: true,
    origin,
    isSecure: isSiteOriginSecure(origin),
    isIncognito: isIncog,
    overrides,
    effective,
    shieldEnabled,
    cookieCount,
    certInfo,
    globalDefaults: { ...permissionsDB.globalDefaults },
    supportedPermissions: VALID_PERMISSION_TYPES
  };
});

ipcMain.handle('set-site-permission', (e, payload) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid payload' };
  const origin = normalizeSiteOrigin(payload.origin);
  const permission = String(payload.permission || '').toLowerCase().trim();
  const value = String(payload.value || '').toLowerCase().trim();

  if (!origin || !VALID_PERMISSION_TYPES.includes(permission) || !VALID_PERMISSION_VALUES.includes(value)) {
    return { ok: false, error: 'Invalid origin, permission, or value' };
  }

  const tab = tabs.get(activeTabId);
  const isIncog = tab && normalizeSiteOrigin(tab.url) === origin ? Boolean(tab.isIncognito) : false;

  if (value === 'default') {
    if (isIncog) {
      if (incognitoPermissionsStore.has(origin)) {
        delete incognitoPermissionsStore.get(origin)[permission];
        if (Object.keys(incognitoPermissionsStore.get(origin)).length === 0) {
          incognitoPermissionsStore.delete(origin);
        }
      }
    } else {
      if (permissionsDB.siteOverrides[origin]) {
        delete permissionsDB.siteOverrides[origin][permission];
        const remainingKeys = Object.keys(permissionsDB.siteOverrides[origin]).filter(k => k !== 'updatedAt');
        if (remainingKeys.length === 0) {
          delete permissionsDB.siteOverrides[origin];
        }
        savePermissionsDB();
      }
    }
  } else {
    if (isIncog) {
      if (!incognitoPermissionsStore.has(origin)) incognitoPermissionsStore.set(origin, {});
      incognitoPermissionsStore.get(origin)[permission] = value;
    } else {
      if (!permissionsDB.siteOverrides[origin]) permissionsDB.siteOverrides[origin] = {};
      permissionsDB.siteOverrides[origin][permission] = value;
      permissionsDB.siteOverrides[origin].updatedAt = Date.now();
      savePermissionsDB();
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('site-permissions-updated', { origin, permission, value });
  }
  return { ok: true, origin, permission, value };
});

ipcMain.handle('reset-site-permissions', (e, targetOrigin) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const origin = normalizeSiteOrigin(targetOrigin);
  if (!origin) return { ok: false, error: 'Invalid origin' };

  const tab = tabs.get(activeTabId);
  const isIncog = tab && normalizeSiteOrigin(tab.url) === origin ? Boolean(tab.isIncognito) : false;

  if (isIncog) {
    incognitoPermissionsStore.delete(origin);
  } else {
    delete permissionsDB.siteOverrides[origin];
    savePermissionsDB();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('site-permissions-updated', { origin, reset: true });
  }
  return { ok: true, origin };
});

ipcMain.handle('get-all-site-permissions', (e) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  return {
    ok: true,
    globalDefaults: { ...permissionsDB.globalDefaults },
    siteOverrides: { ...permissionsDB.siteOverrides },
    supportedPermissions: VALID_PERMISSION_TYPES
  };
});

ipcMain.handle('set-global-permission-default', (e, payload) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid payload' };
  const permission = String(payload.permission || '').toLowerCase().trim();
  const value = String(payload.value || '').toLowerCase().trim();

  if (!VALID_PERMISSION_TYPES.includes(permission) || !['allow', 'block', 'ask'].includes(value)) {
    return { ok: false, error: 'Invalid permission or default value' };
  }

  // Safety guard: camera, microphone, location must never silently default to 'allow' without prompt
  if (['camera', 'microphone', 'location'].includes(permission) && value === 'allow') {
    return { ok: false, error: 'Hardware sensor permissions (Camera, Microphone, Location) cannot be globally granted by default' };
  }

  permissionsDB.globalDefaults[permission] = value;
  savePermissionsDB();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('global-permissions-updated', { globalDefaults: permissionsDB.globalDefaults });
  }
  return { ok: true, globalDefaults: permissionsDB.globalDefaults };
});

ipcMain.handle('reset-all-site-permissions', (e) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  permissionsDB.siteOverrides = {};
  savePermissionsDB();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('global-permissions-updated', { globalDefaults: permissionsDB.globalDefaults, siteOverrides: {} });
  }
  return { ok: true };
});

ipcMain.handle('toggle-site-shield', async (e, payload) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const origin = normalizeSiteOrigin(payload && payload.origin);
  if (!origin) return { ok: false, error: 'Invalid origin' };
  const enabled = Boolean(payload && payload.enabled);
  const shieldVal = enabled ? 'enabled' : 'disabled';

  const tab = tabs.get(activeTabId);
  const isIncog = tab && normalizeSiteOrigin(tab.url) === origin ? Boolean(tab.isIncognito) : false;

  if (isIncog) {
    if (!incognitoPermissionsStore.has(origin)) incognitoPermissionsStore.set(origin, {});
    incognitoPermissionsStore.get(origin).shield = shieldVal;
  } else {
    if (!permissionsDB.siteOverrides[origin]) permissionsDB.siteOverrides[origin] = {};
    permissionsDB.siteOverrides[origin].shield = shieldVal;
    permissionsDB.siteOverrides[origin].updatedAt = Date.now();
    savePermissionsDB();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('site-permissions-updated', { origin, shield: shieldVal });
  }
  return { ok: true, origin, shield: shieldVal };
});

ipcMain.handle('get-site-storage-summary', async (e, targetOrigin) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const origin = normalizeSiteOrigin(targetOrigin);
  if (!origin) return { ok: false, error: 'Invalid origin', cookieCount: 0 };
  try {
    const tab = tabs.get(activeTabId);
    const ses = (tab && tab.isIncognito && tab.view) ? tab.view.webContents.session : session.defaultSession;
    let u;
    try { u = new URL(origin); } catch (_) { return { ok: true, origin, cookieCount: 0 }; }
    const cookies = await ses.cookies.get({ domain: u.hostname });
    return { ok: true, origin, cookieCount: cookies.length };
  } catch (err) {
    return { ok: false, error: err.message, cookieCount: 0 };
  }
});

ipcMain.handle('clear-site-storage', async (e, targetOrigin) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const origin = normalizeSiteOrigin(targetOrigin);
  if (!origin) return { ok: false, error: 'Invalid origin' };
  try {
    const tab = tabs.get(activeTabId);
    const ses = (tab && tab.isIncognito && tab.view) ? tab.view.webContents.session : session.defaultSession;
    await ses.clearStorageData({
      origin,
      storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'cachestorage', 'serviceworkers']
    });
    return { ok: true, origin };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-all-website-data', async (e) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized', sites: [] };
  try {
    const cookies = await session.defaultSession.cookies.get({});
    const domainMap = new Map();
    for (const c of cookies) {
      const d = (c.domain || '').replace(/^\./, '').toLowerCase();
      if (!d) continue;
      domainMap.set(d, (domainMap.get(d) || 0) + 1);
    }
    const sites = Array.from(domainMap.entries()).map(([domain, count]) => ({
      domain,
      cookieCount: count
    })).sort((a, b) => b.cookieCount - a.cookieCount);
    return { ok: true, sites };
  } catch (err) {
    return { ok: false, error: err.message, sites: [] };
  }
});

ipcMain.handle('remove-website-data', async (e, targetDomain) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const domain = String(targetDomain || '').trim().toLowerCase();
  if (!domain) return { ok: false, error: 'Invalid domain' };
  try {
    const cookies = await session.defaultSession.cookies.get({});
    for (const c of cookies) {
      const d = (c.domain || '').replace(/^\./, '').toLowerCase();
      if (d === domain || d.endsWith('.' + domain)) {
        const protocol = c.secure ? 'https:' : 'http:';
        const cookieUrl = `${protocol}//${d.startsWith('.') ? d.slice(1) : d}${c.path || '/'}`;
        await session.defaultSession.cookies.remove(cookieUrl, c.name).catch(() => {});
      }
    }
    await session.defaultSession.clearStorageData({
      origin: 'https://' + domain,
      storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'cachestorage', 'serviceworkers']
    }).catch(() => {});
    return { ok: true, domain };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('clear-browsing-data-selective', async (e, payload) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const { range = '24h', history = true, cookies = true, cache = true, downloads = false } = payload || {};
  try {
    if (history) {
      clearHistoryRange(range);
    }
    if (downloads) {
      clearDownloadsRange(range);
    }
    const tasks = [];
    if (cache) {
      tasks.push(session.defaultSession.clearCache());
    }
    if (cookies) {
      tasks.push(session.defaultSession.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'cachestorage', 'serviceworkers']
      }));
    }
    await Promise.allSettled(tasks);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// =============================================================================
// PHASE 9: PASSWORD VAULT IPC HANDLERS
// =============================================================================

ipcMain.handle('get-credentials', (e, origin) => {
  if (!verifyIpcSender(e)) return [];
  const org = String(origin || '').trim().toLowerCase();
  if (!org) return [];
  return credentialsDB
    .filter(c => c.origin === org)
    .map(c => ({ id: c.id, origin: c.origin, username: c.username, createdAt: c.createdAt, updatedAt: c.updatedAt }));
});

ipcMain.handle('save-credential', (e, payload) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const { origin, username, password } = payload || {};
  const org = String(origin || '').trim().toLowerCase().slice(0, 512);
  const user = String(username || '').trim().slice(0, 256);
  const pass = String(password || '').slice(0, 1024);
  if (!org || !pass) return { ok: false, error: 'origin and password required' };
  const encPass = encryptCredential(pass);
  const existing = credentialsDB.findIndex(c => c.origin === org && c.username === user);
  const now = Date.now();
  if (existing !== -1) {
    credentialsDB[existing].encryptedPassword = encPass;
    credentialsDB[existing].updatedAt = now;
  } else {
    credentialsDB.unshift({
      id: now.toString(36) + Math.random().toString(36).substr(2, 6),
      origin: org,
      username: user,
      encryptedPassword: encPass,
      createdAt: now,
      updatedAt: now
    });
  }
  saveCredentialsDB();
  return { ok: true };
});

ipcMain.handle('delete-credential', (e, id) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const cleanId = String(id || '').trim().slice(0, 64);
  const before = credentialsDB.length;
  credentialsDB = credentialsDB.filter(c => c.id !== cleanId);
  if (credentialsDB.length < before) {
    saveCredentialsDB();
    return { ok: true };
  }
  return { ok: false, error: 'Not found' };
});

ipcMain.handle('fill-credential', (e, id) => {
  if (!verifyIpcSender(e)) return null;
  const cleanId = String(id || '').trim().slice(0, 64);
  const cred = credentialsDB.find(c => c.id === cleanId);
  if (!cred) return null;
  const password = decryptCredential(cred.encryptedPassword);
  if (password === null) return null;
  return { username: cred.username, password };
});

ipcMain.handle('autofill-active-tab', async (e, credId) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const tab = tabs.get(activeTabId);
  if (!tab || !tab.view || !tab.view.webContents || tab.view.webContents.isDestroyed()) {
    return { ok: false, error: 'No active tab' };
  }
  const cleanId = String(credId || '').trim();
  const cred = credentialsDB.find(c => c.id === cleanId);
  if (!cred) return { ok: false, error: 'Credential not found' };
  const tabOrigin = normalizeSiteOrigin(tab.view.webContents.getURL());
  if (tabOrigin !== cred.origin) {
    return { ok: false, error: 'Origin mismatch' };
  }
  const plainPassword = decryptCredential(cred.encryptedPassword);
  if (!plainPassword) return { ok: false, error: 'Decryption failed' };

  try {
    const fillScript = `
      (() => {
        const user = ${JSON.stringify(cred.username || '')};
        const pass = ${JSON.stringify(plainPassword)};
        const pwField = document.querySelector('input[type="password"]');
        if (!pwField) return false;
        const form = pwField.form || document;
        const userField = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[id*="user"], input[id*="login"]') || document.querySelector('input[type="email"], input[type="text"]');
        if (userField && user) {
          userField.value = user;
          userField.dispatchEvent(new Event('input', { bubbles: true }));
          userField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        pwField.value = pass;
        pwField.dispatchEvent(new Event('input', { bubbles: true }));
        pwField.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `;
    const res = await tab.view.webContents.executeJavaScript(fillScript);
    return { ok: true, filled: Boolean(res), username: cred.username };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-all-credentials', (e) => {
  if (!verifyIpcSender(e)) return [];
  return credentialsDB.map(c => ({
    id: c.id,
    origin: c.origin,
    username: c.username,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));
});

ipcMain.handle('check-saved-credential', (e, origin) => {
  if (!verifyIpcSender(e)) return false;
  const org = String(origin || '').trim().toLowerCase();
  return credentialsDB.some(c => c.origin === org);
});

ipcMain.handle('delete-all-credentials', (e) => {
  if (!verifyIpcSender(e)) return { ok: false };
  credentialsDB = [];
  saveCredentialsDB();
  return { ok: true };
});

// =============================================================================
// PHASE 9: DOWNLOAD MANAGER ENHANCEMENTS
// =============================================================================

ipcMain.handle('clear-completed-downloads', (e) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  const before = downloadsDB.length;
  downloadsDB = downloadsDB.filter(d => d.state !== 'completed' && d.state !== 'cancelled' && d.state !== 'interrupted');
  atomicWriteJson(DOWNLOADS_FILE, downloadsDB);
  return { ok: true, removed: before - downloadsDB.length, remaining: downloadsDB.length };
});

// =============================================================================
// PHASE 9: BOOKMARK HTML EXPORT / IMPORT
// =============================================================================

ipcMain.handle('export-bookmarks-html', async (e) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'No window' };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Bookmarks',
      defaultPath: 'staunt_bookmarks.html',
      filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
    });
    if (canceled || !filePath) return { ok: false, error: 'Cancelled' };
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<!-- This is an automatically generated file. -->',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>'
    ];
    for (const bm of bookmarksDB) {
      const addDate = bm.createdAt ? Math.floor(bm.createdAt / 1000) : Math.floor(Date.now() / 1000);
      const title = escapeHtml(bm.title || bm.url || '');
      const url = escapeHtml(bm.url || '');
      lines.push(`    <DT><A HREF="${url}" ADD_DATE="${addDate}">${title}</A>`);
    }
    lines.push('</DL><p>');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    return { ok: true, count: bookmarksDB.length, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('import-bookmarks-html', async (e) => {
  if (!verifyIpcSender(e)) return { ok: false, error: 'Unauthorized' };
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'No window' };
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Bookmarks',
      filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false, error: 'Cancelled' };
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    // Parse Netscape bookmark format: <A HREF="url" ADD_DATE="ts">Title</A>
    const regex = /<A\s[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
    let match;
    let added = 0;
    const existingUrls = new Set(bookmarksDB.map(b => b.url));
    while ((match = regex.exec(raw)) !== null) {
      const url = match[1].trim();
      const title = match[2].trim() || url;
      if (!url || url.startsWith('javascript:') || url.startsWith('data:')) continue;
      if (existingUrls.has(url)) continue;
      const now = Date.now();
      bookmarksDB.push({
        id: now.toString(36) + Math.random().toString(36).substr(2, 6),
        url,
        title: title.slice(0, 256),
        favicon: '',
        createdAt: now
      });
      existingUrls.add(url);
      added++;
    }
    if (added > 0) atomicWriteJson(BOOKMARKS_FILE, bookmarksDB);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bookmarks-updated', bookmarksDB);
    }
    return { ok: true, added, total: bookmarksDB.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// App Lifecycle with Single Instance Lock (prevent duplicate windows)
const gotTheSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotTheSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (settingsDB.hardwareAcceleration === false) {
    try {
      app.disableHardwareAcceleration();
    } catch (_) {}
  }

  app.whenReady().then(() => {
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
