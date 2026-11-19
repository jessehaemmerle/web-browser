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

test('parseColor understands the formats sites use for theme-color', () => {
  assert.deepEqual(T.parseColor('#d4380d'), [212, 56, 13]);
  assert.deepEqual(T.parseColor('#FFF'), [255, 255, 255]);
  assert.deepEqual(T.parseColor('rgb(255, 204, 0)'), [255, 204, 0]);
  assert.deepEqual(T.parseColor('rgb(255 204 0 / 90%)'), [255, 204, 0]);
  assert.deepEqual(T.parseColor('hsl(0, 100%, 50%)'), [255, 0, 0]);
  assert.equal(T.parseColor('transparent'), null);
  assert.equal(T.parseColor('#00000000'), null);
  assert.equal(T.parseColor('rgba(0,0,0,0.1)'), null);
});

test('site colour bar keeps text, secondary text and focus readable', () => {
  const colors = ['#d4380d', '#ff0000', '#ffcc00', '#1a73e8', '#24292f', '#ffffff', '#000000', '#00a86b', '#ff69b4', '#7f7f7f', '#3a3', 'hsl(270 50% 40%)'];
  for (const scheme of ['light', 'dark']) {
    const base = T.PRESETS.nimbus[scheme];
    for (const c of colors) {
      for (const soft of [false, true]) {
        const p = T.sitePalette(c, base, { soft });
        assert.ok(T.contrastRatio(p.text, p.toolbar) >= 4.5, `${c} text ${T.contrastRatio(p.text, p.toolbar).toFixed(2)}`);
        assert.ok(T.contrastRatio(p.text, p.frame) >= 3, `${c} text on frame`);
        assert.ok(T.contrastRatio(p.text, p.surface) >= 4.5, `${c} text on address bar`);
        assert.ok(T.contrastRatio(p.muted, p.toolbar) >= 4.5, `${c} muted ${T.contrastRatio(p.muted, p.toolbar).toFixed(2)}`);
        assert.ok(T.contrastRatio(p.accent, p.toolbar) >= 3, `${c} focus colour`);
      }
    }
  }
  assert.equal(T.sitePalette('#d4380d', T.PRESETS.nimbus.light).toolbar, '#d4380d', 'exact page colour');
  assert.notEqual(T.sitePalette('#ff0000', T.PRESETS.nimbus.light, { soft: true }).toolbar, '#ff0000', 'favicon colour is softened');
});
