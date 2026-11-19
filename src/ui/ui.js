/* Nimbus browser interface logic. */
'use strict';
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const api = window.nimbus;
  const call = (m, ...a) => api.call(m, ...a);
  const params = new URLSearchParams(location.search);
  const IS_PRIVATE = params.get('private') === '1';

  let S = null;            // settings
  let strings = {};
  let state = { tabs: [], groups: [], activeId: null, split: null };
  let bookmarks = null;
  let downloads = [];
  let winState = {};
  let hasExtensions = false;
  let focusMode = false;

  // ------------------------------------------------------------------ helpers
  const t = (key, vars) => {
    let s = strings[key];
    if (s === undefined) s = key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
    return s;
  };
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const icon = (name, cls = '') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ic ' + cls);
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  };
  const setIcon = (btn, name) => { const u = btn.querySelector('use'); if (u) u.setAttribute('href', '#i-' + name); };
  const activeTab = () => state.tabs.find((x) => x.id === state.activeId) || null;
  const isNewTab = (url) => !url || url.startsWith('nimbus://newtab');
  const pointOf = (e) => ({ x: Math.round(e.clientX), y: Math.round(e.clientY) });
  const below = (node) => { const r = node.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.bottom + 2) }; };
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // the UI is drawn above the pages while any of these need it (popover, preview, split drag)
  const overlayUsers = new Set();
  function overlayUse(key, on) {
    const before = overlayUsers.size > 0;
    if (on) overlayUsers.add(key); else overlayUsers.delete(key);
    const after = overlayUsers.size > 0;
    if (before !== after) call('setOverlay', after);
  }

  function applyI18n(root = document) {
    for (const n of $$('[data-i18n]', root)) n.textContent = t(n.dataset.i18n);
    for (const n of $$('[data-i18n-title]', root)) { n.title = t(n.dataset.i18nTitle); n.setAttribute('aria-label', n.title); }
    for (const n of $$('[data-i18n-placeholder]', root)) n.placeholder = t(n.dataset.i18nPlaceholder);
  }

  // ------------------------------------------------------------------ theme + layout classes
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const theme = NimbusTheme.compute(S.appearance, darkMq.matches);
    $('#theme-vars').textContent = theme.css;
    $('#user-css').textContent = S.appearance.uiCss || '';
    document.documentElement.dataset.scheme = theme.scheme;
    document.body.classList.toggle('no-anim', S.appearance.animations === false);
    lastSiteTint = null;
    applyBarTint(activeTab());
  }
  darkMq.addEventListener('change', () => S && applyTheme());

  function applyLayout() {
    const L = S.layout;
    const b = document.body;
    const side = L.tabPosition === 'left' || L.tabPosition === 'right';
    b.classList.toggle('tabs-top', !side);
    b.classList.toggle('tabs-side', side);
    b.classList.toggle('tabs-left', L.tabPosition === 'left');
    b.classList.toggle('tabs-right', L.tabPosition === 'right');
    b.classList.toggle('compact', !!L.compact);
    b.classList.toggle('sidebar-collapsed', side && !!L.verticalTabsCollapsed);
    b.classList.toggle('private', IS_PRIVATE);
    for (const c of ['fixed', 'fit', 'compact']) b.classList.toggle('tab-width-' + c, L.tabWidth === c);
    const style = L.tabStyle || 'classic';
    for (const c of ['classic', 'drift', 'lens', 'thread']) b.classList.toggle('ts-' + c, style === c || (style === 'combo' && (c === 'drift' || c === 'thread')));
    b.classList.toggle('tab-tint', !!L.tabTint);
    b.classList.toggle('tint-scope-tab', !!L.tabTint && L.tintScope === 'tab');
    lastSiteTint = null;
    b.classList.toggle('tab-pulse', !!L.tabPulse);
    if (style !== 'lens') clearLensStyles();
    for (const c of ['always', 'hover', 'active', 'never']) b.classList.toggle('close-' + c, L.tabCloseButton === c);
    document.documentElement.style.setProperty('--sidebar-w', Math.max(160, Math.min(480, L.verticalTabWidth || 240)) + 'px');
    $('#private-badge').hidden = !IS_PRIVATE;
    buildToolbar();
    renderBookmarksBar();
    renderTabs();
    queueRects();
  }

  function applyWindowState() {
    const b = document.body;
    b.classList.toggle('integrated', !!winState.integratedTitlebar && !winState.fullscreen);
    b.classList.toggle('html-fullscreen', !!winState.htmlFullscreen);
    b.classList.toggle('blurred', winState.focused === false);
    b.classList.add('platform-' + (winState.platform || 'linux'));
    // space reserved for the OS window buttons (title bar overlay)
    const wco = winState.integratedTitlebar && !winState.fullscreen ? (winState.platform === 'win32' ? 140 : 110) : 0;
    document.documentElement.style.setProperty('--wco', wco + 'px');
    queueRects();
  }

  // ------------------------------------------------------------------ toolbar buttons
  const BUTTONS = {
    back: () => btn('back', 'ui.back', () => call('command', 'back'), { onauxclick: (e) => e.button === 1 && call('command', 'duplicateTab') }),
    forward: () => btn('forward', 'ui.forward', () => call('command', 'forward')),
    reload: () => btn('reload', 'ui.reload', (e) => call('command', e.shiftKey ? 'hardReload' : (activeTab() || {}).loading ? 'stop' : 'reload')),
    home: () => btn('home', 'ui.home', () => call('command', 'home')),
    shield: () => btn('shield', 'ui.protection', (e) => openShield(e.currentTarget)),
    bookmark: () => btn('folder', 'ui.bookmarks', (e) => call('folderMenu', 'bar', below(e.currentTarget)), { id: 'bm-menu-btn' }),
    extensions: () => {
      if (!hasExtensions) return null;
      const wrap = el('div', { class: 'toolbar-group ext-group' });
      wrap.append(el('browser-action-list', { alignment: 'bottom left' }));
      return wrap;
    },
    downloads: () => btn('download', 'ui.downloads', (e) => openDownloads(e.currentTarget), { id: 'dl-btn' }),
    split: () => btn('split', 'ui.split', () => call('command', 'toggleSplit'), { id: 'split-btn' }),
    history: () => btn('history', 'ui.history', () => call('command', 'openHistory')),
    sidebar: () => btn('sidebar', 'ui.toggleTabs', () => call('command', 'toggleTabLayout')),
    menu: () => btn('menu', 'ui.menu', (e) => call('mainMenu', below(e.currentTarget)), { id: 'menu-btn' })
  };
  const buttons = {};
  function btn(iconName, titleKey, onclick, extra = {}) {
    const b = el('button', { class: 'icon-btn', title: t(titleKey), 'aria-label': t(titleKey), onclick, ...extra });
    b.append(icon(iconName));
    return b;
  }
  function buildToolbar() {
    const left = $('#toolbar-buttons-left');
    const right = $('#toolbar-buttons-right');
    left.textContent = ''; right.textContent = '';
    let side = left;
    const list = (S.layout.toolbarButtons || []).slice();
    if (!list.some((b) => b.id === 'address')) list.splice(3, 0, { id: 'address', visible: true });
    if (!list.some((b) => b.id === 'menu')) list.push({ id: 'menu', visible: true });
    for (const b of list) {
      if (b.id === 'address') { side = right; continue; }
      if (!b.visible && b.id !== 'menu') continue;
      const make = BUTTONS[b.id];
      if (!make) continue;
      const node = make();
      if (!node) continue;
      buttons[b.id] = node;
      side.append(node);
    }
    for (const k of Object.keys(buttons)) if (!list.find((b) => b.id === k && (b.visible || k === 'menu'))) delete buttons[k];
    updateToolbar();
    updateDownloadsButton();
  }

  function updateToolbar() {
    const tab = activeTab();
    if (buttons.back) buttons.back.disabled = !tab || !tab.canGoBack;
    if (buttons.forward) buttons.forward.disabled = !tab || !tab.canGoForward;
    if (buttons.reload) { setIcon(buttons.reload, tab && tab.loading ? 'stop' : 'reload'); buttons.reload.title = t(tab && tab.loading ? 'ui.stop' : 'ui.reload'); }
    if (buttons.split) buttons.split.classList.toggle('on', !!state.split);
    if (buttons.shield) {
      const sh = buttons.shield;
      const on = tab ? tab.protection && S.privacy.adblock : true;
      setIcon(sh, on ? 'shield' : 'shield-off');
      sh.classList.toggle('protection-off', !on);
      let badge = sh.querySelector('.btn-badge');
      const n = tab && on ? tab.blocked : 0;
      if (n > 0) {
        if (!badge) { badge = el('span', { class: 'btn-badge' }); sh.append(badge); }
        badge.textContent = n > 99 ? '99+' : String(n);
      } else if (badge) badge.remove();
    }
    const star = $('#star-btn');
    star.classList.toggle('on', !!(tab && tab.bookmarked));
    star.hidden = !tab || isNewTab(tab.url);
    const zb = $('#zoom-badge');
    if (tab && Math.abs((tab.zoom || 1) - (S.sites.defaultZoom || 1)) > 0.001) { zb.hidden = false; zb.textContent = Math.round(tab.zoom * 100) + ' %'; zb.title = t('ui.zoomReset'); }
    else zb.hidden = true;
    updateSiteButton(tab);
    applyBarTint(tab);
    updateAddress(false);
    $('#progress').classList.toggle('on', !!(tab && tab.loading));
  }

  // ---- the whole top bar takes on the website's colour
  let lastSiteTint = null;
  function applyBarTint(tab) {
    if (!S) return;
    const on = S.layout.tabTint && (S.layout.tintScope || 'bar') === 'bar' && tab && !isNewTab(tab.url) && validColor(tab.tint);
    let pal = null;
    if (on) {
      const base = NimbusTheme.compute(S.appearance, darkMq.matches).palette;
      pal = NimbusTheme.sitePalette(tab.tint, base, { soft: tab.tintSource === 'favicon' });
    }
    const key = pal ? JSON.stringify(pal) : '';
    if (key === lastSiteTint) return;
    lastSiteTint = key;
    document.body.classList.toggle('bar-tinted', !!pal);
    document.body.classList.toggle('bar-tinted-dark', !!(pal && pal.dark));
    $('#site-tint').textContent = pal ? `body.bar-tinted #tabstrip, body.bar-tinted #toolbar, body.bar-tinted #bookmarks-bar {
      --n-frame: ${pal.frame}; --n-toolbar: ${pal.toolbar}; --n-surface: ${pal.surface}; --n-text: ${pal.text}; --n-muted: ${pal.muted};
      --n-border: ${pal.border}; --n-hover: ${pal.hover}; --n-accent: ${pal.accent}; --n-accent-text: ${pal.accentText}; color: var(--n-text); }` : '';
    call('setSiteColors', pal ? { frame: pal.frame, toolbar: pal.toolbar, text: pal.text } : null);
  }

  function updateSiteButton(tab) {
    const b = $('#site-btn');
    b.classList.remove('insecure');
    const lbl = b.querySelector('.label'); if (lbl) lbl.remove();
    if (!tab || isNewTab(tab.url)) { setIcon(b, 'search'); b.title = t('ui.search'); return; }
    const url = tab.url || '';
    if (url.startsWith('nimbus://')) { setIcon(b, 'nimbus'); b.title = 'Nimbus'; b.append(el('span', { class: 'label', text: 'Nimbus' })); }
    else if (tab.secure === true) { setIcon(b, 'lock'); b.title = t('site.secure'); }
    else if (tab.secure === false) { setIcon(b, 'warn'); b.classList.add('insecure'); b.title = t('site.insecure'); b.append(el('span', { class: 'label', text: t('site.notSecure') })); }
    else if (url.startsWith('file:')) { setIcon(b, 'folder'); b.title = t('site.file'); }
    else { setIcon(b, 'info'); b.title = t('ui.siteInfo'); }
  }

  // ------------------------------------------------------------------ address bar
  const addr = $('#address');
  let addrEditing = false;
  let addrTyped = '';
  function updateAddress(force) {
    if (addrEditing && !force) return;
    const tab = activeTab();
    const url = tab ? tab.url : '';
    const focused = document.activeElement === addr;
    addr.value = focused ? (isNewTab(url) ? '' : url) : NimbusUrl.displayUrl(url, { simplify: S.layout.addressBarSimplify });
  }
  addr.addEventListener('focus', () => {
    const tab = activeTab();
    if (!addrEditing) addr.value = tab && !isNewTab(tab.url) ? tab.url : '';
    requestAnimationFrame(() => addr.select());
  });
  addr.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === addr) return;
      addrEditing = false;
      if (popover && popover.kind === 'suggest') closePopover();
      updateAddress(true);
    }, 120);
  });
  let sugTimer = null;
  let sugSeq = 0;
  let sugItems = [];
  let sugIndex = -1;
  addr.addEventListener('input', (e) => {
    addrEditing = true;
    const deleting = e.inputType && e.inputType.startsWith('delete');
    addrTyped = addr.value;
    clearTimeout(sugTimer);
    if (!addr.value.trim()) { if (popover && popover.kind === 'suggest') closePopover(); return; }
    sugTimer = setTimeout(() => fetchSuggestions(addrTyped, !deleting), 50);
  });
  addr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let value = addr.value;
      const sel = sugIndex >= 0 && sugItems[sugIndex];
      closePopover();
      addrEditing = false;
      if (sel && sel.type === 'tab') { call('switchToTab', sel.windowId, sel.tabId); return; }
      if (sel) value = sel.url;
      else if (e.ctrlKey && !/[\s./:]/.test(value)) value = 'www.' + value + '.com';
      call('navigate', value, { newTab: e.altKey });
      addr.blur();
    } else if (e.key === 'Escape') {
      if (popover && popover.kind === 'suggest') { closePopover(); addr.value = addrTyped || addr.value; return; }
      addrEditing = false;
      updateAddress(true);
      addr.select();
      call('focusPage');
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sugItems.length) return;
      e.preventDefault();
      sugIndex = (sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length + 1) % (sugItems.length + 1);
      if (sugIndex === sugItems.length) sugIndex = -1;
      const item = sugItems[sugIndex];
      addr.value = item ? (item.type === 'search' ? item.title : item.url) : addrTyped;
      highlightSuggestion();
    } else if (e.key === 'Delete' && e.shiftKey && sugIndex >= 0) {
      e.preventDefault();
    }
  });

  async function fetchSuggestions(text, allowInline) {
    const seq = ++sugSeq;
    const items = await call('suggest', text);
    if (seq !== sugSeq || document.activeElement !== addr || addr.value !== text) return;
    sugItems = items;
    sugIndex = -1;
    // inline completion of a previously visited host
    if (allowInline) {
      const first = items.find((i) => i.type === 'history' || i.type === 'bookmark');
      if (first) {
        const bare = first.url.replace(/^https?:\/\/(www\.)?/, '');
        if (bare.toLowerCase().startsWith(text.toLowerCase()) && text.length >= 2 && !/\s/.test(text)) {
          const host = bare.split('/')[0];
          const completion = host.toLowerCase().startsWith(text.toLowerCase()) ? host : bare;
          if (completion.length > text.length) {
            addr.value = text + completion.slice(text.length);
            addr.setSelectionRange(text.length, addr.value.length);
          }
        }
      }
    }
    showSuggestions(text);
  }

  function showSuggestions(text) {
    if (!sugItems.length) { if (popover && popover.kind === 'suggest') closePopover(); return; }
    const wrap = $('#address-wrap').getBoundingClientRect();
    const box = el('div', { class: 'popover suggest', role: 'listbox' });
    const hl = (s) => {
      const i = s.toLowerCase().indexOf(text.toLowerCase());
      if (!text || i < 0) return escapeHtml(s);
      return escapeHtml(s.slice(0, i)) + '<mark>' + escapeHtml(s.slice(i, i + text.length)) + '</mark>' + escapeHtml(s.slice(i + text.length));
    };
    sugItems.forEach((it, i) => {
      const ic = { history: 'history', bookmark: 'star', search: 'search', url: 'globe', tab: 'tab' }[it.type] || 'globe';
      const row = el('div', { class: 'sug', role: 'option', 'data-i': i });
      row.append(icon(ic));
      const title = el('span', { class: 't' }); title.innerHTML = hl(it.title || it.url);
      row.append(title);
      if (it.type === 'search') row.append(el('span', { class: 'u', text: '— ' + t('sug.searchWith', { engine: it.engine }) }));
      else if (it.type !== 'url') { const u = el('span', { class: 'u' }); u.innerHTML = hl(NimbusUrl.displayUrl(it.url)); row.append(u); }
      if (it.type === 'tab') row.append(el('span', { class: 'tag', text: t('sug.switchToTab') }));
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        closePopover();
        addrEditing = false;
        if (it.type === 'tab') call('switchToTab', it.windowId, it.tabId);
        else call('navigate', it.url, { newTab: e.button === 1 || e.ctrlKey });
        addr.blur();
      });
      box.append(row);
    });
    openPopover('suggest', box, { x: wrap.left, y: wrap.bottom + 4, width: wrap.width, keepFocus: true });
  }
  function highlightSuggestion() {
    if (!popover) return;
    $$('.sug', popover.node).forEach((r, i) => r.classList.toggle('sel', i === sugIndex));
  }

  $('#zoom-badge').addEventListener('click', () => call('command', 'zoomReset'));
  $('#site-btn').addEventListener('click', (e) => { const tab = activeTab(); if (!tab || isNewTab(tab.url)) addr.focus(); else openSiteInfo(e.currentTarget); });
  $('#star-btn').addEventListener('click', () => openBookmarkEditor());

  // ------------------------------------------------------------------ tabs
  const tabEls = new Map();
  const groupEls = new Map();
  const stackEls = new Map();
  let expandedStack = null;
  function tabsContainer() { return document.body.classList.contains('tabs-side') ? $('#vtabs') : $('#tabs'); }
  const isVertical = () => document.body.classList.contains('tabs-side');
  const tabStyle = () => (S && S.layout.tabStyle) || 'classic';
  const hasStyle = (name) => { const s = tabStyle(); return s === name || (s === 'combo' && (name === 'drift' || name === 'thread')); };
  const siteKey = (url) => (NimbusUrl.hostOf(url) || '').replace(/^www\./, '');
  const validColor = (c) => typeof c === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i.test(c.trim());

  function makeTabEl(tab) {
    const node = el('div', { class: 'tab', role: 'tab', draggable: 'true', 'data-id': tab.id });
    const text = el('span', { class: 'tab-text' }, el('span', { class: 'tab-title' }), el('span', { class: 'tab-sub' }));
    node.append(el('span', { class: 'tab-icon' }), el('span', { class: 'tab-dot', 'aria-hidden': 'true' }), text);
    const audio = el('button', { class: 'tab-audio', tabindex: '-1' }); audio.append(icon('volume'), el('span', { class: 'eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')));
    const close = el('button', { class: 'tab-close', tabindex: '-1', title: t('tab.close') }); close.append(icon('close'));
    node.append(audio, close, el('span', { class: 'tab-wave', 'aria-hidden': 'true' }));
    audio.addEventListener('click', (e) => { e.stopPropagation(); call('tabMute', tab.id); });
    close.addEventListener('click', (e) => { e.stopPropagation(); call('tabClose', Number(node.dataset.id)); });
    node.addEventListener('mousedown', (e) => {
      hidePreview();
      if (e.button === 0 && !e.target.closest('button')) call('tabActivate', Number(node.dataset.id));
      if (e.button === 1) e.preventDefault();
    });
    node.addEventListener('auxclick', (e) => { if (e.button === 1 && S.tabs.middleClickClose) call('tabClose', Number(node.dataset.id)); });
    node.addEventListener('dblclick', (e) => e.stopPropagation());
    node.addEventListener('contextmenu', (e) => { e.preventDefault(); hidePreview(); call('tabMenu', Number(node.dataset.id), pointOf(e)); });
    node.addEventListener('dragstart', (e) => { hidePreview(); onTabDragStart(e); });
    node.addEventListener('dragend', onTabDragEnd);
    node.addEventListener('mouseenter', () => { schedulePreview(node, Number(node.dataset.id)); if (node.classList.contains('stack-member')) keepStackOpen(); });
    node.addEventListener('mouseleave', () => { hidePreview(); if (node.classList.contains('stack-member')) closeStackSoon(); });
    return node;
  }

  /** Drift: how much attention a tab currently gets. */
  function tierOf(tab, now) {
    if (tab.id === state.activeId || (state.split && (state.split.a === tab.id || state.split.b === tab.id))) return 'active';
    if (tab.pinned) return 'pinned';
    if (tab.audible) return 'recent';
    if (tab.sleeping) return 'drop';
    const age = now - (tab.lastActive || now);
    if (age < 10 * 60e3) return 'recent';
    if (age < 45 * 60e3) return 'mid';
    if (age < 3 * 3600e3) return 'old';
    return 'drop';
  }

  function updateTabEl(node, tab, now) {
    const pulse = S.layout.tabPulse;
    node.classList.toggle('active', tab.id === state.activeId);
    node.classList.toggle('pinned', !!tab.pinned);
    node.classList.toggle('sleeping', !!tab.sleeping);
    node.classList.toggle('audible', !!tab.audible);
    node.classList.toggle('muted', !!tab.muted);
    node.classList.toggle('loading', !!tab.loading);
    node.classList.toggle('attention', !!(pulse && tab.attention));
    node.classList.toggle('split-member', !!(state.split && (state.split.a === tab.id || state.split.b === tab.id)));
    node.setAttribute('aria-selected', tab.id === state.activeId ? 'true' : 'false');
    node.dataset.tier = hasStyle('drift') ? tierOf(tab, now) : '';
    const title = tab.title || (isNewTab(tab.url) ? t('tab.newTab') : NimbusUrl.displayUrl(tab.url) || t('tab.untitled'));
    const tt = node.querySelector('.tab-title');
    if (tt.textContent !== title) tt.textContent = title;
    node.querySelector('.tab-sub').textContent = isNewTab(tab.url) ? '' : siteKey(tab.url) || NimbusUrl.displayUrl(tab.url);
    // with live previews the native tooltip would only get in the way
    node.title = S.layout.tabPreview ? '' : title + (tab.sleeping ? ' — ' + t('tab.sleeping') : '') + (tab.url && !isNewTab(tab.url) ? '\n' + NimbusUrl.displayUrl(tab.url, { simplify: false }) : '');
    node.setAttribute('aria-label', title);
    const iconBox = node.querySelector('.tab-icon');
    // activity pulse keeps the favicon while loading and shows a wave instead of a spinner
    const loadingIcon = tab.loading && !(pulse && tab.favicon);
    const key = loadingIcon ? 'loading' : tab.crashed ? 'crash' : tab.favicon ? 'fav:' + tab.favicon : isNewTab(tab.url) ? 'nimbus' : (tab.url || '').startsWith('nimbus://') ? 'nimbus' : 'globe';
    if (iconBox.dataset.key !== key) {
      iconBox.dataset.key = key;
      iconBox.textContent = '';
      if (key === 'loading') iconBox.append(el('span', { class: 'spinner' }));
      else if (key === 'crash') iconBox.append(icon('warn'));
      else if (key.startsWith('fav:')) {
        const img = el('img', { src: tab.favicon, alt: '', draggable: 'false' });
        img.onerror = () => { iconBox.textContent = ''; iconBox.append(icon('globe')); };
        iconBox.append(img);
      } else iconBox.append(icon(key));
    }
    setIcon(node.querySelector('.tab-audio'), tab.muted ? 'mute' : 'volume');
    node.querySelector('.tab-audio').title = t(tab.muted ? 'tab.unmute' : 'tab.mute');
    const tinted = S.layout.tabTint && validColor(tab.tint);
    node.classList.toggle('tinted', !!tinted);
    if (tinted) node.style.setProperty('--tint', tab.tint); else node.style.removeProperty('--tint');
    const g = tab.groupId && state.groups.find((x) => x.id === tab.groupId);
    if (g) { node.dataset.group = g.id; node.dataset.color = g.color; } else { delete node.dataset.group; delete node.dataset.color; }
    node.classList.toggle('group-hidden', !!(g && g.collapsed && tab.id !== state.activeId));
  }

  function makeGroupEl(g) {
    const node = el('div', { class: 'group-chip', 'data-group-id': g.id, draggable: 'false', tabindex: '0', role: 'button' });
    node.append(el('span'));
    node.addEventListener('click', () => call('groupUpdate', node.dataset.groupId, { collapsed: !node.classList.contains('collapsed') }));
    node.addEventListener('contextmenu', (e) => { e.preventDefault(); call('groupMenu', node.dataset.groupId, pointOf(e)); });
    node.addEventListener('dblclick', (e) => { e.stopPropagation(); openGroupEditor(node.dataset.groupId); });
    return node;
  }

  // ---- stacks: 3+ background tabs of the same site collapse into one
  function computeStacks() {
    const stacks = new Map();
    if (!S.layout.tabStacks) return stacks;
    const by = new Map();
    for (const tab of state.tabs) {
      if (tab.id === state.activeId || tab.pinned || tab.groupId || !/^https?:/.test(tab.url || '')) continue;
      if (state.split && (state.split.a === tab.id || state.split.b === tab.id)) continue;
      const k = siteKey(tab.url);
      if (!k) continue;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(tab);
    }
    for (const [k, list] of by) if (list.length >= 3) stacks.set(k, list);
    return stacks;
  }
  function makeStackEl(key) {
    const node = el('div', { class: 'tab stack', role: 'button', tabindex: '0', 'data-stack': key });
    node.append(el('span', { class: 'stack-icons' }), el('span', { class: 'tab-text' }, el('span', { class: 'tab-title' }), el('span', { class: 'tab-sub' })), el('span', { class: 'stack-count' }));
    const open = () => { expandedStack = node.dataset.stack; renderTabs(); };
    node.addEventListener('click', () => {
      // click activates the most recently used tab of the site
      const members = (lastStacks.get(node.dataset.stack) || []).slice().sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      if (members[0]) call('tabActivate', members[0].id);
    });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    node.addEventListener('mouseenter', () => { keepStackOpen(); clearTimeout(stackTimer); stackTimer = setTimeout(open, 260); });
    node.addEventListener('mouseleave', () => { clearTimeout(stackTimer); closeStackSoon(); });
    return node;
  }
  let stackTimer = null, stackCloseTimer = null, lastStacks = new Map();
  function keepStackOpen() { clearTimeout(stackCloseTimer); }
  function closeStackSoon() {
    clearTimeout(stackCloseTimer);
    stackCloseTimer = setTimeout(() => { if (expandedStack) { expandedStack = null; renderTabs(); } }, 480);
  }
  function updateStackEl(node, key, members) {
    const recent = members.slice().sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    const icons = node.querySelector('.stack-icons');
    const favs = recent.map((m) => m.favicon).filter(Boolean).slice(0, 3);
    const sig = favs.join('|');
    if (icons.dataset.sig !== sig || !icons.childElementCount) {
      icons.dataset.sig = sig;
      icons.textContent = '';
      const layers = favs.length ? favs : [''];
      layers.slice().reverse().forEach((f) => {
        const layer = el('span', { class: 'stack-layer' });
        if (f) { const img = el('img', { src: f, alt: '', draggable: 'false' }); img.onerror = () => img.replaceWith(icon('globe')); layer.append(img); } else layer.append(icon('globe'));
        icons.append(layer);
      });
    }
    node.querySelector('.tab-title').textContent = key;
    node.querySelector('.tab-sub').textContent = t('stack.tabs', { count: members.length });
    node.querySelector('.stack-count').textContent = String(members.length);
    node.setAttribute('aria-label', t('stack.label', { count: members.length, host: key }));
    node.classList.toggle('open', expandedStack === key);
    node.classList.toggle('attention', S.layout.tabPulse && members.some((m) => m.attention));
    node.classList.toggle('audible', members.some((m) => m.audible && !m.muted));
    const tint = members.map((m) => m.tint).find(validColor);
    const tinted = S.layout.tabTint && tint;
    node.classList.toggle('tinted', !!tinted);
    if (tinted) node.style.setProperty('--tint', tint); else node.style.removeProperty('--tint');
    node.dataset.tier = hasStyle('drift') ? (members.every((m) => tierOf(m, Date.now()) === 'drop') ? 'drop' : 'old') : '';
  }

  function renderTabs() {
    if (!S) return;
    const now = Date.now();
    const container = tabsContainer();
    const other = container.id === 'tabs' ? $('#vtabs') : $('#tabs');
    // move existing elements if layout switched
    for (const n of [...other.children]) if (!n.classList.contains('drop-indicator')) container.append(n);
    const stacks = computeStacks();
    lastStacks = stacks;
    if (expandedStack && !stacks.has(expandedStack)) expandedStack = null;
    const stackOf = new Map();
    for (const [k, list] of stacks) for (const m of list) stackOf.set(m.id, k);
    const emittedStacks = new Set();
    const wanted = [];
    const seenGroups = new Set();
    const emitTab = (tab, extraClass) => {
      let node = tabEls.get(tab.id);
      if (!node) { node = makeTabEl(tab); tabEls.set(tab.id, node); }
      updateTabEl(node, tab, now);
      node.classList.toggle('stack-member', extraClass === 'stack-member');
      wanted.push(node);
    };
    for (const tab of state.tabs) {
      if (tab.groupId && !seenGroups.has(tab.groupId)) {
        seenGroups.add(tab.groupId);
        const g = state.groups.find((x) => x.id === tab.groupId);
        if (g) {
          let gn = groupEls.get(g.id);
          if (!gn) { gn = makeGroupEl(g); groupEls.set(g.id, gn); }
          gn.dataset.color = g.color;
          gn.classList.toggle('collapsed', !!g.collapsed);
          gn.classList.toggle('empty-title', !g.title);
          gn.querySelector('span').textContent = g.title || '';
          const count = state.tabs.filter((x) => x.groupId === g.id).length;
          gn.title = (g.title || t('group.unnamed')) + ' — ' + t('group.tabs', { count });
          wanted.push(gn);
        }
      }
      const sk = stackOf.get(tab.id);
      if (sk) {
        if (emittedStacks.has(sk)) continue;
        emittedStacks.add(sk);
        let sn = stackEls.get(sk);
        if (!sn) { sn = makeStackEl(sk); stackEls.set(sk, sn); }
        updateStackEl(sn, sk, stacks.get(sk));
        wanted.push(sn);
        if (expandedStack === sk) for (const m of stacks.get(sk)) emitTab(m, 'stack-member');
        continue;
      }
      emitTab(tab);
    }
    const shown = new Set(wanted);
    for (const [id, node] of tabEls) {
      if (!state.tabs.some((x) => x.id === id)) { node.remove(); tabEls.delete(id); }
      else if (!shown.has(node)) node.remove();
    }
    for (const [id, node] of groupEls) if (!seenGroups.has(id)) { node.remove(); groupEls.delete(id); }
    for (const [k, node] of stackEls) if (!emittedStacks.has(k)) { node.remove(); stackEls.delete(k); }
    // reorder only when needed
    const current = [...container.children].filter((n) => !n.classList.contains('drop-indicator'));
    const same = current.length === wanted.length && current.every((n, i) => n === wanted[i]);
    if (!same) for (const n of wanted) container.append(n);
    applyThreadClasses();
    fitTabs();
    if (hasStyle('lens')) resetLens();
    scheduleThreads();
    const act = tabEls.get(state.activeId);
    if (act && !dragState && !lensActive) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // drift ages tabs over time – re-evaluate regularly
  setInterval(() => { if (S && hasStyle('drift')) renderTabs(); }, 30000);

  function fitTabs() {
    const classicNarrowing = !isVertical() && (tabStyle() === 'classic' || tabStyle() === 'thread');
    if (!classicNarrowing) { for (const n of tabEls.values()) n.classList.remove('narrow'); }
    const container = $('#tabs');
    const avail = $('#tabstrip').clientWidth - 120;
    if (classicNarrowing) {
      const count = state.tabs.filter((x) => !x.pinned).length || 1;
      const per = avail / count;
      for (const n of tabEls.values()) n.classList.toggle('narrow', per < 64 && !n.classList.contains('pinned'));
    }
    container.style.maxWidth = Math.max(100, avail + 40) + 'px';
  }

  // ---- threads: show which tab was opened from which
  function threadDepth(tab, byId) {
    let d = 0;
    for (let p = tab; p && p.openerId && byId.has(p.openerId) && d < 4; p = byId.get(p.openerId)) d++;
    return d;
  }
  function applyThreadClasses() {
    const on = hasStyle('thread');
    const byId = new Map(state.tabs.map((x) => [x.id, x]));
    for (const tab of state.tabs) {
      const node = tabEls.get(tab.id);
      if (!node) continue;
      const parentShown = on && tab.openerId && tabEls.get(tab.openerId) && tabEls.get(tab.openerId).isConnected;
      node.classList.toggle('child', !!parentShown);
      node.style.setProperty('--depth', parentShown ? String(threadDepth(tab, byId)) : '0');
    }
  }
  let threadFrames = 0;
  function scheduleThreads() {
    if (!hasStyle('thread') || isVertical()) { const svg = $('#threads'); if (svg) svg.textContent = ''; return; }
    const running = threadFrames > 0;
    threadFrames = 24; // keep redrawing while widths animate
    if (running) return;
    const loop = () => { drawThreads(); if (--threadFrames > 0) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  function drawThreads() {
    let svg = $('#threads');
    const strip = $('#tabstrip');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'threads';
      svg.setAttribute('aria-hidden', 'true');
      strip.append(svg);
    }
    const sr = strip.getBoundingClientRect();
    const tabsBox = $('#tabs').getBoundingClientRect();
    const parts = [];
    for (const tab of state.tabs) {
      if (!tab.openerId) continue;
      const c = tabEls.get(tab.id), p = tabEls.get(tab.openerId);
      if (!c || !p || !c.isConnected || !p.isConnected || c.classList.contains('group-hidden') || p.classList.contains('group-hidden')) continue;
      const cr = c.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const clip = (x) => x >= tabsBox.left - 2 && x <= tabsBox.right + 2;
      const px = pr.left + Math.min(pr.width / 2, 26) - sr.left + (pr.width > 60 ? 6 : 0);
      const cx = cr.left + Math.min(cr.width / 2, 22) - sr.left;
      if (!clip(px + sr.left) && !clip(cx + sr.left)) continue;
      const py = pr.top - sr.top + 1, cy = cr.top - sr.top + 1;
      const lift = Math.max(4, Math.min(py, cy) - 3);
      const peak = Math.min(py, cy) - lift;
      const color = p.classList.contains('tinted') ? getComputedStyle(p).getPropertyValue('--tint').trim() : 'var(--n-accent)';
      parts.push(`<path d="M${px.toFixed(1)} ${py.toFixed(1)} C ${px.toFixed(1)} ${peak.toFixed(1)}, ${cx.toFixed(1)} ${peak.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}" style="stroke:${color}"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" style="fill:${color}"/>`);
    }
    svg.innerHTML = parts.join('');
  }
  $('#tabs').addEventListener('scroll', () => scheduleThreads(), { passive: true });

  // ---- lens: tabs near the pointer grow, the rest stay small
  let lensActive = false;
  const LENS = { minW: 40, maxW: 220, minH: 26, maxH: 50 };
  function lensItems() { return [...tabsContainer().children].filter((n) => (n.classList.contains('tab') && !n.classList.contains('group-hidden') && !n.classList.contains('pinned'))); }
  function lensNeeded(items) {
    if (isVertical()) return true;
    const avail = $('#tabstrip').clientWidth - 140;
    return items.length * 150 > avail;
  }
  function resetLens() {
    lensActive = false;
    const items = lensItems();
    const vertical = isVertical();
    const needed = lensNeeded(items);
    for (const n of items) {
      n.classList.remove('magnified');
      if (vertical) { n.style.height = (n.classList.contains('active') ? LENS.maxH - 10 : LENS.minH + 4) + 'px'; n.classList.toggle('lens-small', false); continue; }
      const w = !needed ? 150 : n.classList.contains('active') ? 190 : LENS.minW;
      n.style.width = w + 'px';
      n.classList.toggle('lens-small', w < 76);
    }
  }
  function applyLens(e) {
    const items = lensItems();
    if (!items.length || !lensNeeded(items)) return;
    const vertical = isVertical();
    const hovered = items.find((n) => { const r = n.getBoundingClientRect(); return vertical ? e.clientY >= r.top && e.clientY < r.bottom : e.clientX >= r.left && e.clientX < r.right; });
    if (!hovered) return;
    lensActive = true;
    const r = hovered.getBoundingClientRect();
    const frac = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    const h = items.indexOf(hovered) + Math.max(0, Math.min(1, frac)) - 0.5;
    items.forEach((n, i) => {
      const k = Math.exp(-Math.pow((i - h) / 1.35, 2));
      if (vertical) {
        const size = LENS.minH + (LENS.maxH - LENS.minH) * k;
        n.style.height = size.toFixed(1) + 'px';
        n.classList.toggle('magnified', size > 40);
      } else {
        const base = n.classList.contains('active') ? 120 : LENS.minW;
        const w = base + (LENS.maxW - base) * k;
        n.style.width = w.toFixed(1) + 'px';
        n.classList.toggle('lens-small', w < 76);
      }
    });
  }
  for (const c of [$('#tabs'), $('#vtabs')]) {
    c.addEventListener('mousemove', (e) => { if (hasStyle('lens') && !dragState) requestAnimationFrame(() => applyLens(e)); });
    c.addEventListener('mouseleave', () => { if (hasStyle('lens')) setTimeout(() => { if (!c.matches(':hover')) resetLens(); }, 120); });
  }
  function clearLensStyles() { for (const n of [...tabEls.values(), ...stackEls.values()]) { n.style.width = ''; n.style.height = ''; n.classList.remove('lens-small', 'magnified'); } }

  // ---- live preview card
  const previewEl = el('div', { class: 'tab-preview', role: 'tooltip', hidden: true });
  document.body.append(previewEl);
  let previewTimer = null, previewFor = null, previewShown = false;
  const thumbCache = new Map();
  function schedulePreview(node, tabId) {
    if (!S.layout.tabPreview || dragState || popover) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => showPreview(node, tabId), previewShown ? 60 : 480);
  }
  async function showPreview(node, tabId) {
    const tab = state.tabs.find((x) => x.id === tabId);
    if (!tab || !node.isConnected || popover || !node.matches(':hover')) return;
    previewFor = tabId;
    previewEl.textContent = '';
    const active = tab.id === state.activeId;
    previewEl.append(el('div', { class: 'pv-text' },
      el('div', { class: 'pv-title', text: tab.title || (isNewTab(tab.url) ? t('tab.newTab') : t('tab.untitled')) }),
      el('div', { class: 'pv-host', text: isNewTab(tab.url) ? 'Nimbus' : NimbusUrl.displayUrl(tab.url) }),
      tab.sleeping ? el('div', { class: 'pv-note', text: t('preview.sleeping') }) : null,
      tab.audible ? el('div', { class: 'pv-note', text: t(tab.muted ? 'preview.muted' : 'preview.playing') }) : null));
    let img = null;
    if (!active && !isNewTab(tab.url)) {
      img = el('img', { class: 'pv-img', alt: '' });
      const cached = thumbCache.get(tabId);
      if (cached) img.src = cached;
      previewEl.append(img);
    }
    const r = node.getBoundingClientRect();
    previewEl.hidden = false;
    previewEl.classList.toggle('instant', previewShown);
    const w = 268;
    if (isVertical()) {
      const right = S.layout.tabPosition === 'right';
      previewEl.style.left = (right ? r.left - w - 10 : r.right + 10) + 'px';
      previewEl.style.top = Math.max(6, Math.min(r.top - 6, innerHeight - 260)) + 'px';
    } else {
      previewEl.style.left = Math.max(6, Math.min(r.left, innerWidth - w - 6)) + 'px';
      previewEl.style.top = (r.bottom + 6) + 'px';
    }
    if (!previewShown) { previewShown = true; overlayUse('preview', true); }
    if (img) {
      const data = await call('tabPreview', tabId).catch(() => null);
      if (previewFor !== tabId) return;
      if (data) { thumbCache.set(tabId, data); img.src = data; } else img.remove();
    }
  }
  function hidePreview() {
    clearTimeout(previewTimer);
    previewFor = null;
    if (!previewShown) return;
    previewShown = false;
    previewEl.hidden = true;
    overlayUse('preview', false);
  }
  addEventListener('blur', hidePreview);
  addEventListener('wheel', hidePreview, { passive: true });

  $('#newtab-btn').addEventListener('click', () => call('command', 'newTab'));
  $('#vnewtab-btn').addEventListener('click', () => call('command', 'newTab'));
  $('#newtab-btn').addEventListener('auxclick', (e) => { if (e.button === 1) navigator.clipboard.readText().then((txt) => txt && call('navigate', txt, { newTab: true })).catch(() => {}); });
  for (const strip of [$('#tabstrip'), $('#vtabs')]) {
    strip.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tab, .group-chip, button')) return;
      if (S.tabs.doubleClickNewTab) call('command', 'newTab');
    });
    strip.addEventListener('wheel', (e) => {
      if (!S.tabs.scrollToSwitch || strip.id === 'vtabs') { if (strip.id !== 'vtabs') $('#tabs').scrollLeft += e.deltaY; return; }
      e.preventDefault();
      call('command', e.deltaY > 0 ? 'nextTab' : 'prevTab');
    }, { passive: false });
  }
  $('#sidebar-toggle').addEventListener('click', () => call('settingsSet', 'layout.verticalTabsCollapsed', !S.layout.verticalTabsCollapsed));

  // sidebar resize
  (() => {
    const h = $('#sidebar-resize');
    let start = null;
    h.addEventListener('pointerdown', (e) => { start = { x: e.clientX, w: $('#sidebar').offsetWidth }; h.setPointerCapture(e.pointerId); });
    h.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = (S.layout.tabPosition === 'right' ? -1 : 1) * (e.clientX - start.x);
      document.documentElement.style.setProperty('--sidebar-w', Math.max(160, Math.min(480, start.w + dx)) + 'px');
      queueRects();
    });
    h.addEventListener('pointerup', () => { if (!start) return; start = null; call('settingsSet', 'layout.verticalTabWidth', $('#sidebar').offsetWidth); });
  })();

  // ------------------------------------------------------------------ tab drag & drop
  let dragState = null;
  const indicator = el('div', { class: 'drop-indicator' });
  function onTabDragStart(e) {
    const node = e.currentTarget;
    dragState = { id: Number(node.dataset.id), dropped: false };
    node.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    const tab = state.tabs.find((x) => x.id === dragState.id);
    e.dataTransfer.setData('application/x-nimbus-tab', String(dragState.id));
    if (tab && tab.url) { e.dataTransfer.setData('text/uri-list', tab.url); e.dataTransfer.setData('text/plain', tab.url); }
  }
  async function onTabDragEnd(e) {
    const node = e.currentTarget;
    node.classList.remove('dragging');
    indicator.remove();
    const ds = dragState;
    dragState = null;
    if (!ds || ds.dropped) return;
    // dropped outside of the strip: move into another window or tear off into a new one
    const outside = e.clientX < 0 || e.clientY < 0 || e.clientX > innerWidth || e.clientY > innerHeight;
    if (outside && state.tabs.length > 1 && !IS_PRIVATE && (e.screenX || e.screenY)) {
      const point = { x: e.screenX, y: e.screenY };
      const target = await call('windowAtPoint', point);
      if (target) call('tabToWindow', ds.id, target);
      else call('tabDetach', ds.id, point);
    }
  }
  function dropIndex(container, e) {
    const vertical = container.classList.contains('vertical');
    const items = [...container.querySelectorAll('.tab[data-id]:not(.group-hidden)')];
    let index = state.tabs.length;
    let ref = null;
    for (const n of items) {
      const r = n.getBoundingClientRect();
      const mid = vertical ? r.top + r.height / 2 : r.left + r.width / 2;
      if ((vertical ? e.clientY : e.clientX) < mid) { ref = n; break; }
    }
    if (ref) index = state.tabs.findIndex((x) => x.id === Number(ref.dataset.id));
    return { index, ref, vertical, items };
  }
  for (const container of [$('#tabs'), $('#vtabs')]) {
    container.addEventListener('dragover', (e) => {
      const isTab = e.dataTransfer.types.includes('application/x-nimbus-tab');
      const isLink = e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain');
      if (!isTab && !isLink) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = isTab ? 'move' : 'copy';
      const { ref, vertical, items } = dropIndex(container, e);
      const cr = container.getBoundingClientRect();
      const last = items[items.length - 1];
      const target = ref || last;
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (vertical) {
        indicator.style.cssText = `left:6px;right:6px;top:${(ref ? r.top : r.bottom) - cr.top + container.scrollTop - 1}px`;
      } else {
        indicator.style.cssText = `top:${r.top - cr.top + 4}px;height:${r.height - 8}px;left:${(ref ? r.left : r.right) - cr.left + container.scrollLeft - 1}px`;
      }
      if (!indicator.isConnected) container.append(indicator);
    });
    container.addEventListener('dragleave', (e) => { if (!container.contains(e.relatedTarget)) indicator.remove(); });
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      indicator.remove();
      const { index, ref } = dropIndex(container, e);
      const tabId = Number(e.dataTransfer.getData('application/x-nimbus-tab'));
      if (tabId && dragState) {
        dragState.dropped = true;
        const from = state.tabs.findIndex((x) => x.id === tabId);
        const to = from < index ? index - 1 : index;
        const refTab = ref && state.tabs.find((x) => x.id === Number(ref.dataset.id));
        const prevTab = state.tabs[index - 1];
        // join the group of neighbours when dropped between two group members
        let groupId = null;
        if (refTab && prevTab && refTab.groupId && refTab.groupId === prevTab.groupId) groupId = refTab.groupId;
        call('tabMove', tabId, to, groupId);
        return;
      }
      const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').split('\n')[0].trim();
      if (url) call('newTab', { url: /^[a-z]+:/i.test(url) ? url : undefined, index }).then(() => { if (!/^[a-z]+:/i.test(url)) call('navigate', url); });
    });
  }

  // ------------------------------------------------------------------ bookmarks bar
  function renderBookmarksBar() {
    if (!S || !bookmarks) return;
    const mode = S.layout.showBookmarksBar;
    const tab = activeTab();
    const show = mode === 'always' || (mode === 'newtab' && tab && isNewTab(tab.url) && !tab.loading);
    const bar = $('#bookmarks-bar');
    const changed = bar.hidden === !!show;
    bar.hidden = !show;
    if (changed) queueRects();
    if (!show) return;
    const items = $('#bm-items');
    items.textContent = '';
    const nodes = bookmarks.bar.children;
    if (!nodes.length) items.append(el('span', { class: 'bm-empty', text: t('bm.barEmpty') }));
    for (const n of nodes) {
      const b = el('button', { class: 'bm-item', 'data-id': n.id, draggable: 'true', title: n.type === 'bookmark' ? `${n.title}\n${n.url}` : n.title });
      b.append(icon(n.type === 'folder' ? 'folder' : 'globe'), el('span', { text: n.title || (n.type === 'folder' ? t('bm.folder') : n.url) }));
      b.addEventListener('click', (e) => {
        if (n.type === 'folder') call('folderMenu', n.id, below(b));
        else if (e.ctrlKey || e.metaKey) call('openUrl', n.url, { newTab: true, background: true });
        else if (e.shiftKey) call('openUrl', n.url, { newWindow: true });
        else call('openUrl', n.url);
      });
      b.addEventListener('auxclick', (e) => { if (e.button === 1 && n.type === 'bookmark') call('openUrl', n.url, { newTab: true, background: true }); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); call('bookmarkMenu', n.id, pointOf(e)); });
      b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-nimbus-bookmark', n.id); if (n.url) e.dataTransfer.setData('text/uri-list', n.url); });
      b.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-nimbus-bookmark') || e.dataTransfer.types.includes('text/uri-list')) { e.preventDefault(); b.classList.add('drop-target'); } });
      b.addEventListener('dragleave', () => b.classList.remove('drop-target'));
      b.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); b.classList.remove('drop-target');
        const id = e.dataTransfer.getData('application/x-nimbus-bookmark');
        const idx = nodes.indexOf(n);
        if (id) { if (n.type === 'folder' && id !== n.id) call('bookmarkMove', id, n.id); else call('bookmarkMove', id, 'bar', idx); }
        else dropUrlToBar(e, n.type === 'folder' ? n.id : 'bar', n.type === 'folder' ? undefined : idx);
      });
      items.append(b);
    }
    requestAnimationFrame(() => {
      const overflow = items.scrollWidth > items.clientWidth + 2;
      $('#bm-more').hidden = !overflow;
    });
  }
  function dropUrlToBar(e, parentId, index) {
    const url = (e.dataTransfer.getData('text/uri-list') || '').split('\n')[0].trim();
    const tabId = Number(e.dataTransfer.getData('application/x-nimbus-tab'));
    const tab = tabId && state.tabs.find((x) => x.id === tabId);
    if (dragState) dragState.dropped = true;
    if (url) call('bookmarkAdd', { parentId, url, title: tab ? tab.title : url, index });
  }
  $('#bookmarks-bar').addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('application/x-nimbus-bookmark')) e.preventDefault(); });
  $('#bookmarks-bar').addEventListener('drop', (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-nimbus-bookmark');
    if (id) call('bookmarkMove', id, 'bar'); else dropUrlToBar(e, 'bar');
  });
  $('#bookmarks-bar').addEventListener('contextmenu', (e) => { if (!e.target.closest('.bm-item')) { e.preventDefault(); call('mainMenu', pointOf(e)); } });
  $('#bm-more').addEventListener('click', (e) => call('folderMenu', 'bar', below(e.currentTarget)));

  // ------------------------------------------------------------------ viewport rects / split
  let rectQueued = false;
  function queueRects() {
    if (rectQueued) return;
    rectQueued = true;
    requestAnimationFrame(() => { rectQueued = false; sendRects(); });
  }
  function sendRects() {
    const vp = $('#viewport').getBoundingClientRect();
    const r = { x: vp.left, y: vp.top, width: vp.width, height: vp.height };
    const divider = $('#split-divider');
    const tab = activeTab();
    const inSplit = state.split && tab && (state.split.a === tab.id || state.split.b === tab.id);
    if (inSplit) {
      const ratio = state.split.ratio || 0.5;
      const gap = 3;
      const wa = Math.round(r.width * ratio) - gap;
      divider.hidden = false;
      divider.style.left = Math.round(r.width * ratio) + 'px';
      call('setRects', [{ x: r.x, y: r.y, width: wa, height: r.height }, { x: r.x + wa + gap * 2, y: r.y, width: r.width - wa - gap * 2, height: r.height }]);
    } else {
      divider.hidden = true;
      call('setRects', [r]);
    }
  }
  new ResizeObserver(() => { queueRects(); fitTabs(); }).observe($('#viewport'));
  addEventListener('resize', () => { queueRects(); fitTabs(); });
  (() => {
    const d = $('#split-divider');
    let dragging = false;
    d.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dragging = true; d.classList.add('dragging'); d.setPointerCapture(e.pointerId); overlayUse('split', true); });
    d.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const vp = $('#viewport').getBoundingClientRect();
      state.split.ratio = Math.max(0.15, Math.min(0.85, (e.clientX - vp.left) / vp.width));
      queueRects();
    });
    d.addEventListener('pointerup', () => { if (!dragging) return; dragging = false; d.classList.remove('dragging'); call('splitRatio', state.split.ratio); overlayUse('split', false); });
    $('#split-swap').addEventListener('click', () => call('splitSwap'));
    $('#split-close').addEventListener('click', () => call('splitClose'));
  })();

  // ------------------------------------------------------------------ overlay / popovers
  let popover = null;   // { kind, node, onClose }
  const overlay = $('#overlay');
  const backdrop = $('#backdrop');
  function openPopover(kind, node, opts = {}) {
    closePopover(true);
    overlay.hidden = false;
    backdrop.classList.toggle('dim', !!opts.dim);
    overlay.append(node);
    hidePreview();
    popover = { kind, node, onClose: opts.onClose, modal: !!opts.modal };
    if (opts.width) node.style.width = opts.width + 'px';
    if (opts.x !== undefined) {
      const w = node.offsetWidth;
      const x = opts.alignRight ? opts.x - w : opts.x;
      node.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
      node.style.top = Math.max(8, opts.y) + 'px';
    }
    overlayUse('popover', true);
    if (!opts.keepFocus) {
      const f = node.querySelector('[autofocus], input:not([type=checkbox]), select, button.primary, button');
      if (f) setTimeout(() => f.focus(), 0);
    }
    return node;
  }
  function closePopover(replacing) {
    if (!popover) return;
    const p = popover;
    popover = null;
    p.node.remove();
    if (p.onClose) p.onClose();
    if (!replacing) {
      overlay.hidden = true;
      backdrop.classList.remove('dim');
      overlayUse('popover', false);
      if (p.kind === 'suggest') { sugItems = []; sugIndex = -1; }
      nextPrompt();
    }
  }
  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (popover && popover.modal) return;
    closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popover && popover.kind !== 'suggest') { e.preventDefault(); if (popover.onCancel) popover.onCancel(); closePopover(); }
  });

  // ------------------------------------------------------------------ site info
  async function openSiteInfo(anchor) {
    const info = await call('siteInfo');
    if (!info) return;
    const box = el('div', { class: 'popover' });
    const ok = info.secure === true;
    const head = el('div', { class: 'site-head ' + (ok ? 'ok' : info.secure === false ? 'bad' : '') });
    head.append(icon(ok ? 'lock' : info.secure === false ? 'warn' : 'info'), el('div', {}, el('strong', { text: info.host || info.url }), el('div', { class: 'muted', style: 'color:var(--n-muted)', text: ok ? t('site.secureLong') : info.secure === false ? t('site.insecureLong') : t('site.internal') })));
    box.append(head);
    const perms = Object.entries(info.permissions || {});
    if (perms.length) {
      box.append(el('div', { class: 'divider' }), el('h2', { text: t('site.permissions') }));
      for (const [key, value] of perms) {
        const sel = el('select', { onchange: (e) => call('sitePermissionSet', info.origin, key, e.target.value) },
          el('option', { value: 'allow', text: t('perm.allow'), selected: value === 'allow' }),
          el('option', { value: 'block', text: t('perm.block'), selected: value === 'block' }),
          el('option', { value: 'default', text: t('perm.askDefault') }));
        box.append(el('div', { class: 'perm-row' }, el('span', { text: t('perm.' + key) }), sel));
      }
    }
    box.append(el('div', { class: 'divider' }));
    box.append(el('div', { class: 'row spread' },
      el('button', { class: 'btn', text: t('site.clearData'), onclick: async () => { await call('clearSiteData', info.origin); closePopover(); } }),
      el('button', { class: 'btn link', text: t('site.settings'), onclick: () => { closePopover(); call('command', 'openSettings', 'privacy'); } })));
    const r = anchor.getBoundingClientRect();
    openPopover('site', box, { x: r.left, y: r.bottom + 6, width: 330 });
  }

  // ------------------------------------------------------------------ protection (shield)
  async function openShield(anchor) {
    const info = await call('siteInfo');
    const tab = activeTab();
    const box = el('div', { class: 'popover' });
    const web = info && /^https?:/.test(info.url);
    box.append(el('h2', { text: web ? t('shield.title', { host: info.host }) : t('shield.titleGeneric') }));
    if (web) {
      const sw = el('input', { type: 'checkbox' });
      sw.checked = !!info.protection;
      sw.addEventListener('change', () => { call('toggleProtection'); closePopover(); });
      box.append(el('label', { class: 'switch' }, el('span', { text: t('shield.toggle') }), sw));
      box.append(el('div', { style: 'display:flex;align-items:baseline;gap:10px;margin:8px 0' }, el('span', { class: 'big-number', text: String(tab ? tab.blocked : 0) }), el('span', { style: 'color:var(--n-muted)', text: t('shield.blocked') })));
      box.append(el('p', { text: info.protection ? t('shield.onHint') : t('shield.offHint') }));
    } else box.append(el('p', { text: t('shield.notApplicable') }));
    if (!S.privacy.adblock) box.append(el('p', { text: t('shield.disabledGlobally') }));
    box.append(el('div', { class: 'row' }, el('button', { class: 'btn link', text: t('shield.settings'), onclick: () => { closePopover(); call('command', 'openSettings', 'privacy'); } })));
    const r = anchor.getBoundingClientRect();
    openPopover('shield', box, { x: r.right, y: r.bottom + 6, width: 310, alignRight: true });
  }

  // ------------------------------------------------------------------ bookmark editor
  async function openBookmarkEditor(id) {
    let res;
    if (id) res = await call('bookmarkInfo', id);
    else res = await call('bookmarkActive');
    if (!res || !res.node) return;
    const { node, folders } = res;
    const isFolder = node.type === 'folder';
    const box = el('div', { class: 'popover' });
    box.append(el('h2', { text: isFolder ? t('bm.editFolder') : res.created ? t('bm.added') : t('bm.edit') }));
    const name = el('input', { type: 'text', value: node.title || '' });
    box.append(el('label', { class: 'field' }, t('bm.name'), name));
    let urlIn = null;
    if (!isFolder && id) { urlIn = el('input', { type: 'text', value: node.url }); box.append(el('label', { class: 'field' }, t('bm.url'), urlIn)); }
    const folderSel = el('select');
    const currentParent = res.parentId || (await call('bookmarkInfo', node.id)).parentId;
    for (const f of folders) {
      if (isFolder && f.id === node.id) continue;
      folderSel.append(el('option', { value: f.id, text: '  '.repeat(f.depth) + (f.title || t('bm.folder')), selected: f.id === currentParent }));
    }
    box.append(el('label', { class: 'field' }, t('bm.folderLabel'), folderSel));
    const save = async () => {
      await call('bookmarkUpdate', node.id, { title: name.value, url: urlIn ? urlIn.value : undefined });
      if (folderSel.value && folderSel.value !== currentParent) await call('bookmarkMove', node.id, folderSel.value);
      closePopover();
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    box.append(el('div', { class: 'row spread' },
      el('button', { class: 'btn danger', text: t('bm.delete'), onclick: async () => { await call('bookmarkRemove', node.id); closePopover(); } }),
      el('button', { class: 'btn primary', text: t('dialog.done'), onclick: save })));
    const anchor = $('#star-btn').getBoundingClientRect();
    openPopover('bookmark', box, id ? { x: innerWidth / 2 - 170, y: 90, width: 340 } : { x: anchor.right, y: anchor.bottom + 8, width: 340, alignRight: true });
    setTimeout(() => { name.focus(); name.select(); }, 0);
  }

  // ------------------------------------------------------------------ group editor
  const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];
  function openGroupEditor(groupId) {
    const g = state.groups.find((x) => x.id === groupId);
    if (!g) return;
    const anchorEl = groupEls.get(groupId) || tabEls.get(state.activeId);
    const box = el('div', { class: 'popover' });
    const name = el('input', { type: 'text', value: g.title || '', placeholder: t('group.namePlaceholder') });
    box.append(el('label', { class: 'field' }, t('group.name'), name));
    let color = g.color;
    const dots = el('div', { class: 'colors' });
    for (const c of GROUP_COLORS) {
      const d = el('button', { class: 'color-dot' + (c === color ? ' sel' : ''), 'data-color': c, title: t('color.' + c) });
      d.addEventListener('click', () => { color = c; $$('.color-dot', dots).forEach((x) => x.classList.toggle('sel', x === d)); call('groupUpdate', groupId, { color }); });
      dots.append(d);
    }
    box.append(dots);
    const save = () => { call('groupUpdate', groupId, { title: name.value.trim(), color }); closePopover(); };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    box.append(el('div', { class: 'row' }, el('button', { class: 'btn primary', text: t('dialog.done'), onclick: save })));
    const r = anchorEl ? anchorEl.getBoundingClientRect() : { left: 20, bottom: 50 };
    openPopover('group', box, { x: r.left, y: r.bottom + 6, width: 280, onClose: () => call('groupUpdate', groupId, { title: name.value.trim() }) });
  }

  // ------------------------------------------------------------------ downloads
  const fmtBytes = (n) => {
    if (!n || n < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0).replace('.', ',') + ' ' + u[i];
  };
  function updateDownloadsButton() {
    const b = buttons.downloads;
    if (!b) return;
    const active = downloads.filter((d) => d.state === 'progressing');
    let ring = b.querySelector('.dl-ring');
    if (active.length) {
      const total = active.reduce((a, d) => a + (d.total || 0), 0);
      const recv = active.reduce((a, d) => a + (d.received || 0), 0);
      if (!ring) { ring = el('span', { class: 'dl-ring' }); b.append(ring); }
      ring.style.setProperty('--p', total ? Math.round(recv / total * 100) : 30);
    } else if (ring) ring.remove();
    if (popover && popover.kind === 'downloads') renderDownloadsList(popover.node.querySelector('.dl-list'));
  }
  function renderDownloadsList(list) {
    list.textContent = '';
    const items = downloads.slice(0, 6);
    if (!items.length) { list.append(el('div', { class: 'empty', text: t('dl.empty') })); return; }
    for (const d of items) {
      const row = el('div', { class: 'dl-item' });
      const name = el('div', { class: 'dl-name', text: d.filename, title: d.path || d.filename });
      const meta = el('div', { class: 'dl-meta' });
      if (d.state === 'progressing') meta.textContent = `${fmtBytes(d.received)} / ${d.total ? fmtBytes(d.total) : '?'}${d.paused ? ' — ' + t('dl.paused') : ''}`;
      else meta.textContent = d.state === 'completed' ? fmtBytes(d.total || d.received) : t('dl.state.' + d.state);
      const actions = el('div', { class: 'dl-actions' });
      const act = (ic, key, action) => { const b = el('button', { class: 'icon-btn', title: t(key), onclick: (e) => { e.stopPropagation(); call('downloadAction', d.id, action); } }); b.append(icon(ic)); actions.append(b); };
      if (d.state === 'progressing') act('close', 'dl.cancel', 'cancel');
      else if (d.state === 'completed') act('folder', 'dl.show', 'show');
      else act('reload', 'dl.retry', 'retry');
      row.append(name, actions, meta);
      if (d.state === 'progressing') { const bar = el('div', { class: 'dl-bar' }, el('i', { style: `width:${d.total ? Math.round(d.received / d.total * 100) : 10}%` })); row.append(bar); }
      if (d.state === 'completed') row.addEventListener('click', () => call('downloadAction', d.id, 'open'));
      list.append(row);
    }
  }
  function openDownloads(anchor) {
    const box = el('div', { class: 'popover' });
    box.append(el('h2', { text: t('dl.title') }));
    const list = el('div', { class: 'dl-list' });
    box.append(list);
    renderDownloadsList(list);
    box.append(el('div', { class: 'row spread' },
      el('button', { class: 'btn link', text: t('dl.showAll'), onclick: () => { closePopover(); call('command', 'openDownloads'); } }),
      el('button', { class: 'btn', text: t('dl.openFolder'), onclick: () => { closePopover(); call('command', 'openDownloads'); } })));
    const r = (anchor || $('#menu-btn')).getBoundingClientRect();
    openPopover('downloads', box, { x: r.right, y: r.bottom + 6, width: 360, alignRight: true });
  }

  // ------------------------------------------------------------------ prompts (permission / auth / screen)
  const promptQueue = [];
  function enqueuePrompt(fn) { promptQueue.push(fn); if (!popover) nextPrompt(); }
  function nextPrompt() { if (popover || !promptQueue.length) return; promptQueue.shift()(); }

  function permissionPrompt(req) {
    const box = el('div', { class: 'popover dialog' });
    const ic = el('div', { class: 'dialog-icon' }); ic.append(icon({ media: 'screen', geolocation: 'globe', notifications: 'info', openExternal: 'forward' }[req.key] || 'shield'));
    let what = t('perm.' + req.key);
    if (req.key === 'media' && req.mediaTypes && req.mediaTypes.length) what = req.mediaTypes.map((m) => t('perm.media.' + m)).join(' + ');
    if (req.key === 'openExternal') what = t('perm.openExternalApp', { scheme: req.extra });
    box.append(ic, el('h2', { text: t('perm.prompt', { origin: req.origin.replace(/^https?:\/\//, ''), what }) }));
    const remember = el('input', { type: 'checkbox', checked: true });
    box.append(el('label', { class: 'check' }, remember, t('perm.remember')));
    let answered = false;
    const answer = (allow) => { answered = true; call('permissionResponse', req.id, allow, remember.checked); closePopover(); };
    box.append(el('div', { class: 'row' }, el('button', { class: 'btn', text: t('perm.block'), onclick: () => answer(false) }), el('button', { class: 'btn primary', text: t('perm.allow'), onclick: () => answer(true) })));
    openPopover('permission', box, { dim: true, modal: true, onClose: () => { if (!answered) call('permissionResponse', req.id, false, false); } });
  }

  function authPrompt(req) {
    const box = el('div', { class: 'popover dialog' });
    const ic = el('div', { class: 'dialog-icon' }); ic.append(icon('key'));
    box.append(ic, el('h2', { text: t(req.isProxy ? 'auth.proxyTitle' : 'auth.title') }), el('p', { text: t('auth.text', { host: req.host }) + (req.realm ? ` („${req.realm}“)` : '') }));
    const user = el('input', { type: 'text', autocomplete: 'username' });
    const pass = el('input', { type: 'password', autocomplete: 'current-password' });
    box.append(el('label', { class: 'field' }, t('auth.user'), user), el('label', { class: 'field' }, t('auth.password'), pass));
    let answered = false;
    const submit = () => { answered = true; call('authResponse', req.id, { username: user.value, password: pass.value }); closePopover(); };
    pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    user.addEventListener('keydown', (e) => { if (e.key === 'Enter') pass.focus(); });
    box.append(el('div', { class: 'row' }, el('button', { class: 'btn', text: t('dialog.cancel'), onclick: () => closePopover() }), el('button', { class: 'btn primary', text: t('auth.signIn'), onclick: submit })));
    openPopover('auth', box, { dim: true, modal: true, onClose: () => { if (!answered) call('authResponse', req.id, null); } });
    setTimeout(() => user.focus(), 0);
  }

  function screenPicker(req) {
    const box = el('div', { class: 'popover dialog wide' });
    box.append(el('h2', { text: t('screen.title', { origin: req.origin.replace(/^https?:\/\//, '') }) }));
    const grid = el('div', { class: 'picker-grid' });
    let selected = null;
    const shareBtn = el('button', { class: 'btn primary', text: t('screen.share'), disabled: true });
    for (const s of req.sources) {
      const item = el('button', { class: 'picker-item' }, el('img', { class: 'thumb', src: s.thumb, alt: '' }), el('div', { class: 'name' }, s.icon ? el('img', { src: s.icon, alt: '' }) : icon(s.screen ? 'screen' : 'tab', 'small'), el('span', { text: s.screen ? t('screen.entire', { name: s.name }) : s.name })));
      item.addEventListener('click', () => { selected = s.id; $$('.picker-item', grid).forEach((x) => x.classList.toggle('sel', x === item)); shareBtn.disabled = false; });
      item.addEventListener('dblclick', () => { selected = s.id; share(); });
      grid.append(item);
    }
    box.append(grid);
    let audio = null;
    if (req.audio) { audio = el('input', { type: 'checkbox' }); box.append(el('label', { class: 'check' }, audio, t('screen.audio'))); }
    let answered = false;
    const share = () => { if (!selected) return; answered = true; call('screenPick', req.id, selected, audio ? audio.checked : false); closePopover(); };
    shareBtn.addEventListener('click', share);
    box.append(el('div', { class: 'row' }, el('button', { class: 'btn', text: t('dialog.cancel'), onclick: () => closePopover() }), shareBtn));
    openPopover('screen', box, { dim: true, modal: true, onClose: () => { if (!answered) call('screenPick', req.id, null); } });
  }

  // ------------------------------------------------------------------ find bar
  const findbar = $('#findbar');
  const findInput = $('#find-input');
  let findText = '';
  function openFind() {
    const wasHidden = findbar.hidden;
    findbar.hidden = false;
    if (wasHidden) queueRects();
    findInput.focus();
    findInput.select();
    if (findInput.value) doFind(true, false);
  }
  function closeFind() {
    findbar.hidden = true;
    findbar.classList.remove('notfound');
    $('#find-count').textContent = '';
    call('stopFind', 'keepSelection');
    queueRects();
    call('focusPage');
  }
  function doFind(forward, findNext) {
    findText = findInput.value;
    if (!findText) { call('find', ''); $('#find-count').textContent = ''; findbar.classList.remove('notfound'); return; }
    call('find', findText, { forward, findNext, matchCase: $('#find-case').checked });
  }
  findInput.addEventListener('input', () => doFind(true, false));
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doFind(!e.shiftKey, true); }
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  $('#find-next').addEventListener('click', () => doFind(true, true));
  $('#find-prev').addEventListener('click', () => doFind(false, true));
  $('#find-close').addEventListener('click', closeFind);
  $('#find-case').addEventListener('change', () => doFind(true, false));

  // ------------------------------------------------------------------ events from main
  api.on((channel, payload) => {
    switch (channel) {
      case 'state': {
        const prevActive = state.activeId;
        const prevSplit = JSON.stringify(state.split);
        state = payload;
        if (previewFor && !state.tabs.some((x) => x.id === previewFor)) hidePreview();
        renderTabs();
        updateToolbar();
        renderBookmarksBar();
        if (prevActive !== state.activeId || prevSplit !== JSON.stringify(state.split)) { queueRects(); if (!findbar.hidden && prevActive !== state.activeId) closeFind(); }
        break;
      }
      case 'tab-activated': addrEditing = false; updateAddress(true); break;
      case 'window-state': winState = payload; applyWindowState(); break;
      case 'focus-address': addr.focus(); addr.select(); break;
      case 'find-open': openFind(); break;
      case 'find-step': if (findbar.hidden) openFind(); else doFind(payload.forward, true); break;
      case 'find-result': {
        if (payload.finalUpdate === false && payload.matches === undefined) break;
        const c = $('#find-count');
        c.textContent = payload.matches ? t('find.count', { i: payload.activeMatchOrdinal, n: payload.matches }) : t('find.none');
        findbar.classList.toggle('notfound', !payload.matches && !!findText);
        break;
      }
      case 'bookmark-edit': openBookmarkEditor(payload && payload.id); break;
      case 'group-rename': setTimeout(() => openGroupEditor(payload.id), 50); break;
      case 'toggle-focus-mode': focusMode = !focusMode; document.body.classList.toggle('focus-mode', focusMode); queueRects(); break;
      case 'permission-request': enqueuePrompt(() => permissionPrompt(payload)); break;
      case 'auth-request': enqueuePrompt(() => authPrompt(payload)); break;
      case 'screen-picker': enqueuePrompt(() => screenPicker(payload)); break;
      case 'download-started': {
        const b = buttons.downloads;
        if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
        break;
      }
      case 'event': onEvent(payload.name, payload.payload); break;
    }
  });

  function onEvent(name, payload) {
    if (name === 'settings') {
      const prev = S;
      S = payload;
      applyTheme();
      if (!prev || JSON.stringify(prev.layout) !== JSON.stringify(S.layout) || JSON.stringify(prev.privacy) !== JSON.stringify(S.privacy)) applyLayout();
      else { renderTabs(); updateToolbar(); }
    } else if (name === 'bookmarks') { bookmarks = payload; renderBookmarksBar(); }
    else if (name === 'downloads') { downloads = payload || []; updateDownloadsButton(); }
    else if (name === 'strings') { strings = payload.strings; applyI18n(); buildToolbar(); }
    else if (name === 'theme') applyTheme();
    else if (name === 'extensions-changed') { /* browser-action-list updates itself */ }
  }

  // ------------------------------------------------------------------ init
  (async () => {
    const init = await call('uiInit');
    S = init.settings;
    strings = init.strings;
    state = init.state;
    bookmarks = init.bookmarks;
    downloads = init.downloads || [];
    winState = init.windowState;
    hasExtensions = init.extensions;
    document.documentElement.lang = init.lang;
    applyI18n();
    applyTheme();
    applyWindowState();
    applyLayout();
    updateToolbar();
    document.body.classList.remove('booting');
    queueRects();
  })();
})();
