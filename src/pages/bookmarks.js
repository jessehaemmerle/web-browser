'use strict';
(async () => {
  const { t, el, call, icon, toast } = N;
  if (!(await N.init())) return;
  document.title = t('bm.manager');
  const root = document.getElementById('root');
  let tree = await call('bookmarksTree');
  let current = 'bar';
  const q = el('input', { type: 'search', placeholder: t('bm.search'), 'aria-label': t('bm.search') });
  const head = el('div', { class: 'page-head' }, el('h1', { text: t('bm.manager') }), el('div', { class: 'search-box' }, icon('search'), q));
  const actions = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px' });
  const layout = el('div', { style: 'display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px;align-items:start' });
  const folders = el('div', { class: 'list', style: 'padding:6px' });
  const list = el('div', { class: 'list' });
  layout.append(folders, list);
  root.append(head, actions, layout);

  const byId = () => {
    const m = new Map();
    const walk = (n, parent) => { m.set(n.id, { node: n, parent }); for (const c of n.children || []) walk(c, n); };
    walk(tree.bar, null); walk(tree.other, null);
    return m;
  };
  const rootTitle = (id) => (id === 'bar' ? t('bm.bar') : id === 'other' ? t('bm.other') : null);

  actions.append(
    el('button', { class: 'btn', onclick: () => edit(null, 'bookmark') }, icon('plus'), t('bm.addBookmark')),
    el('button', { class: 'btn', onclick: () => edit(null, 'folder') }, icon('folder'), t('bm.addFolder')),
    el('span', { style: 'flex:1' }),
    el('button', { class: 'btn ghost', text: t('set.importBookmarks'), onclick: async () => { try { const n = await call('bookmarksImport'); if (n) toast(t('io.bmImported', { count: n })); } catch (e) { toast(t('io.invalid')); } } }),
    el('button', { class: 'btn ghost', text: t('set.exportBookmarks'), onclick: () => call('bookmarksExport') })
  );

  function renderFolders() {
    folders.textContent = '';
    const walk = (n, depth) => {
      if (n.type !== 'folder') return;
      const b = el('button', { class: 'btn ghost', style: `width:100%;justify-content:flex-start;padding-left:${10 + depth * 14}px;${n.id === current ? 'background:color-mix(in srgb,var(--n-accent) 14%,transparent);color:var(--n-accent)' : ''}` }, icon('folder'), el('span', { style: 'overflow:hidden;text-overflow:ellipsis', text: rootTitle(n.id) || n.title || t('bm.folder') }));
      b.addEventListener('click', () => { current = n.id; q.value = ''; render(); });
      b.addEventListener('dragover', (e) => e.preventDefault());
      b.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/x-bm'); if (id && id !== n.id) call('bookmarkMove', id, n.id); });
      folders.append(b);
      for (const c of n.children || []) walk(c, depth + 1);
    };
    walk(tree.bar, 0); walk(tree.other, 0);
  }

  function renderList() {
    list.textContent = '';
    const m = byId();
    let items;
    const query = q.value.trim().toLowerCase();
    if (query) {
      items = [...m.values()].map((x) => x.node).filter((n) => n.type === 'bookmark' && (n.title.toLowerCase().includes(query) || n.url.toLowerCase().includes(query)));
    } else items = (m.get(current) || m.get('bar')).node.children || [];
    if (!items.length) { list.append(el('div', { class: 'empty', text: query ? t('hist.noResults') : t('bm.emptyFolder') })); return; }
    items.forEach((n, i) => {
      const r = el('div', { class: 'list-row', draggable: 'true', tabindex: '0' });
      r.append(n.type === 'folder' ? el('span', { class: 'fav' }, icon('folder')) : N.favicon(n.url),
        el('div', { class: 'grow' }, el('div', { class: 'title', text: n.title || (n.type === 'folder' ? t('bm.folder') : n.url) }), n.type === 'bookmark' ? el('div', { class: 'sub', text: n.url }) : el('div', { class: 'sub', text: t('bm.items', { count: (n.children || []).length }) })));
      const e = el('button', { class: 'icon-btn', title: t('bm.edit'), onclick: (ev) => { ev.stopPropagation(); edit(n); } }); e.append(icon('edit'));
      const d = el('button', { class: 'icon-btn', title: t('bm.delete'), onclick: (ev) => { ev.stopPropagation(); call('bookmarkRemove', n.id); } }); d.append(icon('trash'));
      r.append(e, d);
      r.addEventListener('click', (ev) => { if (n.type === 'folder') { current = n.id; render(); } else call('openUrl', n.url, { newTab: ev.ctrlKey || ev.metaKey }); });
      r.addEventListener('auxclick', (ev) => { if (ev.button === 1 && n.url) call('openUrl', n.url, { newTab: true, background: true }); });
      r.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/x-bm', n.id));
      r.addEventListener('dragover', (ev) => ev.preventDefault());
      r.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/x-bm');
        if (!id || id === n.id) return;
        if (n.type === 'folder') call('bookmarkMove', id, n.id); else call('bookmarkMove', id, current, i);
      });
      list.append(r);
    });
  }

  async function edit(node, type) {
    const isNew = !node;
    const kind = node ? node.type : type;
    const fields = [{ name: 'title', label: kind === 'folder' ? t('bm.folderName') : t('bm.name'), value: node ? node.title : '' }];
    if (kind === 'bookmark') fields.push({ name: 'url', label: t('bm.url'), value: (node && node.url) || 'https://' });
    const r = await N.form(isNew ? (kind === 'folder' ? t('bm.addFolder') : t('bm.addBookmark')) : t('bm.edit'), fields);
    if (!r) return;
    if (isNew) await call('bookmarkAdd', { parentId: current, type: kind, title: r.title, url: r.url });
    else await call('bookmarkUpdate', node.id, { title: r.title, url: r.url });
  }

  function render() { renderFolders(); renderList(); }
  q.addEventListener('input', renderList);
  N.on(async (n, payload) => { if (n === 'bookmarks') { tree = payload; render(); } });
  render();
})();
