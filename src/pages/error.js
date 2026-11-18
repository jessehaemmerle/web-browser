'use strict';
(async () => {
  const { t, el, call } = N;
  if (!(await N.init())) return;
  const p = new URLSearchParams(location.search);
  const url = p.get('url') || '';
  const code = p.get('code') || '';
  const desc = p.get('desc') || '';
  const root = document.getElementById('root');
  const info = await call('errorInfo', url).catch(() => ({}));
  const n = Number(code);
  let kind = 'generic';
  if (code === 'crash') kind = 'crash';
  else if (n === -106 || (!info.online && n <= -100 && n > -200)) kind = 'offline';
  else if (n === -105 || n === -137) kind = 'dns';
  else if (n <= -200 && n > -300) kind = 'cert';
  else if (n === -102 || n === -118 || n === -109 || n === -7) kind = 'unreachable';
  else if (n === -20 || n === -27 || n === -301) kind = 'blocked';
  else if (n === -324 || n === -100 || n === -101) kind = 'reset';
  const httpsFailed = info.httpsUpgraded && url.startsWith('https:') && kind !== 'cert';
  if (httpsFailed) kind = 'httpsOnly';
  const host = NimbusUrl.hostOf(url);
  document.title = t('err.' + kind + '.title');
  const box = el('div', { style: 'max-width:600px;margin:12vh auto 0' });
  box.append(
    el('div', { style: 'font-family:var(--display);font-size:72px;line-height:1;color:var(--n-accent);margin-bottom:18px', 'aria-hidden': 'true', text: kind === 'offline' ? '☁︎' : kind === 'cert' || kind === 'httpsOnly' ? '⚠︎' : '☁︎' }),
    el('h1', { style: 'font-size:2em;margin:0 0 10px', text: t('err.' + kind + '.title') }),
    el('p', { style: 'color:var(--n-muted);font-size:1.08em;max-width:60ch', text: t('err.' + kind + '.text', { host }) }),
    el('p', { class: 'muted', style: 'font-size:.9em;word-break:break-all', text: url })
  );
  const tips = t('err.' + kind + '.tips');
  if (tips !== 'err.' + kind + '.tips') box.append(el('ul', { style: 'color:var(--n-muted);line-height:1.7' }, ...tips.split('|').map((x) => el('li', { text: x }))));
  const row = el('div', { style: 'display:flex;gap:10px;margin-top:22px;flex-wrap:wrap' });
  row.append(el('button', { class: 'btn primary', text: t('err.retry'), onclick: () => call('errorAction', 'retry', url) }));
  if (kind === 'httpsOnly') row.append(el('button', { class: 'btn', text: t('err.continueHttp'), onclick: () => call('errorAction', 'allowHttp', url) }));
  if (kind === 'cert' && info.cert) {
    const adv = el('details', { style: 'margin-top:22px;width:100%' }, el('summary', { style: 'cursor:pointer;color:var(--n-muted)', text: t('err.advanced') }),
      el('p', { class: 'muted', text: `${desc || code} · ${info.cert.error || ''}` }), el('p', { class: 'muted', text: t('err.certIssuer', { issuer: info.cert.issuer || '?' }) }),
      el('button', { class: 'btn danger', text: t('err.proceed', { host }), onclick: () => call('errorAction', 'proceed', url) }));
    row.append(adv);
  }
  box.append(row);
  box.append(el('p', { class: 'muted', style: 'margin-top:28px;font-size:.85em', text: `${t('err.code')}: ${desc || code}` }));
  root.append(box);
  addEventListener('keydown', (e) => { if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) { e.preventDefault(); call('errorAction', 'retry', url); } });
})();
