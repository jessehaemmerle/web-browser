'use strict';
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/** Small JSON file store with debounced, atomic writes. */
class JsonStore extends EventEmitter {
  constructor(file, fallback, { delay = 400 } = {}) {
    super();
    this.file = file;
    this.delay = delay;
    this.timer = null;
    this.data = this._read(fallback);
  }

  _read(fallback) {
    for (const f of [this.file, this.file + '.bak']) {
      try {
        if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch (err) {
        console.warn(`[store] could not read ${f}: ${err.message}`);
      }
    }
    return typeof fallback === 'function' ? fallback() : JSON.parse(JSON.stringify(fallback));
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveSync(), this.delay);
  }

  saveSync() {
    clearTimeout(this.timer);
    this.timer = null;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      if (fs.existsSync(this.file)) {
        try { fs.copyFileSync(this.file, this.file + '.bak'); } catch (_) { /* ignore */ }
      }
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error(`[store] could not write ${this.file}: ${err.message}`);
    }
  }

  flush() {
    if (this.timer) this.saveSync();
  }
}

module.exports = { JsonStore };
