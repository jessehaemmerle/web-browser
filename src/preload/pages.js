'use strict';
/*
 * Preload attached to every tab. It only exposes the Nimbus API to the browser's
 * own nimbus:// pages; regular websites get nothing (the main process re-checks).
 */
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'nimbus:') {
  const listeners = new Set();
  ipcRenderer.on('nimbus:event', (_e, name, payload) => {
    for (const cb of listeners) {
      try { cb(name, payload); } catch (err) { console.error(err); }
    }
  });
  contextBridge.exposeInMainWorld('nimbus', {
    call: (method, ...args) => ipcRenderer.invoke('nimbus:call', method, ...args),
    on: (cb) => { listeners.add(cb); return () => listeners.delete(cb); }
  });
}
