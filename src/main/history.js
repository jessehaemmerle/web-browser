'use strict';
const { EventEmitter } = require('events');
const { JsonStore } = require('./store');

const MAX_ENTRIES = 20000;

/** Browsing history: one entry per URL with visit count (used for search + suggestions). */
class History extends EventEmitter {
  constructor(file) {
    super();
    this.store = new JsonStore(file, () => ({ entries: [] }), { delay: 2000 });
    if (!Array.isArray(this.store.data.entries)) this.store.data.entries = [];
    this.map = new Map(this.store.data.entries.map((e) => [e.url, e]));
  }

  addVisit(url, title) {
    if (!/^(https?|file):/i.test(url)) return;
    let e = this.map.get(url);
    if (e) {
      e.visits++;
      e.lastVisit = Date.now();
      if (title) e.title = title;
    } else {
      e = { url, title: title || url, visits: 1, lastVisit: Date.now() };
      this.map.set(url, e);
      if (this.map.size > MAX_ENTRIES) this.trim();
    }
    this.persist();
  }

  updateTitle(url, title) {
    const e = this.map.get(url);
    if (e && title && e.title !== title) { e.title = title; this.persist(); }
  }

  trim() {
    const sorted = [...this.map.values()].sort((a, b) => b.lastVisit - a.lastVisit).slice(0, MAX_ENTRIES * 0.9);
    this.map = new Map(sorted.map((e) => [e.url, e]));
  }

  persist() {
    this.store.data.entries = [...this.map.values()];
    this.store.save();
    this.emit('change');
  }

  list({ query = '', limit = 200, offset = 0 } = {}) {
    const q = query.toLowerCase();
    let items = [...this.map.values()];
    if (q) items = items.filter((e) => e.url.toLowerCase().includes(q) || (e.title || '').toLowerCase().includes(q));
    items.sort((a, b) => b.lastVisit - a.lastVisit);
    return { total: items.length, items: items.slice(offset, offset + limit) };
  }

  /** Frecency-ranked suggestions. */
  suggest(q, limit = 6) {
    q = String(q || '').toLowerCase().trim();
    if (!q) return [];
    const now = Date.now();
    const scored = [];
    for (const e of this.map.values()) {
      const url = e.url.toLowerCase();
      const title = (e.title || '').toLowerCase();
      const bare = url.replace(/^https?:\/\/(www\.)?/, '');
      let s = 0;
      if (bare.startsWith(q)) s = 4;
      else if (url.includes(q)) s = 2;
      else if (title.includes(q)) s = 1.5;
      else continue;
      const ageDays = (now - e.lastVisit) / 86400000;
      s *= Math.log2(2 + e.visits) * (ageDays < 4 ? 1 : ageDays < 30 ? 0.7 : 0.4);
      scored.push([s, e]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, limit).map(([, e]) => e);
  }

  /** Most visited sites, for the new tab page. */
  top(limit = 8) {
    return [...this.map.values()].sort((a, b) => b.visits - a.visits).slice(0, limit);
  }

  remove(url) { if (this.map.delete(url)) this.persist(); }

  clear(sinceMs) {
    if (sinceMs) {
      for (const [u, e] of this.map) if (e.lastVisit >= sinceMs) this.map.delete(u);
    } else this.map.clear();
    this.persist();
  }

  flush() { this.store.flush(); }
}

module.exports = { History };
