'use strict';
const { app, session, nativeTheme, dialog, desktopCapturer, shell, webContents: WebContents, net, BrowserWindow, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const { Settings } = require('./settings');
const { Bookmarks } = require('./bookmarks');
const BookmarksHtml = require('./bookmarks-html');
const { History } = require('./history');
const { Downloads } = require('./downloads');
const { AdBlock } = require('./adblock');
const { Extensions } = require('./extensions');
const { SiteScripts } = require('./sitescripts');
const { InternalProtocol } = require('./protocol');
const { ContextMenu } = require('./contextmenu');
const { Commands } = require('./commands');
const { NimbusWindow } = require('./window');
const { JsonStore } = require('./store');
const { setupSession, defaultUserAgent, applyDns } = require('./net');
const { I18n } = require('./i18n');
const { DEFAULTS } = require('./defaults');
const Accel = require('../shared/accel');
const { resolveInput, hostOf, originOf, matchesPattern, buildSearchUrl } = require('../shared/url');

class Browser {
  constructor() {
    const ud = app.getPath('userData');
    this.settings = new Settings(path.join(ud, 'settings.json'));
    this.i18n = new I18n(() => this.settings.get('language'));
    this.bookmarks = new Bookmarks(path.join(ud, 'bookmarks.json'));
    this.history = new History(path.join(ud, 'history.json'));
    this.downloads = new Downloads(this, path.join(ud, 'downloads.json'));
    this.sessionStore = new JsonStore(path.join(ud, 'session.json'), () => ({ windows: [] }), { delay: 1500 });
    this.adblock = new AdBlock(this);
    this.extensions = new Extensions(this);
    this.siteScripts = new SiteScripts(this);
    this.protocol = new InternalProtocol(this);
    this.contextMenu = new ContextMenu(this);
    this.commands = new Commands(this);
    this.windows = new Map();
    this.tabsByWc = new Map();
    this.uiWcIds = new Set();
    this.lastFocused = null;
    this.quitting = false;
    this.pending = new Map();        // prompt id -> resolver
    this.privateDecisions = new Map();
    this.httpsUpgraded = new Set();
    this.httpsTemporaryExceptions = new Set();
    this.certExceptions = new Set();
    this.rebuildShortcuts();
  }

  // ---------------------------------------------------------------- startup

  async start(argvUrls = []) {
    nativeTheme.themeSource = this.settings.get('appearance.mode') || 'system';
    app.userAgentFallback = this.settings.get('privacy.userAgent') || defaultUserAgent();
    applyDns(this.settings);
    setupSession(this, session.defaultSession, { private: false });
    this.settings.on('change', (p) => this.onSettingsChanged(p));
    nativeTheme.on('updated', () => {
      for (const w of this.windows.values()) w.applyTheme();
      this.broadcast('theme', { dark: nativeTheme.shouldUseDarkColors });
    });
    this.bookmarks.on('change', () => { this.broadcast('bookmarks', this.bookmarks.tree); for (const w of this.windows.values()) w.scheduleState(); });
    this.downloads.on('change', () => this.broadcastSoon('downloads'));
    this.downloads.on('started', (entry, wc) => {
      const tab = wc && this.tabsByWc.get(wc.id);
      const win = tab ? tab.win : this.lastFocused;
      if (win && this.settings.get('downloads.openPanel')) win.sendUi('download-started', entry);
    });
    this.history.on('change', () => this.broadcastSoon('history'));
    app.on('login', (event, wc, details, authInfo, callback) => this.handleLogin(event, wc, details, authInfo, callback));
    app.on('certificate-error', (event, wc, url, error, cert, callback) => {
      const host = hostOf(url);
      if (this.certExceptions.has(host + '|' + cert.fingerprint)) { event.preventDefault(); callback(true); return; }
      this.lastCertError = { url, error, host, fingerprint: cert.fingerprint, issuer: cert.issuerName, subject: cert.subjectName };
      callback(false);
    });
    app.on('web-contents-created', (_e, wc) => this.onWebContentsCreated(wc));

    // extensions must be ready before tabs are registered with the extension API
    await this.extensions.init().catch((e) => console.error(e));
    this.adblock.load().then(() => this.broadcast('adblock', this.adblock.status()));
    this.openStartupWindows(argvUrls);
    this.sleepTimer = setInterval(() => this.sleepInactiveTabs(), 60 * 1000);
  }

  openStartupWindows(argvUrls) {
    const st = this.settings.get('startup');
    const saved = this.sessionStore.data.windows || [];
    let opened = false;
    if (st.mode === 'restore' && saved.length) {
      for (const w of saved) {
        if (!w.tabs || !w.tabs.length) continue;
        this.createWindow({ tabs: w.tabs, groups: w.groups, activeIndex: w.activeIndex, bounds: this.sanitizeBounds(w.bounds), maximized: w.maximized, restore: true });
        opened = true;
      }
    }
    if (!opened) {
      const urls = st.mode === 'home' ? [this.homeUrl()] : st.mode === 'urls' && st.urls.length ? st.urls : [this.newTabUrl()];
      this.createWindow({ urls });
    }
    if (argvUrls.length) {
      const w = this.lastNormalWindow();
      argvUrls.forEach((u, i) => w.createTab({ url: u, active: i === argvUrls.length - 1, atEnd: true }));
    }
  }

  sanitizeBounds(b) {
    if (!b) return undefined;
    const { screen } = require('electron');
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x < a.x + a.width - 50 && b.x + b.width > a.x + 50 && b.y < a.y + a.height - 50 && b.y + 30 > a.y;
    });
    return visible ? b : undefined;
  }

  setupSession(ses, opts) { setupSession(this, ses, opts); }

  createWindow(opts = {}) {
    let tabs = opts.tabs;
    if (!tabs && opts.urls) tabs = opts.urls.map((url) => ({ url }));
    if (!tabs && opts.url) tabs = [{ url: opts.url }];
    if (opts.adopt) tabs = [];
    const w = new NimbusWindow(this, { ...opts, tabs: tabs && tabs.length ? tabs : opts.adopt ? null : undefined, noInitialTab: !!opts.adopt });
    this.windows.set(w.id, w);
    this.uiWcIds.add(w.ui.webContents.id);
    if (opts.adopt) w.adoptTab(opts.adopt, 0);
    this.saveSessionSoon();
    return w;
  }

  onWindowClosed(w) {
    this.windows.delete(w.id);
    this.uiWcIds.delete(w.ui.webContents.id);
    if (this.lastFocused === w) this.lastFocused = [...this.windows.values()].pop() || null;
    if (!this.quitting) this.saveSessionSoon();
  }

  windowById(id) { return this.windows.get(id) || null; }
  lastNormalWindow() {
    if (this.lastFocused && !this.lastFocused.private && !this.lastFocused.win.isDestroyed()) return this.lastFocused;
    return [...this.windows.values()].reverse().find((w) => !w.private) || this.createWindow({});
  }

  registerTab(tab) { if (tab.wc) this.tabsByWc.set(tab.wc.id, tab); }
  unregisterTab(tab) { if (tab.view && !tab.view.webContents.isDestroyed()) this.tabsByWc.delete(tab.view.webContents.id); }

  onWebContentsCreated(wc) {
    // popups created via window.open (BrowserWindow) – give them our menus and shortcuts
    wc.once('did-finish-load', () => {
      if (this.tabsByWc.has(wc.id) || this.uiWcIds.has(wc.id) || wc.getType() !== 'window') return;
      const bw = BrowserWindow.fromWebContents(wc);
      if (!bw || bw.__nimbus) return;
      bw.__nimbus = true;
      wc.on('context-menu', (_e, params) => {
        if (params.isEditable) this.contextMenu.showEditable(wc, params);
      });
      wc.on('before-input-event', (e, input) => {
        if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) { wc.openDevTools({ mode: 'detach' }); e.preventDefault(); }
      });
      wc.setWindowOpenHandler(({ url }) => { this.lastNormalWindow().createTab({ url, active: true }); return { action: 'deny' }; });
    });
  }

  // ---------------------------------------------------------------- urls

  searchEngine(id) {
    const s = this.settings.get('search');
    return s.engines.find((e) => e.id === (id || s.default)) || s.engines[0] || DEFAULTS.search.engines[0];
  }

  resolve(input) {
    const text = String(input || '').trim();
    // keyword search: "w berlin" → Wikipedia
    const m = text.match(/^(\S+)\s+(.+)$/);
    if (m) {
      const kw = this.settings.get('search.engines').find((e) => e.keyword && e.keyword === m[1]);
      if (kw) return buildSearchUrl(kw.url, m[2]);
    }
    const r = resolveInput(text, this.searchEngine().url);
    return r && r.url;
  }

  newTabUrl() {
    const custom = this.settings.get('newTab.customUrl');
    if (custom) return custom;
    try {
      const o = this.extensions.api && this.extensions.api.getURLOverrides();
      if (o && o.newtab) return o.newtab;
    } catch (_) { /* ignore */ }
    return 'nimbus://newtab/';
  }

  homeUrl() { return this.settings.get('startup.homepage') || this.newTabUrl(); }
  startPageUrl() { return this.newTabUrl(); }

  openInternal(win, page, section) {
    win = win || this.lastNormalWindow();
    const url = `nimbus://${page}/` + (section ? '#' + section : '');
    const existing = win.tabs.find((t) => (t.state.url || '').startsWith(`nimbus://${page}/`));
    if (existing) {
      win.activate(existing);
      if (section && existing.wc) existing.wc.executeJavaScript(`location.hash=${JSON.stringify(section)}`).catch(() => {});
      return existing;
    }
    const active = win.activeTab;
    if (active && (active.state.url || '').startsWith('nimbus://newtab') && !active.state.loading) { active.load(url); return active; }
    return win.createTab({ url, active: true });
  }

  // ---------------------------------------------------------------- protection / permissions

  isProtectionEnabledFor(url) {
    if (!url || !/^https?:/.test(url)) return true;
    const list = this.settings.data.privacy.protectionExceptions || [];
    return !list.some((p) => matchesPattern(url, p));
  }

  toggleProtection(url) {
    const host = hostOf(url).replace(/^www\./, '');
    if (!host) return;
    const list = new Set(this.settings.get('privacy.protectionExceptions') || []);
    if (list.has(host)) list.delete(host); else list.add(host);
    this.settings.set('privacy.protectionExceptions', [...list]);
  }

  permissionDecision(origin, key) {
    const priv = this.privateDecisions.get(origin + '|' + key);
    if (priv) return priv;
    const p = this.settings.data.privacy;
    const site = p.sitePermissions[origin];
    if (site && site[key]) return site[key];
    return (p.permissionDefaults && p.permissionDefaults[key]) || 'ask';
  }

  setSitePermission(origin, key, value) {
    const all = this.settings.get('privacy.sitePermissions') || {};
    all[origin] = all[origin] || {};
    if (!value || value === 'default') delete all[origin][key]; else all[origin][key] = value;
    if (!Object.keys(all[origin]).length) delete all[origin];
    this.settings.set('privacy.sitePermissions', all);
  }

  newPromptId() { return crypto.randomBytes(6).toString('hex'); }

  /** Ask the user (in the tab's window) whether a site may use a permission. */
  askPermission(wc, req) {
    const tab = wc && this.tabsByWc.get(wc.id);
    const t = this.i18n.t;
    if (!tab) {
      const bw = wc && BrowserWindow.fromWebContents(wc);
      return dialog.showMessageBox(bw || undefined, {
        type: 'question', buttons: [t('perm.allow'), t('perm.block')], defaultId: 1, cancelId: 1,
        message: t('perm.prompt', { origin: req.origin, what: t('perm.' + req.key) })
      }).then((r) => r.response === 0);
    }
    return new Promise((resolve) => {
      const id = this.newPromptId();
      this.pending.set(id, (allow, remember) => {
        if (remember) {
          if (req.private) this.privateDecisions.set(req.origin + '|' + req.key, allow ? 'allow' : 'block');
          else this.setSitePermission(req.origin, req.key, allow ? 'allow' : 'block');
        }
        resolve(!!allow);
      });
      const mediaTypes = (req.details && req.details.mediaTypes) || [];
      if (!tab.isActive()) tab.win.activate(tab);
      tab.win.sendUi('permission-request', { id, tabId: tab.id, origin: req.origin, key: req.key, mediaTypes, extra: req.extra || '' });
    });
  }

  resolvePrompt(id, ...args) {
    const fn = this.pending.get(id);
    if (!fn) return false;
    this.pending.delete(id);
    fn(...args);
    return true;
  }

  openExternalWithPermission(tab, url) {
    const origin = originOf(tab.state.url) || 'nimbus://';
    const scheme = url.split(':')[0];
    const key = 'openExternal';
    const decision = this.permissionDecision(origin, key);
    if (decision === 'block') return;
    const go = () => shell.openExternal(url).catch(() => {});
    if (decision === 'allow') return go();
    this.askPermission(tab.wc, { origin, key, extra: scheme, private: tab.win.private }).then((ok) => { if (ok) go(); });
  }

  handleLogin(event, wc, details, authInfo, callback) {
    event.preventDefault();
    const tab = wc && this.tabsByWc.get(wc.id);
    if (!tab) { callback(); return; }
    const id = this.newPromptId();
    this.pending.set(id, (creds) => (creds ? callback(creds.username, creds.password) : callback()));
    tab.win.sendUi('auth-request', { id, host: authInfo.host, realm: authInfo.realm, isProxy: authInfo.isProxy, tabId: tab.id });
  }

  async pickDisplayMedia(request, callback) {
    const wc = request.frame && WebContents.fromFrame ? WebContents.fromFrame(request.frame) : null;
    const tab = wc && this.tabsByWc.get(wc.id);
    let sources = [];
    try { sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true }); } catch (err) { console.warn('[capture]', err.message); }
    if (!sources.length) { callback({}); return; }
    if (sources.length === 1 || !tab) { callback({ video: sources[0], audio: process.platform === 'win32' && request.audioRequested ? 'loopback' : undefined }); return; }
    const id = this.newPromptId();
    this.pending.set(id, (sourceId, withAudio) => {
      const src = sources.find((s) => s.id === sourceId);
      if (!src) { callback({}); return; }
      callback({ video: src, audio: withAudio && process.platform === 'win32' ? 'loopback' : undefined });
    });
    tab.win.sendUi('screen-picker', {
      id, audio: !!request.audioRequested && process.platform === 'win32', origin: originOf(request.securityOrigin || (wc && wc.getURL()) || ''),
      sources: sources.map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL(), icon: s.appIcon ? s.appIcon.toDataURL() : '', screen: s.id.startsWith('screen') }))
    });
  }

  // ---------------------------------------------------------------- settings reactions

  rebuildShortcuts() { this.shortcutMap = Accel.buildMap(this.settings.get('shortcuts')); }

  onSettingsChanged(p) {
    const all = (prefix) => !p || p === prefix || p.startsWith(prefix + '.') || prefix.startsWith(p + '.');
    if (all('shortcuts')) this.rebuildShortcuts();
    if (all('appearance')) {
      nativeTheme.themeSource = this.settings.get('appearance.mode') || 'system';
      for (const w of this.windows.values()) w.applyTheme();
    }
    if (all('privacy.userAgent')) {
      const ua = this.settings.get('privacy.userAgent') || defaultUserAgent();
      app.userAgentFallback = ua;
      for (const ses of this.allSessions()) ses.setUserAgent(ua);
    }
    if (all('privacy.doh') || all('privacy.dohServer')) applyDns(this.settings);
    if (all('privacy.adblockLevel') || all('privacy.customFilters')) this.adblock.load().then(() => this.broadcast('adblock', this.adblock.status()));
    if (all('performance.spellcheck') || all('performance.spellcheckLanguages')) {
      for (const ses of this.allSessions()) {
        ses.setSpellCheckerEnabled(!!this.settings.get('performance.spellcheck'));
        if (process.platform !== 'darwin') try { ses.setSpellCheckerLanguages(this.settings.get('performance.spellcheckLanguages').filter((l) => ses.availableSpellCheckerLanguages.includes(l))); } catch (_) { /* ignore */ }
      }
    }
    if (all('sites.zoom') === false && all('sites.defaultZoom')) for (const w of this.windows.values()) for (const t of w.tabs) t.applyZoom();
    if (all('language')) { this.i18n.reload(); this.broadcast('strings', { lang: this.i18n.lang, strings: this.i18n.dict() }); }
    if (all('privacy.protectionExceptions') || all('privacy.adblock')) for (const w of this.windows.values()) w.scheduleState();
    this.broadcastSoon('settings');
    this.saveSessionSoon();
  }

  allSessions() {
    const set = new Set([session.defaultSession]);
    for (const w of this.windows.values()) set.add(w.session);
    return [...set];
  }

  // ---------------------------------------------------------------- broadcasting

  broadcastSoon(name) {
    this._soon = this._soon || {};
    if (this._soon[name]) return;
    this._soon[name] = setTimeout(() => {
      this._soon[name] = null;
      const payload = name === 'settings' ? this.settings.all() : name === 'downloads' ? this.downloads.list() : null;
      this.broadcast(name, payload);
    }, 60);
  }

  broadcast(name, payload) {
    for (const w of this.windows.values()) w.sendUi('event', { name, payload });
    for (const tab of this.tabsByWc.values()) {
      const wc = tab.wc;
      if (wc && (wc.getURL() || '').startsWith('nimbus://')) wc.send('nimbus:event', name, payload);
    }
  }

  // ---------------------------------------------------------------- session save

  saveSessionSoon() {
    clearTimeout(this.sessionTimer);
    this.sessionTimer = setTimeout(() => this.saveSessionNow(), 1500);
  }

  saveSessionNow() {
    clearTimeout(this.sessionTimer);
    const windows = [...this.windows.values()].filter((w) => !w.private && !w.win.isDestroyed()).map((w) => w.serialize());
    if (!windows.length && !this.quitting) return; // keep last session when the final window closes
    this.sessionStore.data = { windows, saved: Date.now() };
    this.sessionStore.saveSync();
  }

  sleepInactiveTabs() {
    const minutes = Number(this.settings.get('tabs.sleepAfterMinutes')) || 0;
    if (!minutes) return;
    const limit = Date.now() - minutes * 60000;
    for (const w of this.windows.values()) {
      const visible = new Set(w.visibleTabs());
      for (const t of w.tabs) {
        if (visible.has(t) || t.state.sleeping || t.state.audible || t.lastActive > limit) continue;
        const url = t.state.url || '';
        if (url.startsWith('nimbus://')) continue;
        t.sleepWithPreview();
      }
    }
  }

  // ---------------------------------------------------------------- data management

  async clearBrowsingData(opts = {}) {
    const since = opts.range && opts.range !== 'all' ? Date.now() - Number(opts.range) * 3600000 : 0;
    if (opts.history) this.history.clear(since);
    if (opts.downloads) this.downloads.clear();
    for (const ses of this.allSessions()) {
      const storages = [];
      if (opts.cookies) storages.push('cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage', 'filesystem', 'shadercache');
      if (storages.length) await ses.clearStorageData({ storages }).catch(() => {});
      if (opts.cache) { await ses.clearCache().catch(() => {}); await ses.clearCodeCaches({}).catch(() => {}); }
      if (opts.cookies) await ses.clearAuthCache().catch(() => {});
    }
    if (opts.permissions) this.settings.set('privacy.sitePermissions', {});
    return true;
  }

  async clearSiteData(origin) {
    for (const ses of this.allSessions()) await ses.clearStorageData({ origin }).catch(() => {});
  }

  async clearOnExit() {
    const c = this.settings.get('privacy.clearOnExit') || {};
    if (c.history || c.cookies || c.cache || c.downloads) await this.clearBrowsingData({ history: c.history, cookies: c.cookies, cache: c.cache, downloads: c.downloads, range: 'all' });
  }

  flushAll() {
    this.settings.flush();
    this.bookmarks.store.flush();
    this.history.flush();
    this.downloads.flush();
  }

  async setDefaultBrowser() {
    if (process.platform === 'linux') {
      const desktop = process.env.APPIMAGE ? 'nimbus.desktop' : 'nimbus.desktop';
      return new Promise((resolve) => execFile('xdg-settings', ['set', 'default-web-browser', desktop], (err) => resolve(!err)));
    }
    app.setAsDefaultProtocolClient('http');
    app.setAsDefaultProtocolClient('https');
    if (process.platform === 'win32') shell.openExternal('ms-settings:defaultapps');
    return true;
  }

  isDefaultBrowser() {
    try { return app.isDefaultProtocolClient('https'); } catch (_) { return false; }
  }

  /** Restore appearance + layout defaults (reachable from the menu even if pages don't render). */
  async resetDesign(win) {
    const t = this.i18n.t;
    const r = await dialog.showMessageBox(win && win.win, {
      type: 'question', buttons: [t('reset.designConfirm'), t('dialog.cancel')], defaultId: 0, cancelId: 1,
      message: t('reset.designTitle'), detail: t('reset.designDetail')
    });
    if (r.response !== 0) return false;
    this.settings.reset('appearance');
    this.settings.reset('layout');
    return true;
  }

  showTaskManager(win) {
    const t = this.i18n.t;
    const metrics = app.getAppMetrics();
    const byPid = new Map(metrics.map((m) => [m.pid, m]));
    const lines = [];
    let total = 0;
    for (const m of metrics) total += m.memory.workingSetSize;
    for (const w of this.windows.values()) {
      for (const tab of w.tabs) {
        if (!tab.wc) { lines.push(`💤 ${tab.state.title || tab.state.url}`); continue; }
        const m = byPid.get(tab.wc.getOSProcessId());
        const mb = m ? Math.round(m.memory.workingSetSize / 1024) : 0;
        const cpu = m ? m.cpu.percentCPUUsage.toFixed(1) : '0';
        lines.push(`${String(mb).padStart(5)} MB  ${cpu.padStart(5)} %  ${(tab.state.title || tab.state.url).slice(0, 60)}`);
      }
    }
    dialog.showMessageBox(win.win, {
      type: 'info', title: t('menu.taskManager'), message: t('task.total', { mb: Math.round(total / 1024), count: metrics.length }),
      detail: lines.join('\n') + '\n\n' + t('task.hint'), buttons: [t('task.sleepAll'), t('dialog.ok')], defaultId: 1
    }).then((r) => {
      if (r.response === 0) for (const w of this.windows.values()) for (const tab of w.tabs) if (!w.visibleTabs().includes(tab)) tab.sleep();
    });
  }

  // ---------------------------------------------------------------- suggestions

  async suggest(text) {
    const s = this.settings.get('search');
    const q = String(text || '').trim();
    if (!q) return [];
    const out = [];
    const seen = new Set();
    const push = (item) => { if (!seen.has(item.url)) { seen.add(item.url); out.push(item); } };
    const resolved = this.resolve(q);
    const isUrl = resolved && !resolved.startsWith(buildSearchUrl(this.searchEngine().url, '').split('?')[0]);
    if (isUrl && !/\s/.test(q)) push({ type: 'url', title: q, url: resolved });
    if (s.bookmarkSuggestions) for (const b of this.bookmarks.search(q, 3)) push({ type: 'bookmark', title: b.title, url: b.url });
    if (s.historySuggestions) for (const h of this.history.suggest(q, 5)) push({ type: 'history', title: h.title, url: h.url });
    // open tabs
    for (const w of this.windows.values()) for (const tab of w.tabs) {
      const st = tab.state;
      if (st.url && !st.url.startsWith('nimbus:') && ((st.title || '').toLowerCase().includes(q.toLowerCase()) || st.url.toLowerCase().includes(q.toLowerCase())) && out.filter((o) => o.type === 'tab').length < 2) {
        out.push({ type: 'tab', title: st.title, url: st.url, tabId: tab.id, windowId: w.id });
      }
    }
    const engine = this.searchEngine();
    push({ type: 'search', title: q, url: buildSearchUrl(engine.url, q), engine: engine.name });
    if (s.suggestions && engine.suggest && q.length > 1 && !q.startsWith('nimbus:')) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1200);
        const res = await net.fetch(buildSearchUrl(engine.suggest, q), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        clearTimeout(timer);
        const data = await res.json();
        const list = Array.isArray(data) ? (Array.isArray(data[1]) ? data[1] : data.map((d) => d.phrase || d)) : [];
        for (const phrase of list.slice(0, 5)) if (typeof phrase === 'string' && phrase !== q) push({ type: 'search', title: phrase, url: buildSearchUrl(engine.url, phrase), engine: engine.name });
      } catch (_) { /* offline or timeout */ }
    }
    return out.slice(0, 12);
  }

  // ---------------------------------------------------------------- import / export

  async exportSettings(win) {
    const t = this.i18n.t;
    const r = await dialog.showSaveDialog(win && win.win, { defaultPath: path.join(app.getPath('documents'), 'nimbus-einstellungen.json'), filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return false;
    const data = { format: 'nimbus-backup', version: 1, exported: new Date().toISOString(), settings: this.settings.all(), bookmarks: this.bookmarks.tree };
    fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2));
    return t('io.exported');
  }

  async importSettings(win) {
    const r = await dialog.showOpenDialog(win && win.win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return false;
    const data = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
    if (data.format !== 'nimbus-backup' || !data.settings) throw new Error('invalid-backup');
    this.settings.replaceAll(data.settings);
    if (data.bookmarks && data.bookmarks.bar) this.bookmarks.replaceTree(data.bookmarks);
    return true;
  }

  async importBookmarks(win) {
    const t = this.i18n.t;
    const r = await dialog.showOpenDialog(win && win.win, { properties: ['openFile'], filters: [{ name: t('bm.fileTypes'), extensions: ['html', 'htm', 'json'] }] });
    if (r.canceled || !r.filePaths[0]) return 0;
    const text = fs.readFileSync(r.filePaths[0], 'utf8');
    let nodes;
    if (r.filePaths[0].endsWith('.json')) {
      const data = JSON.parse(text);
      // Chrome "Bookmarks" file or Nimbus backup
      const tree = data.bookmarks && data.bookmarks.bar ? data.bookmarks : null;
      if (tree) nodes = [...tree.bar.children, ...tree.other.children];
      else if (data.roots) {
        const conv = (n) => (n.type === 'folder' ? { type: 'folder', title: n.name, children: (n.children || []).map(conv) } : { type: 'bookmark', title: n.name, url: n.url });
        nodes = Object.values(data.roots).filter((x) => x && x.children).map(conv);
      } else throw new Error('invalid-bookmarks');
    } else nodes = BookmarksHtml.parse(text);
    const count = JSON.stringify(nodes).split('"url"').length - 1;
    this.bookmarks.importNodes(nodes, t('bm.imported', { date: new Date().toLocaleDateString(this.i18n.lang) }));
    return count;
  }

  async exportBookmarks(win) {
    const t = this.i18n.t;
    const r = await dialog.showSaveDialog(win && win.win, { defaultPath: path.join(app.getPath('documents'), 'nimbus-lesezeichen.html'), filters: [{ name: 'HTML', extensions: ['html'] }] });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, BookmarksHtml.serialize(this.bookmarks.tree, { bar: t('bm.bar'), other: t('bm.other') }));
    return true;
  }

  async pickBackgroundImage(win) {
    const r = await dialog.showOpenDialog(win && win.win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const ext = path.extname(r.filePaths[0]).toLowerCase();
    const dest = path.join(app.getPath('userData'), 'newtab-background' + ext);
    for (const f of fs.readdirSync(app.getPath('userData'))) if (f.startsWith('newtab-background')) fs.unlinkSync(path.join(app.getPath('userData'), f));
    fs.copyFileSync(r.filePaths[0], dest);
    const url = 'nimbus://newtab/user-background?v=' + Date.now();
    this.settings.set('newTab.image', url);
    this.settings.set('newTab.background', 'image');
    return url;
  }
}

module.exports = { Browser };
