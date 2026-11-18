'use strict';
(async () => {
  const { t, el, call, icon } = N;
  await N.init();
  const $ = (s) => document.querySelector(s);
  let S = N.settings;
  if (!S) return;

  // ---------------------------------------------------------------- sky colours by time of day
  // stops: [hour, top colour, bottom colour, cloud opacity]
  const STOPS = [
    [0, '#0b1230', '#1b2350', 0.10], [5, '#1a1f4d', '#5b4a8a', 0.15], [6.5, '#5c6db8', '#f2a77e', 0.35],
    [9, '#3f7fd6', '#a9d2f5', 0.45], [13, '#2f74d0', '#9ccaf2', 0.45], [17, '#4a6fc4', '#f0b48a', 0.4],
    [19, '#3d3a85', '#e2786a', 0.3], [21, '#151b45', '#3b2f6a', 0.15], [24, '#0b1230', '#1b2350', 0.10]
  ];
  const mix = (a, b, f) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
  };
  function skyFor(date) {
    const h = date.getHours() + date.getMinutes() / 60;
    let i = STOPS.findIndex((s) => s[0] > h) - 1;
    if (i < 0) i = 0;
    const [h0, t0, b0, c0] = STOPS[i];
    const [h1, t1, b1, c1] = STOPS[i + 1];
    const f = (h - h0) / (h1 - h0);
    return { top: mix(t0, t1, f), bottom: mix(b0, b1, f), cloud: c0 + (c1 - c0) * f };
  }

  function applyBackground() {
    const nt = S.newTab;
    const sky = $('#sky');
    sky.className = 'sky ' + nt.background;
    sky.style.setProperty('--dim', String((Number(nt.dim) || 0) / 100));
    if (nt.background === 'image' && nt.image) {
      sky.style.setProperty('--img', `url("${nt.image.replace(/"/g, '%22')}")`);
    } else if (nt.background === 'color') {
      sky.style.setProperty('--sky', nt.color);
    } else if (nt.background === 'gradient') {
      sky.style.setProperty('--sky', `linear-gradient(160deg, ${nt.gradient[0]}, ${nt.gradient[1]})`);
    } else {
      const s = skyFor(new Date());
      sky.style.setProperty('--sky', `linear-gradient(180deg, ${s.top} 0%, ${s.bottom} 100%)`);
      sky.style.setProperty('--cloud', s.cloud.toFixed(2));
    }
  }

  // ---------------------------------------------------------------- clock + greeting
  function greetingFor(h) {
    if (h < 5) return t('nt.greetNight');
    if (h < 11) return t('nt.greetMorning');
    if (h < 14) return t('nt.greetDay');
    if (h < 18) return t('nt.greetAfternoon');
    return t('nt.greetEvening');
  }
  function tick() {
    const nt = S.newTab;
    const now = new Date();
    const clock = $('#clock');
    clock.hidden = !nt.showClock;
    if (nt.showClock) {
      const time = now.toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit', hour12: !nt.clock24h });
      clock.textContent = time;
      if (nt.showSeconds) clock.append(el('span', { class: 'sec', text: String(now.getSeconds()).padStart(2, '0') }));
    }
    $('#date').textContent = nt.showDate ? now.toLocaleDateString(document.documentElement.lang, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    const name = (nt.name || '').trim();
    $('#greeting').textContent = nt.showGreeting ? greetingFor(now.getHours()) + (name ? ', ' + name : '') : '';
    if (now.getSeconds() === 0) applyBackground();
  }

  // ---------------------------------------------------------------- search
  const q = $('#q');
  function applySearch() {
    $('#search').hidden = !S.newTab.showSearch;
    const engine = S.search.engines.find((e) => e.id === S.search.default) || S.search.engines[0];
    q.placeholder = t('nt.searchWith', { engine: engine ? engine.name : '' });
  }
  $('#search').addEventListener('submit', (e) => {
    e.preventDefault();
    if (q.value.trim()) call('pageNavigate', q.value);
  });

  // ---------------------------------------------------------------- speed dial
  const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  async function renderDial() {
    const nt = S.newTab;
    const dial = $('#dial');
    dial.hidden = !nt.showSpeedDial;
    dial.style.setProperty('--cols', Math.max(2, Math.min(10, nt.speedDialColumns || 6)));
    dial.textContent = '';
    let tiles = nt.speedDial || [];
    let fromHistory = false;
    if (!tiles.length) { tiles = (await call('topSites', nt.speedDialColumns || 6)) || []; fromHistory = true; }
    tiles.forEach((tile, i) => {
      const host = NimbusUrl.hostOf(tile.url).replace(/^www\./, '') || tile.url;
      const label = tile.title || host;
      const a = el('a', { class: 'tile', href: tile.url, title: `${label}\n${tile.url}` });
      const badge = el('span', { class: 'badge', style: `--c: hsl(${hue(host)} 55% 42%)`, text: (label.trim()[0] || '?').toUpperCase() });
      a.append(badge, el('span', { class: 'label', text: label }));
      if (!fromHistory) {
        const edit = el('button', { class: 'edit', title: t('nt.editTile'), 'aria-label': t('nt.editTile') });
        edit.append(icon('edit'));
        edit.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openTile(i); });
        a.append(edit);
      }
      dial.append(a);
    });
    const add = el('a', { class: 'tile add', href: '#', title: t('nt.addTile') });
    const badge = el('span', { class: 'badge' }); badge.append(icon('plus'));
    add.append(badge, el('span', { class: 'label', text: t('nt.addTile') }));
    add.addEventListener('click', (e) => { e.preventDefault(); openTile(-1); });
    dial.append(add);
  }

  const dlg = $('#tile-dialog');
  let editing = -1;
  function openTile(i) {
    editing = i;
    const tile = i >= 0 ? S.newTab.speedDial[i] : { title: '', url: '' };
    $('#tile-title').textContent = i >= 0 ? t('nt.editTile') : t('nt.addTile');
    $('#tile-name').value = tile.title;
    $('#tile-url').value = tile.url;
    $('#tile-remove').hidden = i < 0;
    dlg.showModal();
    $('#tile-url').focus();
  }
  $('#tile-cancel').addEventListener('click', () => dlg.close());
  $('#tile-remove').addEventListener('click', () => {
    const list = S.newTab.speedDial.slice();
    list.splice(editing, 1);
    call('settingsSet', 'newTab.speedDial', list);
    dlg.close();
  });
  $('#tile-form').addEventListener('submit', () => {
    let url = $('#tile-url').value.trim();
    if (!url) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    const list = (S.newTab.speedDial || []).slice();
    const tile = { title: $('#tile-name').value.trim(), url };
    if (editing >= 0) list[editing] = tile; else list.push(tile);
    call('settingsSet', 'newTab.speedDial', list);
  });

  $('#customize').addEventListener('click', () => call('openUrl', 'nimbus://settings/#newtab'));

  function renderAll() {
    applyBackground();
    applySearch();
    tick();
    renderDial();
  }
  N.on((name, payload) => { if (name === 'settings') { S = payload; renderAll(); } });
  renderAll();
  setInterval(tick, 1000);
  document.title = t('tab.newTab');
  q.focus();
})();
