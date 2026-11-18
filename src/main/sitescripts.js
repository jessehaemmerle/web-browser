'use strict';
const { matchesPattern } = require('../shared/url');

/** Per-site custom CSS and JavaScript defined by the user. */
class SiteScripts {
  constructor(browser) { this.b = browser; }

  matching(list, url) {
    return (list || []).filter((x) => x.enabled !== false && String(x.match || '').split(/[\s,]+/).some((p) => matchesPattern(url, p)));
  }

  onNavigate(tab) {
    const wc = tab.wc;
    if (!wc) return;
    const url = wc.getURL();
    const sites = this.b.settings.data.sites;
    for (const s of this.matching(sites.userScripts, url)) {
      if (s.runAt === 'start') wc.executeJavaScript(wrap(s.js), true).catch((e) => console.warn('[userscript]', s.name, e.message));
    }
  }

  onDomReady(tab) {
    const wc = tab.wc;
    if (!wc) return;
    const url = wc.getURL();
    const sites = this.b.settings.data.sites;
    for (const s of this.matching(sites.userStyles, url)) wc.insertCSS(String(s.css || ''), { cssOrigin: 'user' }).catch(() => {});
    for (const s of this.matching(sites.userScripts, url)) {
      if (s.runAt !== 'start') wc.executeJavaScript(wrap(s.js), true).catch((e) => console.warn('[userscript]', s.name, e.message));
    }
  }
}

function wrap(js) {
  return `(function(){try{${String(js || '')}\n}catch(e){console.error('[Nimbus user script]',e)}})();`;
}

module.exports = { SiteScripts };
