'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BH = require('../../src/main/bookmarks-html');
const { Bookmarks } = require('../../src/main/bookmarks');
const { History } = require('../../src/main/history');
const { Settings, mergeDefaults } = require('../../src/main/settings');
const { DEFAULTS } = require('../../src/main/defaults');
const { crxToZip } = require('../../src/main/extensions');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-unit-'));

const FIREFOX_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Toolbar</H3>
    <DL><p>
        <DT><A HREF="https://www.orf.at/" ADD_DATE="1700000000">ORF &amp; mehr</A>
        <DT><H3>Dev</H3>
        <DL><p>
            <DT><A HREF="https://developer.mozilla.org/">MDN</A>
            <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://example.com/">Example</A>
</DL>`;

test('bookmark HTML import parses folders and skips javascript:', () => {
  const nodes = BH.parse(FIREFOX_EXPORT);
  assert.equal(nodes.length, 2);
  const toolbar = nodes[0];
  assert.equal(toolbar.title, 'Bookmarks Toolbar');
  assert.equal(toolbar.children[0].title, 'ORF & mehr');
  assert.equal(toolbar.children[0].added, 1700000000000);
  assert.equal(toolbar.children[1].children.length, 1, 'bookmarklet skipped');
  assert.equal(nodes[1].url, 'https://example.com/');
});

test('bookmark export round-trips', () => {
  const b = new Bookmarks(path.join(tmp(), 'b.json'));
  const f = b.add({ type: 'folder', title: 'Ordner <1>', parentId: 'bar' });
  b.add({ parentId: f.id, title: 'A & B', url: 'https://a.example/?x=1&y="2"' });
  b.add({ parentId: 'other', title: 'Other', url: 'https://o.example/' });
  const html = BH.serialize(b.tree);
  const back = BH.parse(html);
  assert.equal(back[0].children[0].title, 'Ordner <1>');
  assert.equal(back[0].children[0].children[0].url, 'https://a.example/?x=1&y="2"');
  assert.equal(back[1].children[0].title, 'Other');
});

test('bookmarks store: add, move, protect against cycles, persist', () => {
  const file = path.join(tmp(), 'b.json');
  const b = new Bookmarks(file);
  const f1 = b.add({ type: 'folder', title: 'F1' });
  const f2 = b.add({ type: 'folder', title: 'F2', parentId: f1.id });
  const bm = b.add({ title: 'X', url: 'https://x.example/' });
  assert.ok(b.isBookmarked('https://x.example/'));
  assert.equal(b.move(f1.id, f2.id), false, 'no cycles');
  assert.ok(b.move(bm.id, f2.id, 0));
  assert.equal(b.parentOf.get(bm.id).id, f2.id);
  b.store.saveSync();
  const again = new Bookmarks(file);
  assert.ok(again.isBookmarked('https://x.example/'));
  assert.ok(again.remove(bm.id));
  assert.ok(!again.isBookmarked('https://x.example/'));
});

test('history suggestions rank by prefix and frequency', () => {
  const h = new History(path.join(tmp(), 'h.json'));
  for (let i = 0; i < 5; i++) h.addVisit('https://github.com/', 'GitHub');
  h.addVisit('https://example.com/github-guide', 'A guide');
  h.addVisit('nimbus://settings/', 'ignored');
  const s = h.suggest('git');
  assert.equal(s[0].url, 'https://github.com/');
  assert.equal(h.list().total, 2, 'internal pages are not recorded');
  h.clear();
  assert.equal(h.list().total, 0);
});

test('settings merge keeps user values and adds new defaults', () => {
  const merged = mergeDefaults(DEFAULTS, { appearance: { mode: 'dark' }, unknown: 1, search: { engines: [{ id: 'x', name: 'X', url: 'https://x/?q=%s' }] } });
  assert.equal(merged.appearance.mode, 'dark');
  assert.equal(merged.appearance.preset, 'nimbus');
  assert.equal(merged.unknown, 1);
  assert.equal(merged.search.engines.length, 1, 'arrays are replaced, not merged');
});

test('settings set/get/reset and path safety', () => {
  const s = new Settings(path.join(tmp(), 's.json'));
  let changed = null;
  s.on('change', (p) => { changed = p; });
  s.set('layout.tabPosition', 'left');
  assert.equal(s.get('layout.tabPosition'), 'left');
  assert.equal(changed, 'layout.tabPosition');
  s.reset('layout');
  assert.equal(s.get('layout.tabPosition'), 'top');
  assert.throws(() => s.set('__proto__.polluted', 1));
  assert.equal({}.polluted, undefined);
});

test('crxToZip handles CRX2, CRX3 and plain zip', () => {
  const zip = Buffer.from('PK\u0003\u0004rest-of-zip');
  assert.deepEqual(crxToZip(zip), zip);
  const crx3 = Buffer.concat([Buffer.from('Cr24'), u32(3), u32(5), Buffer.from('hdr!!'), zip]);
  assert.deepEqual(crxToZip(crx3), zip);
  const crx2 = Buffer.concat([Buffer.from('Cr24'), u32(2), u32(3), u32(2), Buffer.from('keysg'), zip]);
  assert.deepEqual(crxToZip(crx2), zip);
  assert.throws(() => crxToZip(Buffer.from('nope')));
});

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }

test('every translation key exists in German and English', () => {
  const de = require('../../src/locales/de');
  const en = require('../../src/locales/en');
  assert.deepEqual(Object.keys(de).filter((k) => !(k in en)), []);
  assert.deepEqual(Object.keys(en).filter((k) => !(k in de)), []);
  // every shortcut command has a label
  for (const cmd of Object.keys(DEFAULTS.shortcuts)) assert.ok(de['cmd.' + cmd], 'label for ' + cmd);
});
