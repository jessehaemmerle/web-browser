'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../../src/shared/url');

const DDG = 'https://duckduckgo.com/?q=%s';
const r = (s) => U.resolveInput(s, DDG).url;

test('domains become https URLs', () => {
  assert.equal(r('wikipedia.org'), 'https://wikipedia.org');
  assert.equal(r('de.wikipedia.org/wiki/Wien'), 'https://de.wikipedia.org/wiki/Wien');
  assert.equal(r('example.co.uk:8443/x'), 'https://example.co.uk:8443/x');
  assert.equal(r('bücher.de'), 'https://bücher.de');
});

test('local hosts and IPs use http', () => {
  assert.equal(r('localhost:3000'), 'http://localhost:3000');
  assert.equal(r('localhost'), 'http://localhost');
  assert.equal(r('192.168.0.1/admin'), 'http://192.168.0.1/admin');
  assert.equal(r('[::1]:8080'), 'http://[::1]:8080');
  assert.equal(r('drucker.local'), 'http://drucker.local');
});

test('explicit schemes are kept', () => {
  assert.equal(r('http://x.y'), 'http://x.y');
  assert.equal(r('nimbus://settings'), 'nimbus://settings');
  assert.equal(r('about:blank'), 'about:blank');
  assert.equal(r('view-source:https://a.com'), 'view-source:https://a.com');
});

test('file paths on Windows and Linux', () => {
  assert.equal(r('C:\\Users\\Jesse\\a.html'), 'file:///C:/Users/Jesse/a.html');
  assert.equal(r('/home/jesse/a.html'), 'file:///home/jesse/a.html');
});

test('everything else is a search', () => {
  assert.equal(r('hello world'), 'https://duckduckgo.com/?q=hello%20world');
  assert.equal(r('foo'), 'https://duckduckgo.com/?q=foo');
  assert.equal(r('what is node.js?'), 'https://duckduckgo.com/?q=what%20is%20node.js%3F');
  assert.equal(r('?example.com'), 'https://duckduckgo.com/?q=example.com');
  assert.equal(r('mailto'), 'https://duckduckgo.com/?q=mailto');
  assert.equal(U.resolveInput('   ', DDG), null);
});

test('displayUrl simplifies', () => {
  assert.equal(U.displayUrl('https://www.example.com/'), 'example.com');
  assert.equal(U.displayUrl('https://example.com/a?b=1#c'), 'example.com/a?b=1#c');
  assert.equal(U.displayUrl('https://example.com/%C3%BC'), 'example.com/ü');
  assert.equal(U.displayUrl('nimbus://newtab/'), '');
  assert.equal(U.displayUrl('https://www.example.com/', { simplify: false }), 'https://www.example.com/');
});

test('matchesPattern for user styles and exceptions', () => {
  assert.ok(U.matchesPattern('https://www.example.com/a', 'example.com'));
  assert.ok(U.matchesPattern('https://sub.example.com/a', '*.example.com'));
  assert.ok(!U.matchesPattern('https://notexample.com/', 'example.com'));
  assert.ok(U.matchesPattern('https://example.com/docs/x', 'example.com/docs/*'));
  assert.ok(!U.matchesPattern('https://example.com/blog', 'example.com/docs/*'));
  assert.ok(U.matchesPattern('https://a.org/', '*'));
});

test('isPrivateHost', () => {
  for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', 'nas.local']) assert.ok(U.isPrivateHost(h), h);
  for (const h of ['8.8.8.8', 'example.com', '172.32.0.1']) assert.ok(!U.isPrivateHost(h), h);
});
