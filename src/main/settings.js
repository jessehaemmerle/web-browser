'use strict';
const { EventEmitter } = require('events');
const { JsonStore } = require('./store');
const { DEFAULTS } = require('./defaults');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/** Merge saved values over defaults. Unknown keys are kept (forward compatibility). */
function mergeDefaults(defaults, saved) {
  if (!isObj(defaults)) return saved === undefined ? clone(defaults) : saved;
  const out = clone(defaults);
  if (!isObj(saved)) return out;
  for (const [k, v] of Object.entries(saved)) {
    if (isObj(defaults[k]) && isObj(v)) out[k] = mergeDefaults(defaults[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

function getPath(obj, p) {
  if (!p) return obj;
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, p, value) {
  const keys = p.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isObj(o[keys[i]])) o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

class Settings extends EventEmitter {
  constructor(file) {
    super();
    this.store = new JsonStore(file, {});
    this.data = mergeDefaults(DEFAULTS, this.store.data);
    this.store.data = this.data;
  }

  get(p) { return clone(getPath(this.data, p) ?? null); }
  all() { return clone(this.data); }

  set(p, value) {
    if (typeof p !== 'string' || !p || p.split('.').some((k) => FORBIDDEN.has(k))) throw new Error('invalid settings path');
    setPath(this.data, p, clone(value));
    this.store.save();
    this.emit('change', p, this.get(p));
  }

  /** Reset a section (e.g. "appearance") or everything (no argument) to defaults. */
  reset(section) {
    if (section) {
      const def = getPath(DEFAULTS, section);
      if (def === undefined) return;
      setPath(this.data, section, clone(def));
    } else {
      for (const k of Object.keys(this.data)) delete this.data[k];
      Object.assign(this.data, clone(DEFAULTS));
    }
    this.store.save();
    this.emit('change', section || '', this.get(section || ''));
  }

  replaceAll(obj) {
    const merged = mergeDefaults(DEFAULTS, obj);
    for (const k of Object.keys(this.data)) delete this.data[k];
    Object.assign(this.data, merged);
    this.store.save();
    this.emit('change', '', this.all());
  }

  flush() { this.store.flush(); }
}

module.exports = { Settings, mergeDefaults, getPath };
