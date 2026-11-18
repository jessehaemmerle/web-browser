'use strict';
const { BaseWindow, WebContentsView, BrowserWindow, Menu, dialog, nativeTheme, screen, session: electronSession } = require('electron');
const crypto = require('crypto');
const { Tab } = require('./tab');
const { UI_HTML, STATUS_HTML, UI_PRELOAD, PAGES_PRELOAD, ICON } = require('./paths');
const Theme = require('../shared/theme');
const Accel = require('../shared/accel');

let privateCounter = 0;
const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

class NimbusWindow {
  constructor(browser, opts = {}) {
    this.browser = browser;
    this.private = !!opts.private;
    this.id = null;
    this.tabs = [];
    this.groups = new Map();
    this.activeTab = null;
    this.split = null;              // { a: tabId, b: tabId, ratio }
    this.rects = [];                // viewport rectangles reported by the UI
    this.overlay = false;
    this.htmlFullscreen = false;
    this.closedTabs = [];
    this.closing = false;
    this.session = this.private
      ? electronSession.fromPartition(`nimbus-private-${++privateCounter}`)
      : electronSession.defaultSession;
    if (this.private) browser.setupSession(this.session, { private: true });

    const s = browser.settings;
    const theme = this.theme();
    const bounds = opts.bounds || this.defaultBounds();
    const winOpts = {
      ...bounds,
      minWidth: 400,
      minHeight: 280,
      show: false,
      title: 'Nimbus',
      icon: ICON,
      backgroundColor: theme.palette.frame
    };
    this.integratedTitlebar = s.get('layout.titlebar') === 'integrated';
    if (this.integratedTitlebar) {
      winOpts.titleBarStyle = 'hidden';
      winOpts.titleBarOverlay = this.titleBarOverlay(theme);
    }
    this.win = new BaseWindow(winOpts);
    this.id = this.win.id;
    if (opts.maximized) this.win.maximize();

    this.ui = new WebContentsView({
      webPreferences: {
        preload: UI_PRELOAD,
        sandbox: false,               // needs require() for the extension action bar
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true,
        backgroundThrottling: false,
        session: electronSession.defaultSession
      }
    });
    this.ui.setBackgroundColor('#00000000');
    this.win.contentView.addChildView(this.ui);
    this.ui.webContents.loadFile(UI_HTML, { query: { window: String(this.id), private: this.private ? '1' : '0' } });
    this.ui.webContents.on('before-input-event', (e, input) => this.handleInput(e, input, null));
    this.ui.webContents.on('context-menu', (_e, params) => {
      if (params.isEditable) browser.contextMenu.showEditable(this.ui.webContents, params);
    });
    this.ui.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.ui.webContents.on('will-navigate', (e) => e.preventDefault());
    this.uiReady = new Promise((resolve) => this.ui.webContents.once('did-finish-load', resolve));

    this.status = null;
    this.layoutUi();
    this.win.on('resize', () => this.layoutUi());
    this.win.on('maximize', () => this.sendUi('window-state', this.windowState()));
    this.win.on('unmaximize', () => this.sendUi('window-state', this.windowState()));
    this.win.on('enter-full-screen', () => this.sendUi('window-state', this.windowState()));
    this.win.on('leave-full-screen', () => { this.htmlFullscreen = false; this.sendUi('window-state', this.windowState()); });
    this.win.on('focus', () => { browser.lastFocused = this; this.sendUi('window-state', this.windowState()); if (this.activeTab) browser.extensions.selectTab(this.activeTab); });
    this.win.on('blur', () => this.sendUi('window-state', this.windowState()));
    this.win.on('close', (e) => this.onClose(e));
    this.win.on('closed', () => this.onClosed());

    // initial tabs
    const tabs = opts.noInitialTab ? [] : opts.tabs && opts.tabs.length ? opts.tabs : [{ url: opts.url || browser.startPageUrl() }];
    if (opts.groups) for (const g of opts.groups) this.groups.set(g.id, g);
    const activeIndex = Math.min(opts.activeIndex || 0, tabs.length - 1);
    const created = tabs.map((t, i) => this.createTab({ ...t, active: false, noActivate: true, sleeping: opts.restore && i !== activeIndex, index: i, noState: true }));
    if (created[activeIndex]) this.activate(created[activeIndex]);
    this.uiReady.then(() => {
      this.sendState();
      this.win.show();
      if (!this.activeTab || !this.activeTab.state.url || this.activeTab.state.url.startsWith('nimbus://newtab')) this.sendUi('focus-address');
    });
    browser.lastFocused = this;
  }

  defaultBounds() {
    const { workArea } = screen.getPrimaryDisplay();
    const width = Math.min(1360, Math.round(workArea.width * 0.85));
    const height = Math.min(900, Math.round(workArea.height * 0.88));
    const last = this.browser.lastFocused;
    if (last && !last.win.isDestroyed()) {
      const b = last.win.getBounds();
      return { x: b.x + 28, y: b.y + 28, width: b.width, height: b.height };
    }
    return { width, height, x: workArea.x + Math.round((workArea.width - width) / 2), y: workArea.y + Math.round((workArea.height - height) / 2) };
  }

  theme() {
    return Theme.compute(this.browser.settings.get('appearance'), nativeTheme.shouldUseDarkColors);
  }

  titleBarOverlay(theme) {
    const d = Theme.DENSITY[this.browser.settings.get('appearance.density')] || Theme.DENSITY.comfortable;
    const compactTop = this.browser.settings.get('layout.tabPosition') === 'top';
    return { color: compactTop ? theme.palette.frame : theme.palette.toolbar, symbolColor: theme.palette.text, height: compactTop ? d.tabH + 6 : d.toolbarH };
  }

  applyTheme() {
    const theme = this.theme();
    this.win.setBackgroundColor(theme.palette.frame);
    if (this.integratedTitlebar) {
      try { this.win.setTitleBarOverlay(this.titleBarOverlay(theme)); } catch (_) { /* unsupported platform */ }
    }
  }

  windowState() {
    return {
      maximized: this.win.isMaximized(),
      fullscreen: this.win.isFullScreen(),
      htmlFullscreen: this.htmlFullscreen,
      focused: this.win.isFocused(),
      integratedTitlebar: this.integratedTitlebar,
      platform: process.platform
    };
  }

  // ---------------------------------------------------------------- layout

  layoutUi() {
    if (this.win.isDestroyed()) return;
    const { width, height } = this.win.getContentBounds();
    this.ui.setBounds({ x: 0, y: 0, width, height });
  }

  setRects(rects) {
    this.rects = Array.isArray(rects) ? rects.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.max(0, Math.round(r.width)), height: Math.max(0, Math.round(r.height)) })) : [];
    this.layoutTabs();
  }

  visibleTabs() {
    const a = this.activeTab;
    if (!a) return [];
    if (this.split) {
      const ta = this.tabById(this.split.a), tb = this.tabById(this.split.b);
      if (ta && tb && (a === ta || a === tb)) return [ta, tb];
    }
    return [a];
  }

  layoutTabs() {
    if (this.win.isDestroyed()) return;
    const visible = this.visibleTabs();
    for (const t of this.tabs) {
      if (!t.view) continue;
      const i = visible.indexOf(t);
      if (i >= 0 && this.rects[i]) {
        t.view.setBounds(this.rects[i]);
        t.view.setVisible(true);
      } else {
        t.view.setVisible(false);
      }
    }
    this.updateStatusBounds();
  }

  attachTabView(tab) {
    if (!tab.view || this.win.isDestroyed()) return;
    this.win.contentView.addChildView(tab.view);
    if (this.overlay) this.win.contentView.addChildView(this.ui); // keep UI on top
    if (tab.state.muted) tab.wc.setAudioMuted(true);
    this.layoutTabs();
  }

  /** Bring the (transparent) UI above the pages so popups/menus can draw over the content. */
  setOverlay(on) {
    on = !!on;
    if (this.overlay === on || this.win.isDestroyed()) return;
    this.overlay = on;
    const cv = this.win.contentView;
    if (on) {
      cv.addChildView(this.ui);
    } else {
      cv.addChildView(this.ui, 0);
    }
  }

  setHtmlFullscreen(on) {
    this.htmlFullscreen = on;
    if (on !== this.win.isFullScreen()) this.win.setFullScreen(on);
    this.sendUi('window-state', this.windowState());
  }

  // status bubble (link target on hover) – a tiny view drawn above the page
  setStatus(url) {
    if (!this.browser.settings.get('layout.showStatusUrl')) url = '';
    this.statusText = url || '';
    if (!url) {
      if (this.status) this.status.setVisible(false);
      return;
    }
    if (!this.status) {
      this.status = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, preload: undefined } });
      this.status.setBackgroundColor('#00000000');
      this.status.webContents.loadFile(STATUS_HTML);
      this.win.contentView.addChildView(this.status);
      this.statusReady = new Promise((r) => this.status.webContents.once('did-finish-load', r));
    } else {
      this.win.contentView.addChildView(this.status); // keep on top
    }
    const theme = this.theme();
    const text = url.length > 160 ? url.slice(0, 157) + '…' : url;
    this.statusReady.then(() => {
      if (!this.status || this.status.webContents.isDestroyed()) return;
      this.status.webContents.executeJavaScript(`window.setStatus(${JSON.stringify(text)}, ${JSON.stringify(theme.palette)}, ${JSON.stringify(theme.vars['--n-font'])})`).catch(() => {});
      this.statusWidth = Math.min(Math.round(text.length * 6.6) + 26, 640);
      this.updateStatusBounds();
      this.status.setVisible(true);
    });
  }

  updateStatusBounds() {
    if (!this.status || !this.rects[0]) return;
    const r = this.rects[0];
    const w = Math.min(this.statusWidth || 200, Math.max(120, r.width - 20));
    this.status.setBounds({ x: r.x, y: r.y + r.height - 26, width: w, height: 26 });
  }

  // ---------------------------------------------------------------- tabs

  tabById(id) { return this.tabs.find((t) => t.id === id) || null; }

  createTab(opts = {}) {
    const tab = new Tab(this, opts);
    let index = opts.index;
    if (!Number.isInteger(index)) {
      const pos = this.browser.settings.get('layout.newTabPosition');
      if (opts.opener && pos === 'afterCurrent') {
        // place after the opener and its previously opened children
        let i = this.tabs.indexOf(opts.opener);
        while (i + 1 < this.tabs.length && this.tabs[i + 1].openerId === opts.opener.id) i++;
        index = i + 1;
      } else if (pos === 'afterCurrent' && this.activeTab && !opts.atEnd) {
        index = this.tabs.indexOf(this.activeTab) + 1;
      } else {
        index = this.tabs.length;
      }
    }
    if (opts.opener) {
      tab.openerId = opts.opener.id;
      if (opts.opener.state.groupId && !opts.groupId) tab.state.groupId = opts.opener.state.groupId;
    }
    // pinned tabs stay at the front
    const pinnedCount = this.tabs.filter((t) => t.state.pinned).length;
    if (!tab.state.pinned) index = Math.max(index, pinnedCount);
    this.tabs.splice(Math.min(index, this.tabs.length), 0, tab);
    if (tab.view) this.attachTabView(tab);
    if (!this.private && tab.wc) this.browser.extensions.addTab(tab, this);
    if (opts.active || (!this.activeTab && !opts.noActivate)) this.activate(tab);
    if (!opts.noState) this.scheduleState();
    return tab;
  }

  activate(tab) {
    if (!tab || tab.win !== this) return;
    const prev = this.activeTab;
    this.activeTab = tab;
    tab.lastActive = Date.now();
    if (tab.state.sleeping) tab.wake();
    if (prev && prev !== tab && prev.wc) prev.wc.stopFindInPage('clearSelection');
    this.layoutTabs();
    if (tab.wc && !this.overlay) {
      const url = tab.state.url;
      if (url && !url.startsWith('nimbus://newtab')) tab.wc.focus();
    }
    if (!this.private) this.browser.extensions.selectTab(tab);
    this.setStatus('');
    this.scheduleState();
    this.sendUi('tab-activated', { id: tab.id });
    this.browser.saveSessionSoon();
  }

  onTabFocus(tab) {
    // in split view, focusing one pane makes it the active tab
    if (this.split && tab !== this.activeTab && this.visibleTabs().includes(tab)) {
      this.activeTab = tab;
      this.scheduleState();
    }
  }

  closeTab(tab, { remember = true } = {}) {
    if (!tab || !this.tabs.includes(tab)) return;
    const i = this.tabs.indexOf(tab);
    if (remember && tab.state.url && !this.private) {
      this.closedTabs.push({ ...tab.serialize(), index: i });
      const limit = this.browser.settings.get('tabs.closedTabsLimit') || 25;
      while (this.closedTabs.length > limit) this.closedTabs.shift();
    }
    if (this.split && (this.split.a === tab.id || this.split.b === tab.id)) this.split = null;
    this.tabs.splice(i, 1);
    if (this.activeTab === tab) {
      this.activeTab = null;
      // prefer: tab opened from it, the tab to the right, then left
      const next = this.tabs.find((t) => t.openerId === tab.id) || this.tabs[i] || this.tabs[i - 1];
      if (next) this.activate(next);
    }
    tab.destroy();
    this.cleanupGroups();
    if (!this.tabs.length) {
      this.win.close();
      return;
    }
    this.scheduleState();
    this.browser.saveSessionSoon();
  }

  /** Detach a tab (without destroying its page) so it can move to another window. */
  detachTab(tab) {
    const i = this.tabs.indexOf(tab);
    if (i < 0) return null;
    if (this.split && (this.split.a === tab.id || this.split.b === tab.id)) this.split = null;
    this.tabs.splice(i, 1);
    if (tab.view) {
      try { this.win.contentView.removeChildView(tab.view); } catch (_) { /* ignore */ }
    }
    if (this.activeTab === tab) {
      this.activeTab = null;
      const next = this.tabs[i] || this.tabs[i - 1];
      if (next) this.activate(next);
    }
    this.cleanupGroups();
    if (!this.tabs.length) this.win.close(); else this.scheduleState();
    return tab;
  }

  adoptTab(tab, index) {
    tab.win = this;
    tab.state.groupId = null;
    this.tabs.splice(Number.isInteger(index) ? index : this.tabs.length, 0, tab);
    if (tab.view) this.attachTabView(tab);
    if (tab.wc) this.browser.extensions.addTab(tab, this);
    this.activate(tab);
  }

  moveTabToNewWindow(tab, point) {
    if (this.tabs.length < 2) return;
    if (this.private) return;
    const bounds = this.win.getBounds();
    if (point) { bounds.x = point.x - 120; bounds.y = point.y - 20; }
    this.detachTab(tab);
    const w = this.browser.createWindow({ adopt: tab, bounds });
    return w;
  }

  moveTab(tabId, toIndex, groupId) {
    const tab = this.tabById(tabId);
    if (!tab) return;
    const from = this.tabs.indexOf(tab);
    this.tabs.splice(from, 1);
    toIndex = Math.max(0, Math.min(toIndex, this.tabs.length));
    const pinnedCount = this.tabs.filter((t) => t.state.pinned).length;
    if (tab.state.pinned) toIndex = Math.min(toIndex, pinnedCount);
    else toIndex = Math.max(toIndex, pinnedCount);
    this.tabs.splice(toIndex, 0, tab);
    if (groupId !== undefined) tab.state.groupId = groupId && this.groups.has(groupId) ? groupId : null;
    this.cleanupGroups();
    this.scheduleState();
    this.browser.saveSessionSoon();
  }

  reopenClosedTab() {
    const t = this.closedTabs.pop();
    if (!t) return;
    this.createTab({ ...t, groupId: this.groups.has(t.groupId) ? t.groupId : null, active: true, index: t.index });
  }

  duplicateTab(tab) {
    const data = tab.serialize();
    this.createTab({ ...data, active: true, opener: tab, index: this.tabs.indexOf(tab) + 1 });
  }

  setPinned(tab, pinned) {
    tab.state.pinned = !!pinned;
    if (pinned) tab.state.groupId = null;
    const pinnedCount = this.tabs.filter((t) => t.state.pinned && t !== tab).length;
    this.tabs.splice(this.tabs.indexOf(tab), 1);
    this.tabs.splice(pinned ? pinnedCount : pinnedCount, 0, tab);
    this.cleanupGroups();
    this.scheduleState();
    this.browser.saveSessionSoon();
  }

  closeOtherTabs(tab) { for (const t of [...this.tabs]) if (t !== tab && !t.state.pinned) this.closeTab(t); }
  closeTabsToRight(tab) { const i = this.tabs.indexOf(tab); for (const t of this.tabs.slice(i + 1)) this.closeTab(t); }

  // ---------------------------------------------------------------- groups

  createGroup(tabIds, title = '', color) {
    const id = crypto.randomBytes(4).toString('hex');
    const used = new Set([...this.groups.values()].map((g) => g.color));
    color = color || GROUP_COLORS.find((c) => !used.has(c)) || GROUP_COLORS[this.groups.size % GROUP_COLORS.length];
    this.groups.set(id, { id, title, color, collapsed: false });
    this.addToGroup(tabIds, id);
    return id;
  }

  addToGroup(tabIds, groupId) {
    const group = this.groups.get(groupId);
    if (!group) return;
    for (const tid of [].concat(tabIds)) {
      const tab = this.tabById(tid);
      if (!tab || tab.state.pinned) continue;
      tab.state.groupId = groupId;
      // keep group contiguous: move tab after the last member
      const members = this.tabs.filter((t) => t.state.groupId === groupId && t !== tab);
      if (members.length) {
        this.tabs.splice(this.tabs.indexOf(tab), 1);
        const last = members[members.length - 1];
        this.tabs.splice(this.tabs.indexOf(last) + 1, 0, tab);
      }
    }
    this.scheduleState();
    this.browser.saveSessionSoon();
  }

  removeFromGroup(tabId) {
    const tab = this.tabById(tabId);
    if (!tab) return;
    tab.state.groupId = null;
    this.cleanupGroups();
    this.scheduleState();
  }

  updateGroup(groupId, patch) {
    const g = this.groups.get(groupId);
    if (!g) return;
    for (const k of ['title', 'color', 'collapsed']) if (patch[k] !== undefined) g[k] = patch[k];
    if (g.collapsed && this.activeTab && this.activeTab.state.groupId === groupId) {
      const other = this.tabs.find((t) => t.state.groupId !== groupId);
      if (other) this.activate(other); else g.collapsed = false;
    }
    this.scheduleState();
    this.browser.saveSessionSoon();
  }

  ungroup(groupId) {
    for (const t of this.tabs) if (t.state.groupId === groupId) t.state.groupId = null;
    this.groups.delete(groupId);
    this.scheduleState();
  }

  closeGroup(groupId) {
    for (const t of this.tabs.filter((x) => x.state.groupId === groupId)) this.closeTab(t);
    this.groups.delete(groupId);
    this.scheduleState();
  }

  cleanupGroups() {
    for (const id of [...this.groups.keys()]) if (!this.tabs.some((t) => t.state.groupId === id)) this.groups.delete(id);
  }

  // ---------------------------------------------------------------- split view

  toggleSplit(tab = this.activeTab) {
    if (!tab) return;
    if (this.split && (this.split.a === tab.id || this.split.b === tab.id)) {
      this.split = null;
    } else {
      const i = this.tabs.indexOf(tab);
      let other = this.tabs[i + 1] || this.tabs[i - 1];
      if (!other || other.state.pinned !== tab.state.pinned && false) other = null;
      if (!other) other = this.createTab({ url: this.browser.newTabUrl(), active: false, index: i + 1 });
      if (other.state.sleeping) other.wake();
      this.split = { a: tab.id, b: other.id, ratio: 0.5 };
    }
    this.layoutTabs();
    this.scheduleState();
  }

  splitWith(tab, otherId) {
    const other = this.tabById(otherId);
    if (!tab || !other || tab === other) return;
    if (other.state.sleeping) other.wake();
    this.split = { a: tab.id, b: other.id, ratio: 0.5 };
    this.activate(tab);
  }

  setSplitRatio(ratio) {
    if (!this.split) return;
    this.split.ratio = Math.max(0.15, Math.min(0.85, Number(ratio) || 0.5));
    this.scheduleState();
  }

  swapSplit() {
    if (!this.split) return;
    const { a, b } = this.split;
    this.split.a = b; this.split.b = a;
    this.layoutTabs();
    this.scheduleState();
  }

  // ---------------------------------------------------------------- popups / new windows

  handleWindowOpen(opener, details) {
    const { url, disposition, features } = details;
    const b = this.browser;
    const switchTo = b.settings.get('tabs.switchToNewTabs');
    if (disposition === 'new-window' && features) {
      // a real popup (OAuth, payment …): keep window.opener working
      return {
        action: 'allow',
        outlivesOpener: false,
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          icon: ICON,
          backgroundColor: '#ffffff',
          webPreferences: { preload: PAGES_PRELOAD, sandbox: true, contextIsolation: true, session: this.session }
        }
      };
    }
    if (disposition === 'new-window' && !features) {
      b.createWindow({ url, private: this.private });
      return { action: 'deny' };
    }
    // ctrl/middle-click → background-tab; target=_blank → foreground-tab
    const active = disposition === 'foreground-tab' ? true : !!switchTo;
    return {
      action: 'allow',
      outlivesOpener: true,
      createWindow: (options) => {
        const tab = this.createTab({ webContentsOptions: options, active, opener, url });
        tab.state.url = url;
        return tab.wc;
      }
    };
  }

  // ---------------------------------------------------------------- input

  handleInput(event, input, tab) {
    if (input.type !== 'keyDown') return;
    const accel = Accel.fromEvent(input);
    if (!accel) return;
    const cmd = this.browser.shortcutMap.get(accel);
    if (!cmd) return;
    // let the page keep editing shortcuts that conflict with nothing; only intercept mapped ones
    if (tab && input.isAutoRepeat && !['nextTab', 'prevTab', 'zoomIn', 'zoomOut', 'findNext', 'findPrev'].includes(cmd)) { event.preventDefault(); return; }
    event.preventDefault();
    this.browser.commands.run(this, cmd, { tab: tab || this.activeTab, fromUi: !tab });
  }

  // ---------------------------------------------------------------- state sync

  scheduleState() {
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => { this.stateTimer = null; this.sendState(); }, 16);
  }

  snapshot() {
    return {
      windowId: this.id,
      private: this.private,
      activeId: this.activeTab ? this.activeTab.id : null,
      tabs: this.tabs.map((t) => t.info()),
      groups: [...this.groups.values()],
      split: this.split,
      canReopen: this.closedTabs.length > 0
    };
  }

  sendState() {
    if (this.win.isDestroyed()) return;
    this.sendUi('state', this.snapshot());
    const t = this.activeTab;
    const suffix = this.private ? ` (${this.browser.i18n.t('ui.private')})` : '';
    this.win.setTitle(t && t.state.title ? `${t.state.title} – Nimbus${suffix}` : 'Nimbus' + suffix);
  }

  sendUi(channel, payload) {
    if (this.ui && !this.ui.webContents.isDestroyed()) this.ui.webContents.send('nimbus:ui', channel, payload);
  }

  focus() {
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }

  // ---------------------------------------------------------------- closing

  onClose(e) {
    if (this.closing || this.browser.quitting) { this.closing = true; return; }
    const t = this.browser.i18n.t;
    if (this.tabs.length > 1 && this.browser.settings.get('tabs.confirmCloseWindow') && this.browser.windows.size > 1) {
      e.preventDefault();
      dialog.showMessageBox(this.win, {
        type: 'question', buttons: [t('dialog.closeWindow'), t('dialog.cancel')], defaultId: 0, cancelId: 1,
        message: t('dialog.closeWindowTabs', { count: this.tabs.length }), checkboxLabel: t('dialog.dontAskAgain')
      }).then(({ response, checkboxChecked }) => {
        if (response !== 0 || this.win.isDestroyed()) return;
        if (checkboxChecked) this.browser.settings.set('tabs.confirmCloseWindow', false);
        this.closing = true;
        this.win.close();
      });
      return;
    }
    if (!this.private && this.browser.windows.size === 1) this.browser.saveSessionNow();
    this.closing = true;
  }

  onClosed() {
    for (const t of this.tabs) t.destroy();
    this.tabs = [];
    if (this.status && !this.status.webContents.isDestroyed()) this.status.webContents.close();
    if (!this.ui.webContents.isDestroyed()) this.ui.webContents.close();
    this.browser.onWindowClosed(this);
    if (this.private) {
      const ses = this.session;
      ses.clearStorageData().catch(() => {});
      ses.clearCache().catch(() => {});
    }
  }

  serialize() {
    const b = this.win.getNormalBounds ? this.win.getNormalBounds() : this.win.getBounds();
    return {
      bounds: b,
      maximized: this.win.isMaximized(),
      activeIndex: Math.max(0, this.tabs.indexOf(this.activeTab)),
      tabs: this.tabs.map((t) => t.serialize()),
      groups: [...this.groups.values()]
    };
  }
}

module.exports = { NimbusWindow, GROUP_COLORS };
