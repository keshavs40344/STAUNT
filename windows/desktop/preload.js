// Staunt Browser Ultra — Hardened Sandboxed IPC Preload Bridge
// Strict Defense-in-Depth: Zero direct ipcRenderer exposure, parameter validation, & Object.freeze
const { contextBridge, ipcRenderer } = require('electron');

// Type Validation Helpers
function sanitizeString(val, maxLen = 4096) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function sanitizeNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

const secureAPI = Object.freeze({
  platform: process.platform,
  // Tabs Lifecycle API
  createTab: (url, opts) => {
    const cleanUrl = sanitizeString(url, 2048) || 'staunt://newtab';
    const cleanOpts = opts && typeof opts === 'object' ? {
      isIncognito: Boolean(opts.isIncognito),
      workspaceId: sanitizeString(opts.workspaceId, 64) || 'personal',
      isPinned: Boolean(opts.isPinned)
    } : {};
    ipcRenderer.send('create-tab', cleanUrl, cleanOpts);
  },

  switchTab: (tabId) => {
    const id = sanitizeNumber(tabId, -1);
    if (id > 0) ipcRenderer.send('switch-tab', id);
  },

  closeTab: (tabId) => {
    const id = sanitizeNumber(tabId, -1);
    if (id > 0) ipcRenderer.send('close-tab', id);
  },

  undoCloseTab: () => {
    ipcRenderer.send('undo-close-tab');
  },

  duplicateTab: (tabId) => {
    const id = sanitizeNumber(tabId, -1);
    if (id > 0) ipcRenderer.send('duplicate-tab', id);
  },

  pinTab: (tabId, isPinned) => {
    const id = sanitizeNumber(tabId, -1);
    if (id > 0) ipcRenderer.send('pin-tab', id, Boolean(isPinned));
  },

  closeOtherTabs: (tabId) => {
    const id = sanitizeNumber(tabId, -1);
    if (id > 0) ipcRenderer.send('close-other-tabs', id);
  },

  closeTabsToRight: (tabId) => {
    const id = sanitizeNumber(tabId, -1);
    if (id > 0) ipcRenderer.send('close-tabs-to-right', id);
  },

  showTabContextMenu: (tabId, pos) => {
    const id = sanitizeNumber(tabId, -1);
    const cleanPos = (pos && typeof pos.x === 'number' && typeof pos.y === 'number') ? { x: Math.round(pos.x), y: Math.round(pos.y) } : undefined;
    if (id > 0) ipcRenderer.send('show-tab-context-menu', id, cleanPos);
  },

  setTabGroup: (tabId, group) => {
    const id = sanitizeNumber(tabId, -1);
    if (id <= 0) return;
    const cleanGroup = (group && typeof group === 'object') ? {
      name: sanitizeString(group.name, 40),
      color: sanitizeString(group.color, 24),
      collapsed: Boolean(group.collapsed)
    } : null;
    ipcRenderer.send('set-tab-group', id, cleanGroup);
  },

  toggleSplitView: (secId) => {
    const id = secId ? sanitizeNumber(secId, null) : null;
    ipcRenderer.send('toggle-split-view', id);
  },

  toggleMuteTab: (tabId) => {
    const id = tabId ? sanitizeNumber(tabId, null) : null;
    ipcRenderer.send('toggle-mute-tab', id);
  },

  // Navigation API (Supports both navigate-to and direct nav verbs)
  navigate: (url) => {
    const cleanUrl = sanitizeString(url, 2048);
    if (cleanUrl) ipcRenderer.send('navigate-to', cleanUrl);
  },
  navigateTo: (url) => {
    const cleanUrl = sanitizeString(url, 2048);
    if (cleanUrl) ipcRenderer.send('navigate-to', cleanUrl);
  },

  goBack: () => ipcRenderer.send('nav-back'),
  goForward: () => ipcRenderer.send('nav-forward'),
  reload: () => ipcRenderer.send('nav-reload'),
  stopNavigation: () => ipcRenderer.send('nav-stop'),
  goHome: () => ipcRenderer.send('nav-home'),

  // Autocomplete Suggestions & Popup View API
  getSuggestions: (query) => {
    return ipcRenderer.invoke('get-suggestions', sanitizeString(query, 256));
  },

  showOmniboxPopup: (payload) => {
    if (payload && typeof payload === 'object') {
      ipcRenderer.send('show-omnibox-popup', payload);
    }
  },
  updateOmniboxPopupSelection: (idx) => {
    ipcRenderer.send('update-omnibox-popup-selection', sanitizeNumber(idx, -1));
  },
  hideOmniboxPopup: () => {
    ipcRenderer.send('hide-omnibox-popup');
  },

  // Find In Page API
  findInPage: (text, forward = true, findNext = false) => {
    const cleanText = sanitizeString(text, 256);
    if (cleanText) ipcRenderer.send('find-in-page', cleanText, Boolean(forward), Boolean(findNext));
  },

  stopFindInPage: () => {
    ipcRenderer.send('stop-find-in-page');
  },

  setFindBarOpen: (isOpen) => {
    ipcRenderer.send('set-find-bar-open', Boolean(isOpen));
  },

  // Zoom & PDF Exporter
  setZoom: (level) => {
    const z = Math.max(-3, Math.min(3, sanitizeNumber(level, 0)));
    ipcRenderer.send('set-zoom', z);
  },

  printToPDF: () => {
    ipcRenderer.send('print-to-pdf');
  },

  savePage: () => {
    ipcRenderer.send('save-page');
  },

  // Tab Cycling & Reorder API
  cycleTab: (direction = 1) => {
    ipcRenderer.send('cycle-tab', sanitizeNumber(direction, 1));
  },

  reorderTabs: (ids) => {
    if (Array.isArray(ids)) {
      ipcRenderer.send('reorder-tabs', ids.map(id => sanitizeNumber(id, 0)).filter(id => id > 0));
    }
  },

  // History & Bookmarks Query API
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: (range) => ipcRenderer.invoke('clear-history', sanitizeString(range, 64)),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', sanitizeString(id, 64)),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (item) => {
    if (item && typeof item === 'object') {
      ipcRenderer.send('add-bookmark', {
        title: sanitizeString(item.title, 256),
        url: sanitizeString(item.url, 2048),
        favicon: sanitizeString(item.favicon, 2048)
      });
    }
  },
  toggleBookmark: () => ipcRenderer.invoke('toggle-bookmark'),
  checkIsBookmarked: (url) => ipcRenderer.invoke('check-is-bookmarked', sanitizeString(url, 2048)),
  deleteBookmark: (id) => ipcRenderer.invoke('delete-bookmark', sanitizeString(id, 64)),
  editBookmark: (id, item) => {
    if (!id || !item || typeof item !== 'object') return Promise.resolve({ success: false });
    return ipcRenderer.invoke('edit-bookmark', {
      id: sanitizeString(id, 64),
      title: sanitizeString(item.title, 256),
      url: sanitizeString(item.url, 2048)
    });
  },
  reorderBookmarks: (ids) => {
    if (!Array.isArray(ids)) return Promise.resolve({ success: false });
    return ipcRenderer.invoke('reorder-bookmarks', ids.map(id => sanitizeString(id, 64)).filter(Boolean));
  },
  toggleFavouritesBar: (state) => {
    const s = state !== undefined ? Boolean(state) : undefined;
    return ipcRenderer.invoke('toggle-favourites-bar', s);
  },
  getFavouritesBarVisible: () => ipcRenderer.invoke('get-favourites-bar-visible'),

  // Downloads Vault & Live Lifecycle API
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  openDownload: (itemPath) => {
    const p = sanitizeString(itemPath, 4096);
    if (p) ipcRenderer.send('open-download', p);
  },
  showInFolder: (itemPath) => {
    const p = sanitizeString(itemPath, 4096);
    if (p) ipcRenderer.send('show-in-folder', p);
  },
  openDownloadChecked: (itemPath) => ipcRenderer.invoke('open-download-checked', sanitizeString(itemPath, 4096)),
  showInFolderChecked: (itemPath) => ipcRenderer.invoke('show-in-folder-checked', sanitizeString(itemPath, 4096)),
  pauseDownload: (id) => ipcRenderer.invoke('pause-download', sanitizeString(id, 64)),
  resumeDownload: (id) => ipcRenderer.invoke('resume-download', sanitizeString(id, 64)),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', sanitizeString(id, 64)),
  retryDownload: (id) => ipcRenderer.invoke('retry-download', sanitizeString(id, 64)),
  deleteDownload: (id) => ipcRenderer.invoke('delete-download', sanitizeString(id, 64)),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),

  // Native Favourites Bar Context & Overflow Menus (above WebContentsView)
  showFavContextMenu: (favId, pos) => {
    const cleanId = sanitizeString(favId, 64);
    const p = (pos && typeof pos === 'object') ? { x: sanitizeNumber(pos.x, 0), y: sanitizeNumber(pos.y, 0) } : null;
    if (cleanId) ipcRenderer.send('show-fav-context-menu', cleanId, p);
  },
  showFavOverflowMenu: (favIds, pos) => {
    const ids = Array.isArray(favIds) ? favIds.map(i => sanitizeString(i, 64)).filter(Boolean) : [];
    const p = (pos && typeof pos === 'object') ? { x: sanitizeNumber(pos.x, 0), y: sanitizeNumber(pos.y, 0) } : null;
    ipcRenderer.send('show-fav-overflow-menu', ids, p);
  },

  // Settings API
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectDownloadDir: () => ipcRenderer.invoke('select-download-dir'),
  resetDownloadDir: () => ipcRenderer.invoke('reset-download-dir'),
  getDefaultDownloadsDir: () => ipcRenderer.invoke('get-default-downloads-dir'),
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (_event, settings) => {
      if (typeof callback === 'function') callback(settings);
    });
  },

  // Layout & Shell State
  setSidebarState: (isCollapsed) => {
    ipcRenderer.send('set-sidebar-state', Boolean(isCollapsed));
  },

  clearCache: () => {
    ipcRenderer.send('clear-browser-cache');
  },
  clearCacheAsync: () => ipcRenderer.invoke('clear-browser-cache-async'),
  getRuntimeStats: () => ipcRenderer.invoke('get-runtime-stats'),

  toggleDevTools: () => {
    ipcRenderer.send('toggle-devtools');
  },

  showAbout: () => {
    ipcRenderer.send('show-about');
  },

  showMoreMenu: (pos) => {
    const p = (pos && typeof pos === 'object') ? {
      x: sanitizeNumber(pos.x, 0),
      y: sanitizeNumber(pos.y, 0)
    } : null;
    ipcRenderer.send('show-more-menu', p);
  },

  setModalOpen: (isOpen) => {
    ipcRenderer.send('set-modal-open', Boolean(isOpen));
  },

  // Native Window Controls (Supports both win-* and window-* aliases)
  minimizeWindow: () => ipcRenderer.send('win-min'),
  maximizeWindow: () => ipcRenderer.send('win-max'),
  restoreWindow: () => ipcRenderer.send('win-restore'),
  toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('win-close'),
  createWindow: () => ipcRenderer.send('create-window'),
  createIncognitoWindow: () => ipcRenderer.send('create-incognito-window'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  getWindowState: () => ipcRenderer.invoke('get-window-state'),

  // Safe Parameterized Inbound Listeners
  onWindowStateChanged: (cb) => { if (typeof cb === 'function') ipcRenderer.on('window-state-changed', (e, d) => cb(d)); },
  onUrlUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('url-updated', (e, d) => cb(d)); },
  onTabCreated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('tab-created', (e, d) => cb(d)); },
  onTabUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('tab-updated', (e, d) => cb(d)); },
  onTabClosed: (cb) => { if (typeof cb === 'function') ipcRenderer.on('tab-closed', (e, d) => cb(d)); },
  onTabSwitched: (cb) => { if (typeof cb === 'function') ipcRenderer.on('tab-switched', (e, d) => cb(d)); },
  onTabCrashed: (cb) => { if (typeof cb === 'function') ipcRenderer.on('tab-crashed', (e, d) => cb(d)); },
  onSplitViewUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('split-view-updated', (e, d) => cb(d)); },
  onShieldUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('shield-updated', (e, d) => cb(d)); },
  onPermissionRequested: (cb) => { if (typeof cb === 'function') ipcRenderer.on('permission-requested', (e, d) => cb(d)); },
  onFindResult: (cb) => { if (typeof cb === 'function') ipcRenderer.on('find-result', (e, d) => cb(d)); },
  onDownloadProgress: (cb) => { if (typeof cb === 'function') ipcRenderer.on('download-progress', (e, d) => cb(d)); },
  onDownloadComplete: (cb) => { if (typeof cb === 'function') ipcRenderer.on('download-complete', (e, d) => cb(d)); },
  onBookmarkStatusChanged: (cb) => { if (typeof cb === 'function') ipcRenderer.on('bookmark-status-changed', (e, d) => cb(d)); },
  onBookmarksUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('bookmarks-updated', (e, d) => cb(d)); },
  onFavouritesBarToggled: (cb) => { if (typeof cb === 'function') ipcRenderer.on('favourites-bar-visibility-changed', (e, d) => cb(d)); },
  onShowBookmarks: (cb) => { if (typeof cb === 'function') ipcRenderer.on('show-bookmarks', () => cb()); },
  onToggleFindBar: (cb) => { if (typeof cb === 'function') ipcRenderer.on('toggle-find-bar', () => cb()); },
  onOpenSettingsModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-settings-modal', () => cb()); },
  onOpenHistoryModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-history-modal', () => cb()); },
  onOpenBookmarksModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-bookmarks-modal', () => cb()); },
  onOpenDownloadsModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-downloads-modal', () => cb()); },
  onOpenClearDataModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-clear-data-modal', () => cb()); },
  onOpenAboutModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-about-modal', () => cb()); },
  onFocusOmnibox: (cb) => { if (typeof cb === 'function') ipcRenderer.on('focus-omnibox', () => cb()); },
  onOmniboxPopupChosen: (cb) => { if (typeof cb === 'function') ipcRenderer.on('omnibox-popup-chosen', (_e, idx) => cb(idx)); },
  onOmniboxPopupHover: (cb) => { if (typeof cb === 'function') ipcRenderer.on('omnibox-popup-hover', (_e, idx) => cb(idx)); },
  onChromeShortcut: (cb) => { if (typeof cb === 'function') ipcRenderer.on('chrome-shortcut', (_e, action) => cb(action)); },
  onShieldLevelChanged: (cb) => { if (typeof cb === 'function') ipcRenderer.on('shield-level-changed', (_e, lvl) => cb(lvl)); },
  onFavAction: (cb) => { if (typeof cb === 'function') ipcRenderer.on('fav-action', (_e, data) => cb(data)); },
  onToastMessage: (cb) => { if (typeof cb === 'function') ipcRenderer.on('toast-message', (_e, msg) => cb(msg)); },

  // Unified Sovereign Account & Sync API
  getAccountState: () => ipcRenderer.invoke('get-account-state'),
  saveAccountState: (user) => {
    if (user && typeof user === 'object') {
      return ipcRenderer.invoke('save-account-state', {
        id: sanitizeNumber(user.id, 0),
        email: sanitizeString(user.email, 256),
        name: sanitizeString(user.name, 256)
      });
    }
    return Promise.resolve(false);
  },
  signOutAccount: () => ipcRenderer.invoke('sign-out-account'),
  openAuthPage: () => ipcRenderer.send('open-auth-page'),
  onOpenAccountModal: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-account-modal', () => cb()); },
  onAccountStateChanged: (cb) => { if (typeof cb === 'function') ipcRenderer.on('account-state-changed', (_e, state) => cb(state)); },

  // Phase 7: Tab Group Productivity, Tab Search, Reading List & Reader Mode
  renameTabGroup: (oldName, newName, newColor) => {
    const o = sanitizeString(oldName, 40);
    const n = sanitizeString(newName, 40);
    const c = newColor ? sanitizeString(newColor, 24) : '';
    if (o) ipcRenderer.send('rename-tab-group', o, n, c);
  },
  toggleCollapseTabGroup: (groupName) => {
    const g = sanitizeString(groupName, 40);
    if (g) ipcRenderer.send('toggle-collapse-tab-group', g);
  },
  closeTabGroup: (groupName) => {
    const g = sanitizeString(groupName, 40);
    if (g) ipcRenderer.send('close-tab-group', g);
  },
  onOpenGroupEditor: (cb) => { if (typeof cb === 'function') ipcRenderer.on('open-group-editor', (_e, data) => cb(data)); },

  getTabSearchData: () => ipcRenderer.invoke('get-tab-search-data'),
  restoreClosedTabAt: (stackIndex) => ipcRenderer.invoke('restore-closed-tab-at', sanitizeNumber(stackIndex, -1)),

  getReadingList: () => ipcRenderer.invoke('get-reading-list'),
  addReadingListItem: (payload) => {
    const clean = (payload && typeof payload === 'object') ? {
      url: sanitizeString(payload.url, 2048),
      title: sanitizeString(payload.title, 240)
    } : {};
    return ipcRenderer.invoke('add-reading-list-item', clean);
  },
  removeReadingListItem: (id) => ipcRenderer.invoke('remove-reading-list-item', sanitizeString(id, 64)),
  toggleReadingListRead: (id) => ipcRenderer.invoke('toggle-reading-list-read', sanitizeString(id, 64)),

  extractReaderArticle: () => ipcRenderer.invoke('extract-reader-article'),

  // Phase 8: Site Permissions & Privacy Control Center
  getSitePermissions: (origin) => ipcRenderer.invoke('get-site-permissions', sanitizeString(origin, 512)),
  setSitePermission: (payload) => {
    if (!payload || typeof payload !== 'object') return Promise.resolve({ ok: false, error: 'Invalid payload' });
    return ipcRenderer.invoke('set-site-permission', {
      origin: sanitizeString(payload.origin, 512),
      permission: sanitizeString(payload.permission, 64),
      value: sanitizeString(payload.value, 32)
    });
  },
  resetSitePermissions: (origin) => ipcRenderer.invoke('reset-site-permissions', sanitizeString(origin, 512)),
  getAllSitePermissions: () => ipcRenderer.invoke('get-all-site-permissions'),
  setGlobalPermissionDefault: (payload) => {
    if (!payload || typeof payload !== 'object') return Promise.resolve({ ok: false, error: 'Invalid payload' });
    return ipcRenderer.invoke('set-global-permission-default', {
      permission: sanitizeString(payload.permission, 64),
      value: sanitizeString(payload.value, 32)
    });
  },
  resetAllSitePermissions: () => ipcRenderer.invoke('reset-all-site-permissions'),
  toggleSiteShield: (payload) => ipcRenderer.invoke('toggle-site-shield', {
    origin: sanitizeString(payload && payload.origin, 512),
    enabled: Boolean(payload && payload.enabled)
  }),
  getSiteStorageSummary: (origin) => ipcRenderer.invoke('get-site-storage-summary', sanitizeString(origin, 512)),
  clearSiteStorage: (origin) => ipcRenderer.invoke('clear-site-storage', sanitizeString(origin, 512)),
  getAllWebsiteData: () => ipcRenderer.invoke('get-all-website-data'),
  removeWebsiteData: (domain) => ipcRenderer.invoke('remove-website-data', sanitizeString(domain, 256)),
  clearBrowsingDataSelective: (payload) => ipcRenderer.invoke('clear-browsing-data-selective', payload),
  onSitePermissionsUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('site-permissions-updated', (_e, d) => cb(d)); },
  onGlobalPermissionsUpdated: (cb) => { if (typeof cb === 'function') ipcRenderer.on('global-permissions-updated', (_e, d) => cb(d)); }
});

// Expose both namespaces (stauntAPI & stauntSecureBridge)
contextBridge.exposeInMainWorld('stauntAPI', secureAPI);
contextBridge.exposeInMainWorld('stauntSecureBridge', secureAPI);
