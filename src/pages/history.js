'use strict';
(async () => {
  const { t, el, call, icon } = N;
  if (!(await N.init())) return;
  document.title = t('hist.title');
  const root = document.getElementById('root');
  const q = el('input', { type: 'search', placeholder: t('hist.search'), 'aria-label': t('hist.search') });
  const sb = el('div', { class: 'search-box' }, icon('search'), q);
  const clearSel = el('select', { 'aria-label': t('hist.clear') }, el('option', { value: '', text: t('hist.clear') }),
    ...[['1', t('range.hour')], ['24', t('range.day')], ['168', t('range.week')], ['0', t('range.all')]].map(([v, l]) => el('option', { value: v, text: l })));
  clearSel.addEventListener('change', async () => {
    if (!clearSel.value) return;
    if (confirm(t('hist.clearConfirm'))) await call('historyClear', Number(clearSel.value));
    clearSel.value = '';
    load();
  });
  root.append(el('div', { class: 'page-head' }, el('h1', { text: t('hist.title') }), sb, clearSel));
  const list = el('div');
  const more = el('button', { class: 'btn', text: t('hist.more'), hidden: true });
  root.append(list, el('div', { style: 'text-align:center;margin-top:16px' }, more));
  let limit = 300;
  const fmtDay = (d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (diff === 0) return t('hist.today');
    if (diff === 1) return t('hist.yesterday');
    return new Date(d).toLocaleDateString(document.documentElement.lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  async function load() {
    const res = await call('historyList', { query: q.value, limit });
    list.textContent = '';
    if (!res.items.length) { list.append(el('div', { class: 'empty', text: q.value ? t('hist.noResults') : t('hist.empty') })); more.hidden = true; return; }
    let day = null, box = null;
    for (const e of res.items) {
      const d = fmtDay(e.lastVisit);
      if (d !== day) { day = d; list.append(el('div', { class: 'day-label', text: d })); box = el('div', { class: 'list' }); list.append(box); }
      const time = new Date(e.lastVisit).toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' });
      const del = el('button', { class: 'icon-btn', title: t('hist.remove'), onclick: async (ev) => { ev.stopPropagation(); await call('historyRemove', e.url); load(); } });
      del.append(icon('close'));
      const r = el('div', { class: 'list-row', tabindex: '0', role: 'link' },
        el('span', { class: 'muted', style: 'width:46px;font-variant-numeric:tabular-nums', text: time }), N.favicon(e.url),
        el('div', { class: 'grow' }, el('div', { class: 'title', text: e.title || e.url }), el('div', { class: 'sub', text: NimbusUrl.displayUrl(e.url, { simplify: false }) })),
        e.visits > 1 ? el('span', { class: 'muted', title: t('hist.visits'), text: '×' + e.visits }) : null, del);
      r.addEventListener('click', (ev) => call('openUrl', e.url, { newTab: ev.ctrlKey || ev.metaKey || ev.button === 1 }));
      r.addEventListener('auxclick', (ev) => { if (ev.button === 1) call('openUrl', e.url, { newTab: true, background: true }); });
      r.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') call('openUrl', e.url); });
      box.append(r);
    }
    more.hidden = res.total <= limit;
  }
  more.addEventListener('click', () => { limit += 300; load(); });
  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 150); });
  N.on((n) => { if (n === 'history' && !q.value) load(); });
  load();
  q.focus();
})();
