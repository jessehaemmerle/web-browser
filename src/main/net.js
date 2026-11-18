'use strict';
const { webContents: WebContents, app } = require('electron');
const { siteOf } = require('./adblock');
const { isPrivateHost, hostOf, originOf } = require('../shared/url');

/** Chrome-compatible user agent (without "Electron" / app tokens, which some sites reject). */
function defaultUserAgent() {
  const major = String(process.versions.chrome || '140').split('.')[0];
  const platform = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
    : process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7'
      : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

const SKIP_SCHEMES = /^(nimbus|chrome-extension|devtools|file|data|blob|crx|chrome):/i;

/** Map Electron permission names to our settings keys. */
function permissionKey(permission) {
  switch (permission) {
    case 'media': return 'media';
    case 'geolocation': return 'geolocation';
    case 'notifications': return 'notifications';
    case 'clipboard-read': return 'clipboard';
    case 'midi': case 'midiSysex': return 'midi';
    case 'fullscreen': return 'fullscreen';
    case 'pointerLock': case 'keyboardLock': return 'pointerLock';
    case 'openExternal': return 'openExternal';
    case 'idle-detection': return 'idleDetection';
    case 'window-management': return 'windowManagement';
    case 'speaker-selection': case 'clipboard-sanitized-write': case 'storage-access': case 'top-level-storage-access': case 'display-capture': case 'persistent-storage': return null; // always allowed / handled elsewhere
    default: return permission;
  }
}

function setupSession(browser, ses, { private: isPrivate = false } = {}) {
  const s = browser.settings;
  ses.setUserAgent(s.get('privacy.userAgent') || defaultUserAgent());
  if (process.platform !== 'darwin') {
    try { ses.setSpellCheckerLanguages(s.get('performance.spellcheckLanguages').filter((l) => ses.availableSpellCheckerLanguages.includes(l))); } catch (_) { /* ignore */ }
  }
  ses.setSpellCheckerEnabled(!!s.get('performance.spellcheck'));

  // ---------------------------------------------------------------- permissions
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const key = permissionKey(permission);
    if (key === null) return callback(true);
    const origin = originOf(details.requestingUrl || (wc && wc.getURL()) || '');
    if (/^nimbus:|^chrome-extension:/.test(origin)) return callback(true);
    const decision = browser.permissionDecision(origin, key);
    if (decision === 'allow') return callback(true);
    if (decision === 'block') return callback(false);
    browser.askPermission(wc, { origin, key, permission, details, private: isPrivate }).then(callback, () => callback(false));
  });
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) => {
    const key = permissionKey(permission);
    if (key === null) return true;
    const origin = originOf(requestingOrigin || (wc && wc.getURL()) || '');
    if (/^nimbus:|^chrome-extension:|^file:/.test(origin)) return true;
    return browser.permissionDecision(origin, key) === 'allow';
  });
  ses.setDisplayMediaRequestHandler((request, callback) => browser.pickDisplayMedia(request, callback), { useSystemPicker: true });

  // ---------------------------------------------------------------- web requests
  const tabFor = (id) => (id ? browser.tabsByWc.get(id) : null);
  const topUrlFor = (details) => {
    if (details.resourceType === 'mainFrame') return details.url;
    if (details.webContentsId) {
      const wc = WebContents.fromId(details.webContentsId);
      if (wc && !wc.isDestroyed()) return wc.getURL();
    }
    return details.referrer || '';
  };
  const isUi = (id) => id && browser.uiWcIds.has(id);

  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (SKIP_SCHEMES.test(details.url) || isUi(details.webContentsId)) return callback({});
    const p = s.data.privacy;
    // HTTPS-only mode
    if (details.resourceType === 'mainFrame' && p.httpsOnly && details.url.startsWith('http:')) {
      const host = hostOf(details.url);
      if (!isPrivateHost(host) && !p.httpsExceptions.includes(host) && !browser.httpsTemporaryExceptions.has(host)) {
        browser.httpsUpgraded.add(host);
        return callback({ redirectURL: 'https:' + details.url.slice(5) });
      }
    }
    if (p.adblock && details.resourceType !== 'mainFrame') {
      const top = topUrlFor(details);
      if (browser.isProtectionEnabledFor(top)) {
        const r = browser.adblock.match(details);
        if (r) {
          const tab = tabFor(details.webContentsId);
          if (tab) { tab.state.blocked++; tab.changed(); }
          browser.adblock.totalBlocked++;
          return callback(r);
        }
      }
    }
    callback({});
  });

  ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
    if (SKIP_SCHEMES.test(details.url)) return callback({});
    const p = s.data.privacy;
    const headers = details.requestHeaders;
    if (p.doNotTrack) headers.DNT = '1';
    if (p.gpc) headers['Sec-GPC'] = '1';
    if (p.thirdPartyCookies === 'block' && details.resourceType !== 'mainFrame') {
      const top = topUrlFor(details);
      if (top && /^https?:/.test(top) && siteOf(top) !== siteOf(details.url) && browser.isProtectionEnabledFor(top)) {
        for (const k of Object.keys(headers)) if (k.toLowerCase() === 'cookie') delete headers[k];
      }
    }
    callback({ requestHeaders: headers });
  });

  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
    if (SKIP_SCHEMES.test(details.url)) return callback({});
    const p = s.data.privacy;
    let headers = null;
    if (p.thirdPartyCookies === 'block' && details.resourceType !== 'mainFrame') {
      const top = topUrlFor(details);
      if (top && /^https?:/.test(top) && siteOf(top) !== siteOf(details.url) && browser.isProtectionEnabledFor(top)) {
        headers = details.responseHeaders || {};
        for (const k of Object.keys(headers)) if (k.toLowerCase() === 'set-cookie') delete headers[k];
      }
    }
    if (p.adblock && (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') && browser.isProtectionEnabledFor(topUrlFor(details))) {
      const csp = browser.adblock.cspFor(details);
      if (csp) {
        headers = headers || details.responseHeaders || {};
        const policies = csp.split(';').map((x) => x.trim());
        for (const [name, values] of Object.entries(headers)) {
          if (name.toLowerCase() === 'content-security-policy') { policies.push(...values); delete headers[name]; }
        }
        headers['content-security-policy'] = [policies.join(';')];
      }
    }
    callback(headers ? { responseHeaders: headers } : {});
  });

  // ---------------------------------------------------------------- misc
  ses.on('will-download', (event, item, wc) => browser.downloads.handle(item, wc, isPrivate));
  browser.protocol.register(ses);
  if (s.get('privacy.adblockCosmetic') !== false) browser.adblock.attachCosmetic(ses);
  ses.on('select-hid-device', (e, details, cb) => { e.preventDefault(); cb(details.deviceList[0] && details.deviceList.length === 1 ? details.deviceList[0].deviceId : undefined); });
  ses.on('select-serial-port', (e, portList, wc, cb) => { e.preventDefault(); cb(portList.length === 1 ? portList[0].portId : ''); });
  ses.on('select-usb-device', (e, details, cb) => { e.preventDefault(); cb(details.deviceList.length === 1 ? details.deviceList[0].deviceId : undefined); });
}

function applyDns(settings) {
  const mode = settings.get('privacy.doh');
  const server = settings.get('privacy.dohServer');
  try {
    app.configureHostResolver({
      secureDnsMode: mode === 'secure' ? 'secure' : mode === 'off' ? 'off' : 'automatic',
      secureDnsServers: mode !== 'off' && server ? [server] : []
    });
  } catch (err) {
    console.warn('[net] DNS configuration failed:', err.message);
  }
}

module.exports = { setupSession, defaultUserAgent, applyDns, permissionKey };
