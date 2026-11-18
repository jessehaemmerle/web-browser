'use strict';
const { protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { PAGES_DIR, SHARED_DIR, ASSETS_DIR } = require('./paths');

const PAGES = new Set(['newtab', 'settings', 'history', 'bookmarks', 'downloads', 'error', 'about']);

function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'nimbus', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }
  ]);
}

function fontDir() {
  try { return path.join(path.dirname(require.resolve('@fontsource-variable/bricolage-grotesque/package.json')), 'files'); } catch (_) { return null; }
}

function resolveFile(url) {
  const u = new URL(url);
  const host = u.hostname;
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  let base = PAGES_DIR;
  if (rel === 'user-background') {
    const { app } = require('electron');
    const dir = app.getPath('userData');
    const f = fs.readdirSync(dir).find((x) => x.startsWith('newtab-background'));
    return f ? path.join(dir, f) : null;
  }
  if (!rel) {
    if (!PAGES.has(host)) return null;
    rel = (host === 'about' ? 'settings' : host) + '.html';
  } else if (rel.startsWith('shared/')) { base = SHARED_DIR; rel = rel.slice(7); }
  else if (rel.startsWith('assets/')) { base = ASSETS_DIR; rel = rel.slice(7); }
  else if (rel.startsWith('fonts/')) { base = fontDir(); rel = rel.slice(6); }
  if (!base) return null;
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep)) return null;
  return file;
}

class InternalProtocol {
  constructor(browser) { this.b = browser; this.done = new WeakSet(); }

  register(ses) {
    if (this.done.has(ses)) return;
    this.done.add(ses);
    ses.protocol.handle('nimbus', async (request) => {
      const file = resolveFile(request.url);
      if (!file || !fs.existsSync(file)) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      const res = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(res.headers);
      headers.set('Content-Security-Policy', "default-src 'self' nimbus:; img-src * data: blob:; style-src 'self' 'unsafe-inline' nimbus:; font-src 'self' nimbus: data:; connect-src 'self' nimbus:; frame-src 'none'; object-src 'none'");
      headers.set('Cache-Control', 'no-cache');
      return new Response(res.body, { status: res.status, headers });
    });
  }
}

module.exports = { InternalProtocol, registerSchemes, resolveFile };
