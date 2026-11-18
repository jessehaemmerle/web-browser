'use strict';
const { app } = require('electron');
const LOCALES = { de: require('../locales/de'), en: require('../locales/en') };

class I18n {
  constructor(getSetting) {
    this.getSetting = getSetting;
    this.reload();
    this.t = this.t.bind(this);
  }

  reload() {
    const pref = this.getSetting() || 'auto';
    let lang = pref;
    if (pref === 'auto') {
      const sys = (app.getPreferredSystemLanguages && app.getPreferredSystemLanguages()[0]) || app.getLocale() || 'en';
      lang = sys.toLowerCase().startsWith('de') ? 'de' : 'en';
    }
    this.lang = LOCALES[lang] ? lang : 'en';
  }

  dict() { return Object.assign({}, LOCALES.en, LOCALES[this.lang]); }

  t(key, vars) {
    let s = (LOCALES[this.lang] && LOCALES[this.lang][key]) ?? LOCALES.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
    return s;
  }
}

module.exports = { I18n, LOCALES };
