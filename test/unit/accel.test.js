'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../src/shared/accel');

test('normalize orders modifiers and aliases', () => {
  assert.equal(A.normalize('shift+ctrl+t'), 'Ctrl+Shift+T');
  assert.equal(A.normalize('CmdOrCtrl+Shift+N'), 'Ctrl+Shift+N');
  assert.equal(A.normalize('Ctrl++'), 'Ctrl+Plus');
  assert.equal(A.normalize('Alt+ArrowLeft'), 'Alt+Left');
  assert.equal(A.normalize('F5'), 'F5');
});

test('fromEvent uses physical keys for letters (QWERTZ safe)', () => {
  assert.equal(A.fromEvent({ key: 'z', code: 'KeyZ', ctrlKey: true }), 'Ctrl+Z');
  assert.equal(A.fromEvent({ key: 'T', code: 'KeyT', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+T');
  assert.equal(A.fromEvent({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+1');
  assert.equal(A.fromEvent({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true }), 'Alt+Left');
  assert.equal(A.fromEvent({ key: 'Control', code: 'ControlLeft', ctrlKey: true }), '');
  // Electron input object
  assert.equal(A.fromEvent({ key: 'l', code: 'KeyL', control: true, shift: false, alt: false, meta: false }), 'Ctrl+L');
});

test('buildMap and conflicts', () => {
  const sc = { a: ['Ctrl+T'], b: ['ctrl+t', 'F2'], c: [] };
  const m = A.buildMap(sc);
  assert.equal(m.get('Ctrl+T'), 'a');
  assert.equal(m.get('F2'), 'b');
  assert.deepEqual(A.conflicts(sc), [{ accel: 'Ctrl+T', commands: ['a', 'b'] }]);
});

test('default shortcuts have no conflicts', () => {
  const { SHORTCUTS } = require('../../src/main/defaults');
  assert.deepEqual(A.conflicts(SHORTCUTS), []);
});
