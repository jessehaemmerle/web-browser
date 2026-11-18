'use strict';
/** Import/export of the Netscape bookmark file format used by Chrome, Firefox, Edge, Safari. */

const decode = (s) => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const encode = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parse(html) {
  const root = { type: 'folder', title: '', children: [] };
  const stack = [root];
  let pendingFolder = null;
  const re = /<(\/?)(DL|DT|H3|A)\b([^>]*)>([^<]*)/gi;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[1] === '/';
    const tag = m[2].toUpperCase();
    const attrs = m[3];
    const text = m[4];
    const cur = stack[stack.length - 1];
    if (tag === 'H3' && !closing) {
      pendingFolder = { type: 'folder', title: decode(text.trim()), children: [] };
      cur.children.push(pendingFolder);
    } else if (tag === 'A' && !closing) {
      const href = (attrs.match(/HREF="([^"]*)"/i) || [])[1];
      if (href && !/^(javascript|place):/i.test(href)) {
        const added = Number((attrs.match(/ADD_DATE="(\d+)"/i) || [])[1]) * 1000 || Date.now();
        cur.children.push({ type: 'bookmark', title: decode(text.trim()) || decode(href), url: decode(href), added });
      }
    } else if (tag === 'DL') {
      if (!closing) {
        if (pendingFolder) { stack.push(pendingFolder); pendingFolder = null; } else if (stack.length > 1 || root.children.length) { /* nested DL without H3 */ }
      } else if (stack.length > 1) stack.pop();
    }
  }
  return root.children;
}

function serialize(tree, labels = { bar: 'Bookmarks bar', other: 'Other bookmarks' }) {
  const out = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>'
  ];
  const walk = (node, depth, extra = '') => {
    const pad = '    '.repeat(depth);
    if (node.type === 'folder') {
      out.push(`${pad}<DT><H3${extra}>${encode(node.title)}</H3>`);
      out.push(`${pad}<DL><p>`);
      for (const c of node.children || []) walk(c, depth + 1);
      out.push(`${pad}</DL><p>`);
    } else {
      out.push(`${pad}<DT><A HREF="${encode(node.url)}" ADD_DATE="${Math.floor((node.added || Date.now()) / 1000)}">${encode(node.title)}</A>`);
    }
  };
  walk({ type: 'folder', title: labels.bar, children: tree.bar.children }, 1, ' PERSONAL_TOOLBAR_FOLDER="true"');
  walk({ type: 'folder', title: labels.other, children: tree.other.children }, 1);
  out.push('</DL><p>');
  return out.join('\n');
}

module.exports = { parse, serialize };
