'use strict';
const { app, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { JsonStore } = require('./store');

let nextId = 1;

function uniquePath(dir, name) {
  name = (name || 'download').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '_') || 'download';
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name);
  for (let i = 1; fs.existsSync(p) || fs.existsSync(p + '.crdownload'); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}

class Downloads extends EventEmitter {
  constructor(browser, file) {
    super();
    this.b = browser;
    this.store = new JsonStore(file, () => ({ items: [] }));
    this.items = (this.store.data.items || []).map((d) => ({ ...d, id: nextId++, state: d.state === 'progressing' ? 'interrupted' : d.state }));
    this.live = new Map(); // id -> DownloadItem
  }

  dir() {
    const d = this.b.settings.get('downloads.dir');
    return d && fs.existsSync(d) ? d : app.getPath('downloads');
  }

  handle(item, wc, isPrivate) {
    const id = nextId++;
    const ask = this.b.settings.get('downloads.ask');
    if (ask) item.setSaveDialogOptions({ defaultPath: path.join(this.dir(), item.getFilename()) });
    else item.setSavePath(uniquePath(this.dir(), item.getFilename()));
    const entry = {
      id, url: item.getURL(), filename: item.getFilename(), path: item.getSavePath(), mime: item.getMimeType(),
      total: item.getTotalBytes(), received: 0, state: 'progressing', paused: false, start: Date.now(), private: !!isPrivate
    };
    this.items.unshift(entry);
    this.live.set(id, item);
    let last = 0;
    item.on('updated', (_e, state) => {
      entry.state = state === 'interrupted' ? 'interrupted' : 'progressing';
      entry.received = item.getReceivedBytes();
      entry.total = item.getTotalBytes();
      entry.paused = item.isPaused();
      entry.path = item.getSavePath() || entry.path;
      entry.filename = path.basename(entry.path || entry.filename);
      const now = Date.now();
      if (now - last > 250) { last = now; this.changed(entry); }
    });
    item.once('done', (_e, state) => {
      entry.state = state; // completed | cancelled | interrupted
      entry.received = item.getReceivedBytes();
      entry.path = item.getSavePath() || entry.path;
      entry.filename = path.basename(entry.path || entry.filename);
      entry.end = Date.now();
      this.live.delete(id);
      this.changed(entry, true);
      if (state === 'completed' && process.platform === 'darwin') app.dock.downloadFinished(entry.path);
    });
    this.changed(entry, true);
    this.emit('started', entry, wc);
  }

  changed(entry, persist) {
    this.emit('change', entry);
    if (persist) this.persist();
  }

  persist() {
    this.store.data.items = this.items.filter((d) => !d.private).slice(0, 300).map(({ id, ...rest }) => rest);
    this.store.save();
  }

  list() { return this.items.slice(0, 300); }

  action(id, action) {
    const entry = this.items.find((d) => d.id === id);
    if (!entry) return false;
    const item = this.live.get(id);
    switch (action) {
      case 'pause': if (item) item.pause(); break;
      case 'resume': if (item && item.canResume()) item.resume(); else if (!item) this.b.lastFocused && this.b.lastFocused.activeTab && this.b.lastFocused.activeTab.wc && this.b.lastFocused.activeTab.wc.downloadURL(entry.url); break;
      case 'cancel': if (item) item.cancel(); break;
      case 'open': if (entry.state === 'completed') shell.openPath(entry.path).then((err) => { if (err) dialog.showErrorBox('Nimbus', err); }); break;
      case 'show': if (entry.path) shell.showItemInFolder(entry.path); break;
      case 'retry': if (this.b.lastFocused && this.b.lastFocused.activeTab && this.b.lastFocused.activeTab.wc) this.b.lastFocused.activeTab.wc.downloadURL(entry.url); break;
      case 'remove': this.items = this.items.filter((d) => d !== entry); this.persist(); break;
      case 'delete':
        if (item) item.cancel();
        try { if (entry.path && fs.existsSync(entry.path)) fs.unlinkSync(entry.path); } catch (_) { /* ignore */ }
        this.items = this.items.filter((d) => d !== entry); this.persist(); break;
      default: return false;
    }
    this.emit('change', entry);
    return true;
  }

  clear() {
    this.items = this.items.filter((d) => d.state === 'progressing');
    this.persist();
    this.emit('change');
  }

  activeCount() { return this.items.filter((d) => d.state === 'progressing').length; }

  flush() { this.store.flush(); }
}

module.exports = { Downloads, uniquePath };
