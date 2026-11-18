'use strict';
const path = require('path');

const ROOT = path.join(__dirname, '..');
module.exports = {
  ROOT,
  UI_HTML: path.join(ROOT, 'ui', 'index.html'),
  STATUS_HTML: path.join(ROOT, 'ui', 'status.html'),
  UI_PRELOAD: path.join(ROOT, 'preload', 'ui.js'),
  PAGES_PRELOAD: path.join(ROOT, 'preload', 'pages.js'),
  PAGES_DIR: path.join(ROOT, 'pages'),
  SHARED_DIR: path.join(ROOT, 'shared'),
  ASSETS_DIR: path.join(ROOT, 'assets'),
  ICON: path.join(ROOT, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
};
