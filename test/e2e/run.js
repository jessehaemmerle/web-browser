'use strict';
/*
 * End-to-end test of the real Nimbus app (Electron + Playwright).
 * Run: npm run test:e2e   (on Linux CI/headless: xvfb-run -a npm run test:e2e)
 * Screenshots of the whole window go to test/e2e/screenshots when ImageMagick's `import` is available.
 */
const { _electron: electron } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const FIX = path.join(__dirname, 'fixtures');
const SHOTS = path.join(__dirname, 'screenshots');
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function server() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const file = path.join(FIX, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!file.startsWith(FIX) || !fs.existsSync(file)) { res.writeHead(404); res.end('nope'); return; }
      const headers = { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'text/plain' };
      if (file.endsWith('.txt')) headers['content-disposition'] = 'attachment; filename="nimbus-test.txt"';
      res.writeHead(200, headers);
      fs.createReadStream(file).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`  ✗ ${name}\n      ${err.message.split('\n')[0]}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
async function waitFor(fn, msg, timeout = 8000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await sleep(100);
  }
  throw new Error('timeout: ' + msg + (last instanceof Error ? ' (' + last.message + ')' : ''));
}

let shotN = 0;
function screenshot(name) {
  if (!process.env.DISPLAY) return;
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    const file = path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${name}.png`);
    execFileSync('import', ['-window', 'root', file], { stdio: 'ignore' });
  } catch (_) { /* no ImageMagick */ }
}

(async () => {
  const srv = await server();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-e2e-'));
  // seed settings: no network-dependent extras, predictable language/theme
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({
    language: process.env.NIMBUS_LANG || 'de', startup: { mode: 'newtab' }, extensions: { enabled: true, autoUpdate: false },
    search: { suggestions: false }, layout: { titlebar: 'system', tabStacks: false }
  }));
  const launch = () => electron.launch({
    executablePath: require('electron'),
    args: [ROOT, '--no-sandbox', '--window-size=1280,820'],
    env: { ...process.env, NIMBUS_PROFILE: profile, NIMBUS_NO_OZONE_HINT: '1', ELECTRON_ENABLE_LOGGING: '1' },
    timeout: 60000
  });
  let app = await launch();
  const logs = [];
  app.process().stderr.on('data', (d) => logs.push(String(d)));
  const M = (fn, arg) => app.evaluate(fn, arg);              // run in main process

  // native key events (go through before-input-event like real typing)
  const key = (accel, target = 'ui') => M(async (_, { accel, target }) => {
    const w = global.nimbus.lastFocused;
    const wc = target === 'ui' ? w.ui.webContents : w.activeTab.wc;
    const parts = accel.split('+');
    const keyCode = parts.pop();
    const modifiers = parts.map((m) => m.toLowerCase());
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await new Promise((r) => setTimeout(r, 150));
  }, { accel, target });
  const pages = () => app.windows();
  const uiPage = async () => waitFor(() => pages().find((p) => p.url().includes('/ui/index.html')), 'ui page');
  const tabPage = async (pred) => waitFor(() => pages().find((p) => pred(p.url())), 'tab page');
  const state = () => M(() => { const w = global.nimbus.lastFocused; return { tabs: w.tabs.map((t) => ({ id: t.id, url: t.state.url, title: t.state.title, sleeping: t.state.sleeping, groupId: t.state.groupId, pinned: t.state.pinned })), active: w.activeTab && w.activeTab.id, split: w.split, groups: [...w.groups.values()], windows: global.nimbus.windows.size }; });

  console.log('Nimbus E2E');
  let ui;
  await check('App startet und zeigt Oberfläche + neuen Tab', async () => {
    ui = await uiPage();
    await ui.waitForSelector('body:not(.booting)', { timeout: 15000 });
    await tabPage((u) => u.startsWith('nimbus://newtab'));
    const s = await state();
    assert(s.tabs.length === 1, 'expected 1 tab, got ' + s.tabs.length);
  });
  await sleep(800);
  screenshot('start-newtab');

  await check('Neuer-Tab-Seite rendert Uhr, Suche und Schnellwahl', async () => {
    const nt = await tabPage((u) => u.startsWith('nimbus://newtab'));
    await nt.waitForSelector('body:not(.booting)');
    const clock = await nt.textContent('#clock');
    assert(/\d{1,2}:\d{2}/.test(clock), 'clock: ' + clock);
    assert(await nt.isVisible('#q'), 'search visible');
    const tiles = await nt.$$('.tile');
    assert(tiles.length >= 2, 'tiles: ' + tiles.length);
  });

  await check('Adressleiste lädt lokale Seite', async () => {
    await ui.click('#address');
    await ui.fill('#address', base + '/');
    await ui.press('#address', 'Enter');
    const p = await tabPage((u) => u.startsWith(base));
    await p.waitForLoadState('domcontentloaded');
    await waitFor(async () => (await state()).tabs[0].title === 'Fixture Home', 'title updated');
    const shown = await ui.inputValue('#address');
    assert(shown.includes('127.0.0.1'), 'address shows url: ' + shown);
  });
  await sleep(400);
  screenshot('page-loaded');

  await check('Tab-Titel erscheint in der Tableiste', async () => {
    await waitFor(async () => (await ui.textContent('.tab.active .tab-title')).includes('Fixture Home'), 'tab title');
  });

  await check('Interne Navigation + Zurück/Vorwärts', async () => {
    const p = await tabPage((u) => u.startsWith(base));
    await p.click('#same');
    await waitFor(async () => (await state()).tabs[0].title === 'Fixture Second', 'second page');
    await waitFor(async () => !(await ui.isDisabled('[title="Zurück"]')), 'back enabled');
    await ui.click('[title="Zurück"]');
    await waitFor(async () => (await state()).tabs[0].title === 'Fixture Home', 'back to home');
  });

  await check('target=_blank öffnet neuen Tab (noopener wie Chrome)', async () => {
    const p = await tabPage((u) => u === base + '/');
    await p.click('#blank');
    await waitFor(async () => (await state()).tabs.length === 2, '2 tabs');
    const s = await state();
    assert(s.active === s.tabs[1].id, 'new tab active');
    const p2 = await tabPage((u) => u.endsWith('?blank'));
    await p2.waitForLoadState('domcontentloaded');
    assert((await p2.textContent('#op')) === 'no', 'implicit noopener like Chromium');
  });

  await check('Popup (window.open mit Features) öffnet echtes Fenster', async () => {
    const before = pages().length;
    const s = await state();
    await M((_, id) => { const w = global.nimbus.lastFocused; w.activate(w.tabs[0]); }, s.tabs[0].id);
    const p = await tabPage((u) => u === base + '/');
    await p.click('#popup');
    const pop = await waitFor(() => pages().find((x) => x.url().endsWith('?popup')), 'popup page');
    await pop.waitForLoadState('domcontentloaded');
    assert((await pop.textContent('#op')) === 'yes', 'popup has opener');
    assert(pages().length > before, 'more pages');
    await pop.close();
  });

  await check('Tastenkürzel Strg+T / Strg+W', async () => {
    const n = (await state()).tabs.length;
    await key('Control+t');
    await waitFor(async () => (await state()).tabs.length === n + 1, 'tab added');
    await key('Control+w');
    await waitFor(async () => (await state()).tabs.length === n, 'tab closed');
  });

  await check('Geschlossenen Tab wiederherstellen (Strg+Umschalt+T)', async () => {
    const s = await state();
    await M((_, id) => { const w = global.nimbus.lastFocused; w.closeTab(w.tabById(id)); }, s.tabs[1].id);
    await waitFor(async () => (await state()).tabs.length === s.tabs.length - 1, 'closed');
    await key('Control+Shift+t', 'tab');
    await waitFor(async () => (await state()).tabs.length === s.tabs.length, 'restored');
  });

  await check('Suche auf der Seite findet Treffer', async () => {
    await M((_, url) => global.nimbus.lastFocused.activeTab.load(url), base + '/?find');
    const fp = await tabPage((u) => u.endsWith('/?find'));
    await fp.waitForLoadState('domcontentloaded');
    await M(() => global.nimbus.commands.run(global.nimbus.lastFocused, 'find'));
    await ui.waitForSelector('#findbar:not([hidden])');
    await ui.fill('#find-input', 'fox');
    await waitFor(async () => /\d+ von \d+|\d+ of \d+/.test(await ui.textContent('#find-count')), 'count shown');
    const txt = await ui.textContent('#find-count');
    assert(/von 4|of 4/.test(txt), 'expected 4 matches: ' + txt);
    screenshot('find');
    await ui.press('#find-input', 'Escape');
    await waitFor(async () => await ui.isHidden('#findbar'), 'find closed');
  });

  await check('Lesezeichen anlegen (Strg+D) und Leiste zeigt es', async () => {
    await M(() => global.nimbus.settings.set('layout.showBookmarksBar', 'always'));
    await key('Control+d', 'tab');
    await ui.waitForSelector('.popover h2');
    await ui.click('.popover .btn.primary');
    await waitFor(async () => (await ui.$$('.bm-item')).length >= 1, 'bookmark in bar');
    await waitFor(async () => await ui.evaluate(() => document.querySelector('#star-btn').classList.contains('on')), 'star on');
  });
  await sleep(300);
  screenshot('bookmark-bar');

  await check('Adressleisten-Vorschläge aus Verlauf', async () => {
    await ui.click('#address');
    await ui.fill('#address', 'Fixture');
    await ui.waitForSelector('.sug', { timeout: 5000 });
    const n = (await ui.$$('.sug')).length;
    assert(n >= 2, 'suggestions: ' + n);
    screenshot('suggestions');
    await ui.keyboard.press('Escape');
    await ui.keyboard.press('Escape');
    await waitFor(async () => !(await M(() => global.nimbus.lastFocused.overlay)), 'overlay closed');
  });

  await check('Download landet in der Liste', async () => {
    const dl = path.join(profile, 'dl');
    fs.mkdirSync(dl);
    await M((_, d) => global.nimbus.settings.set('downloads.dir', d), dl);
    await M((_, url) => global.nimbus.lastFocused.activeTab.load(url), base + '/?dl');
    const p = await tabPage((u) => u.endsWith('/?dl'));
    await p.waitForLoadState('domcontentloaded');
    await p.click('#dl');
    await waitFor(async () => (await M(() => global.nimbus.downloads.list().filter((d) => d.state === 'completed').length)) >= 1, 'download completed');
    assert(fs.readdirSync(dl).some((f) => f.startsWith('nimbus-test')), 'file saved');
  });

  await check('Werbeblocker-Status abrufbar', async () => {
    const st = await M(() => global.nimbus.adblock.status());
    assert(st.enabled === true, 'enabled');
  });

  await check('Geteilte Ansicht zeigt zwei Seiten', async () => {
    await M(() => global.nimbus.commands.run(global.nimbus.lastFocused, 'toggleSplit'));
    await waitFor(async () => (await state()).split, 'split on');
    await waitFor(async () => (await M(() => global.nimbus.lastFocused.rects.length)) === 2, 'two rects');
    const vis = await M(() => global.nimbus.lastFocused.visibleTabs().length);
    assert(vis === 2, 'two visible');
    await sleep(400);
    screenshot('split-view');
    await M(() => global.nimbus.commands.run(global.nimbus.lastFocused, 'toggleSplit'));
    await waitFor(async () => !(await state()).split, 'split off');
  });

  await check('Tab-Gruppe anlegen, einklappen', async () => {
    const s = await state();
    const gid = await M((_, ids) => global.nimbus.lastFocused.createGroup(ids, 'Recherche'), s.tabs.map((t) => t.id).slice(1));
    await waitFor(async () => (await ui.$$('.group-chip')).length === 1, 'chip shown');
    assert((await ui.textContent('.group-chip')).includes('Recherche'), 'title');
    await M((_, g) => global.nimbus.lastFocused.updateGroup(g, { collapsed: true }), gid);
    await sleep(200);
    screenshot('tab-group');
    await M((_, g) => global.nimbus.lastFocused.ungroup(g), gid);
  });

  await check('Tab schlafen legen und wieder aufwecken', async () => {
    const s = await state();
    const bg = s.tabs.find((t) => t.id !== s.active && t.url.startsWith(base));
    await M((_, id) => global.nimbus.lastFocused.tabById(id).sleep(), bg.id);
    await waitFor(async () => (await state()).tabs.find((t) => t.id === bg.id).sleeping, 'sleeping');
    await M((_, id) => { const w = global.nimbus.lastFocused; w.activate(w.tabById(id)); }, bg.id);
    await waitFor(async () => !(await state()).tabs.find((t) => t.id === bg.id).sleeping, 'woken');
    await waitFor(async () => (await state()).tabs.find((t) => t.id === bg.id).url.startsWith(base), 'url restored');
  });

  await check('Seitliche Tabs per Einstellung', async () => {
    await M(() => global.nimbus.settings.set('layout.tabPosition', 'left'));
    await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('tabs-side')), 'side class');
    await waitFor(async () => (await ui.$$('#vtabs .tab')).length >= 2, 'vertical tabs');
    await sleep(400);
    screenshot('vertical-tabs');
    await M(() => global.nimbus.settings.set('layout.tabPosition', 'top'));
  });

  await check('Dunkles Theme + Akzentfarbe live', async () => {
    await M(() => { global.nimbus.settings.set('appearance.mode', 'dark'); global.nimbus.settings.set('appearance.preset', 'fjord'); });
    await waitFor(async () => (await ui.evaluate(() => document.documentElement.dataset.scheme)) === 'dark', 'dark scheme');
    const bg = await waitFor(async () => { const c = await ui.evaluate(() => getComputedStyle(document.querySelector('#toolbar')).backgroundColor); return c === 'rgb(21, 35, 33)' && c; }, 'toolbar turns fjord dark');
    assert(bg, 'toolbar color');
    await sleep(300);
    screenshot('dark-fjord');
  });

  await check('Einstellungsseite öffnet und ändert Werte', async () => {
    await M(() => global.nimbus.openInternal(global.nimbus.lastFocused, 'settings', 'appearance'));
    const sp = await tabPage((u) => u.startsWith('nimbus://settings'));
    await sp.waitForSelector('section#appearance');
    await sp.waitForSelector('.seg');
    const sections = await sp.$$('section.sec');
    assert(sections.length >= 12, 'sections: ' + sections.length);
    // click "Light" in colour scheme
    await sp.click('section#appearance .seg button:nth-child(2)');
    await waitFor(async () => (await M(() => global.nimbus.settings.get('appearance.mode'))) === 'light', 'mode light');
    await sleep(400);
    screenshot('settings');
    await sp.fill('#filter', 'cookies');
    await sleep(200);
    const visible = await sp.$$eval('section.sec:not([hidden])', (els) => els.map((e) => e.id));
    assert(visible.includes('privacy'), 'filter finds privacy: ' + visible);
  });

  await check('Verlauf-Seite listet Besuche', async () => {
    await M(() => global.nimbus.openInternal(global.nimbus.lastFocused, 'history'));
    const hp = await tabPage((u) => u.startsWith('nimbus://history'));
    await hp.waitForSelector('.list-row');
    const n = (await hp.$$('.list-row')).length;
    assert(n >= 2, 'history rows ' + n);
  });

  await check('Lesezeichen-Seite + Downloads-Seite', async () => {
    await M(() => global.nimbus.openInternal(global.nimbus.lastFocused, 'bookmarks'));
    const bp = await tabPage((u) => u.startsWith('nimbus://bookmarks'));
    await bp.waitForSelector('.list-row');
    await M(() => global.nimbus.openInternal(global.nimbus.lastFocused, 'downloads'));
    const dp = await tabPage((u) => u.startsWith('nimbus://downloads'));
    await dp.waitForSelector('.list-row');
    assert((await dp.textContent('.list-row .title')).includes('nimbus-test'), 'download listed');
  });

  await check('Webseiten bekommen keine Nimbus-API', async () => {
    const p = await tabPage((u) => u.startsWith(base));
    const has = await p.evaluate(() => typeof window.nimbus);
    assert(has === 'undefined', 'window.nimbus on web page: ' + has);
  });

  await check('Fehlerseite bei nicht erreichbarem Server', async () => {
    await M((_, url) => global.nimbus.lastFocused.activeTab.load(url), 'http://127.0.0.1:9/');
    const ep = await tabPage((u) => u.startsWith('nimbus://error'));
    await ep.waitForSelector('h1');
    const h = await ep.textContent('h1');
    assert(h.length > 3, 'error heading ' + h);
    const addr = await waitFor(async () => { const v = await ui.inputValue('#address'); return v.includes('127.0.0.1:9') && v; }, 'address keeps url');
    assert(addr, 'address');
    await sleep(300);
    screenshot('error-page');
  });

  await check('Privates Fenster mit eigener Sitzung', async () => {
    await M(() => global.nimbus.createWindow({ private: true }));
    await waitFor(async () => (await M(() => global.nimbus.windows.size)) === 2, '2 windows');
    const priv = await M((electron) => { const w = [...global.nimbus.windows.values()].find((x) => x.private); return { part: w.session !== electron.session.defaultSession }; });
    assert(priv.part, 'separate session');
    await sleep(800);
    screenshot('private-window');
    await M(() => { const w = [...global.nimbus.windows.values()].find((x) => x.private); w.win.close(); });
    await waitFor(async () => (await M(() => global.nimbus.windows.size)) === 1, 'closed private');
  });

  await check('Werbeblocker blockiert Skripte und blendet Elemente aus', async () => {
    await M(() => global.nimbus.settings.set('privacy.customFilters', '/ads.js$script\n127.0.0.1##.ad-banner'));
    await waitFor(async () => (await M(() => !!global.nimbus.adblock.engine)), 'engine ready', 20000);
    await sleep(500);
    await M((_, url) => global.nimbus.lastFocused.activeTab.load(url), base + '/?ads');
    await sleep(1500);
    const p = await tabPage((u) => u.endsWith('/?ads'));
    await p.waitForLoadState('domcontentloaded');
    await waitFor(async () => (await p.evaluate(() => window.loadedAt)) > 0, 'page loaded');
    assert((await p.evaluate(() => window.adLoaded)) === undefined, 'ads.js was blocked');
    await waitFor(async () => (await p.evaluate(() => getComputedStyle(document.getElementById('ad')).display)) === 'none', 'ad hidden');
    const blocked = await M(() => global.nimbus.lastFocused.activeTab.state.blocked);
    assert(blocked >= 1, 'blocked counter ' + blocked);
    await waitFor(async () => (await ui.$$('.btn-badge')).length > 0, 'shield badge');
  });

  await check('Schutz pro Website abschaltbar', async () => {
    await M(() => global.nimbus.toggleProtection(global.nimbus.lastFocused.activeTab.state.url));
    await M(() => global.nimbus.lastFocused.activeTab.wc.reload());
    await sleep(1200);
    const p = await tabPage((u) => u.endsWith('/?ads'));
    await waitFor(async () => (await p.evaluate(() => window.adLoaded)) === true, 'ads.js loads when protection off');
    await M(() => global.nimbus.toggleProtection(global.nimbus.lastFocused.activeTab.state.url));
  });

  await check('Berechtigungsabfrage (Benachrichtigungen) erscheint und wird gemerkt', async () => {
    const p = await tabPage((u) => u.endsWith('/?ads'));
    await p.click('#notify');
    await ui.waitForSelector('.popover.dialog');
    await sleep(250);
    screenshot('permission-prompt');
    await ui.click('.popover.dialog .btn.primary');
    await waitFor(async () => (await p.textContent('#perm')) === 'granted', 'granted');
    const saved = await M(() => global.nimbus.settings.get('privacy.sitePermissions'));
    assert(Object.values(saved).some((x) => x.notifications === 'allow'), 'remembered');
  });

  await check('Chrome-Erweiterung (MV3): Content-Script + Toolbar-Knopf', async () => {
    const id = await M((_, dir) => global.nimbus.extensions.loadPath(dir, false), path.join(FIX, 'ext'));
    assert(id, 'extension loaded');
    await M(() => global.nimbus.lastFocused.activeTab.wc.reload());
    await sleep(1200);
    const p = await tabPage((u) => u.endsWith('/?ads'));
    await waitFor(async () => (await p.evaluate(() => document.documentElement.dataset.nimbusExt)) === 'ok', 'content script ran');
    await waitFor(async () => (await ui.evaluate(() => { const l = document.querySelector('browser-action-list'); return l && l.shadowRoot && l.shadowRoot.querySelectorAll('.action, button').length; })) > 0, 'action button');
    const list = await M(() => global.nimbus.extensions.list());
    assert(list.some((e) => e.name === 'Nimbus Test Extension'), 'listed');
    await sleep(300);
    screenshot('extension');
  });

  // ------------------------------------------------------------ tab display
  const tabsOf = () => ui.$$eval('#tabs > .tab[data-id]:not([data-leaving])', (els) => els.map((e) => ({ id: Number(e.dataset.id), tier: e.dataset.tier, w: Math.round(e.getBoundingClientRect().width), cls: e.className })));
  await check('Tab-Stil Drift ist Standard; lange ungenutzte Tabs werden zu Tropfen', async () => {
    await M(() => { global.nimbus.settings.set('layout.tabPosition', 'top'); global.nimbus.settings.set('appearance.mode', 'light'); global.nimbus.settings.set('appearance.preset', 'nimbus'); });
    assert(await ui.evaluate(() => document.body.classList.contains('ts-drift')), 'ts-drift class');
    const s = await state();
    const bg = s.tabs.filter((t) => t.id !== s.active);
    await M((_, ids) => { const w = global.nimbus.lastFocused; ids.forEach((id, i) => { const t = w.tabById(id); t.lastActive = Date.now() - [4 * 3600e3, 3600e3, 20 * 60e3, 60e3][i % 4]; }); w.scheduleState(); }, bg.map((t) => t.id));
    await waitFor(async () => (await tabsOf()).some((t) => t.tier === 'drop' && t.w <= 34), 'drop tab');
    const tabs = await tabsOf();
    const active = tabs.find((t) => t.cls.includes('active'));
    assert(active.tier === 'active' && active.w > 200, 'active wide: ' + active.w);
    assert(tabs.some((t) => t.tier === 'mid') && tabs.some((t) => t.tier === 'old'), 'tiers: ' + tabs.map((t) => t.tier));
    await sleep(500);
    screenshot('tabs-drift');
  });

  await check('Ganze obere Leiste übernimmt die Farbe der Website (theme-color)', async () => {
    await M((_, url) => global.nimbus.lastFocused.activeTab.load(url), base + '/tint.html');
    await waitFor(async () => (await ui.evaluate(() => { const a = document.querySelector('.tab.active'); return a && a.classList.contains('tinted') && a.style.getPropertyValue('--tint').toLowerCase(); })) === '#d4380d', 'tint detected');
    await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('bar-tinted')), 'bar tinted');
    await sleep(500); // colour transition
    const colors = await ui.evaluate(() => {
      const bg = (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor;
      return { toolbar: bg('#toolbar'), strip: bg('#tabstrip'), bookmarks: bg('#bookmarks-bar'), activeTab: bg('.tab.active'), text: getComputedStyle(document.querySelector('#toolbar')).color };
    });
    assert(colors.toolbar === 'rgb(212, 56, 13)', 'toolbar ' + colors.toolbar);
    assert(colors.bookmarks === 'rgb(212, 56, 13)', 'bookmarks bar ' + colors.bookmarks);
    assert(colors.activeTab === 'rgb(212, 56, 13)', 'active tab merges into bar ' + colors.activeTab);
    assert(colors.strip !== 'rgb(228, 234, 242)' && /^rgb\(1[0-9]{2}, 4[0-9]/.test(colors.strip), 'tab strip darker site colour ' + colors.strip);
    assert(colors.text === 'rgb(255, 255, 255)', 'readable white text ' + colors.text);
    screenshot('bar-tint');
    // new tab page → back to the theme colours
    await M(() => global.nimbus.commands.run(global.nimbus.lastFocused, 'newTab'));
    await waitFor(async () => !(await ui.evaluate(() => document.body.classList.contains('bar-tinted'))), 'untinted on new tab');
    await M(() => global.nimbus.commands.run(global.nimbus.lastFocused, 'closeTab'));
    await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('bar-tinted')), 'tinted again');
    // "tab only" keeps the bar in theme colours
    await M(() => global.nimbus.settings.set('layout.tintScope', 'tab'));
    await waitFor(async () => !(await ui.evaluate(() => document.body.classList.contains('bar-tinted'))), 'tab-only scope');
    assert(await ui.evaluate(() => document.querySelector('.tab.active').classList.contains('tinted')), 'tab still tinted');
    await M(() => global.nimbus.settings.set('layout.tintScope', 'bar'));
  });

  await check('Aktivitätspuls: Punkt bei Neuigkeiten in Hintergrund-Tab', async () => {
    const s = await state();
    const tid = await M((_, url) => { const w = global.nimbus.lastFocused; return w.createTab({ url, active: false, atEnd: true }).id; }, base + '/tint.html?bg');
    await waitFor(async () => (await ui.$$(`.tab[data-id="${tid}"].attention`)).length === 1, 'attention dot', 6000);
    await M((_, id) => { const w = global.nimbus.lastFocused; w.activate(w.tabById(id)); }, tid);
    await waitFor(async () => (await ui.$$(`.tab[data-id="${tid}"].attention`)).length === 0, 'cleared on activate');
    await M((_, id) => { const w = global.nimbus.lastFocused; w.activate(w.tabById(id)); }, s.active);
  });

  await check('Live-Vorschau beim Überfahren eines Hintergrund-Tabs', async () => {
    const tabs = await tabsOf();
    const target = tabs.find((t) => !t.cls.includes('active') && t.w > 60) || tabs.find((t) => !t.cls.includes('active'));
    await ui.hover(`.tab[data-id="${target.id}"]`);
    await ui.waitForSelector('.tab-preview:not([hidden])', { timeout: 4000 });
    await waitFor(async () => (await ui.evaluate(() => { const i = document.querySelector('.tab-preview .pv-img'); return !i || (i.src || '').startsWith('data:image'); })), 'thumbnail');
    assert(await M(() => global.nimbus.lastFocused.overlay), 'ui above page while preview shows');
    await sleep(300);
    screenshot('tabs-preview');
    await ui.mouse.move(640, 500);
    await waitFor(async () => await ui.isHidden('.tab-preview'), 'preview hidden');
    await waitFor(async () => !(await M(() => global.nimbus.lastFocused.overlay)), 'overlay released');
  });

  await check('Stapel pro Website fächert sich beim Überfahren auf', async () => {
    const port = base.split(':').pop();
    await M((_, p) => { const w = global.nimbus.lastFocused; for (let i = 0; i < 3; i++) w.createTab({ url: 'http://localhost:' + p + '/second.html?s' + i, active: false, atEnd: true }); }, port);
    await M(() => global.nimbus.settings.set('layout.tabStacks', true));
    await waitFor(async () => (await ui.$$('.tab.stack[data-stack="localhost"]')).length === 1, 'stack shown');
    const label = await ui.$eval('.tab.stack[data-stack="localhost"]', (e) => e.getAttribute('aria-label'));
    assert(/3/.test(label), 'stack label ' + label);
    await ui.hover('.tab.stack[data-stack="localhost"]');
    await waitFor(async () => (await ui.$$('.tab.stack-member')).length >= 3, 'fanned out');
    await sleep(350);
    screenshot('tabs-stack');
    await ui.mouse.move(640, 500);
    await waitFor(async () => (await ui.$$('.tab.stack-member')).length === 0, 'collapsed again', 4000);
  });

  await check('Tab-Stil Lupe vergrößert Tabs unter dem Mauszeiger', async () => {
    await M((_, b) => { global.nimbus.settings.set('layout.tabStacks', false); const w = global.nimbus.lastFocused; for (let i = 0; i < 6; i++) w.createTab({ url: b + '/second.html?lens' + i, active: false, atEnd: true }); global.nimbus.settings.set('layout.tabStyle', 'lens'); }, base);
    await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('ts-lens')), 'lens class');
    await sleep(300);
    const items = await ui.$$('#tabs > .tab:not(.active):not(.pinned)');
    const box = await items[Math.floor(items.length / 2)].boundingBox();
    await ui.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await ui.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    await sleep(400);
    const widths = await ui.$$eval('#tabs > .tab:not(.pinned)', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    assert(Math.max(...widths) > 150 && Math.min(...widths) < 60, 'lens widths ' + widths);
    screenshot('tabs-lens');
    // magnification must not jump when a tab updates while the pointer stands still
    const tabWidths = () => ui.$$eval('#tabs > .tab:not(.pinned):not([data-leaving])', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    const beforeUpdate = await tabWidths();
    await M(() => { const w = global.nimbus.lastFocused; w.tabs[w.tabs.length - 1].state.title = 'Neuer Titel'; w.sendState(); });
    await sleep(300);
    const afterUpdate = await tabWidths();
    assert(beforeUpdate.indexOf(Math.max(...beforeUpdate)) === afterUpdate.indexOf(Math.max(...afterUpdate)), 'lens stays under the pointer: ' + beforeUpdate + ' / ' + afterUpdate);
    await ui.mouse.move(640, 500);
  });

  await check('Lupe wirkt auch bei wenigen Tabs', async () => {
    const s = await state();
    await M((_, keep) => { const w = global.nimbus.lastFocused; for (const t of [...w.tabs]) if (t.id !== keep) w.closeTab(t, { remember: false }); for (let i = 0; i < 3; i++) w.createTab({ url: 'data:text/html,<title>Klein ' + i + '</title>x', active: false, atEnd: true }); }, s.active);
    await waitFor(async () => (await ui.$$('#tabs > .tab:not([data-leaving])')).length === 4, '4 tabs');
    await sleep(500);
    const idle = await ui.$$eval('#tabs > .tab:not([data-leaving])', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    assert(Math.min(...idle) < 60, 'small tabs at rest ' + idle);
    const items = await ui.$$('#tabs > .tab:not(.active):not([data-leaving])');
    const box = await items[1].boundingBox();
    await ui.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await ui.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    await sleep(400);
    const hovered = await ui.$$eval('#tabs > .tab:not([data-leaving])', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    assert(Math.max(...hovered) > 180, 'magnified with few tabs ' + hovered);
    await ui.mouse.move(640, 500);
    await sleep(400);
  });

  await check('Tab-Animationen: Öffnen wächst, Schließen schrumpft weg', async () => {
    await M(() => global.nimbus.settings.set('layout.tabStyle', 'classic'));
    await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('ts-classic')), 'classic');
    await sleep(400);
    // opening: the new tab grows in instead of appearing at full width
    const id = await M(() => global.nimbus.lastFocused.createTab({ url: 'data:text/html,<title>Animiert</title>x', active: false, atEnd: true }).id);
    const samples = [];
    for (let i = 0; i < 6; i++) { samples.push(await ui.evaluate((tid) => { const e = document.querySelector(`.tab[data-id="${tid}"]`); return e ? Math.round(e.getBoundingClientRect().width) : -1; }, id)); await sleep(40); }
    await sleep(300);
    const final = await ui.evaluate((tid) => Math.round(document.querySelector(`.tab[data-id="${tid}"]`).getBoundingClientRect().width), id);
    assert(samples.some((w) => w >= 0 && w < final - 20), 'grows in: ' + samples + ' → ' + final);
    // closing: the tab stays briefly as a shrinking ghost, then disappears
    await M((_, tid) => { const w = global.nimbus.lastFocused; w.closeTab(w.tabById(tid), { remember: false }); }, id);
    await sleep(60);
    const ghost = await ui.evaluate((tid) => { const e = document.querySelector(`.tab[data-id="${tid}"]`); return e && e.dataset.leaving ? Math.round(e.getBoundingClientRect().width) : null; }, id);
    assert(ghost !== null && ghost < final, 'shrinking ghost ' + ghost);
    await waitFor(async () => !(await ui.$(`.tab[data-id="${id}"]`)), 'ghost removed');
    // with animations switched off everything happens instantly
    await M(() => global.nimbus.settings.set('appearance.animations', false));
    await sleep(200);
    const id2 = await M(() => global.nimbus.lastFocused.createTab({ url: 'data:text/html,<title>Sofort</title>x', active: false, atEnd: true }).id);
    await sleep(40);
    const running = await ui.evaluate((tid) => { const e = document.querySelector(`.tab[data-id="${tid}"]`); return e ? e.getAnimations().length : -1; }, id2);
    assert(running === 0, 'no animation when disabled: ' + running);
    await M(() => global.nimbus.settings.set('appearance.animations', true));
    await M(() => global.nimbus.settings.set('layout.tabStyle', 'drift'));
  });

  await check('Tab-Stil Faden verbindet Kind-Tabs mit ihrem Ursprung', async () => {
    await M(() => { global.nimbus.settings.set('layout.tabStacks', false); global.nimbus.settings.set('layout.tabStyle', 'thread'); });
    await M((_, url) => global.nimbus.lastFocused.activeTab.load(url), base + '/tint.html?parent');
    const pp = await tabPage((u) => u.endsWith('?parent'));
    await pp.waitForLoadState('domcontentloaded');
    await pp.click('#child');
    await waitFor(async () => (await ui.$$('#tabs > .tab.child')).length >= 1, 'child tab');
    await waitFor(async () => (await ui.$$('#threads path')).length >= 1, 'thread drawn');
    await sleep(500);
    screenshot('tabs-thread');
  });

  await check('Drift + Faden auch seitlich (Baum + kompakte Zeilen)', async () => {
    await M(() => { global.nimbus.settings.set('layout.tabStyle', 'combo'); global.nimbus.settings.set('layout.tabPosition', 'left'); global.nimbus.settings.set('appearance.mode', 'dark'); });
    await waitFor(async () => (await ui.$$('#vtabs > .tab.child')).length >= 1, 'vertical child');
    // age one background tab so a compact "drop" row exists
    await M(() => { const w = global.nimbus.lastFocused; const t = w.tabs.find((x) => x !== w.activeTab && !w.visibleTabs().includes(x)); if (t) t.lastActive = Date.now() - 5 * 3600e3; w.scheduleState(); });
    await waitFor(async () => (await ui.$$('#vtabs > .tab[data-tier="drop"]')).length >= 1, 'aged tab');
    const ml = await ui.$eval('#vtabs > .tab.child', (e) => parseFloat(getComputedStyle(e).marginLeft));
    assert(ml >= 14, 'indented ' + ml);
    assert((await ui.$$('#vtabs > .tab[data-tier="drop"]')).length >= 1, 'compact drop rows');
    await sleep(500);
    screenshot('tabs-vertical-combo');
    await M(() => { global.nimbus.settings.set('layout.tabPosition', 'top'); global.nimbus.settings.set('appearance.mode', 'light'); });
  });

  await check('Klassischer Stil bleibt wählbar', async () => {
    await M(() => global.nimbus.settings.set('layout.tabStyle', 'classic'));
    await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('ts-classic')), 'classic class');
    const tiers = (await tabsOf()).map((t) => t.tier).filter(Boolean);
    assert(!tiers.length, 'no tiers in classic');
    await M(() => global.nimbus.settings.set('layout.tabStyle', 'drift'));
  });

  await check('Einstellungsseite zeigt Tab-Stil-Auswahl', async () => {
    await M(() => global.nimbus.openInternal(global.nimbus.lastFocused, 'settings', 'layout'));
    await sleep(800);
    const sp = await tabPage((u) => u.startsWith('nimbus://settings') && !u.includes('#appearance'));
    const diag = await sp.evaluate(() => location.href + ' sections=' + document.querySelectorAll('section.sec').length + ' styles=' + document.querySelectorAll('.tabstyles').length).catch((e) => 'eval failed ' + e.message);
    await sp.fill('#filter', '');
    await sp.dispatchEvent('#filter', 'input');
    await sp.waitForSelector('.tabstyles .preset', { timeout: 5000 }).catch(() => { throw new Error('no style picker: ' + diag + ' pages=' + pages().map((p) => p.url()).filter((u) => u.startsWith('nimbus://settings'))); });
    assert((await sp.$$('.tabstyles .preset')).length === 5, '5 styles');
    await sp.click('.tabstyles .preset:nth-child(3)');
    await waitFor(async () => (await M(() => global.nimbus.settings.get('layout.tabStyle'))) === 'lens', 'lens chosen');
    await sp.evaluate(() => document.getElementById('layout').scrollIntoView());
    await sleep(400);
    screenshot('settings-tabstyle');
    await M(() => global.nimbus.settings.set('layout.tabStyle', 'drift'));
  });

  await check('Kompakter Modus (Tabs + Adressleiste in einer Zeile) zeigt die Seite', async () => {
    const pageArea = () => M(() => global.nimbus.lastFocused.rects);
    for (const style of ['drift', 'classic', 'lens']) {
      for (const bar of ['always', 'never']) {
        await M((_, o) => { const st = global.nimbus.settings; st.set('layout.tabPosition', 'top'); st.set('layout.compact', true); st.set('layout.tabStyle', o.style); st.set('layout.showBookmarksBar', o.bar); }, { style, bar });
        await waitFor(async () => await ui.evaluate(() => document.body.classList.contains('compact')), 'compact class');
        const rects = await waitFor(async () => { const r = await pageArea(); return r[0] && r[0].height > 400 && r; }, `page area visible (${style}, bar ${bar})`);
        const tb = await ui.evaluate(() => { const a = document.querySelector('#tabstrip').getBoundingClientRect(); const b = document.querySelector('#toolbar').getBoundingClientRect(); return { sameRow: Math.abs(a.top - b.top) < 2, tabsBottom: a.bottom, barBottom: b.bottom }; });
        assert(tb.sameRow, 'tabs and address bar in one row');
        assert(rects[0].y >= Math.max(tb.tabsBottom, tb.barBottom) - 1, 'page below the bars');
      }
    }
    // find bar must not push the page out of view either
    await M(() => global.nimbus.commands.run(global.nimbus.lastFocused, 'find'));
    await ui.waitForSelector('#findbar:not([hidden])');
    await waitFor(async () => { const r = await pageArea(); return r[0] && r[0].height > 300; }, 'page area with find bar');
    await sleep(300);
    screenshot('compact-mode');
    await ui.press('#find-input', 'Escape');
  });

  await check('Design zurücksetzen stellt Aussehen und Layout wieder her', async () => {
    await M(() => { const st = global.nimbus.settings; st.set('appearance.preset', 'ember'); st.set('appearance.mode', 'dark'); st.set('layout.tabPosition', 'right'); });
    const dialogs = await M((electron) => {
      // answer the confirmation dialog automatically
      const orig = electron.dialog.showMessageBox;
      electron.dialog.showMessageBox = async () => { electron.dialog.showMessageBox = orig; return { response: 0 }; };
      return true;
    });
    assert(dialogs, 'dialog stubbed');
    await M(() => global.nimbus.resetDesign(global.nimbus.lastFocused));
    const s = await M(() => ({ a: global.nimbus.settings.get('appearance'), l: global.nimbus.settings.get('layout'), bm: global.nimbus.bookmarks.flat().length }));
    assert(s.a.preset === 'nimbus' && s.a.mode === 'system', 'appearance reset');
    assert(s.l.tabPosition === 'top' && s.l.compact === false && s.l.tabStyle === 'drift', 'layout reset');
    assert(s.bm >= 1, 'bookmarks kept');
    await waitFor(async () => (await M(() => global.nimbus.lastFocused.rects))[0].height > 400, 'page visible after reset');
    await M(() => { const st = global.nimbus.settings; st.set('appearance.mode', 'light'); st.set('layout.titlebar', 'system'); st.set('layout.tabStacks', false); });
  });

  await check('Einstellungen werden gespeichert (settings.json)', async () => {
    await M(() => global.nimbus.settings.flush());
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8'));
    assert(saved.appearance.preset === 'nimbus' && saved.layout.tabStyle === 'drift', 'settings persisted');
  });

  await check('Sitzung wird gespeichert', async () => {
    await M(() => global.nimbus.saveSessionNow());
    const sess = JSON.parse(fs.readFileSync(path.join(profile, 'session.json'), 'utf8'));
    assert(sess.windows.length === 1 && sess.windows[0].tabs.length >= 2, 'session tabs');
  });

  await check('Neustart stellt Sitzung wieder her (Hintergrund-Tabs schlafen)', async () => {
    const before = (await state()).tabs.length;
    await M(() => global.nimbus.settings.set('startup.mode', 'restore'));
    await M(() => global.nimbus.settings.flush());
    await app.close();
    app = await launch();
    app.process().stderr.on('data', (d) => logs.push(String(d)));
    ui = await uiPage();
    await ui.waitForSelector('body:not(.booting)', { timeout: 15000 });
    const s = await waitFor(async () => { const x = await state(); return x.tabs.length === before && x; }, 'restored tabs');
    assert(s.tabs.filter((t) => t.sleeping).length === before - 1, 'background tabs sleep: ' + JSON.stringify(s.tabs.map((t) => [t.url.slice(0, 40), t.sleeping])) + ' active ' + s.active);
    const bm = await M(() => global.nimbus.bookmarks.flat().length);
    assert(bm >= 1, 'bookmarks persisted');
  });

  const errs = logs.join('').split('\n').filter((l) => /Uncaught|TypeError|ReferenceError|is not a function|Cannot read/.test(l));
  await check('Keine JavaScript-Fehler im Log', async () => {
    assert(!errs.length, errs.slice(0, 5).join('\n'));
  });

  await app.close().catch(() => {});
  srv.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
  if (failed.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
