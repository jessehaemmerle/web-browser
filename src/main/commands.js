'use strict';
const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

/** Every action the browser can perform – used by shortcuts, menus and the UI. */
class Commands {
  constructor(browser) { this.b = browser; }

  list() { return Object.keys(this.b.settings.get('shortcuts')); }

  run(win, cmd, ctx = {}) {
    const b = this.b;
    const tab = ctx.tab || (win && win.activeTab);
    const wc = tab && tab.wc;
    const selectN = cmd.match(/^selectTab(\d)$/);
    if (selectN) {
      const visible = win.tabs.filter((t) => !t.state.groupId || !(win.groups.get(t.state.groupId) || {}).collapsed);
      const t = visible[Number(selectN[1]) - 1];
      if (t) win.activate(t);
      return;
    }
    switch (cmd) {
      case 'newTab': win.createTab({ url: b.newTabUrl(), active: true, atEnd: true }); win.sendUi('focus-address'); break;
      case 'newWindow': b.createWindow({}); break;
      case 'newPrivateWindow': b.createWindow({ private: true }); break;
      case 'closeTab': if (tab) win.closeTab(tab); break;
      case 'closeWindow': win.win.close(); break;
      case 'reopenClosedTab': win.reopenClosedTab(); break;
      case 'nextTab': case 'prevTab': {
        const list = win.tabs.filter((t) => t === win.activeTab || !t.state.groupId || !(win.groups.get(t.state.groupId) || {}).collapsed);
        if (list.length < 2) break;
        const i = list.indexOf(win.activeTab);
        win.activate(list[(i + (cmd === 'nextTab' ? 1 : -1) + list.length) % list.length]);
        break;
      }
      case 'selectLastTab': win.activate(win.tabs[win.tabs.length - 1]); break;
      case 'duplicateTab': if (tab) win.duplicateTab(tab); break;
      case 'pinTab': if (tab) win.setPinned(tab, !tab.state.pinned); break;
      case 'muteTab': if (tab) tab.setMuted(!tab.state.muted); break;
      case 'focusAddress': win.sendUi('focus-address'); win.ui.webContents.focus(); break;
      case 'reload': if (tab) { if (tab.state.displayUrl) tab.load(tab.state.displayUrl); else if (wc) wc.reload(); else tab.wake(); } break;
      case 'hardReload': if (wc) wc.reloadIgnoringCache(); break;
      case 'stop': if (wc) wc.stop(); break;
      case 'back': if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
      case 'forward': if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
      case 'home': if (tab) tab.load(b.homeUrl()); break;
      case 'find': win.sendUi('find-open'); win.ui.webContents.focus(); break;
      case 'findNext': win.sendUi('find-step', { forward: true }); break;
      case 'findPrev': win.sendUi('find-step', { forward: false }); break;
      case 'zoomIn': if (tab) tab.zoom(1); break;
      case 'zoomOut': if (tab) tab.zoom(-1); break;
      case 'zoomReset': if (tab) tab.zoom(0); break;
      case 'bookmarkPage': win.sendUi('bookmark-edit'); win.ui.webContents.focus(); break;
      case 'toggleBookmarksBar': {
        const cur = b.settings.get('layout.showBookmarksBar');
        b.settings.set('layout.showBookmarksBar', cur === 'always' ? 'never' : 'always');
        break;
      }
      case 'openBookmarks': b.openInternal(win, 'bookmarks'); break;
      case 'openHistory': b.openInternal(win, 'history'); break;
      case 'openDownloads': b.openInternal(win, 'downloads'); break;
      case 'openSettings': b.openInternal(win, 'settings', ctx.arg); break;
      case 'openExtensions': b.openInternal(win, 'settings', 'extensions'); break;
      case 'openAbout': b.openInternal(win, 'settings', 'about'); break;
      case 'clearData': b.openInternal(win, 'settings', 'privacy'); break;
      case 'devtools': if (wc) { if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'right' }); } break;
      case 'uiDevtools': win.ui.webContents.openDevTools({ mode: 'detach' }); break;
      case 'viewSource': if (tab && tab.state.url && !tab.state.url.startsWith('view-source:')) win.createTab({ url: 'view-source:' + tab.state.url, active: true, opener: tab }); break;
      case 'fullscreen': win.win.setFullScreen(!win.win.isFullScreen()); break;
      case 'focusMode': win.sendUi('toggle-focus-mode'); break;
      case 'print': if (wc) wc.print({}, () => {}); break;
      case 'savePage': this.savePage(win, tab); break;
      case 'toggleSplit': win.toggleSplit(tab); break;
      case 'toggleTabLayout': {
        const cur = b.settings.get('layout.tabPosition');
        b.settings.set('layout.tabPosition', cur === 'top' ? 'left' : 'top');
        break;
      }
      case 'toggleTabSidebar': b.settings.set('layout.verticalTabsCollapsed', !b.settings.get('layout.verticalTabsCollapsed')); break;
      case 'sleepTab': if (tab && tab !== win.activeTab) tab.sleep(); break;
      case 'translate': if (tab && /^https?:/.test(tab.state.url)) win.createTab({ url: 'https://translate.google.com/translate?sl=auto&tl=' + b.i18n.lang + '&u=' + encodeURIComponent(tab.state.url), active: true, opener: tab }); break;
      case 'quit': app.quit(); break;
      default: console.warn('[commands] unknown command', cmd);
    }
  }

  async savePage(win, tab) {
    if (!tab || !tab.wc) return;
    const t = this.b.i18n.t;
    const name = (tab.state.title || 'page').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
    const r = await dialog.showSaveDialog(win.win, {
      defaultPath: path.join(this.b.downloads.dir(), name + '.html'),
      filters: [{ name: t('save.complete'), extensions: ['html'] }, { name: t('save.single'), extensions: ['mhtml'] }, { name: t('save.pdf'), extensions: ['pdf'] }]
    });
    if (r.canceled || !r.filePath) return;
    const ext = path.extname(r.filePath).toLowerCase();
    try {
      if (ext === '.pdf') fs.writeFileSync(r.filePath, await tab.wc.printToPDF({ printBackground: true }));
      else await tab.wc.savePage(r.filePath, ext === '.mhtml' ? 'MHTML' : 'HTMLComplete');
    } catch (err) {
      dialog.showErrorBox(t('save.failed'), err.message);
    }
  }
}

module.exports = { Commands };
