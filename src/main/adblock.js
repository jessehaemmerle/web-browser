'use strict';
const fs = require('fs');
const path = require('path');
const { app, ipcMain, net } = require('electron');
const { parse: parseDomain } = require('tldts');

/** Wraps the Ghostery filter engine. Network matching is called from our own webRequest pipeline. */
class AdBlock {
  constructor(browser) {
    this.b = browser;
    this.engine = null;
    this.loading = null;
    this.totalBlocked = 0;
    this.lastUpdate = 0;
    this.error = null;
  }

  enabled() { return !!this.b.settings.get('privacy.adblock'); }

  cachePath(level) { return path.join(app.getPath('userData'), `adblock-${level}.bin`); }

  async load(force = false) {
    const level = this.b.settings.get('privacy.adblockLevel') || 'ads-tracking';
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const file = this.cachePath(level);
    const fetchFn = (url, init) => net.fetch(url, init);
    const custom = String(this.b.settings.get('privacy.customFilters') || '').trim();
    clearTimeout(this.retryTimer);
    this.loading = (async () => {
      let engine = null;
      try {
        // refresh lists that are older than a week
        let stale = force;
        try { stale = stale || Date.now() - fs.statSync(file).mtimeMs > 7 * 86400000; } catch (_) { /* no cache yet */ }
        if (stale) { try { fs.unlinkSync(file); } catch (_) { /* none */ } }
        const caching = { path: file, read: fs.promises.readFile, write: fs.promises.writeFile };
        if (level === 'ads') engine = await ElectronBlocker.fromPrebuiltAdsOnly(fetchFn, caching);
        else if (level === 'full') engine = await ElectronBlocker.fromPrebuiltFull(fetchFn, caching);
        else engine = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetchFn, caching);
        this.error = null;
        try { this.lastUpdate = fs.statSync(file).mtimeMs; } catch (_) { this.lastUpdate = Date.now(); }
      } catch (err) {
        // offline or blocked: keep working with the user's own rules and retry later
        this.error = err.message;
        console.warn('[adblock] could not load filter lists:', err.message);
        engine = ElectronBlocker.parse('', { loadCosmeticFilters: true, loadNetworkFilters: true });
        this.retryTimer = setTimeout(() => this.load(), 10 * 60 * 1000);
      }
      if (custom) {
        try {
          const { parseFilters } = require('@ghostery/adblocker');
          const { networkFilters, cosmeticFilters } = parseFilters(custom);
          engine.update({ newNetworkFilters: networkFilters, newCosmeticFilters: cosmeticFilters });
        } catch (err) { console.warn('[adblock] invalid custom filters:', err.message); }
      }
      this.engine = engine;
    })();
    return this.loading;
  }

  /** Register the cosmetic filtering preload for a session. */
  attachCosmetic(ses) {
    let PRELOAD_PATH = null;
    try { PRELOAD_PATH = require.resolve('@ghostery/adblocker-electron-preload'); } catch (_) { /* not installed */ }
    if (PRELOAD_PATH && fs.existsSync(PRELOAD_PATH)) {
      ses.registerPreloadScript({ id: 'nimbus-adblock', type: 'frame', filePath: PRELOAD_PATH });
    }
    if (this.ipcReady) return;
    this.ipcReady = true;
    ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (event, url, msg) => {
      if (!this.engine || !this.enabled() || !this.b.settings.get('privacy.adblockCosmetic')) return;
      const top = event.sender && !event.sender.isDestroyed() ? event.sender.getURL() : url;
      if (!this.b.isProtectionEnabledFor(top)) return;
      return this.engine.onInjectCosmeticFilters(event, url, msg);
    });
    ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', () => !!(this.engine && this.engine.config.enableMutationObserver));
  }

  /** Returns { cancel } / { redirectURL } / null for a request. */
  match(details) {
    if (!this.engine || !this.enabled()) return null;
    const { fromElectronDetails } = require('@ghostery/adblocker-electron');
    const request = fromElectronDetails(details);
    if (request.type === 'other') request.guessTypeOfRequest();
    if (request.isMainFrame()) return null;
    const { redirect, match } = this.engine.match(request);
    if (redirect) return { redirectURL: redirect.dataUrl };
    if (match) return { cancel: true };
    return null;
  }

  cspFor(details) {
    if (!this.engine || !this.enabled()) return undefined;
    const { fromElectronDetails } = require('@ghostery/adblocker-electron');
    return this.engine.getCSPDirectives(fromElectronDetails(details));
  }

  status() {
    return { enabled: this.enabled(), ready: !!this.engine, error: this.error, lastUpdate: this.lastUpdate, totalBlocked: this.totalBlocked };
  }
}

/** eTLD+1 of a URL, cached. */
const domainCache = new Map();
function siteOf(url) {
  let host;
  try { host = new URL(url).hostname; } catch (_) { return ''; }
  let d = domainCache.get(host);
  if (d === undefined) {
    d = parseDomain(host).domain || host;
    if (domainCache.size > 5000) domainCache.clear();
    domainCache.set(host, d);
  }
  return d;
}

module.exports = { AdBlock, siteOf };
