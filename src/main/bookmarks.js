'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { JsonStore } = require('./store');

const newId = () => crypto.randomBytes(6).toString('hex');

function emptyTree() {
  return {
    bar: { id: 'bar', type: 'folder', title: '', children: [] },
    other: { id: 'other', type: 'folder', title: '', children: [] }
  };
}

class Bookmarks extends EventEmitter {
  constructor(file) {
    super();
    this.store = new JsonStore(file, emptyTree);
    if (!this.store.data.bar || !this.store.data.other) this.store.data = Object.assign(emptyTree(), this.store.data);
    this.reindex();
  }

  get tree() { return this.store.data; }

  reindex() {
    this.byId = new Map();
    this.parentOf = new Map();
    this.urls = new Map();
    const walk = (node, parent) => {
      this.byId.set(node.id, node);
      if (parent) this.parentOf.set(node.id, parent);
      if (node.type === 'bookmark') this.urls.set(node.url, (this.urls.get(node.url) || 0) + 1);
      for (const c of node.children || []) walk(c, node);
    };
    walk(this.tree.bar, null);
    walk(this.tree.other, null);
  }

  changed() {
    this.reindex();
    this.store.save();
    this.emit('change');
  }

  isBookmarked(url) { return this.urls.has(url); }

  findByUrl(url) {
    for (const n of this.byId.values()) if (n.type === 'bookmark' && n.url === url) return n;
    return null;
  }

  add({ parentId = 'bar', title, url, type = 'bookmark', index }) {
    const parent = this.byId.get(parentId) || this.tree.bar;
    if (parent.type !== 'folder') throw new Error('parent is not a folder');
    const node = type === 'folder'
      ? { id: newId(), type: 'folder', title: String(title || ''), children: [] }
      : { id: newId(), type: 'bookmark', title: String(title || url), url: String(url), added: Date.now() };
    if (Number.isInteger(index) && index >= 0 && index <= parent.children.length) parent.children.splice(index, 0, node);
    else parent.children.push(node);
    this.changed();
    return node;
  }

  update(id, { title, url }) {
    const n = this.byId.get(id);
    if (!n || id === 'bar' || id === 'other') return null;
    if (title !== undefined) n.title = String(title);
    if (url !== undefined && n.type === 'bookmark') n.url = String(url);
    this.changed();
    return n;
  }

  remove(id) {
    const parent = this.parentOf.get(id);
    if (!parent) return false;
    parent.children = parent.children.filter((c) => c.id !== id);
    this.changed();
    return true;
  }

  removeUrl(url) {
    const n = this.findByUrl(url);
    return n ? this.remove(n.id) : false;
  }

  move(id, parentId, index) {
    const node = this.byId.get(id);
    const from = this.parentOf.get(id);
    const to = this.byId.get(parentId);
    if (!node || !from || !to || to.type !== 'folder') return false;
    // prevent moving a folder into itself
    for (let p = to; p; p = this.parentOf.get(p.id)) if (p.id === id) return false;
    from.children = from.children.filter((c) => c.id !== id);
    const i = Number.isInteger(index) ? Math.max(0, Math.min(index, to.children.length)) : to.children.length;
    to.children.splice(i, 0, node);
    this.changed();
    return true;
  }

  /** Flat list for search / suggestions. */
  flat() {
    return [...this.byId.values()].filter((n) => n.type === 'bookmark');
  }

  search(q, limit = 8) {
    q = String(q || '').toLowerCase();
    if (!q) return [];
    return this.flat().filter((b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)).slice(0, limit);
  }

  /** Merge imported nodes into a new folder under "other". */
  importNodes(nodes, folderTitle) {
    const assignIds = (n) => {
      const copy = n.type === 'folder'
        ? { id: newId(), type: 'folder', title: n.title || '', children: (n.children || []).map(assignIds) }
        : { id: newId(), type: 'bookmark', title: n.title || n.url, url: n.url, added: n.added || Date.now() };
      return copy;
    };
    const folder = { id: newId(), type: 'folder', title: folderTitle, children: nodes.map(assignIds) };
    this.tree.other.children.push(folder);
    this.changed();
    return folder;
  }

  replaceTree(tree) {
    if (!tree || !tree.bar || !tree.other) throw new Error('invalid bookmarks');
    this.store.data = tree;
    this.changed();
  }
}

module.exports = { Bookmarks };
