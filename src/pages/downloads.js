'use strict';
(async () => {
  const { t, el, call, icon, fmtBytes } = N;
  if (!(await N.init())) return;
  document.title = t('dl.title');
  const root = document.getElementById('root');
  const q = el('input', { type: 'search', placeholder: t('dl.search') });
  root.append(el('div', { class: 'page-head' }, el('h1', { text: t('dl.title') }), el('div', { class: 'search-box' }, icon('search'), q),
    el('button', { class: 'btn', text: t('dl.clear'), onclick: () => call('downloadsClear') })));
  const list = el('div', { class: 'list' });
  root.append(list);
  let items = await call('downloadsList');
  const act = (d, ic, key, action) => { const b = el('button', { class: 'icon-btn', title: t(key), onclick: (e) => { e.stopPropagation(); call('downloadAction', d.id, action); } }); b.append(icon(ic)); return b; };
  function render() {
    list.textContent = '';
    const query = q.value.trim().toLowerCase();
    const shown = items.filter((d) => !query || d.filename.toLowerCase().includes(query) || d.url.toLowerCase().includes(query));
    if (!shown.length) { list.append(el('div', { class: 'empty', text: t('dl.empty') })); return; }
    for (const d of shown) {
      let meta;
      if (d.state === 'progressing') meta = `${fmtBytes(d.received)} / ${d.total ? fmtBytes(d.total) : '?'}` + (d.paused ? ' — ' + t('dl.paused') : '');
      else if (d.state === 'completed') meta = fmtBytes(d.total || d.received) + ' · ' + new Date(d.end || d.start).toLocaleString(document.documentElement.lang);
      else meta = t('dl.state.' + d.state);
      const buttons = [];
      if (d.state === 'progressing') { buttons.push(d.paused ? act(d, 'play', 'dl.resume', 'resume') : act(d, 'pause', 'dl.pause', 'pause'), act(d, 'close', 'dl.cancel', 'cancel')); }
      else if (d.state === 'completed') buttons.push(act(d, 'open', 'dl.open', 'open'), act(d, 'folder', 'dl.show', 'show'));
      else buttons.push(act(d, 'reload', 'dl.retry', 'retry'));
      buttons.push(act(d, 'trash', 'dl.remove', 'remove'));
      const bar = d.state === 'progressing' ? el('div', { style: 'height:4px;border-radius:4px;background:var(--n-border);overflow:hidden;margin-top:6px' }, el('div', { style: `height:100%;width:${d.total ? Math.round(d.received / d.total * 100) : 10}%;background:var(--n-accent)` })) : null;
      const r = el('div', { class: 'list-row' }, el('span', { class: 'fav' }, icon('file')),
        el('div', { class: 'grow' }, el('div', { class: 'title', text: d.filename, style: d.state === 'cancelled' ? 'text-decoration:line-through' : '' }), el('div', { class: 'sub', text: meta + ' · ' + d.url }), bar), ...buttons);
      if (d.state === 'completed') r.addEventListener('dblclick', () => call('downloadAction', d.id, 'open'));
      list.append(r);
    }
  }
  q.addEventListener('input', render);
  N.on((n, payload) => { if (n === 'downloads') { items = payload || []; render(); } });
  render();
})();
