/* Shared helpers for nimbus:// pages. */
'use strict';
const N = (() => {
  const api = window.nimbus;
  let strings = {};
  let settings = null;
  const listeners = new Set();
  const darkMq = matchMedia('(prefers-color-scheme: dark)');

  const t = (key, vars) => {
    let s = strings[key];
    if (s === undefined) s = key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
    return s;
  };
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const SVG = {
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8c-2.5-2.5-3.5-5-3.5-8s1-5.5 3.5-8z"/>',
    folder: '<path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h7a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/>',
    close: '<path d="M7 7l10 10M17 7L7 17"/>', plus: '<path d="M12 5.5v13M5.5 12h13"/>', search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>', edit: '<path d="M5 19h4L19 9l-4-4L5 15z"/>', up: '<path d="M7 14l5-5 5 5"/>', down: '<path d="M7 10l5 5 5-5"/>',
    star: '<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/>', file: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5v4h4"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', drag: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
    palette: '<path d="M12 4a8 8 0 1 0 0 16c1.1 0 1.5-.8 1.2-1.6-.4-1 .2-2 1.3-2H16a4 4 0 0 0 4-4c0-4.7-3.6-8.4-8-8.4z"/><circle cx="8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
    sidebar: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M9 5v14"/>', tab: '<rect x="3.5" y="6" width="17" height="13" rx="2"/><path d="M3.5 10h8V6"/>',
    shield: '<path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6.1z"/>', download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
    keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8"/>', puzzle: '<path d="M9.5 4.5a2 2 0 0 1 4 0V6H17a1 1 0 0 1 1 1v3.5h-1.5a2 2 0 0 0 0 4H18V18a1 1 0 0 1-1 1h-3.5v-1.5a2 2 0 0 0-4 0V19H6a1 1 0 0 1-1-1v-3.5h1.5a2 2 0 0 0 0-4H5V7a1 1 0 0 1 1-1h3.5z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    database: '<ellipse cx="12" cy="6.5" rx="7" ry="2.5"/><path d="M5 6.5v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-11M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.5"/>', power: '<path d="M12 4v8"/><path d="M7.5 7a7 7 0 1 0 9 0"/>',
    reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>', pause: '<path d="M9 6v12M15 6v12"/>', play: '<path d="M8 5.5v13l10-6.5z"/>'
  };
  const icon = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic'); s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = SVG[name] || '';
    return s;
  };

  function applyTheme() {
    if (!settings || typeof NimbusTheme === 'undefined') return;
    const theme = NimbusTheme.compute(settings.appearance, darkMq.matches);
    let st = document.getElementById('n-theme');
    if (!st) { st = document.createElement('style'); st.id = 'n-theme'; document.head.append(st); }
    st.textContent = theme.css;
    document.documentElement.dataset.scheme = theme.scheme;
    return theme;
  }
  darkMq.addEventListener('change', applyTheme);

  function applyI18n(root = document) {
    for (const n of root.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
    for (const n of root.querySelectorAll('[data-i18n-placeholder]')) n.placeholder = t(n.dataset.i18nPlaceholder);
    for (const n of root.querySelectorAll('[data-i18n-title]')) n.title = t(n.dataset.i18nTitle);
  }

  let toastTimer = null;
  function toast(text) {
    let n = document.querySelector('.toast');
    if (!n) { n = el('div', { class: 'toast', role: 'status' }); document.body.append(n); }
    n.textContent = text; n.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { n.hidden = true; }, 2600);
  }

  /** Modal form dialog. fields: [{ name, label, value }] → resolves to values object or null. */
  function form(title, fields, okLabel) {
    return new Promise((resolve) => {
      const dlg = el('dialog', { class: 'n-dialog', style: 'border:1px solid var(--n-border);border-radius:16px;background:var(--n-surface);color:var(--n-text);padding:20px;width:400px;max-width:92vw' });
      const f = el('form', { method: 'dialog' });
      f.append(el('h2', { style: 'margin:0 0 14px;font-size:1.25em', text: title }));
      const inputs = {};
      for (const fd of fields) {
        const i = el('input', { type: 'text', value: fd.value || '', style: 'width:100%' });
        inputs[fd.name] = i;
        f.append(el('label', { style: 'display:grid;gap:4px;margin-bottom:12px;color:var(--n-muted)' }, fd.label, i));
      }
      const cancel = el('button', { type: 'button', class: 'btn', text: t('dialog.cancel') });
      f.append(el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, cancel, el('button', { type: 'submit', class: 'btn primary', text: okLabel || t('dialog.save') })));
      dlg.append(f);
      document.body.append(dlg);
      let result = null;
      cancel.addEventListener('click', () => dlg.close());
      f.addEventListener('submit', () => { result = {}; for (const [k, i] of Object.entries(inputs)) result[k] = i.value; });
      dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
      dlg.showModal();
      const first = Object.values(inputs)[0];
      if (first) { first.focus(); first.select(); }
    });
  }

  const call = (m, ...a) => {
    if (!api) return Promise.reject(new Error('no api'));
    return api.call(m, ...a);
  };

  async function init() {
    if (!api) { document.body.classList.remove('booting'); return null; }
    const data = await call('pageInit');
    strings = data.strings;
    settings = data.settings;
    document.documentElement.lang = data.lang;
    applyTheme();
    applyI18n();
    api.on((name, payload) => {
      if (name === 'settings') { settings = payload; applyTheme(); }
      if (name === 'theme') applyTheme();
      if (name === 'strings') { location.reload(); return; }
      for (const cb of listeners) cb(name, payload);
    });
    document.body.classList.remove('booting');
    return data;
  }

  const fmtBytes = (n) => {
    if (!n || n < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toLocaleString(document.documentElement.lang, { maximumFractionDigits: i ? 1 : 0 }) + ' ' + u[i];
  };
  const favicon = (url) => {
    const box = el('span', { class: 'fav' });
    box.append(icon('globe'));
    return box;
  };

  return {
    t, el, icon, call, init, toast, form, applyTheme, applyI18n, fmtBytes, favicon,
    get settings() { return settings; },
    on: (cb) => listeners.add(cb)
  };
})();
