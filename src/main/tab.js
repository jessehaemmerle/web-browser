'use strict';
const { WebContentsView, dialog, shell } = require('electron');
const { PAGES_PRELOAD } = require('./paths');
const { hostOf } = require('../shared/url');

let nextTabId = 1;

/**
 * One browser tab. Owns a WebContentsView while awake. Sleeping tabs keep only
 * their state and navigation history and are recreated on activation.
 */
class Tab {
  constructor(win, opts = {}) {
    this.win = win;
    this.browser = win.browser;
    this.id = nextTabId++;
    this.view = null;
    this.lastActive = Date.now();
    this.state = {
      title: opts.title || '',
      url: opts.url || '',
      favicon: opts.favicon || '',
      loading: false,
      audible: false,
      muted: false,
      pinned: !!opts.pinned,
      groupId: opts.groupId || null,
      canGoBack: false,
      canGoForward: false,
      zoom: 1,
      blocked: 0,
      sleeping: false,
      crashed: false,
      displayUrl: null,     // shown instead of the real URL (error pages)
      secure: null
    };
    this.savedHistory = opts.history || null; // { entries, index }
    if (opts.sleeping) {
      this.state.sleeping = true;
    } else {
      this.createView(opts.webContentsOptions);
      if (!opts.webContentsOptions) this.loadInitial(opts.url);
    }
  }

  get wc() { return this.view && !this.view.webContents.isDestroyed() ? this.view.webContents : null; }

  createView(webContentsOptions) {
    const perf = this.browser.settings.get('performance');
    const webPreferences = {
      session: this.win.session,
      preload: PAGES_PRELOAD,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: perf.spellcheck,
      scrollBounce: false,
      safeDialogs: true,
      navigateOnDragDrop: true,
      backgroundThrottling: true
    };
    const opts = webContentsOptions
      ? Object.assign({}, webContentsOptions, { webPreferences: Object.assign({}, webContentsOptions.webPreferences, webPreferences) })
      : { webPreferences };
    this.view = new WebContentsView(opts);
    this.view.setBackgroundColor('#ffffff');
    this.view.setVisible(false);
    this.state.sleeping = false;
    this.bindEvents(this.view.webContents);
    this.browser.registerTab(this);
    return this.view;
  }

  loadInitial(url) {
    if (this.savedHistory && this.savedHistory.entries && this.savedHistory.entries.length) {
      const { entries, index } = this.savedHistory;
      this.savedHistory = null;
      try {
        this.wc.navigationHistory.restore({ entries, index: Math.min(index, entries.length - 1) });
        return;
      } catch (err) {
        console.warn('[tab] history restore failed', err.message);
      }
    }
    this.load(url || this.browser.newTabUrl());
  }

  load(url) {
    if (!url) return;
    if (this.state.sleeping) { this.state.url = url; this.wake(); return; }
    this.state.url = url;
    this.state.displayUrl = null;
    this.wc.loadURL(url).catch(() => { /* handled by did-fail-load */ });
    this.changed();
  }

  bindEvents(wc) {
    const b = this.browser;
    wc.setWindowOpenHandler((details) => this.win.handleWindowOpen(this, details));

    wc.on('did-start-loading', () => { this.state.loading = true; this.state.crashed = false; this.changed(); });
    wc.on('did-stop-loading', () => { this.state.loading = false; this.updateNav(); this.changed(); });
    wc.on('page-title-updated', (_e, title) => {
      this.state.title = title;
      if (!this.win.private) b.history.updateTitle(wc.getURL(), title);
      this.changed();
    });
    wc.on('page-favicon-updated', (_e, favicons) => { this.state.favicon = favicons && favicons[0] || ''; this.changed(); });
    wc.on('did-navigate', (_e, url, code) => {
      const prevHost = hostOf(this.state.url);
      this.state.url = url;
      if (!url.startsWith('nimbus://error')) this.state.displayUrl = null;
      this.state.blocked = 0;
      this.state.secure = url.startsWith('https:') ? true : url.startsWith('http:') ? false : null;
      if (hostOf(url) !== prevHost) this.state.favicon = '';
      this.applyZoom();
      this.recordVisit(url, code);
      this.updateNav();
      this.changed();
      b.siteScripts.onNavigate(this);
    });
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (!isMainFrame) return;
      this.state.url = url;
      this.recordVisit(url, 200);
      this.updateNav();
      this.changed();
    });
    wc.on('dom-ready', () => b.siteScripts.onDomReady(this));
    wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 /* ABORTED */ || code === 0) return;
      this.showError(url, code, desc);
    });
    wc.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit') return;
      this.state.crashed = true;
      this.state.loading = false;
      this.changed();
      if (!wc.isDestroyed()) this.showError(this.state.url, 'crash', details.reason);
    });
    wc.on('unresponsive', async () => {
      const t = b.i18n.t;
      const r = await dialog.showMessageBox({ type: 'warning', buttons: [t('dialog.wait'), t('dialog.killPage')], defaultId: 0, message: t('dialog.unresponsive', { title: this.state.title || this.state.url }) });
      if (r.response === 1 && !wc.isDestroyed()) wc.forcefullyCrashRenderer();
    });
    wc.on('audio-state-changed', () => { this.state.audible = wc.isCurrentlyAudible(); this.changed(); });
    wc.on('found-in-page', (_e, result) => this.win.sendUi('find-result', { tabId: this.id, ...result }));
    wc.on('context-menu', (_e, params) => b.contextMenu.show(this, params));
    wc.on('before-input-event', (e, input) => this.win.handleInput(e, input, this));
    wc.on('enter-html-full-screen', () => this.win.setHtmlFullscreen(true));
    wc.on('leave-html-full-screen', () => this.win.setHtmlFullscreen(false));
    wc.on('zoom-changed', (_e, dir) => this.zoom(dir === 'in' ? 1 : -1));
    wc.on('update-target-url', (_e, url) => { if (this.isActive()) this.win.setStatus(url); });
    wc.on('focus', () => this.win.onTabFocus(this));
    wc.on('will-prevent-unload', (e) => {
      const t = b.i18n.t;
      const choice = dialog.showMessageBoxSync(this.win.win, { type: 'question', buttons: [t('dialog.leave'), t('dialog.stay')], defaultId: 0, cancelId: 1, message: t('dialog.leavePage'), detail: t('dialog.leavePageDetail') });
      if (choice === 0) e.preventDefault();
    });
    // Open external protocols (mailto:, tel:, zoommtg: …) via the OS after confirmation
    wc.on('will-navigate', (e, url) => {
      if (/^(https?|file|nimbus|about|data|blob|chrome-extension|view-source):/i.test(url)) return;
      e.preventDefault();
      b.openExternalWithPermission(this, url);
    });
    wc.on('devtools-open-url', (_e, url) => this.win.createTab({ url, active: true, opener: this }));
  }

  recordVisit(url, code) {
    if (this.win.private || !this.browser.settings.get('privacy.saveHistory')) return;
    if (code && code >= 400) return;
    this.browser.history.addVisit(url, this.state.title);
  }

  updateNav() {
    const wc = this.wc;
    if (!wc) return;
    this.state.canGoBack = wc.navigationHistory.canGoBack();
    this.state.canGoForward = wc.navigationHistory.canGoForward();
  }

  showError(url, code, desc) {
    const q = new URLSearchParams({ url: url || '', code: String(code), desc: desc || '' });
    this.state.displayUrl = url;
    this.state.loading = false;
    this.changed();
    if (this.wc) this.wc.loadURL('nimbus://error/?' + q.toString()).catch(() => {});
  }

  applyZoom() {
    const wc = this.wc;
    if (!wc) return;
    const sites = this.browser.settings.get('sites');
    const host = hostOf(wc.getURL());
    const z = (host && sites.zoom[host]) || sites.defaultZoom || 1;
    wc.setZoomFactor(z);
    this.state.zoom = z;
  }

  zoom(step) {
    const wc = this.wc;
    if (!wc) return;
    const LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
    const cur = wc.getZoomFactor();
    let z;
    if (step === 0) z = this.browser.settings.get('sites.defaultZoom') || 1;
    else if (step > 0) z = LEVELS.find((l) => l > cur + 0.001) || LEVELS[LEVELS.length - 1];
    else z = [...LEVELS].reverse().find((l) => l < cur - 0.001) || LEVELS[0];
    wc.setZoomFactor(z);
    this.state.zoom = z;
    const host = hostOf(wc.getURL());
    if (host) {
      const zooms = this.browser.settings.get('sites.zoom') || {};
      const def = this.browser.settings.get('sites.defaultZoom') || 1;
      if (Math.abs(z - def) < 0.001) delete zooms[host]; else zooms[host] = z;
      this.browser.settings.set('sites.zoom', zooms);
    }
    this.changed();
  }

  isActive() { return this.win.activeTab === this; }

  /** Put tab to sleep to free memory. */
  sleep() {
    const wc = this.wc;
    if (!wc || this.state.audible || this.state.sleeping) return false;
    try {
      const entries = wc.navigationHistory.getAllEntries();
      this.savedHistory = { entries, index: wc.navigationHistory.getActiveIndex() };
    } catch (_) { this.savedHistory = null; }
    this.destroyView();
    this.state.sleeping = true;
    this.state.loading = false;
    this.changed();
    return true;
  }

  wake() {
    if (!this.state.sleeping) return;
    this.createView();
    this.loadInitial(this.state.url);
    this.win.attachTabView(this);
    this.changed();
  }

  destroyView() {
    if (!this.view) return;
    const view = this.view;
    this.browser.unregisterTab(this);
    try { this.win.win.contentView.removeChildView(view); } catch (_) { /* window gone */ }
    if (!view.webContents.isDestroyed()) view.webContents.close();
    this.view = null;
  }

  destroy() {
    this.destroyView();
  }

  changed() { this.win.scheduleState(); }

  serialize() {
    let history = this.savedHistory;
    const wc = this.wc;
    if (wc) {
      try {
        const entries = wc.navigationHistory.getAllEntries();
        const index = wc.navigationHistory.getActiveIndex();
        // keep the last 15 entries to keep the session file small
        const start = Math.max(0, entries.length - 15);
        history = { entries: entries.slice(start).map((e) => ({ url: e.url, title: e.title })), index: index - start };
      } catch (_) { /* ignore */ }
    }
    const url = this.state.displayUrl || this.state.url;
    return { url, title: this.state.title, favicon: this.state.favicon, pinned: this.state.pinned, groupId: this.state.groupId, history: url && url.startsWith('nimbus://error') ? null : history };
  }

  info() {
    const s = this.state;
    return {
      id: this.id, title: s.title, url: s.displayUrl || s.url, favicon: s.favicon, loading: s.loading,
      audible: s.audible, muted: s.muted, pinned: s.pinned, groupId: s.groupId, canGoBack: s.canGoBack,
      canGoForward: s.canGoForward, zoom: s.zoom, blocked: s.blocked, sleeping: s.sleeping, crashed: s.crashed,
      secure: s.secure, bookmarked: this.browser.bookmarks.isBookmarked(s.url),
      protection: this.browser.isProtectionEnabledFor(s.url)
    };
  }

  setMuted(m) {
    this.state.muted = !!m;
    if (this.wc) this.wc.setAudioMuted(this.state.muted);
    this.changed();
  }

  openExternal(url) { shell.openExternal(url); }
}

module.exports = { Tab };
