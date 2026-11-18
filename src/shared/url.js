/* Nimbus – address bar input handling (shared between main process, UI and tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NimbusUrl = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KNOWN_SCHEMES = ['http', 'https', 'file', 'nimbus', 'chrome-extension', 'about', 'data', 'view-source', 'ftp', 'mailto', 'blob', 'chrome', 'devtools'];
  const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;
  const HOSTLIKE = /^(?:[a-z0-9\u00a1-\uffff](?:[a-z0-9\u00a1-\uffff-]{0,61}[a-z0-9\u00a1-\uffff])?\.)+[a-z\u00a1-\uffff]{2,63}\.?$/i;

  function isPrivateHost(host) {
    host = (host || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
    if (IPV4.test(host)) {
      const p = host.split('.').map(Number);
      return p[0] === 10 || p[0] === 127 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 169 && p[1] === 254);
    }
    return false;
  }

  function buildSearchUrl(template, query) {
    const q = encodeURIComponent(query);
    return template.includes('%s') ? template.split('%s').join(q) : template + q;
  }

  /**
   * Turn whatever the user typed into a URL to load.
   * Returns { url, isSearch }.
   */
  function resolveInput(input, searchTemplate) {
    const text = String(input || '').trim();
    if (!text) return null;
    const search = () => ({ url: buildSearchUrl(searchTemplate || 'https://duckduckgo.com/?q=%s', text), isSearch: true });

    // Windows drive path (C:\foo) or UNC path
    if (/^[a-z]:[\\/]/i.test(text)) return { url: 'file:///' + text.replace(/\\/g, '/'), isSearch: false };
    if (/^\\\\/.test(text)) return { url: 'file:' + text.replace(/\\/g, '/'), isSearch: false };
    // Unix absolute path
    if (/^\/[^\s]*$/.test(text) && !text.startsWith('//')) return { url: 'file://' + text, isSearch: false };

    // Explicit "?" forces a search
    if (text.startsWith('?')) return { url: buildSearchUrl(searchTemplate || 'https://duckduckgo.com/?q=%s', text.slice(1).trim()), isSearch: true };

    if (/\s/.test(text)) return search();

    // localhost / host:port
    const hostPort = text.match(/^([^/:?#]+)(:\d{1,5})?([/?#].*)?$/);
    if (hostPort) {
      const host = hostPort[1];
      if (host.toLowerCase() === 'localhost' || IPV4.test(host)) {
        return { url: 'http://' + text, isSearch: false };
      }
    }

    const scheme = text.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme && KNOWN_SCHEMES.includes(scheme[1].toLowerCase())) {
      const s = scheme[1].toLowerCase();
      if ((s === 'http' || s === 'https') && !/^https?:\/\//i.test(text)) return search();
      return { url: text, isSearch: false };
    }

    // IPv6 literal
    if (/^\[[0-9a-f:]+\](:\d+)?(\/.*)?$/i.test(text)) return { url: 'http://' + text, isSearch: false };

    if (hostPort) {
      const host = hostPort[1];
      if (HOSTLIKE.test(host)) {
        return { url: (isPrivateHost(host) ? 'http://' : 'https://') + text, isSearch: false };
      }
    }
    return search();
  }

  /** Human friendly URL for the address bar when not focused. */
  function displayUrl(url, { simplify = true } = {}) {
    if (!url) return '';
    if (url.startsWith('nimbus://newtab')) return '';
    if (!simplify) return url;
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        let s = u.host.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
        try { s = decodeURI(s); } catch (_) { /* keep encoded */ }
        return s;
      }
    } catch (_) { /* not a URL */ }
    return url;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (_) { return ''; }
  }

  function originOf(url) {
    try { const u = new URL(url); return u.origin === 'null' ? u.protocol + '//' + u.host : u.origin; } catch (_) { return ''; }
  }

  /** Match a URL against a simple pattern list: "example.com", "*.example.com", "https://x.org/path*", "*" */
  function matchesPattern(url, pattern) {
    pattern = String(pattern || '').trim();
    if (!pattern) return false;
    if (pattern === '*' || pattern === '<all_urls>') return /^(https?|file):/.test(url);
    if (/^[a-z]+:\/\//i.test(pattern) || pattern.includes('/')) {
      const re = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (pattern.endsWith('*') ? '' : '.*') + '$', 'i');
      return re.test(url) || re.test(url.replace(/^[a-z]+:\/\//i, ''));
    }
    const host = hostOf(url);
    if (!host) return false;
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2).toLowerCase();
      return host === base || host.endsWith('.' + base);
    }
    const p = pattern.toLowerCase();
    return host === p || host === 'www.' + p || host.endsWith('.' + p);
  }

  return { resolveInput, displayUrl, hostOf, originOf, isPrivateHost, buildSearchUrl, matchesPattern };
});
