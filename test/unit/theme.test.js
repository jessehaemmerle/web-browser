'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../src/shared/theme');

test('compute resolves scheme and variables', () => {
  const light = T.compute({ mode: 'light', preset: 'nimbus' }, true);
  assert.equal(light.scheme, 'light');
  assert.equal(light.vars['--n-accent'], T.PRESETS.nimbus.light.accent);
  const sys = T.compute({ mode: 'system', preset: 'graphite' }, true);
  assert.equal(sys.scheme, 'dark');
  assert.ok(sys.css.includes('color-scheme:dark'));
});

test('custom accent picks readable text colour', () => {
  const t = T.compute({ mode: 'light', accent: '#ffe600' }, false);
  assert.equal(t.vars['--n-accent'], '#ffe600');
  assert.equal(t.vars['--n-accent-text'], '#000000');
});

test('custom colours override the preset', () => {
  const t = T.compute({ mode: 'dark', preset: 'nimbus', customColors: { dark: { frame: '#000000' } } }, false);
  assert.equal(t.vars['--n-frame'], '#000000');
});

test('every preset has readable text (WCAG AA) in both schemes', () => {
  for (const [name, p] of Object.entries(T.PRESETS)) {
    for (const scheme of ['light', 'dark']) {
      const c = p[scheme];
      assert.ok(T.contrastRatio(c.text, c.toolbar) >= 7, `${name}/${scheme} text on toolbar`);
      assert.ok(T.contrastRatio(c.muted, c.surface) >= 4.5, `${name}/${scheme} muted on surface: ${T.contrastRatio(c.muted, c.surface).toFixed(2)}`);
      assert.ok(T.contrastRatio(c.accentText, c.accent) >= 4.5, `${name}/${scheme} accent text: ${T.contrastRatio(c.accentText, c.accent).toFixed(2)}`);
    }
  }
});

test('density and font settings', () => {
  const t = T.compute({ density: 'compact', font: 'mono', fontSize: 15, radius: 0 }, false);
  assert.equal(t.vars['--n-tab-h'], '28px');
  assert.equal(t.vars['--n-font-size'], '15px');
  assert.equal(t.vars['--n-radius'], '0px');
  assert.ok(t.vars['--n-font'].includes('monospace'));
});
