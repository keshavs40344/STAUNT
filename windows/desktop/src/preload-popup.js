// Sandboxed preload for STAUNT Omnibox Autocomplete Popup WebContentsView
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omniboxPopupAPI', Object.freeze({
  onUpdate: (cb) => {
    if (typeof cb === 'function') {
      ipcRenderer.on('omnibox-popup-data', (_e, data) => cb(data));
    }
  },
  onSelectIndex: (cb) => {
    if (typeof cb === 'function') {
      ipcRenderer.on('omnibox-popup-selection', (_e, idx) => cb(idx));
    }
  },
  chooseItem: (index) => {
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0) {
      ipcRenderer.send('omnibox-popup-choose', index);
    }
  },
  hoverItem: (index) => {
    if (typeof index === 'number' && Number.isInteger(index)) {
      ipcRenderer.send('omnibox-popup-hover', index);
    }
  }
}));
