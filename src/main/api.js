'use strict';
const { ipcMain, app, dialog, webContents: WebContents, shell, session } = require('electron');
const path = require('path');
const { DEFAULTS, SHORTCUTS } = require('./defaults');
const { hostOf, originOf } = require('../shared/url');

/**
 * IPC surface. The browser UI (trusted, own WebContentsView) and internal
 * nimbus:// pages call methods by name. Web content never gets this API:
 * the page preload only exposes it on nimbus:// and we re-check the sender here.
 */
function setupIpc(browser) {
  const b = browser;
  const t = (...a) => b.i18n.t(...a);

  const winOf = (ctx) => ctx.win || (ctx.tab && ctx.tab.win) || b.lastFocused;
  const tabOf = (ctx, id) => (id ? winOf(ctx).tabById(id) : winOf(ctx).activeTab);

  const shared = {
    settingsAll: () => b.settings.all(),
    settingsGet: (ctx, p) => b.settings.get(p),
    settingsSet: (ctx, p, v) => { b.settings.set(p, v); return true; },
    settingsReset: (ctx, section) => { b.settings.reset(section); return true; },
    defaults: () => DEFAULTS,
    strings: () => ({ lang: b.i18n.lang, strings: b.i18n.dict() }),
    openUrl: (ctx, url, opts = {}) => {
      const w = winOf(ctx);
      if (opts.newWindow) return void b.createWindow({ url, private: !!opts.private });
      if (opts.newTab) return void w.createTab({ url, active: !opts.background, opener: ctx.tab || w.activeTab });
      const tab = ctx.tab || w.activeTab;
      if (tab) tab.load(url);
    },
    command: (ctx, cmd, arg) => b.commands.run(winOf(ctx), cmd, { tab: ctx.tab || winOf(ctx).activeTab, arg }),
    bookmarksTree: () => b.bookmarks.tree,
    bookmarkAdd: (ctx, node) => b.bookmarks.add(node),
    bookmarkUpdate: (ctx, id, patch) => b.bookmarks.update(id, patch),
    bookmarkRemove: (ctx, id) => b.bookmarks.remove(id),
    bookmarkMove: (ctx, id, parentId, index) => b.bookmarks.move(id, parentId, index),
    downloadsList: () => b.downloads.list(),
    downloadAction: (ctx, id, action) => b.downloads.action(id, action),
    downloadsClear: () => b.downloads.clear(),
    adblockStatus: () => b.adblock.status(),
    platform: () => process.platform
  };

  const ui = {
    ...shared,
    uiInit: (ctx) => ({
      windowId: ctx.win.id,
      private: ctx.win.private,
      platform: process.platform,
      version: app.getVersion(),
      settings: b.settings.all(),
      lang: b.i18n.lang,
      strings: b.i18n.dict(),
      state: ctx.win.snapshot(),
      windowState: ctx.win.windowState(),
      bookmarks: b.bookmarks.tree,
      downloads: b.downloads.list(),
      extensions: !ctx.win.private && !!b.extensions.api
    }),
    setRects: (ctx, rects) => ctx.win.setRects(rects),
    setOverlay: (ctx, on) => ctx.win.setOverlay(on),
    navigate: (ctx, input, opts = {}) => {
      const url = b.resolve(input);
      if (!url) return;
      const w = ctx.win;
      if (opts.newTab || !w.activeTab) w.createTab({ url, active: true, atEnd: true });
      else w.activeTab.load(url);
      if (w.activeTab && w.activeTab.wc) w.activeTab.wc.focus();
    },
    focusPage: (ctx) => { const tab = ctx.win.activeTab; if (tab && tab.wc) tab.wc.focus(); },
    suggest: (ctx, text) => b.suggest(text),
    switchToTab: (ctx, windowId, tabId) => { const w = b.windowById(windowId); const tab = w && w.tabById(tabId); if (tab) { w.activate(tab); w.focus(); } },
    tabActivate: (ctx, id) => ctx.win.activate(ctx.win.tabById(id)),
    tabClose: (ctx, id) => ctx.win.closeTab(ctx.win.tabById(id)),
    tabMove: (ctx, id, index, groupId) => ctx.win.moveTab(id, index, groupId),
    tabMenu: (ctx, id, point) => { const tab = ctx.win.tabById(id); if (tab) b.contextMenu.showTab(ctx.win, tab, point); },
    tabPreview: async (ctx, id) => { const tab = ctx.win.tabById(id); return tab ? tab.thumbnail() : null; },
    tabMute: (ctx, id) => { const tab = ctx.win.tabById(id); if (tab) tab.setMuted(!tab.state.muted); },
    tabDetach: (ctx, id, point) => { const tab = ctx.win.tabById(id); if (tab) ctx.win.moveTabToNewWindow(tab, point); },
    tabToWindow: (ctx, id, targetWindowId, index) => {
      const tab = ctx.win.tabById(id); const target = b.windowById(targetWindowId);
      if (!tab || !target || target === ctx.win || target.private !== ctx.win.private) return false;
      ctx.win.detachTab(tab); target.adoptTab(tab, index); target.focus(); return true;
    },
    windowAtPoint: (ctx, point) => {
      for (const w of b.windows.values()) {
        if (w === ctx.win || w.win.isMinimized()) continue;
        const r = w.win.getBounds();
        if (point.x >= r.x && point.x <= r.x + r.width && point.y >= r.y && point.y <= r.y + 80) return w.id;
      }
      return null;
    },
    windowBounds: (ctx) => ctx.win.win.getContentBounds(),
    newTab: (ctx, opts = {}) => ctx.win.createTab({ url: opts.url || b.newTabUrl(), active: true, atEnd: true, index: opts.index }),
    groupMenu: (ctx, id, point) => b.contextMenu.showGroup(ctx.win, id, point),
    groupUpdate: (ctx, id, patch) => ctx.win.updateGroup(id, patch),
    splitRatio: (ctx, r) => ctx.win.setSplitRatio(r),
    splitSwap: (ctx) => ctx.win.swapSplit(),
    splitClose: (ctx) => { ctx.win.split = null; ctx.win.layoutTabs(); ctx.win.scheduleState(); },
    find: (ctx, text, opts = {}) => {
      const tab = ctx.win.activeTab;
      if (!tab || !tab.wc) return;
      if (!text) { tab.wc.stopFindInPage('clearSelection'); return; }
      tab.wc.findInPage(text, { forward: opts.forward !== false, findNext: !!opts.findNext, matchCase: !!opts.matchCase });
    },
    stopFind: (ctx, action) => { const tab = ctx.win.activeTab; if (tab && tab.wc) tab.wc.stopFindInPage(action || 'clearSelection'); },
    mainMenu: (ctx, point) => b.contextMenu.showMainMenu(ctx.win, point),
    bookmarkMenu: (ctx, id, point) => b.contextMenu.showBookmark(ctx.win, id, point),
    folderMenu: (ctx, id, point) => b.contextMenu.showFolder(ctx.win, id, point),
    bookmarkActive: (ctx) => {
      const tab = ctx.win.activeTab;
      if (!tab || !tab.state.url) return null;
      let node = b.bookmarks.findByUrl(tab.state.url);
      let created = false;
      if (!node) { node = b.bookmarks.add({ parentId: 'bar', title: tab.state.title || tab.state.url, url: tab.state.url }); created = true; }
      return { node, created, folders: folderList(b) };
    },
    bookmarkInfo: (ctx, id) => ({ node: b.bookmarks.byId.get(id) || null, parentId: (b.bookmarks.parentOf.get(id) || {}).id, folders: folderList(b) }),
    permissionResponse: (ctx, id, allow, remember) => b.resolvePrompt(id, allow, remember),
    authResponse: (ctx, id, creds) => b.resolvePrompt(id, creds),
    screenPick: (ctx, id, sourceId, audio) => b.resolvePrompt(id, sourceId, audio),
    toggleProtection: (ctx) => { const tab = ctx.win.activeTab; if (tab) { b.toggleProtection(tab.state.url); if (tab.wc) tab.wc.reload(); } },
    siteInfo: (ctx) => {
      const tab = ctx.win.activeTab;
      if (!tab) return null;
      const url = tab.state.displayUrl || tab.state.url;
      const origin = originOf(url);
      const perms = (b.settings.get('privacy.sitePermissions') || {})[origin] || {};
      return { url, origin, host: hostOf(url), secure: tab.state.secure, blocked: tab.state.blocked, protection: b.isProtectionEnabledFor(url), permissions: perms, zoom: tab.state.zoom, cert: tab.state.secure === false ? null : undefined };
    },
    sitePermissionSet: (ctx, origin, key, value) => b.setSitePermission(origin, key, value),
    clearSiteData: async (ctx, origin) => { await b.clearSiteData(origin); const tab = ctx.win.activeTab; if (tab && tab.wc) tab.wc.reload(); },
    windowControl: (ctx, action) => {
      const w = ctx.win.win;
      if (action === 'minimize') w.minimize();
      else if (action === 'maximize') (w.isMaximized() ? w.unmaximize() : w.maximize());
      else if (action === 'close') w.close();
    },
    uiDevtools: (ctx) => ctx.win.ui.webContents.openDevTools({ mode: 'detach' })
  };

  const page = {
    ...shared,
    pageInit: (ctx) => ({
      platform: process.platform, version: app.getVersion(), settings: b.settings.all(), lang: b.i18n.lang, strings: b.i18n.dict(),
      private: !!(ctx.tab && ctx.tab.win.private), versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, v8: process.versions.v8 }
    }),
    pageNavigate: (ctx, input) => { const url = b.resolve(input); if (url && ctx.tab) ctx.tab.load(url); },
    historyList: (ctx, opts) => b.history.list(opts),
    historyRemove: (ctx, url) => b.history.remove(url),
    historyClear: (ctx, hours) => b.history.clear(hours ? Date.now() - hours * 3600000 : 0),
    topSites: (ctx, n) => b.history.top(n || 8).map((e) => ({ title: e.title, url: e.url })),
    settingsExport: (ctx) => b.exportSettings(winOf(ctx)),
    settingsImport: (ctx) => b.importSettings(winOf(ctx)),
    bookmarksImport: (ctx) => b.importBookmarks(winOf(ctx)),
    bookmarksExport: (ctx) => b.exportBookmarks(winOf(ctx)),
    extensionsList: () => (b.extensions.ready ? b.extensions.list() : []),
    extensionsAvailable: () => !!b.settings.get('extensions.enabled'),
    extensionSetEnabled: (ctx, id, on) => b.extensions.setEnabled(id, on),
    extensionRemove: async (ctx, id) => {
      const r = await dialog.showMessageBox(winOf(ctx).win, { type: 'question', buttons: [t('ext.remove'), t('dialog.cancel')], defaultId: 1, cancelId: 1, message: t('ext.confirmRemove') });
      if (r.response === 0) await b.extensions.remove(id);
      return r.response === 0;
    },
    extensionLoadUnpacked: (ctx) => b.extensions.pickUnpacked(winOf(ctx)),
    extensionInstallFile: (ctx) => b.extensions.installFile(winOf(ctx)),
    extensionInstallStore: (ctx, id) => b.extensions.installFromStore(id),
    extensionsUpdate: () => b.extensions.update(),
    adblockUpdate: async () => { await b.adblock.load(true); b.broadcast('adblock', b.adblock.status()); return b.adblock.status(); },
    clearBrowsingData: (ctx, opts) => b.clearBrowsingData(opts),
    pickFolder: async (ctx) => {
      const r = await dialog.showOpenDialog(winOf(ctx).win, { properties: ['openDirectory', 'createDirectory'] });
      return r.canceled ? null : r.filePaths[0];
    },
    pickBackground: (ctx) => b.pickBackgroundImage(winOf(ctx)),
    spellcheckLanguages: () => session.defaultSession.availableSpellCheckerLanguages,
    setDefaultBrowser: () => b.setDefaultBrowser(),
    isDefaultBrowser: () => b.isDefaultBrowser(),
    paths: () => ({ userData: app.getPath('userData'), downloads: b.downloads.dir(), exe: app.getPath('exe') }),
    openPath: (ctx, p) => shell.openPath(p),
    restart: () => { b.saveSessionNow(); app.relaunch(); app.quit(); },
    errorAction: (ctx, action, url) => {
      const tab = ctx.tab;
      if (!tab) return;
      const host = hostOf(url);
      if (action === 'proceed' && b.lastCertError && b.lastCertError.host === host) b.certExceptions.add(host + '|' + b.lastCertError.fingerprint);
      if (action === 'allowHttp') { b.httpsTemporaryExceptions.add(host); url = url.replace(/^https:/, 'http:'); }
      tab.load(url);
    },
    errorInfo: (ctx, url) => ({ httpsUpgraded: b.httpsUpgraded.has(hostOf(url)), cert: b.lastCertError && b.lastCertError.host === hostOf(url) ? b.lastCertError : null, online: require('electron').net.isOnline() }),
    shortcutDefaults: () => SHORTCUTS,
    sitePermissions: () => b.settings.get('privacy.sitePermissions'),
    sitePermissionSet: (ctx, origin, key, value) => b.setSitePermission(origin, key, value),
    newtabData: () => ({ top: b.history.top(12).map((e) => ({ title: e.title, url: e.url })), name: b.settings.get('newTab.name') })
  };

  ipcMain.handle('nimbus:call', async (event, method, ...args) => {
    const sender = event.sender;
    let ctx;
    let table;
    if (b.uiWcIds.has(sender.id)) {
      const win = [...b.windows.values()].find((w) => w.ui.webContents === sender);
      if (!win) throw new Error('unknown window');
      ctx = { win };
      table = ui;
    } else {
      const frame = event.senderFrame;
      if (!frame || frame !== sender.mainFrame || !String(frame.url).startsWith('nimbus://')) throw new Error('forbidden');
      const tab = b.tabsByWc.get(sender.id);
      ctx = { tab, win: tab ? tab.win : null };
      table = page;
    }
    const fn = table[method];
    if (typeof fn !== 'function') throw new Error('unknown method ' + method);
    return fn(ctx, ...args);
  });
}

function folderList(b) {
  const out = [];
  const walk = (n, depth, label) => {
    if (n.type !== 'folder') return;
    out.push({ id: n.id, title: label || n.title, depth });
    for (const c of n.children || []) walk(c, depth + 1);
  };
  walk(b.bookmarks.tree.bar, 0, b.i18n.t('bm.bar'));
  walk(b.bookmarks.tree.other, 0, b.i18n.t('bm.other'));
  return out;
}

module.exports = { setupIpc };
