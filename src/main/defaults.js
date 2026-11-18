'use strict';
/** Default settings. Every user-facing option of Nimbus lives here. */

const SEARCH_ENGINES = [
  { id: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', suggest: 'https://duckduckgo.com/ac/?q=%s&type=list' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', suggest: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s', suggest: 'https://api.bing.com/osjson.aspx?query=%s' },
  { id: 'startpage', name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s', suggest: '' },
  { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s', suggest: 'https://ac.ecosia.org/autocomplete?q=%s&type=list' },
  { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=%s', suggest: '' },
  { id: 'wikipedia', name: 'Wikipedia', url: 'https://de.wikipedia.org/w/index.php?search=%s', suggest: '', keyword: 'w' }
];

const TOOLBAR_BUTTONS = ['back', 'forward', 'reload', 'home', 'address', 'shield', 'bookmark', 'extensions', 'downloads', 'split', 'menu'];

const SHORTCUTS = {
  newTab: ['Ctrl+T'],
  newWindow: ['Ctrl+N'],
  newPrivateWindow: ['Ctrl+Shift+N'],
  closeTab: ['Ctrl+W', 'Ctrl+F4'],
  closeWindow: ['Ctrl+Shift+W'],
  reopenClosedTab: ['Ctrl+Shift+T'],
  nextTab: ['Ctrl+Tab', 'Ctrl+PageDown'],
  prevTab: ['Ctrl+Shift+Tab', 'Ctrl+PageUp'],
  selectTab1: ['Ctrl+1'], selectTab2: ['Ctrl+2'], selectTab3: ['Ctrl+3'], selectTab4: ['Ctrl+4'],
  selectTab5: ['Ctrl+5'], selectTab6: ['Ctrl+6'], selectTab7: ['Ctrl+7'], selectTab8: ['Ctrl+8'],
  selectLastTab: ['Ctrl+9'],
  duplicateTab: ['Ctrl+Shift+D'],
  pinTab: [],
  muteTab: ['Ctrl+M'],
  focusAddress: ['Ctrl+L', 'Alt+D', 'F6'],
  reload: ['F5', 'Ctrl+R'],
  hardReload: ['Ctrl+F5', 'Ctrl+Shift+R'],
  back: ['Alt+Left', 'BrowserBack'],
  forward: ['Alt+Right', 'BrowserForward'],
  home: ['Alt+Home'],
  find: ['Ctrl+F'],
  findNext: ['F3', 'Ctrl+G'],
  findPrev: ['Shift+F3', 'Ctrl+Shift+G'],
  zoomIn: ['Ctrl+Plus', 'Ctrl+=', 'Ctrl+Shift+='],
  zoomOut: ['Ctrl+Minus'],
  zoomReset: ['Ctrl+0'],
  bookmarkPage: ['Ctrl+D'],
  toggleBookmarksBar: ['Ctrl+Shift+B'],
  openBookmarks: ['Ctrl+Shift+O'],
  openHistory: ['Ctrl+H'],
  openDownloads: ['Ctrl+J'],
  openSettings: ['Ctrl+,'],
  openExtensions: [],
  devtools: ['F12', 'Ctrl+Shift+I'],
  viewSource: ['Ctrl+U'],
  fullscreen: ['F11'],
  focusMode: ['Ctrl+Shift+F'],
  print: ['Ctrl+P'],
  savePage: ['Ctrl+S'],
  toggleSplit: ['Ctrl+Shift+S'],
  toggleTabLayout: ['Ctrl+Shift+E'],
  quit: ['Ctrl+Q']
};

const isWin = process.platform === 'win32';

const DEFAULTS = {
  version: 1,
  language: 'auto',
  appearance: {
    mode: 'system',           // system | light | dark
    preset: 'nimbus',         // nimbus | graphite | fjord | ember | orchid | contrast
    accent: '',               // custom accent colour (hex) – empty = preset accent
    customColors: { light: {}, dark: {} },
    font: 'system',           // system | humanist | rounded | serif | mono | display | custom
    customFont: '',
    fontSize: 13,
    density: 'comfortable',   // compact | comfortable | spacious
    radius: 8,
    animations: true,
    forceDarkPages: false,    // ask websites to render dark (prefers-color-scheme) following the theme
    uiCss: ''                 // custom CSS injected into the browser interface
  },
  layout: {
    tabPosition: 'top',       // top | left | right
    verticalTabWidth: 240,
    verticalTabsCollapsed: false,
    tabWidth: 'fixed',        // fixed | fit | compact
    tabCloseButton: 'hover',  // always | hover | active | never
    newTabPosition: 'afterCurrent', // end | afterCurrent
    showBookmarksBar: 'newtab', // always | newtab | never
    toolbarButtons: TOOLBAR_BUTTONS.map((id) => ({ id, visible: id !== 'split' })),
    addressBarSimplify: true, // hide https:// and www.
    showStatusUrl: true,      // show link target when hovering
    titlebar: isWin ? 'integrated' : 'system', // integrated | system
    compact: false            // merge tabs and toolbar into a single row (top tabs only)
  },
  newTab: {
    background: 'sky',        // sky | color | gradient | image
    color: '#1d2a44',
    gradient: ['#3a56d4', '#c86dd7'],
    image: '',
    dim: 20,
    showClock: true,
    clock24h: true,
    showSeconds: false,
    showDate: true,
    showGreeting: true,
    name: '',
    showSearch: true,
    showSpeedDial: true,
    speedDialColumns: 6,
    speedDial: [
      { title: 'Wikipedia', url: 'https://www.wikipedia.org' },
      { title: 'YouTube', url: 'https://www.youtube.com' },
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org' }
    ],
    customUrl: ''             // use any URL as new tab page instead
  },
  search: {
    engines: SEARCH_ENGINES,
    default: 'ddg',
    suggestions: true,
    historySuggestions: true,
    bookmarkSuggestions: true
  },
  startup: {
    mode: 'restore',          // newtab | home | restore | urls
    homepage: 'nimbus://newtab',
    urls: []
  },
  downloads: {
    dir: '',
    ask: false,
    openPanel: true
  },
  privacy: {
    adblock: true,
    adblockLevel: 'ads-tracking', // ads | ads-tracking | full
    adblockCosmetic: true,
    protectionExceptions: [],   // sites where ad/tracker/cookie protection is switched off
    customFilters: '',
    httpsOnly: false,
    httpsExceptions: [],
    doNotTrack: true,
    gpc: true,
    thirdPartyCookies: 'block', // block | allow
    doh: 'automatic',          // off | automatic | secure
    dohServer: 'https://cloudflare-dns.com/dns-query',
    userAgent: '',             // custom UA string, empty = Chrome-compatible default
    saveHistory: true,
    clearOnExit: { history: false, cookies: false, cache: false, downloads: false },
    permissionDefaults: {
      notifications: 'ask', geolocation: 'ask', media: 'ask', clipboard: 'ask',
      midi: 'ask', fullscreen: 'allow', pointerLock: 'ask', openExternal: 'ask', idleDetection: 'block', sensors: 'ask', hid: 'ask', serial: 'ask', usb: 'ask', windowManagement: 'ask'
    },
    sitePermissions: {}        // { origin: { permission: 'allow' | 'block' } }
  },
  tabs: {
    sleepAfterMinutes: 30,     // 0 = never put background tabs to sleep
    confirmCloseWindow: true,
    closedTabsLimit: 25,
    switchToNewTabs: false,    // switch to tabs opened from links (middle-click / ctrl-click)
    middleClickClose: true,
    doubleClickNewTab: true,
    scrollToSwitch: false
  },
  shortcuts: SHORTCUTS,
  sites: {
    zoom: {},                  // host -> zoom factor
    defaultZoom: 1,
    userStyles: [],            // { id, name, match, css, enabled }
    userScripts: []            // { id, name, match, js, runAt: 'start'|'end', enabled }
  },
  performance: {
    hardwareAcceleration: true,
    smoothScrolling: true,
    spellcheck: true,
    spellcheckLanguages: ['de-DE', 'en-US']
  },
  extensions: {
    enabled: true,
    allowUnpacked: true,
    autoUpdate: true,
    disabled: [],              // extension ids that are installed but disabled
    unpacked: []               // folders of unpacked / .crx-installed extensions
  }
};

module.exports = { DEFAULTS, SEARCH_ENGINES, SHORTCUTS, TOOLBAR_BUTTONS };
