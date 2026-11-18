'use strict';
const { app, session, dialog, Menu, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Chrome extension support: chrome.* APIs (electron-chrome-extensions),
 * installing from the Chrome Web Store (electron-chrome-web-store),
 * unpacked folders and local .crx files.
 */
class Extensions {
  constructor(browser) {
    this.b = browser;
    this.api = null;
    this.ready = false;
    this.dir = path.join(app.getPath('userData'), 'Extensions');
    this.unpackedDir = path.join(app.getPath('userData'), 'ExtensionsLocal');
    this.paths = new Map(); // id -> path (for re-enabling)
  }

  get ses() { return session.defaultSession; }

  async init() {
    const s = this.b.settings;
    if (!s.get('extensions.enabled')) return;
    try {
      const { ElectronChromeExtensions } = require('electron-chrome-extensions');
      const b = this.b;
      this.api = new ElectronChromeExtensions({
        license: 'GPL-3.0',
        session: this.ses,
        createTab: async (details) => {
          const win = (details.windowId && b.windowById(details.windowId)) || b.lastNormalWindow() || b.createWindow({});
          const tab = win.createTab({ url: details.url || b.newTabUrl(), active: details.active !== false, atEnd: true });
          return [tab.wc, win.win];
        },
        // only follow activation requests that come from extensions (chrome.tabs.update),
        // not the library's own bookkeeping while we register or select tabs
        selectTab: (wc) => { if (this.internal) return; const tab = b.tabsByWc.get(wc.id); if (tab && tab !== tab.win.activeTab) { tab.win.activate(tab); tab.win.focus(); } },
        removeTab: (wc) => { const tab = b.tabsByWc.get(wc.id); if (tab) tab.win.closeTab(tab); },
        createWindow: async (details) => {
          const urls = [].concat(details.url || []);
          const w = b.createWindow({ urls, private: !!details.incognito });
          return w.win;
        },
        removeWindow: (bw) => { if (!bw || bw.isDestroyed()) return; const w = b.windowById(bw.id); if (w) w.win.close(); },
        assignTabDetails: (details, wc) => {
          const tab = b.tabsByWc.get(wc.id);
          if (tab) { details.pinned = tab.state.pinned; details.discarded = tab.state.sleeping; }
        }
      });
      const { ElectronChromeExtensions: ECE } = require('electron-chrome-extensions');
      ECE.handleCRXProtocol(this.ses);
    } catch (err) {
      console.error('[extensions] chrome API layer failed:', err);
    }
    try {
      const { installChromeWebStore } = require('electron-chrome-web-store');
      await installChromeWebStore({
        session: this.ses,
        extensionsPath: this.dir,
        autoUpdate: s.get('extensions.autoUpdate'),
        loadExtensions: true,
        allowUnpackedExtensions: false,
        beforeInstall: async (details) => {
          const t = this.b.i18n.t;
          const perms = [].concat(details.manifest.permissions || [], details.manifest.host_permissions || []).filter((p) => typeof p === 'string');
          const r = await dialog.showMessageBox(details.browserWindow || (this.b.lastFocused && this.b.lastFocused.win), {
            type: 'question', buttons: [t('ext.add'), t('dialog.cancel')], defaultId: 0, cancelId: 1,
            icon: details.icon && !details.icon.isEmpty() ? details.icon : undefined,
            message: t('ext.confirmInstall', { name: details.localizedName }),
            detail: perms.length ? t('ext.permissions') + '\n• ' + perms.slice(0, 12).join('\n• ') : ''
          });
          return { action: r.response === 0 ? 'allow' : 'deny' };
        }
      });
    } catch (err) {
      console.error('[extensions] web store support failed:', err);
    }
    // local unpacked extensions
    for (const p of s.get('extensions.unpacked') || []) await this.loadPath(p, false);
    // disabled ones
    for (const ext of this.ses.extensions.getAllExtensions()) {
      this.paths.set(ext.id, ext.path);
      if ((s.get('extensions.disabled') || []).includes(ext.id)) this.ses.extensions.removeExtension(ext.id);
    }
    this.ses.extensions.on('extension-loaded', (_e, ext) => { this.paths.set(ext.id, ext.path); this.b.broadcast('extensions-changed'); });
    this.ses.extensions.on('extension-unloaded', () => this.b.broadcast('extensions-changed'));
    this.ready = true;
    this.b.broadcast('extensions-changed');
  }

  addTab(tab, win) {
    if (!this.api || !tab.wc) return;
    this.internal = true;
    try { this.api.addTab(tab.wc, win.win); } catch (err) { console.warn('[extensions] addTab', err.message); } finally { this.internal = false; }
    // keep the library's idea of the active tab in sync
    if (win.activeTab && win.activeTab !== tab) this.selectTab(win.activeTab);
  }

  selectTab(tab) {
    if (!this.api || !tab || !tab.wc || tab.win.private) return;
    this.internal = true;
    try { this.api.selectTab(tab.wc); } catch (_) { /* tab not tracked */ } finally { this.internal = false; }
  }

  contextMenuItems(tab, params) {
    if (!this.api || !tab.wc) return [];
    try { return this.api.getContextMenuItems(tab.wc, params) || []; } catch (_) { return []; }
  }

  list() {
    const disabled = new Set(this.b.settings.get('extensions.disabled') || []);
    const unpacked = new Set(this.b.settings.get('extensions.unpacked') || []);
    const loaded = this.ses.extensions.getAllExtensions();
    const out = loaded.map((e) => this.describe(e, true, unpacked));
    for (const id of disabled) {
      if (out.some((e) => e.id === id)) continue;
      const p = this.paths.get(id);
      let manifest = {};
      try { manifest = JSON.parse(fs.readFileSync(path.join(p, 'manifest.json'), 'utf8')); } catch (_) { /* missing */ }
      out.push({ id, name: this.localize(manifest.name, p) || id, version: manifest.version || '', description: this.localize(manifest.description, p) || '', enabled: false, path: p, icon: this.iconData(manifest, p), unpacked: unpacked.has(p) });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  localize(str, dir) {
    if (!str || !/^__MSG_.+__$/.test(str) || !dir) return str;
    const key = str.slice(6, -2);
    for (const lang of [this.b.i18n.lang, 'en', 'en_US', 'de']) {
      try {
        const msgs = JSON.parse(fs.readFileSync(path.join(dir, '_locales', lang, 'messages.json'), 'utf8'));
        const hit = Object.entries(msgs).find(([k]) => k.toLowerCase() === key.toLowerCase());
        if (hit) return hit[1].message;
      } catch (_) { /* next */ }
    }
    return str;
  }

  iconData(manifest, dir) {
    const icons = manifest.icons || (manifest.action && manifest.action.default_icon) || (manifest.browser_action && manifest.browser_action.default_icon) || {};
    const rel = typeof icons === 'string' ? icons : icons['48'] || icons['64'] || icons['128'] || icons['32'] || Object.values(icons)[0];
    if (!rel || !dir) return '';
    try {
      const img = nativeImage.createFromPath(path.join(dir, rel));
      return img.isEmpty() ? '' : img.resize({ width: 48 }).toDataURL();
    } catch (_) { return ''; }
  }

  describe(ext, enabled, unpacked) {
    const m = ext.manifest || {};
    return {
      id: ext.id, name: this.localize(m.name, ext.path) || ext.name, version: m.version || ext.version, description: this.localize(m.description, ext.path) || '',
      enabled, path: ext.path, icon: this.iconData(m, ext.path), unpacked: unpacked.has(ext.path),
      optionsUrl: m.options_page ? `chrome-extension://${ext.id}/${m.options_page}` : m.options_ui && m.options_ui.page ? `chrome-extension://${ext.id}/${m.options_ui.page}` : '',
      store: !unpacked.has(ext.path)
    };
  }

  async setEnabled(id, enabled) {
    const s = this.b.settings;
    const disabled = new Set(s.get('extensions.disabled') || []);
    if (enabled) {
      disabled.delete(id);
      const p = this.paths.get(id);
      if (p && !this.ses.extensions.getExtension(id)) await this.ses.extensions.loadExtension(p, { allowFileAccess: true }).catch((e) => console.warn(e));
    } else {
      disabled.add(id);
      if (this.ses.extensions.getExtension(id)) this.ses.extensions.removeExtension(id);
    }
    s.set('extensions.disabled', [...disabled]);
    this.b.broadcast('extensions-changed');
  }

  async installFromStore(idOrUrl) {
    const m = String(idOrUrl || '').match(/([a-p]{32})/);
    if (!m) throw new Error('invalid-id');
    const { installExtension } = require('electron-chrome-web-store');
    const ext = await installExtension(m[1], { session: this.ses, extensionsPath: this.dir });
    this.paths.set(ext.id, ext.path);
    this.b.broadcast('extensions-changed');
    return ext.id;
  }

  async loadPath(p, remember = true) {
    try {
      const ext = await this.ses.extensions.loadExtension(p, { allowFileAccess: true });
      this.paths.set(ext.id, ext.path);
      if (ext.manifest.manifest_version === 3 && ext.manifest.background && ext.manifest.background.service_worker) {
        await this.ses.serviceWorkers.startWorkerForScope(`chrome-extension://${ext.id}`).catch(() => {});
      }
      if (remember) {
        const list = new Set(this.b.settings.get('extensions.unpacked') || []);
        list.add(p);
        this.b.settings.set('extensions.unpacked', [...list]);
      }
      this.b.broadcast('extensions-changed');
      return ext.id;
    } catch (err) {
      console.warn('[extensions] could not load', p, err.message);
      if (remember) throw err;
      return null;
    }
  }

  async pickUnpacked(win) {
    const r = await dialog.showOpenDialog(win && win.win, { properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    if (!fs.existsSync(path.join(r.filePaths[0], 'manifest.json'))) throw new Error('no-manifest');
    return this.loadPath(r.filePaths[0]);
  }

  /** Install a local .crx (CRX2/CRX3) or .zip file. */
  async installFile(win) {
    const r = await dialog.showOpenDialog(win && win.win, { properties: ['openFile'], filters: [{ name: 'Chrome Extension', extensions: ['crx', 'zip'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const buf = fs.readFileSync(r.filePaths[0]);
    const zipBuf = crxToZip(buf);
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuf);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) throw new Error('no-manifest');
    const manifest = JSON.parse(manifestEntry.getData().toString('utf8').replace(/^﻿/, ''));
    const name = String(manifest.name || 'extension').replace(/[^\w.-]+/g, '_').slice(0, 40);
    const dest = path.join(this.unpackedDir, `${name}-${manifest.version || '0'}-${Date.now().toString(36)}`);
    fs.mkdirSync(dest, { recursive: true });
    zip.extractAllTo(dest, true);
    return this.loadPath(dest);
  }

  async remove(id) {
    const s = this.b.settings;
    const p = this.paths.get(id);
    if (this.ses.extensions.getExtension(id)) this.ses.extensions.removeExtension(id);
    const unpacked = (s.get('extensions.unpacked') || []).filter((x) => x !== p);
    s.set('extensions.unpacked', unpacked);
    s.set('extensions.disabled', (s.get('extensions.disabled') || []).filter((x) => x !== id));
    if (p && p.startsWith(this.dir)) {
      const { uninstallExtension } = require('electron-chrome-web-store');
      await uninstallExtension(id, { session: this.ses, extensionsPath: this.dir }).catch(() => {});
    } else if (p && p.startsWith(this.unpackedDir)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
    this.paths.delete(id);
    this.b.broadcast('extensions-changed');
  }

  async update() {
    const { updateExtensions } = require('electron-chrome-web-store');
    await updateExtensions(this.ses);
  }
}

function crxToZip(buf) {
  if (buf.slice(0, 2).toString() === 'PK') return buf;
  if (buf.slice(0, 4).toString() !== 'Cr24') throw new Error('invalid-crx');
  const version = buf.readUInt32LE(4);
  if (version === 3) return buf.slice(12 + buf.readUInt32LE(8));
  if (version === 2) return buf.slice(16 + buf.readUInt32LE(8) + buf.readUInt32LE(12));
  throw new Error('invalid-crx');
}

module.exports = { Extensions, crxToZip };
