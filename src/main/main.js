'use strict';
const { app, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');

// keep the profile in a predictable place (also used by portable builds)
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
if (portableDir) app.setPath('userData', path.join(portableDir, 'NimbusProfile'));
else if (process.env.NIMBUS_PROFILE) app.setPath('userData', path.resolve(process.env.NIMBUS_PROFILE));
else app.setPath('userData', path.join(app.getPath('appData'), 'Nimbus'));

const { registerSchemes } = require('./protocol');
const { Settings } = require('./settings');

// settings that must be applied before the app is ready
const early = new Settings(path.join(app.getPath('userData'), 'settings.json'));
if (!early.get('performance.hardwareAcceleration')) app.disableHardwareAcceleration();
if (!early.get('performance.smoothScrolling')) app.commandLine.appendSwitch('disable-smooth-scrolling');
const features = [];
if (early.get('appearance.forceDarkPages')) features.push('WebContentsForceDark');
if (process.platform === 'linux') features.push('WaylandWindowDecorations');
if (features.length) app.commandLine.appendSwitch('enable-features', features.join(','));
if (process.platform === 'linux' && !process.env.NIMBUS_NO_OZONE_HINT) app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

registerSchemes();
app.setName('Nimbus');
if (process.platform === 'win32') app.setAppUserModelId('at.haemmerle.nimbus');

function urlsFromArgv(argv) {
  return argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-')).map((a) => {
    if (/^(https?|file|nimbus|ftp):/i.test(a)) return a;
    const p = path.resolve(a);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return 'file://' + p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
    return null;
  }).filter(Boolean);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let browser = null;
  const pendingUrls = urlsFromArgv(process.argv);

  app.on('second-instance', (_e, argv) => {
    if (!browser) return;
    const urls = urlsFromArgv(argv);
    const w = browser.lastNormalWindow();
    if (urls.length) urls.forEach((u, i) => w.createTab({ url: u, active: i === urls.length - 1, atEnd: true }));
    else if (argv.includes('--new-window')) browser.createWindow({});
    else if (argv.includes('--private')) browser.createWindow({ private: true });
    w.focus();
  });
  app.on('open-url', (e, url) => { e.preventDefault(); if (browser) browser.lastNormalWindow().createTab({ url, active: true }); else pendingUrls.push(url); });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const { Browser } = require('./browser');
    const { setupIpc } = require('./api');
    browser = new Browser();
    global.nimbus = browser;
    setupIpc(browser);
    await browser.start(pendingUrls);
    if (process.platform === 'win32') {
      app.setUserTasks([
        { program: process.execPath, arguments: (app.isPackaged ? '' : `"${app.getAppPath()}" `) + '--new-window', iconPath: process.execPath, iconIndex: 0, title: browser.i18n.t('menu.newWindow'), description: '' },
        { program: process.execPath, arguments: (app.isPackaged ? '' : `"${app.getAppPath()}" `) + '--private', iconPath: process.execPath, iconIndex: 0, title: browser.i18n.t('menu.newPrivateWindow'), description: '' }
      ]);
    }
  });

  let cleaned = false;
  app.on('before-quit', (e) => {
    if (!browser || cleaned) return;
    browser.quitting = true;
    browser.saveSessionNow();
    e.preventDefault();
    cleaned = true;
    Promise.race([browser.clearOnExit(), new Promise((r) => setTimeout(r, 3000))]).finally(() => {
      browser.flushAll();
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
