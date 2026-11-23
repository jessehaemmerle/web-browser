'use strict';
const { Menu, clipboard, shell } = require('electron');
const { buildSearchUrl } = require('../shared/url');

/** Native context menus for pages, tabs, bookmarks and text fields. */
class ContextMenu {
  constructor(browser) { this.b = browser; }

  editItems(wc, params, t) {
    const items = [];
    if (params.misspelledWord) {
      for (const s of (params.dictionarySuggestions || []).slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
      if (!params.dictionarySuggestions || !params.dictionarySuggestions.length) items.push({ label: t('ctx.noSuggestions'), enabled: false });
      items.push({ label: t('ctx.addToDictionary'), click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord) });
      items.push({ type: 'separator' });
    }
    const f = params.editFlags || {};
    items.push(
      { label: t('ctx.undo'), role: 'undo', enabled: f.canUndo },
      { label: t('ctx.redo'), role: 'redo', enabled: f.canRedo },
      { type: 'separator' },
      { label: t('ctx.cut'), role: 'cut', enabled: f.canCut },
      { label: t('ctx.copy'), role: 'copy', enabled: f.canCopy },
      { label: t('ctx.paste'), role: 'paste', enabled: f.canPaste },
      { label: t('ctx.pastePlain'), click: () => wc.pasteAndMatchStyle(), enabled: f.canPaste },
      { label: t('ctx.selectAll'), role: 'selectAll' }
    );
    return items;
  }

  showEditable(wc, params) {
    const t = this.b.i18n.t;
    Menu.buildFromTemplate(this.editItems(wc, params, t)).popup();
  }

  show(tab, params) {
    const b = this.b;
    const t = b.i18n.t;
    const wc = tab.wc;
    const win = tab.win;
    const items = [];
    const sep = () => { if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' }); };
    const engine = b.searchEngine();

    if (params.linkURL) {
      const url = params.linkURL;
      items.push(
        { label: t('ctx.openLinkNewTab'), click: () => win.createTab({ url, opener: tab, active: b.settings.get('tabs.switchToNewTabs') }) },
        { label: t('ctx.openLinkNewWindow'), click: () => b.createWindow({ url }) },
        { label: t('ctx.openLinkPrivate'), click: () => b.createWindow({ url, private: true }) },
        { label: t('ctx.openLinkSplit'), click: () => { const nt = win.createTab({ url, opener: tab, active: false }); win.splitWith(tab, nt.id); } },
        { type: 'separator' },
        { label: t('ctx.saveLinkAs'), click: () => wc.downloadURL(url) },
        { label: t('ctx.copyLink'), click: () => clipboard.writeText(url) }
      );
      if (params.linkText && !params.hasImageContents) items.push({ label: t('ctx.copyLinkText'), click: () => clipboard.writeText(params.linkText) });
    }
    if (params.mediaType === 'image' && params.srcURL) {
      sep();
      items.push(
        { label: t('ctx.openImageNewTab'), click: () => win.createTab({ url: params.srcURL, opener: tab }) },
        { label: t('ctx.saveImageAs'), click: () => wc.downloadURL(params.srcURL) },
        { label: t('ctx.copyImage'), click: () => wc.copyImageAt(params.x, params.y) },
        { label: t('ctx.copyImageAddress'), click: () => clipboard.writeText(params.srcURL) }
      );
      if (/^https?:/.test(params.srcURL)) items.push({ label: t('ctx.searchImage', { engine: 'Google Lens' }), click: () => win.createTab({ url: 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(params.srcURL), opener: tab, active: true }) });
    }
    if ((params.mediaType === 'video' || params.mediaType === 'audio') && params.srcURL) {
      sep();
      const playing = !(params.mediaFlags && params.mediaFlags.isPaused);
      items.push(
        { label: playing ? t('ctx.pause') : t('ctx.play'), click: () => wc.executeJavaScript(`(()=>{const m=document.elementFromPoint(${params.x},${params.y});if(m&&m.paused!==undefined){m.paused?m.play():m.pause()}})()`).catch(() => {}) },
        { label: t('ctx.loop'), type: 'checkbox', checked: !!(params.mediaFlags && params.mediaFlags.isLooping), click: () => wc.executeJavaScript(`(()=>{const m=document.elementFromPoint(${params.x},${params.y});if(m)m.loop=!m.loop})()`).catch(() => {}) },
        { label: t('ctx.showControls'), type: 'checkbox', checked: !!(params.mediaFlags && params.mediaFlags.isControlsVisible), click: () => wc.executeJavaScript(`(()=>{const m=document.elementFromPoint(${params.x},${params.y});if(m)m.controls=!m.controls})()`).catch(() => {}) },
        { label: params.mediaType === 'video' ? t('ctx.saveVideoAs') : t('ctx.saveAudioAs'), click: () => wc.downloadURL(params.srcURL) },
        { label: t('ctx.copyMediaAddress'), click: () => clipboard.writeText(params.srcURL) }
      );
      if (params.mediaType === 'video') items.push({ label: t('ctx.pip'), click: () => wc.executeJavaScript(`(()=>{const m=document.elementFromPoint(${params.x},${params.y});if(m&&m.requestPictureInPicture)m.requestPictureInPicture()})()`, true).catch(() => {}) });
    }

    if (params.isEditable) {
      sep();
      items.push(...this.editItems(wc, params, t));
    } else if (params.selectionText && params.selectionText.trim()) {
      sep();
      const text = params.selectionText.trim();
      const short = text.length > 28 ? text.slice(0, 26) + '…' : text;
      items.push({ label: t('ctx.copy'), role: 'copy' });
      items.push({ label: t('ctx.searchFor', { engine: engine.name, text: short }), click: () => win.createTab({ url: buildSearchUrl(engine.url, text), opener: tab, active: true }) });
      if (/^\S+\.\S{2,}$/.test(text) && !text.includes('@')) items.push({ label: t('ctx.openAsUrl'), click: () => win.createTab({ url: /^https?:/.test(text) ? text : 'https://' + text, opener: tab, active: true }) });
    }

    if (!params.linkURL && !params.mediaType.match(/image|video|audio/) && !params.isEditable && !params.selectionText) {
      items.push(
        { label: t('ctx.back'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
        { label: t('ctx.forward'), enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
        { label: t('ctx.reload'), click: () => wc.reload() },
        { type: 'separator' },
        { label: t('ctx.savePageAs'), click: () => b.commands.run(win, 'savePage', { tab }) },
        { label: t('ctx.print'), click: () => b.commands.run(win, 'print', { tab }) },
        { label: t('ctx.translate'), visible: /^https?:/.test(tab.state.url), click: () => b.commands.run(win, 'translate', { tab }) },
        { label: t('ctx.viewSource'), click: () => b.commands.run(win, 'viewSource', { tab }) }
      );
    }

    // Chrome extension context menu entries
    if (!win.private) {
      const extItems = b.extensions.contextMenuItems(tab, params);
      if (extItems.length) { sep(); items.push(...extItems); }
    }

    sep();
    items.push({ label: t('ctx.inspect'), click: () => { wc.inspectElement(params.x, params.y); } });
    Menu.buildFromTemplate(items).popup({ window: win.win });
  }

  showTab(win, tab, point) {
    const b = this.b;
    const t = b.i18n.t;
    const groups = [...win.groups.values()];
    const items = [
      { label: t('tab.new'), click: () => win.createTab({ url: b.newTabUrl(), active: true, index: win.tabs.indexOf(tab) + 1 }) },
      { type: 'separator' },
      { label: t('tab.reload'), click: () => b.commands.run(win, 'reload', { tab }) },
      { label: t('tab.duplicate'), click: () => win.duplicateTab(tab) },
      { label: tab.state.pinned ? t('tab.unpin') : t('tab.pin'), click: () => win.setPinned(tab, !tab.state.pinned) },
      { label: tab.state.muted ? t('tab.unmute') : t('tab.mute'), click: () => tab.setMuted(!tab.state.muted) },
      { type: 'separator' },
      {
        label: t('tab.addToGroup'), enabled: !tab.state.pinned,
        submenu: [
          { label: t('tab.newGroup'), click: () => { const id = win.createGroup([tab.id]); win.sendUi('group-rename', { id }); } },
          ...(groups.length ? [{ type: 'separator' }] : []),
          ...groups.map((g) => ({ label: g.title || t('group.unnamed'), type: 'radio', checked: tab.state.groupId === g.id, click: () => win.addToGroup([tab.id], g.id) }))
        ]
      },
      { label: t('tab.removeFromGroup'), visible: !!tab.state.groupId, click: () => win.removeFromGroup(tab.id) },
      {
        label: t('tab.splitWith'),
        enabled: win.tabs.length > 1,
        submenu: win.tabs.filter((x) => x !== tab).slice(0, 30).map((x) => ({ label: (x.state.title || x.state.url || t('tab.untitled')).slice(0, 60), click: () => win.splitWith(tab, x.id) }))
      },
      { label: t('tab.moveToNewWindow'), enabled: win.tabs.length > 1 && !win.private, click: () => win.moveTabToNewWindow(tab) },
      { label: t('tab.sleep'), enabled: tab !== win.activeTab && !tab.state.sleeping, click: () => tab.sleep() },
      { type: 'separator' },
      { label: t('tab.close'), click: () => win.closeTab(tab) },
      { label: t('tab.closeOthers'), enabled: win.tabs.length > 1, click: () => win.closeOtherTabs(tab) },
      { label: t('tab.closeRight'), enabled: win.tabs.indexOf(tab) < win.tabs.length - 1, click: () => win.closeTabsToRight(tab) },
      { type: 'separator' },
      { label: t('tab.reopenClosed'), enabled: win.closedTabs.length > 0, click: () => win.reopenClosedTab() }
    ];
    Menu.buildFromTemplate(items).popup({ window: win.win, x: point && point.x, y: point && point.y });
  }

  showGroup(win, groupId, point) {
    const t = this.b.i18n.t;
    const g = win.groups.get(groupId);
    if (!g) return;
    const { GROUP_COLORS } = require('./window');
    const items = [
      { label: t('group.rename'), click: () => win.sendUi('group-rename', { id: groupId }) },
      { label: t('group.color'), submenu: GROUP_COLORS.map((c) => ({ label: t('color.' + c), type: 'radio', checked: g.color === c, click: () => win.updateGroup(groupId, { color: c }) })) },
      { label: g.collapsed ? t('group.expand') : t('group.collapse'), click: () => win.updateGroup(groupId, { collapsed: !g.collapsed }) },
      { label: t('group.newTab'), click: () => { const tab = win.createTab({ url: this.b.newTabUrl(), active: true }); win.addToGroup([tab.id], groupId); } },
      { type: 'separator' },
      { label: t('group.ungroup'), click: () => win.ungroup(groupId) },
      { label: t('group.close'), click: () => win.closeGroup(groupId) }
    ];
    Menu.buildFromTemplate(items).popup({ window: win.win, x: point && point.x, y: point && point.y });
  }

  showBookmark(win, id, point) {
    const b = this.b;
    const t = b.i18n.t;
    const node = b.bookmarks.byId.get(id);
    if (!node) return;
    const items = [];
    if (node.type === 'bookmark') {
      items.push(
        { label: t('ctx.openLinkNewTab'), click: () => win.createTab({ url: node.url, active: false }) },
        { label: t('ctx.openLinkNewWindow'), click: () => b.createWindow({ url: node.url }) },
        { label: t('ctx.openLinkPrivate'), click: () => b.createWindow({ url: node.url, private: true }) },
        { type: 'separator' },
        { label: t('bm.edit'), click: () => win.sendUi('bookmark-edit', { id }) },
        { label: t('ctx.copyLink'), click: () => clipboard.writeText(node.url) }
      );
    } else {
      const urls = (node.children || []).filter((c) => c.type === 'bookmark');
      items.push(
        { label: t('bm.openAll', { count: urls.length }), enabled: urls.length > 0, click: () => urls.forEach((c, i) => win.createTab({ url: c.url, active: i === 0, atEnd: true })) },
        { label: t('bm.rename'), click: () => win.sendUi('bookmark-edit', { id }) }
      );
    }
    items.push({ type: 'separator' }, { label: t('bm.delete'), click: () => b.bookmarks.remove(id) }, { type: 'separator' },
      { label: t('bm.addFolder'), click: () => { const f = b.bookmarks.add({ type: 'folder', title: t('bm.newFolder'), parentId: 'bar' }); win.sendUi('bookmark-edit', { id: f.id }); } },
      { label: t('bm.manage'), click: () => b.openInternal(win, 'bookmarks') });
    Menu.buildFromTemplate(items).popup({ window: win.win, x: point && point.x, y: point && point.y });
  }

  /** Popup listing the contents of a bookmark folder. */
  showFolder(win, id, point) {
    const b = this.b;
    const t = b.i18n.t;
    const node = b.bookmarks.byId.get(id);
    if (!node) return;
    const build = (n) => {
      const kids = (n.children || []).map((c) => c.type === 'folder'
        ? { label: c.title || t('bm.folder'), submenu: build(c) }
        : { label: (c.title || c.url).slice(0, 70), click: (_mi, _bw, ev) => (ev && (ev.ctrlKey || ev.metaKey)) ? win.createTab({ url: c.url }) : win.activeTab && win.activeTab.load(c.url) });
      if (!kids.length) kids.push({ label: t('bm.empty'), enabled: false });
      const links = (n.children || []).filter((c) => c.type === 'bookmark');
      if (links.length > 1) kids.push({ type: 'separator' }, { label: t('bm.openAll', { count: links.length }), click: () => links.forEach((c, i) => win.createTab({ url: c.url, active: i === 0, atEnd: true })) });
      return kids;
    };
    Menu.buildFromTemplate(build(node)).popup({ window: win.win, x: point && point.x, y: point && point.y });
  }

  showMainMenu(win, point) {
    const b = this.b;
    const t = b.i18n.t;
    const tab = win.activeTab;
    const zoom = tab ? Math.round((tab.state.zoom || 1) * 100) : 100;
    const accel = (cmd) => {
      const a = (b.settings.get('shortcuts.' + cmd) || [])[0];
      return a ? a.replace('Plus', '+').replace('Minus', '-') : undefined;
    };
    const item = (label, cmd, extra = {}) => ({ label, accelerator: accel(cmd), registerAccelerator: false, click: () => b.commands.run(win, cmd, { tab }), ...extra });
    const bookmarksBar = b.bookmarks.tree.bar.children;
    const items = [
      item(t('menu.newTab'), 'newTab'),
      item(t('menu.newWindow'), 'newWindow'),
      item(t('menu.newPrivateWindow'), 'newPrivateWindow'),
      { type: 'separator' },
      item(t('menu.history'), 'openHistory'),
      item(t('menu.downloads'), 'openDownloads'),
      {
        label: t('menu.bookmarks'),
        submenu: [
          item(t('menu.bookmarkPage'), 'bookmarkPage'),
          item(t('menu.manageBookmarks'), 'openBookmarks'),
          { label: t('menu.showBookmarksBar'), type: 'checkbox', checked: b.settings.get('layout.showBookmarksBar') === 'always', accelerator: accel('toggleBookmarksBar'), registerAccelerator: false, click: () => b.commands.run(win, 'toggleBookmarksBar') },
          { type: 'separator' },
          ...bookmarksBar.slice(0, 25).map((n) => n.type === 'folder'
            ? { label: n.title || t('bm.folder'), click: () => this.showFolder(win, n.id) }
            : { label: (n.title || n.url).slice(0, 60), click: () => tab && tab.load(n.url) })
        ]
      },
      item(t('menu.extensions'), 'openExtensions', { enabled: !win.private }),
      { type: 'separator' },
      {
        label: t('menu.zoom', { zoom }),
        submenu: [item(t('menu.zoomIn'), 'zoomIn'), item(t('menu.zoomOut'), 'zoomOut'), item(t('menu.zoomReset'), 'zoomReset'), { type: 'separator' }, item(t('menu.fullscreen'), 'fullscreen')]
      },
      item(t('menu.find'), 'find'),
      item(t('menu.print'), 'print'),
      item(t('menu.savePage'), 'savePage'),
      {
        label: t('menu.view'),
        submenu: [
          item(t('menu.splitView'), 'toggleSplit', { type: 'checkbox', checked: !!win.split }),
          item(t('menu.verticalTabs'), 'toggleTabLayout', { type: 'checkbox', checked: b.settings.get('layout.tabPosition') !== 'top' }),
          { label: t('menu.tabStyle'), submenu: ['classic', 'drift', 'lens', 'thread', 'combo'].map((st) => ({ label: t('tabstyle.' + st), type: 'radio', checked: (b.settings.get('layout.tabStyle') || 'classic') === st, click: () => b.settings.set('layout.tabStyle', st) })) },
          item(t('menu.focusMode'), 'focusMode'),
          { type: 'separator' },
          { label: t('menu.theme'), submenu: ['system', 'light', 'dark'].map((m) => ({ label: t('theme.' + m), type: 'radio', checked: b.settings.get('appearance.mode') === m, click: () => b.settings.set('appearance.mode', m) })) },
          { label: t('menu.customize'), click: () => b.openInternal(win, 'settings', 'appearance') },
          { label: t('menu.resetDesign'), click: () => b.resetDesign(win) }
        ]
      },
      {
        label: t('menu.tools'),
        submenu: [
          item(t('menu.devtools'), 'devtools'),
          item(t('menu.viewSource'), 'viewSource'),
          item(t('menu.translate'), 'translate'),
          { type: 'separator' },
          { label: t('menu.clearData'), click: () => b.openInternal(win, 'settings', 'privacy') },
          { label: t('menu.taskManager'), click: () => b.showTaskManager(win) }
        ]
      },
      { type: 'separator' },
      item(t('menu.settings'), 'openSettings'),
      { label: t('menu.about'), click: () => b.openInternal(win, 'settings', 'about') },
      { label: t('menu.help'), click: () => win.createTab({ url: 'https://github.com/jessehaemmerle/web-browser#readme', active: true }) },
      { type: 'separator' },
      item(t('menu.quit'), 'quit')
    ];
    Menu.buildFromTemplate(items).popup({ window: win.win, x: point && point.x, y: point && point.y });
  }
}

module.exports = { ContextMenu };
