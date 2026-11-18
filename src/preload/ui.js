'use strict';
/* Preload for the browser interface (trusted local page). */
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Set();
ipcRenderer.on('nimbus:ui', (_e, channel, payload) => {
  for (const cb of listeners) {
    try { cb(channel, payload); } catch (err) { console.error(err); }
  }
});

contextBridge.exposeInMainWorld('nimbus', {
  call: (method, ...args) => ipcRenderer.invoke('nimbus:call', method, ...args),
  on: (cb) => { listeners.add(cb); return () => listeners.delete(cb); }
});

// <browser-action-list> element for Chrome extension buttons
try {
  const params = new URLSearchParams(location.search);
  if (params.get('private') !== '1') {
    const { injectBrowserAction } = require('electron-chrome-extensions/browser-action');
    injectBrowserAction();
  }
} catch (err) {
  console.warn('extension actions unavailable', err);
}
