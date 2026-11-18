'use strict';
(async () => {
  const { t, el, call, icon, toast } = N;
  const info = await N.init();
  if (!info) return;
  let S = N.settings;
  const DEF = await call('defaults');
  const $ = (s, r = document) => r.querySelector(s);
  const get = (p, obj = S) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const set = (p, v) => call('settingsSet', p, v);
  const binders = [];      // { path, update(value) }
  const clone = (v) => JSON.parse(JSON.stringify(v));

  // ---------------------------------------------------------------- generic controls
  function row(name, hint, control, opts = {}) {
    const r = el('div', { class: 'row' + (opts.block ? ' block' : ''), 'data-search': (name + ' ' + (hint || '') + ' ' + (opts.keywords || '')).toLowerCase() });
    const label = el('div', { class: 'label' }, el('div', { class: 'name' }, name, opts.restart ? el('span', { class: 'restart', text: t('set.restart') }) : null));
    if (hint) label.append(el('div', { class: 'hint', text: hint }));
    r.append(label, el('div', { class: 'control' }, control));
    return r;
  }
  function bind(path, update) { binders.push({ path, update }); update(get(path)); }
  function toggle(path, opts = {}) {
    const c = el('input', { type: 'checkbox', class: 'toggle', 'aria-label': opts.label || path });
    c.addEventListener('change', () => set(path, opts.invert ? !c.checked : c.checked));
    bind(path, (v) => { c.checked = opts.invert ? !v : !!v; });
    return c;
  }
  function select(path, options, opts = {}) {
    const c = el('select', { 'aria-label': opts.label || path });
    for (const [value, label] of options) c.append(el('option', { value: String(value), text: label }));
    c.addEventListener('change', () => set(path, opts.number ? Number(c.value) : c.value));
    bind(path, (v) => { c.value = String(v); });
    return c;
  }
  function seg(path, options) {
    const wrap = el('div', { class: 'seg', role: 'radiogroup' });
    const btns = options.map(([value, label]) => {
      const b = el('button', { type: 'button', role: 'radio', text: label });
      b.addEventListener('click', () => set(path, value));
      wrap.append(b);
      return [value, b];
    });
    bind(path, (v) => btns.forEach(([val, b]) => { b.classList.toggle('on', val === v); b.setAttribute('aria-checked', val === v ? 'true' : 'false'); }));
    return wrap;
  }
  function text(path, opts = {}) {
    const c = el('input', { type: opts.type || 'text', placeholder: opts.placeholder || '', style: `width:${opts.width || 260}px`, 'aria-label': opts.label || path });
    let timer;
    c.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => set(path, opts.number ? Number(c.value) : c.value), 400); });
    bind(path, (v) => { if (document.activeElement !== c) c.value = v ?? ''; });
    return c;
  }
  function area(path, opts = {}) {
    const c = el('textarea', { rows: opts.rows || 6, placeholder: opts.placeholder || '', spellcheck: 'false', 'aria-label': opts.label || path });
    let timer;
    c.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => set(path, opts.lines ? c.value.split('\n').map((x) => x.trim()).filter(Boolean) : c.value), 500); });
    bind(path, (v) => { if (document.activeElement !== c) c.value = opts.lines ? (v || []).join('\n') : (v || ''); });
    return c;
  }
  function range(path, min, max, step, fmt) {
    const out = el('span', { class: 'muted', style: 'min-width:48px;text-align:right' });
    const c = el('input', { type: 'range', min, max, step, 'aria-label': path });
    c.addEventListener('input', () => { out.textContent = fmt(Number(c.value)); });
    c.addEventListener('change', () => set(path, Number(c.value)));
    bind(path, (v) => { if (document.activeElement !== c) c.value = v; out.textContent = fmt(Number(v)); });
    return [c, out];
  }
  function color(path, opts = {}) {
    const c = el('input', { type: 'color', 'aria-label': opts.label || path });
    let timer;
    c.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => set(path, c.value), 120); });
    const fb = () => (typeof opts.fallback === 'function' ? opts.fallback() : opts.fallback) || '#3a56d4';
    bind(path, (v) => { c.value = v || fb(); });
    if (opts.alsoOn) binders.push({ path: opts.alsoOn, update: () => { c.value = get(path) || fb(); } });
    return c;
  }
  const button = (label, onclick, cls = '') => el('button', { type: 'button', class: 'btn ' + cls, text: label, onclick });
  const card = (title, ...rows) => el('div', { class: 'card' }, title ? el('h3', { text: title }) : null, ...rows);

  // ---------------------------------------------------------------- sections
  const SECTIONS = [];
  const section = (id, iconName, build) => SECTIONS.push({ id, iconName, build });

  // ---- appearance
  section('appearance', 'palette', () => {
    const presetsWrap = el('div', { class: 'presets' });
    const renderPresets = () => {
      presetsWrap.textContent = '';
      const dark = document.documentElement.dataset.scheme === 'dark';
      for (const id of Object.keys(NimbusTheme.PRESETS)) {
        const p = NimbusTheme.PRESETS[id][dark ? 'dark' : 'light'];
        const b = el('button', { type: 'button', class: 'preset' + (S.appearance.preset === id ? ' on' : ''), 'aria-pressed': S.appearance.preset === id ? 'true' : 'false' },
          el('div', { class: 'pv' },
            el('i', { style: `background:${p.frame}` }),
            el('div', { class: 'bar', style: `background:${p.toolbar}` }, el('b', { style: `width:40%;background:${p.surface};border:1px solid ${p.border}` }), el('b', { style: `width:12px;background:${S.appearance.accent || p.accent}` })),
            el('i', { style: `background:${p.surface}` })),
          el('div', { class: 'nm', text: t('preset.' + id) }));
        b.addEventListener('click', () => set('appearance.preset', id));
        presetsWrap.append(b);
      }
    };
    binders.push({ path: 'appearance', update: renderPresets });
    renderPresets();

    const accentReset = button(t('set.useThemeColour'), () => set('appearance.accent', ''), 'small ghost');
    const customColorsBox = el('div', { class: 'color-grid' });
    const renderCustom = () => {
      customColorsBox.textContent = '';
      const scheme = document.documentElement.dataset.scheme === 'dark' ? 'dark' : 'light';
      const base = NimbusTheme.PRESETS[S.appearance.preset || 'nimbus'][scheme];
      const cur = (S.appearance.customColors && S.appearance.customColors[scheme]) || {};
      for (const key of ['frame', 'toolbar', 'surface', 'text', 'muted', 'border']) {
        const c = el('input', { type: 'color', value: cur[key] || base[key] });
        c.addEventListener('change', () => { const all = clone(S.appearance.customColors || { light: {}, dark: {} }); all[scheme] = all[scheme] || {}; all[scheme][key] = c.value; set('appearance.customColors', all); });
        customColorsBox.append(el('label', {}, el('span', { text: t('colorKey.' + key) }), c));
      }
    };
    binders.push({ path: 'appearance.customColors', update: renderCustom });
    renderCustom();

    return [
      card(null,
        row(t('set.mode'), t('set.modeHint'), seg('appearance.mode', [['system', t('theme.system')], ['light', t('theme.light')], ['dark', t('theme.dark')]]), { keywords: 'dark light hell dunkel' }),
        row(t('set.preset'), null, presetsWrap, { block: true, keywords: 'theme farbe colour' }),
        row(t('set.accent'), t('set.accentHint'), [color('appearance.accent', { alsoOn: 'appearance.preset', fallback: () => (NimbusTheme.PRESETS[S.appearance.preset] || NimbusTheme.PRESETS.nimbus)[document.documentElement.dataset.scheme === 'dark' ? 'dark' : 'light'].accent }), accentReset]),
        row(t('set.font'), null, [select('appearance.font', ['system', 'humanist', 'rounded', 'serif', 'mono', 'display', 'custom'].map((f) => [f, t('font.' + f)])), text('appearance.customFont', { placeholder: t('set.fontCustomPlaceholder'), width: 170 })], { keywords: 'schrift' }),
        row(t('set.fontSize'), null, range('appearance.fontSize', 11, 18, 1, (v) => v + ' px')),
        row(t('set.density'), t('set.densityHint'), seg('appearance.density', [['compact', t('density.compact')], ['comfortable', t('density.comfortable')], ['spacious', t('density.spacious')]])),
        row(t('set.radius'), null, range('appearance.radius', 0, 16, 1, (v) => v + ' px'), { keywords: 'ecken corners rund' }),
        row(t('set.animations'), t('set.animationsHint'), toggle('appearance.animations')),
        row(t('set.forceDark'), t('set.forceDarkHint'), toggle('appearance.forceDarkPages'), { restart: true })
      ),
      el('div', { class: 'card' }, el('details', { class: 'adv' }, el('summary', { text: t('set.customColours') }),
        el('div', { class: 'row block' }, el('div', { class: 'label' }, el('div', { class: 'hint', text: t('set.customColoursHint') })), el('div', { class: 'control' }, customColorsBox, button(t('set.resetColours'), () => set('appearance.customColors', { light: {}, dark: {} }), 'small'))))),
      card(t('set.uiCss'), row(t('set.uiCss'), t('set.uiCssHint'), area('appearance.uiCss', { rows: 8, placeholder: '.tab.active { font-weight: 700; }' }), { block: true, keywords: 'css stylesheet' }))
    ];
  });

  // ---- layout
  section('layout', 'sidebar', () => {
    const tbList = el('div', { class: 'tb-list' });
    const renderTb = () => {
      tbList.textContent = '';
      const list = clone(S.layout.toolbarButtons);
      list.forEach((b, i) => {
        const fixed = b.id === 'address' || b.id === 'menu';
        const cb = el('input', { type: 'checkbox', checked: b.visible || fixed, disabled: fixed });
        cb.addEventListener('change', () => { list[i].visible = cb.checked; set('layout.toolbarButtons', list); });
        const move = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; set('layout.toolbarButtons', list); };
        const up = el('button', { type: 'button', class: 'icon-btn', title: t('set.moveUp'), onclick: () => move(-1) }); up.append(icon('up'));
        const down = el('button', { type: 'button', class: 'icon-btn', title: t('set.moveDown'), onclick: () => move(1) }); down.append(icon('down'));
        tbList.append(el('div', { class: 'tb-item' + (fixed ? ' fixed' : '') }, cb, el('span', { class: 'grow', text: t('tb.' + b.id) }), up, down));
      });
      // offer buttons that are not in the list yet
      const known = ['back', 'forward', 'reload', 'home', 'address', 'shield', 'bookmark', 'extensions', 'downloads', 'split', 'history', 'sidebar', 'menu'];
      const missing = known.filter((k) => !list.some((b) => b.id === k));
      if (missing.length) {
        const sel = el('select', {}, el('option', { value: '', text: t('set.addButton') }), ...missing.map((m) => el('option', { value: m, text: t('tb.' + m) })));
        sel.addEventListener('change', () => { if (!sel.value) return; list.splice(list.length - 1, 0, { id: sel.value, visible: true }); set('layout.toolbarButtons', list); });
        tbList.append(sel);
      }
    };
    binders.push({ path: 'layout.toolbarButtons', update: renderTb });
    renderTb();
    const STYLES = {
      classic: [[1, 1, 1, 1, 1]],
      drift: [[2.2, 1, .8, .3, .3, .3]],
      lens: [[.3, .3, .7, 1.6, .7, .3, .3]],
      thread: [[1, .9, .9, 1], 'thread'],
      combo: [[2, .9, .9, .3, .3], 'thread']
    };
    const stylePicker = el('div', { class: 'presets tabstyles' });
    const renderStyles = () => {
      stylePicker.textContent = '';
      for (const [id, [widths, extra]] of Object.entries(STYLES)) {
        const on = (S.layout.tabStyle || 'classic') === id;
        const pv = el('div', { class: 'ts-pv' + (extra ? ' with-thread' : '') });
        widths.forEach((w, i) => pv.append(el('i', { class: (i === 0 ? 'act' : '') + (w < .5 ? ' drop' : '') + (extra && (i === 1 || i === 2) ? ' kid' : ''), style: `flex:${w}` })));
        const b = el('button', { type: 'button', class: 'preset' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false' }, pv,
          el('div', { class: 'nm', text: t('tabstyle.' + id) }), el('div', { class: 'ds', text: t('tabstyle.' + id + '.desc') }));
        b.addEventListener('click', () => set('layout.tabStyle', id));
        stylePicker.append(b);
      }
    };
    binders.push({ path: 'layout.tabStyle', update: renderStyles });
    renderStyles();
    return [
      card(t('set.tabs'),
        row(t('set.tabStyle'), t('set.tabStyleHint'), stylePicker, { block: true, keywords: 'drift lens thread faden tabstil' }),
        row(t('set.tabPreview'), t('set.tabPreviewHint'), toggle('layout.tabPreview'), { keywords: 'vorschau preview' }),
        row(t('set.tabTint'), t('set.tabTintHint'), toggle('layout.tabTint'), { keywords: 'farbe colour' }),
        row(t('set.tabPulse'), t('set.tabPulseHint'), toggle('layout.tabPulse')),
        row(t('set.tabStacks'), t('set.tabStacksHint'), toggle('layout.tabStacks'), { keywords: 'stapel stack' }),
        row(t('set.tabPosition'), t('set.tabPositionHint'), seg('layout.tabPosition', [['top', t('pos.top')], ['left', t('pos.left')], ['right', t('pos.right')]]), { keywords: 'vertikal vertical seitenleiste sidebar' }),
        row(t('set.compact'), t('set.compactHint'), toggle('layout.compact')),
        row(t('set.tabWidth'), null, seg('layout.tabWidth', [['fixed', t('tabw.fixed')], ['fit', t('tabw.fit')], ['compact', t('tabw.compact')]])),
        row(t('set.tabClose'), null, select('layout.tabCloseButton', ['always', 'hover', 'active', 'never'].map((v) => [v, t('tabclose.' + v)]))),
        row(t('set.newTabPosition'), null, select('layout.newTabPosition', [['afterCurrent', t('ntpos.afterCurrent')], ['end', t('ntpos.end')]])),
        row(t('set.verticalWidth'), null, range('layout.verticalTabWidth', 160, 480, 10, (v) => v + ' px'))
      ),
      card(t('set.toolbar'),
        row(t('set.toolbarButtons'), t('set.toolbarButtonsHint'), tbList, { block: true, keywords: 'knöpfe buttons symbolleiste' }),
        row(t('set.bookmarksBar'), null, seg('layout.showBookmarksBar', [['always', t('bmbar.always')], ['newtab', t('bmbar.newtab')], ['never', t('bmbar.never')]])),
        row(t('set.simplifyUrl'), t('set.simplifyUrlHint'), toggle('layout.addressBarSimplify')),
        row(t('set.statusUrl'), t('set.statusUrlHint'), toggle('layout.showStatusUrl'))
      ),
      card(t('set.window'),
        row(t('set.titlebar'), t('set.titlebarHint'), seg('layout.titlebar', [['integrated', t('titlebar.integrated')], ['system', t('titlebar.system')]]), { restart: true })
      )
    ];
  });

  // ---- new tab
  section('newtab', 'plus', () => {
    const pick = button(t('set.pickImage'), async () => { const r = await call('pickBackground'); if (r) toast(t('set.imageSet')); });
    const gradient = el('span', { class: 'control' });
    const g0 = el('input', { type: 'color' }), g1 = el('input', { type: 'color' });
    const setG = () => set('newTab.gradient', [g0.value, g1.value]);
    g0.addEventListener('change', setG); g1.addEventListener('change', setG);
    bind('newTab.gradient', (v) => { g0.value = v[0]; g1.value = v[1]; });
    gradient.append(g0, g1);

    const dialList = el('div', { class: 'list-editor' });
    const renderDial = () => {
      dialList.textContent = '';
      const list = clone(S.newTab.speedDial || []);
      list.forEach((d, i) => {
        const name = el('input', { type: 'text', value: d.title, placeholder: t('nt.tileName') });
        const url = el('input', { type: 'text', value: d.url, placeholder: 'https://' });
        const save = () => { list[i] = { title: name.value, url: url.value }; set('newTab.speedDial', list); };
        name.addEventListener('change', save); url.addEventListener('change', save);
        const up = el('button', { type: 'button', class: 'icon-btn', onclick: () => { if (i) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; set('newTab.speedDial', list); } } }); up.append(icon('up'));
        const del = el('button', { type: 'button', class: 'icon-btn', title: t('nt.remove'), onclick: () => { list.splice(i, 1); set('newTab.speedDial', list); } }); del.append(icon('trash'));
        dialList.append(el('div', { class: 'le-item' }, name, url, up, del));
      });
      dialList.append(el('div', {}, button(t('nt.addTile'), () => { list.push({ title: '', url: 'https://' }); set('newTab.speedDial', list); }, 'small')));
    };
    binders.push({ path: 'newTab.speedDial', update: () => { if (!dialList.contains(document.activeElement)) renderDial(); } });
    renderDial();

    return [
      card(t('set.background'),
        row(t('set.backgroundType'), t('set.backgroundHint'), seg('newTab.background', [['sky', t('bg.sky')], ['color', t('bg.color')], ['gradient', t('bg.gradient')], ['image', t('bg.image')]])),
        row(t('bg.color'), null, color('newTab.color')),
        row(t('bg.gradient'), null, gradient),
        row(t('bg.image'), null, pick),
        row(t('set.dim'), t('set.dimHint'), range('newTab.dim', 0, 80, 5, (v) => v + ' %'))
      ),
      card(t('set.ntContent'),
        row(t('set.showClock'), null, toggle('newTab.showClock')),
        row(t('set.clock24'), null, toggle('newTab.clock24h')),
        row(t('set.showSeconds'), null, toggle('newTab.showSeconds')),
        row(t('set.showDate'), null, toggle('newTab.showDate')),
        row(t('set.showGreeting'), null, toggle('newTab.showGreeting')),
        row(t('set.name'), t('set.nameHint'), text('newTab.name', { width: 200 })),
        row(t('set.showSearch'), null, toggle('newTab.showSearch')),
        row(t('set.showSpeedDial'), t('set.speedDialHint'), toggle('newTab.showSpeedDial')),
        row(t('set.columns'), null, range('newTab.speedDialColumns', 2, 10, 1, (v) => String(v))),
        row(t('set.speedDial'), null, dialList, { block: true }),
        row(t('set.customNewTab'), t('set.customNewTabHint'), text('newTab.customUrl', { placeholder: 'https://…', width: 280 }))
      )
    ];
  });

  // ---- search
  section('search', 'search', () => {
    const engineSel = el('select');
    const enginesBox = el('div', { class: 'list-editor' });
    const render = () => {
      engineSel.textContent = '';
      for (const e of S.search.engines) engineSel.append(el('option', { value: e.id, text: e.name, selected: e.id === S.search.default }));
      if (enginesBox.contains(document.activeElement)) return;
      enginesBox.textContent = '';
      const list = clone(S.search.engines);
      list.forEach((e, i) => {
        const name = el('input', { type: 'text', value: e.name, placeholder: t('search.name'), style: 'flex:0 1 150px' });
        const url = el('input', { type: 'text', value: e.url, placeholder: t('search.urlHint') });
        const kw = el('input', { type: 'text', value: e.keyword || '', placeholder: t('search.keyword'), style: 'flex:0 0 90px' });
        const save = () => { list[i] = { ...list[i], name: name.value, url: url.value, keyword: kw.value.trim() }; set('search.engines', list); };
        [name, url, kw].forEach((x) => x.addEventListener('change', save));
        const del = el('button', { type: 'button', class: 'icon-btn', title: t('nt.remove'), disabled: list.length < 2, onclick: () => { list.splice(i, 1); set('search.engines', list); if (S.search.default === e.id) set('search.default', list[0].id); } }); del.append(icon('trash'));
        enginesBox.append(el('div', { class: 'le-item' }, name, url, kw, del));
      });
      enginesBox.append(el('div', {}, button(t('search.add'), () => { list.push({ id: 'c' + Date.now().toString(36), name: t('search.newEngine'), url: 'https://example.com/search?q=%s', suggest: '' }); set('search.engines', list); }, 'small'), ' ',
        button(t('search.restore'), () => set('search.engines', DEF.search.engines), 'small ghost')));
    };
    engineSel.addEventListener('change', () => set('search.default', engineSel.value));
    binders.push({ path: 'search', update: render });
    render();
    return [
      card(null,
        row(t('set.defaultEngine'), t('set.defaultEngineHint'), engineSel, { keywords: 'google duckduckgo bing suchmaschine' }),
        row(t('set.suggestions'), t('set.suggestionsHint'), toggle('search.suggestions')),
        row(t('set.historySuggestions'), null, toggle('search.historySuggestions')),
        row(t('set.bookmarkSuggestions'), null, toggle('search.bookmarkSuggestions'))
      ),
      card(t('set.engines'), row(t('set.engines'), t('set.enginesHint'), enginesBox, { block: true }))
    ];
  });

  // ---- startup
  section('startup', 'power', () => [
    card(null,
      row(t('set.startupMode'), null, select('startup.mode', [['restore', t('startup.restore')], ['newtab', t('startup.newtab')], ['home', t('startup.home')], ['urls', t('startup.urls')]])),
      row(t('set.homepage'), t('set.homepageHint'), text('startup.homepage', { width: 300 })),
      row(t('set.startupUrls'), t('set.startupUrlsHint'), area('startup.urls', { rows: 4, lines: true, placeholder: 'https://…' }), { block: true })
    )
  ]);

  // ---- tabs behaviour
  section('tabs', 'tab', () => [
    card(null,
      row(t('set.sleep'), t('set.sleepHint'), select('tabs.sleepAfterMinutes', [[0, t('sleep.never')], [5, t('sleep.min', { n: 5 })], [15, t('sleep.min', { n: 15 })], [30, t('sleep.min', { n: 30 })], [60, t('sleep.hour', { n: 1 })], [120, t('sleep.hour', { n: 2 })], [240, t('sleep.hour', { n: 4 })]], { number: true }), { keywords: 'speicher memory ram schlafen' }),
      row(t('set.switchToNew'), t('set.switchToNewHint'), toggle('tabs.switchToNewTabs')),
      row(t('set.middleClose'), null, toggle('tabs.middleClickClose')),
      row(t('set.dblNewTab'), null, toggle('tabs.doubleClickNewTab')),
      row(t('set.scrollSwitch'), null, toggle('tabs.scrollToSwitch')),
      row(t('set.confirmClose'), null, toggle('tabs.confirmCloseWindow')),
      row(t('set.closedLimit'), null, range('tabs.closedTabsLimit', 5, 100, 5, (v) => String(v)))
    )
  ]);

  // ---- privacy
  section('privacy', 'shield', () => {
    const status = el('span', { class: 'muted' });
    const renderStatus = async () => {
      const st = await call('adblockStatus');
      status.textContent = st.error ? t('ab.error', { error: st.error }) : !st.ready ? t('ab.loading') : t('ab.ready', { date: st.lastUpdate ? new Date(st.lastUpdate).toLocaleString() : '—', count: st.totalBlocked });
    };
    renderStatus();
    N.on((n) => { if (n === 'adblock') renderStatus(); });
    const exceptions = el('div', { class: 'chips' });
    const renderExc = () => {
      exceptions.textContent = '';
      const list = S.privacy.protectionExceptions || [];
      if (!list.length) exceptions.append(el('span', { class: 'muted', text: t('set.noExceptions') }));
      for (const h of list) {
        const x = el('button', { type: 'button', title: t('nt.remove'), onclick: () => set('privacy.protectionExceptions', list.filter((y) => y !== h)) }); x.append(icon('close'));
        exceptions.append(el('span', { class: 'chip' }, h, x));
      }
      const inp = el('input', { type: 'text', placeholder: 'example.com', style: 'width:180px' });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) set('privacy.protectionExceptions', [...new Set([...list, inp.value.trim().replace(/^https?:\/\//, '').split('/')[0]])]); });
      exceptions.append(inp);
    };
    binders.push({ path: 'privacy.protectionExceptions', update: renderExc });
    renderExc();

    const perms = el('div', {});
    const PERMS = ['notifications', 'geolocation', 'media', 'clipboard', 'midi', 'pointerLock', 'openExternal', 'idleDetection', 'windowManagement', 'sensors', 'hid', 'serial', 'usb', 'fullscreen'];
    for (const k of PERMS) perms.append(row(t('perm.' + k), null, select('privacy.permissionDefaults.' + k, [['ask', t('perm.ask')], ['allow', t('perm.allow')], ['block', t('perm.block')]])));

    const sitePerms = el('div', { class: 'list-editor' });
    const renderSitePerms = () => {
      sitePerms.textContent = '';
      const all = S.privacy.sitePermissions || {};
      const entries = Object.entries(all).flatMap(([origin, map]) => Object.entries(map).map(([key, value]) => ({ origin, key, value })));
      if (!entries.length) { sitePerms.append(el('span', { class: 'muted', text: t('set.noSitePerms') })); return; }
      for (const e of entries) {
        const sel = el('select', {}, el('option', { value: 'allow', text: t('perm.allow'), selected: e.value === 'allow' }), el('option', { value: 'block', text: t('perm.block'), selected: e.value === 'block' }));
        sel.addEventListener('change', () => call('sitePermissionSet', e.origin, e.key, sel.value));
        const del = el('button', { type: 'button', class: 'icon-btn', title: t('nt.remove'), onclick: () => call('sitePermissionSet', e.origin, e.key, null) }); del.append(icon('trash'));
        sitePerms.append(el('div', { class: 'le-item' }, el('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis', text: e.origin }), el('span', { class: 'muted', text: t('perm.' + e.key) }), sel, del));
      }
    };
    binders.push({ path: 'privacy.sitePermissions', update: renderSitePerms });
    renderSitePerms();

    // clear browsing data
    const cRange = el('select', {}, ...[['1', t('range.hour')], ['24', t('range.day')], ['168', t('range.week')], ['672', t('range.month')], ['all', t('range.all')]].map(([v, l]) => el('option', { value: v, text: l, selected: v === 'all' })));
    const cb = (key, on) => { const c = el('input', { type: 'checkbox', checked: on }); c.dataset.key = key; return el('label', { style: 'display:flex;gap:8px;align-items:center' }, c, t('clear.' + key)); };
    const checks = el('div', { style: 'display:grid;gap:6px;margin:6px 0 10px' }, cb('history', true), cb('cookies', false), cb('cache', true), cb('downloads', false), cb('permissions', false));
    const clearBtn = button(t('clear.button'), async () => {
      const opts = { range: cRange.value };
      for (const c of checks.querySelectorAll('input')) opts[c.dataset.key] = c.checked;
      await call('clearBrowsingData', opts);
      toast(t('clear.done'));
    }, 'danger');

    const dohServers = [['https://cloudflare-dns.com/dns-query', 'Cloudflare'], ['https://dns.quad9.net/dns-query', 'Quad9'], ['https://dns.google/dns-query', 'Google'], ['https://dns.mullvad.net/dns-query', 'Mullvad'], ['https://doh.dns4all.eu/dns-query', 'DNS4EU / dns4all']];
    const UAS = [['', t('ua.default')], ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox (Windows)'], ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Safari (macOS)'], ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36', 'Chrome (Android)']];
    return [
      card(t('set.protection'),
        row(t('set.adblock'), t('set.adblockHint'), toggle('privacy.adblock'), { keywords: 'werbung ads tracker blocker' }),
        row(t('set.adblockLevel'), null, select('privacy.adblockLevel', [['ads', t('ab.ads')], ['ads-tracking', t('ab.adsTracking')], ['full', t('ab.full')]])),
        row(t('set.cosmetic'), t('set.cosmeticHint'), toggle('privacy.adblockCosmetic'), { restart: true }),
        row(t('set.filterStatus'), null, [status, button(t('ab.update'), async () => { status.textContent = t('ab.loading'); await call('adblockUpdate'); renderStatus(); }, 'small')]),
        row(t('set.customFilters'), t('set.customFiltersHint'), area('privacy.customFilters', { rows: 5, placeholder: '||example.com^\nexample.org##.banner' }), { block: true }),
        row(t('set.exceptions'), t('set.exceptionsHint'), exceptions, { block: true }),
        row(t('set.thirdPartyCookies'), t('set.thirdPartyCookiesHint'), select('privacy.thirdPartyCookies', [['block', t('cookies.block')], ['allow', t('cookies.allow')]])),
        row(t('set.dnt'), null, toggle('privacy.doNotTrack')),
        row(t('set.gpc'), t('set.gpcHint'), toggle('privacy.gpc'))
      ),
      card(t('set.security'),
        row(t('set.httpsOnly'), t('set.httpsOnlyHint'), toggle('privacy.httpsOnly')),
        row(t('set.httpsExceptions'), null, area('privacy.httpsExceptions', { rows: 3, lines: true, placeholder: 'intranet.example' }), { block: true }),
        row(t('set.doh'), t('set.dohHint'), seg('privacy.doh', [['off', t('doh.off')], ['automatic', t('doh.automatic')], ['secure', t('doh.secure')]]), { keywords: 'dns doh' }),
        row(t('set.dohServer'), null, [select('privacy.dohServer', [...dohServers, ...(dohServers.some(([u]) => u === S.privacy.dohServer) ? [] : [[S.privacy.dohServer, S.privacy.dohServer]])]), text('privacy.dohServer', { width: 240 })]),
        row(t('set.userAgent'), t('set.userAgentHint'), [select('privacy.userAgent', [...UAS, ...(UAS.some(([u]) => u === S.privacy.userAgent) ? [] : [[S.privacy.userAgent, t('ua.custom')]])]), text('privacy.userAgent', { width: 240, placeholder: t('ua.default') })], { keywords: 'user agent kompatibilität compatibility' })
      ),
      card(t('set.history'),
        row(t('set.saveHistory'), null, toggle('privacy.saveHistory')),
        row(t('set.clearOnExit'), t('set.clearOnExitHint'), el('div', { class: 'chips' }, ...['history', 'cookies', 'cache', 'downloads'].map((k) => {
          const chip = el('button', { type: 'button', class: 'chip toggle-chip', text: t('clear.' + k) });
          chip.addEventListener('click', () => set('privacy.clearOnExit.' + k, !S.privacy.clearOnExit[k]));
          bind('privacy.clearOnExit.' + k, (v) => chip.classList.toggle('on', !!v));
          return chip;
        }))),
        row(t('set.clearNow'), t('set.clearNowHint'), el('div', {}, cRange, checks, clearBtn), { block: true, keywords: 'löschen delete cookies cache verlauf' })
      ),
      card(t('set.permissionDefaults'), perms),
      card(t('set.sitePermissions'), row(t('set.sitePermissions'), t('set.sitePermissionsHint'), sitePerms, { block: true }))
    ];
  });

  // ---- downloads
  section('downloads', 'download', () => {
    const dirLabel = el('code', { class: 'path' });
    call('paths').then((p) => { bind('downloads.dir', (v) => { dirLabel.textContent = v || p.downloads; }); });
    return [card(null,
      row(t('set.downloadDir'), null, [dirLabel, button(t('set.change'), async () => { const d = await call('pickFolder'); if (d) set('downloads.dir', d); }, 'small')]),
      row(t('set.askWhere'), null, toggle('downloads.ask')),
      row(t('set.downloadPanel'), t('set.downloadPanelHint'), toggle('downloads.openPanel'))
    )];
  });

  // ---- shortcuts
  section('shortcuts', 'keyboard', () => {
    const box = el('div', { class: 'card' });
    let recording = null;
    const render = async () => {
      const defaults = await call('shortcutDefaults');
      box.textContent = '';
      const sc = S.shortcuts;
      const conflicts = new Set(NimbusAccel.conflicts(sc).map((c) => c.accel));
      box.append(el('div', { class: 'row' }, el('div', { class: 'label' }, el('div', { class: 'hint', text: t('sc.hint') })), button(t('sc.resetAll'), () => set('shortcuts', defaults), 'small')));
      for (const cmd of Object.keys(defaults)) {
        const list = sc[cmd] || [];
        const keys = el('div', { class: 'chips' });
        list.forEach((a, i) => {
          const del = el('button', { type: 'button', title: t('nt.remove'), onclick: () => { const l = list.slice(); l.splice(i, 1); set('shortcuts.' + cmd, l); } }); del.append(icon('close'));
          keys.append(el('span', { class: 'kbd' + (conflicts.has(NimbusAccel.normalize(a)) ? ' conflict' : ''), title: conflicts.has(NimbusAccel.normalize(a)) ? t('sc.conflict') : '' }, NimbusAccel.label(a), del));
        });
        const add = el('button', { type: 'button', class: 'btn small ghost', text: '+' , title: t('sc.add') });
        add.addEventListener('click', () => {
          if (recording) recording.cancel();
          add.textContent = t('sc.press');
          add.classList.add('kbd', 'recording');
          const onKey = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (e.key === 'Escape') { cleanup(); return; }
            const accel = NimbusAccel.fromEvent(e);
            if (!accel) return;
            cleanup();
            set('shortcuts.' + cmd, [...list, accel]);
          };
          const cleanup = () => { window.removeEventListener('keydown', onKey, true); add.textContent = '+'; add.classList.remove('kbd', 'recording'); recording = null; };
          recording = { cancel: cleanup };
          window.addEventListener('keydown', onKey, true);
        });
        const reset = el('button', { type: 'button', class: 'icon-btn', title: t('sc.reset'), onclick: () => set('shortcuts.' + cmd, defaults[cmd]) }); reset.append(icon('reload'));
        box.append(el('div', { class: 'sc-row', 'data-search': (t('cmd.' + cmd) + ' ' + list.join(' ')).toLowerCase() }, el('span', { class: 'grow', text: t('cmd.' + cmd) }), keys, add, reset));
      }
    };
    binders.push({ path: 'shortcuts', update: () => { if (!recording) render(); } });
    render();
    return [box];
  });

  // ---- sites (zoom, user styles, user scripts)
  section('sites', 'globe', () => {
    const zoomBox = el('div', { class: 'chips' });
    binders.push({
      path: 'sites.zoom', update: (z) => {
        zoomBox.textContent = '';
        const entries = Object.entries(z || {});
        if (!entries.length) zoomBox.append(el('span', { class: 'muted', text: t('set.noZoom') }));
        for (const [host, f] of entries) {
          const x = el('button', { type: 'button', title: t('nt.remove'), onclick: () => { const zz = clone(S.sites.zoom); delete zz[host]; set('sites.zoom', zz); } }); x.append(icon('close'));
          zoomBox.append(el('span', { class: 'chip' }, `${host} · ${Math.round(f * 100)} %`, x));
        }
      }
    });
    binders[binders.length - 1].update(S.sites.zoom);
    const listEditor = (path, kind) => {
      const box = el('div', { class: 'list-editor' });
      const render = () => {
        if (box.contains(document.activeElement)) return;
        box.textContent = '';
        const list = clone(get(path) || []);
        list.forEach((it, i) => {
          const save = () => set(path, list);
          const name = el('input', { type: 'text', value: it.name || '', placeholder: t('us.name') });
          const match = el('input', { type: 'text', value: it.match || '', placeholder: t('us.match') });
          const code = el('textarea', { rows: 5, spellcheck: 'false' });
          code.value = kind === 'css' ? it.css || '' : it.js || '';
          const en = el('input', { type: 'checkbox', class: 'toggle', checked: it.enabled !== false, title: t('us.enabled') });
          name.addEventListener('change', () => { it.name = name.value; save(); });
          match.addEventListener('change', () => { it.match = match.value; save(); });
          code.addEventListener('change', () => { if (kind === 'css') it.css = code.value; else it.js = code.value; save(); });
          en.addEventListener('change', () => { it.enabled = en.checked; save(); });
          const head = el('div', { class: 'le-head' }, en, name, match);
          if (kind === 'js') {
            const runAt = el('select', {}, el('option', { value: 'end', text: t('us.runEnd'), selected: it.runAt !== 'start' }), el('option', { value: 'start', text: t('us.runStart'), selected: it.runAt === 'start' }));
            runAt.addEventListener('change', () => { it.runAt = runAt.value; save(); });
            head.append(runAt);
          }
          const del = el('button', { type: 'button', class: 'icon-btn', title: t('nt.remove'), onclick: () => { list.splice(i, 1); set(path, list); } }); del.append(icon('trash'));
          head.append(del);
          box.append(el('div', { class: 'le-item vertical' }, head, code));
        });
        box.append(el('div', {}, button(kind === 'css' ? t('us.addStyle') : t('us.addScript'), () => {
          list.push(kind === 'css' ? { id: Date.now().toString(36), name: t('us.newStyle'), match: 'example.com', css: 'body { }', enabled: true } : { id: Date.now().toString(36), name: t('us.newScript'), match: 'example.com', js: "console.log('Hallo von Nimbus');", runAt: 'end', enabled: true });
          set(path, list);
        }, 'small')));
      };
      binders.push({ path, update: render });
      render();
      return box;
    };
    return [
      card(t('set.zoom'),
        row(t('set.defaultZoom'), null, select('sites.defaultZoom', [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((z) => [z, Math.round(z * 100) + ' %']), { number: true })),
        row(t('set.siteZoom'), t('set.siteZoomHint'), zoomBox, { block: true })
      ),
      card(t('set.userStyles'), row(t('set.userStyles'), t('set.userStylesHint'), listEditor('sites.userStyles', 'css'), { block: true, keywords: 'css' })),
      card(t('set.userScripts'), row(t('set.userScripts'), t('set.userScriptsHint'), listEditor('sites.userScripts', 'js'), { block: true, keywords: 'javascript userscript' }))
    ];
  });

  // ---- extensions
  section('extensions', 'puzzle', () => {
    const list = el('div', { class: 'card' });
    const render = async () => {
      const items = await call('extensionsList');
      list.textContent = '';
      if (!S.extensions.enabled) { list.append(el('div', { class: 'empty', text: t('ext.disabledGlobally') })); return; }
      if (!items.length) { list.append(el('div', { class: 'empty', text: t('ext.none') })); return; }
      for (const x of items) {
        const sw = el('input', { type: 'checkbox', class: 'toggle', checked: x.enabled, title: t('us.enabled') });
        sw.addEventListener('change', () => call('extensionSetEnabled', x.id, sw.checked));
        const opts = x.optionsUrl && x.enabled ? button(t('ext.options'), () => call('openUrl', x.optionsUrl, { newTab: true }), 'small') : null;
        const rm = el('button', { type: 'button', class: 'icon-btn', title: t('ext.remove'), onclick: () => call('extensionRemove', x.id).then(render) }); rm.append(icon('trash'));
        list.append(el('div', { class: 'ext' }, x.icon ? el('img', { src: x.icon, alt: '' }) : el('span', { class: 'noicon' }),
          el('div', { class: 'grow' }, el('div', { class: 'title', style: 'font-weight:600' }, x.name, ' ', el('span', { class: 'muted', text: x.version + (x.unpacked ? ' · ' + t('ext.unpacked') : '') })), el('div', { class: 'desc', text: x.description })),
          opts, sw, rm));
      }
    };
    N.on((n) => { if (n === 'extensions-changed') render(); });
    render();
    const idIn = el('input', { type: 'text', placeholder: t('ext.storePlaceholder'), style: 'width:320px' });
    const install = async (fn, ...a) => {
      try { const r = await call(fn, ...a); if (r) toast(t('ext.installed')); render(); }
      catch (e) { toast(t('ext.failed', { error: String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })); }
    };
    return [
      el('p', { class: 'lead', text: t('ext.lead') }),
      card(t('ext.install'),
        row(t('ext.fromStore'), t('ext.fromStoreHint'), [button(t('ext.openStore'), () => call('openUrl', 'https://chromewebstore.google.com/', { newTab: true }), 'primary')]),
        row(t('ext.byId'), t('ext.byIdHint'), [idIn, button(t('ext.add'), () => install('extensionInstallStore', idIn.value), 'small')]),
        row(t('ext.crx'), t('ext.crxHint'), button(t('ext.chooseFile'), () => install('extensionInstallFile'), 'small')),
        row(t('ext.unpackedLoad'), t('ext.unpackedHint'), button(t('ext.chooseFolder'), () => install('extensionLoadUnpacked'), 'small')),
        row(t('ext.updates'), null, [toggle('extensions.autoUpdate'), button(t('ext.updateNow'), async () => { await call('extensionsUpdate'); toast(t('ext.updated')); render(); }, 'small')]),
        row(t('ext.enable'), t('ext.enableHint'), toggle('extensions.enabled'), { restart: true })
      ),
      el('h3', { text: t('ext.installedList'), style: 'margin:22px 0 10px' }),
      list
    ];
  });

  // ---- system
  section('system', 'gear', () => {
    const langs = el('div', { class: 'chips' });
    call('spellcheckLanguages').then((avail) => {
      const render = () => {
        langs.textContent = '';
        const cur = S.performance.spellcheckLanguages || [];
        const shown = [...new Set([...cur, ...avail.filter((l) => /^(de|en|fr|it|es|nl|pl|pt|tr|cs|sv|da|nb|fi|hu|ro|ru|uk)/.test(l))])].slice(0, 40);
        for (const l of shown) {
          const c = el('button', { type: 'button', class: 'chip toggle-chip' + (cur.includes(l) ? ' on' : ''), text: l });
          c.addEventListener('click', () => set('performance.spellcheckLanguages', cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));
          langs.append(c);
        }
      };
      binders.push({ path: 'performance.spellcheckLanguages', update: render });
      render();
    });
    const defStatus = el('span', { class: 'muted' });
    call('isDefaultBrowser').then((d) => { defStatus.textContent = d ? t('sys.isDefault') : ''; });
    return [card(null,
      row(t('set.language'), null, seg('language', [['auto', t('lang.auto')], ['de', 'Deutsch'], ['en', 'English']]), { keywords: 'sprache language' }),
      row(t('set.defaultBrowser'), t('set.defaultBrowserHint'), [defStatus, button(t('set.makeDefault'), async () => { const ok = await call('setDefaultBrowser'); toast(ok ? t('sys.defaultSet') : t('sys.defaultFailed')); }, 'small')]),
      row(t('set.hwAccel'), t('set.hwAccelHint'), toggle('performance.hardwareAcceleration'), { restart: true }),
      row(t('set.smoothScroll'), null, toggle('performance.smoothScrolling'), { restart: true }),
      row(t('set.spellcheck'), null, toggle('performance.spellcheck')),
      row(t('set.spellLangs'), null, langs, { block: true }),
      row(t('set.restartNow'), null, button(t('set.restartButton'), () => call('restart'), 'small'))
    )];
  });

  // ---- data
  section('data', 'database', () => [
    card(t('set.backup'),
      row(t('set.exportSettings'), t('set.exportSettingsHint'), button(t('set.export'), async () => { const r = await call('settingsExport'); if (r) toast(t('io.exported')); })),
      row(t('set.importSettings'), t('set.importSettingsHint'), button(t('set.import'), async () => { try { if (await call('settingsImport')) toast(t('io.imported')); } catch (e) { toast(t('io.invalid')); } }))
    ),
    card(t('set.bookmarksIo'),
      row(t('set.importBookmarks'), t('set.importBookmarksHint'), button(t('set.import'), async () => { try { const n = await call('bookmarksImport'); if (n) toast(t('io.bmImported', { count: n })); } catch (e) { toast(t('io.invalid')); } })),
      row(t('set.exportBookmarks'), null, button(t('set.export'), async () => { if (await call('bookmarksExport')) toast(t('io.exported')); }))
    ),
    card(t('set.reset'),
      row(t('set.resetSection'), null, el('div', { class: 'chips' }, ...['appearance', 'layout', 'newTab', 'search', 'privacy', 'shortcuts', 'tabs'].map((s) => button(t('reset.' + s), () => { if (confirm(t('set.resetConfirm'))) set && call('settingsReset', s); }, 'small')))),
      row(t('set.resetAll'), t('set.resetAllHint'), button(t('set.resetAllButton'), () => { if (confirm(t('set.resetConfirm'))) call('settingsReset'); }, 'danger'))
    )
  ]);

  // ---- about
  section('about', 'info', () => {
    const p = el('code', { class: 'path' });
    call('paths').then((x) => { p.textContent = x.userData; p.onclick = () => call('openPath', x.userData); p.style.cursor = 'pointer'; });
    const v = info.versions;
    return [card(null,
      el('div', { class: 'about-hero' }, el('div', { class: 'logo', html: '<svg class="ic" viewBox="0 0 24 24"><path d="M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.6 4.5 4.5 0 0 0 7.5 18.5z"/></svg>' }),
        el('div', {}, el('h3', { text: 'Nimbus ' + info.version }), el('div', { class: 'muted', text: `Chromium ${v.chrome} · Electron ${v.electron} · V8 ${v.v8}` }))),
      row(t('about.profile'), t('about.profileHint'), p),
      row(t('about.license'), t('about.licenseText'), el('a', { href: 'https://www.gnu.org/licenses/gpl-3.0.html', target: '_blank', text: 'GPL-3.0' })),
      row(t('about.source'), null, el('a', { href: 'https://github.com/jessehaemmerle/web-browser', target: '_blank', text: 'github.com/jessehaemmerle/web-browser' }))
    )];
  });

  // ---------------------------------------------------------------- build page
  const main = $('#main');
  const nav = $('#nav-links');
  for (const s of SECTIONS) {
    const sec = el('section', { class: 'sec', id: s.id });
    sec.append(el('h2', { text: t('sec.' + s.id) }));
    const lead = t('sec.' + s.id + '.lead');
    if (lead !== 'sec.' + s.id + '.lead') sec.append(el('p', { class: 'lead', text: lead }));
    for (const part of s.build()) sec.append(part);
    main.append(sec);
    const a = el('a', { href: '#' + s.id, 'data-sec': s.id });
    a.append(icon(s.iconName), el('span', { text: t('sec.' + s.id) }));
    nav.append(a);
  }

  // live update controls when settings change elsewhere
  N.on((name, payload) => {
    if (name !== 'settings') return;
    const prev = S;
    S = payload;
    for (const b of binders) {
      if (JSON.stringify(get(b.path, prev)) !== JSON.stringify(get(b.path))) b.update(get(b.path));
    }
    if (prev.appearance.mode !== S.appearance.mode) { for (const b of binders) if (b.path === 'appearance' || b.path === 'appearance.customColors') b.update(); }
  });

  // nav highlighting + deep links
  const sections = [...main.querySelectorAll('section.sec')];
  const highlight = () => {
    let cur = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top < 120) cur = s;
    for (const a of nav.querySelectorAll('a')) a.classList.toggle('active', a.dataset.sec === cur.id);
  };
  addEventListener('scroll', highlight, { passive: true });
  const jump = () => { const id = location.hash.slice(1); const target = id && document.getElementById(id); if (target) target.scrollIntoView(); highlight(); };
  addEventListener('hashchange', jump);
  jump();

  // filter
  $('#filter').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const sec of sections) {
      let any = !q || t('sec.' + sec.id).toLowerCase().includes(q);
      for (const r of sec.querySelectorAll('[data-search]')) {
        const hit = !q || any || r.dataset.search.includes(q);
        r.classList.toggle('hidden-by-filter', !hit);
        if (hit && q) any = true;
      }
      sec.hidden = !any;
      const a = nav.querySelector(`a[data-sec="${sec.id}"]`);
      if (a) a.classList.toggle('dim', !any);
    }
  });
  document.title = t('set.title');
})();
