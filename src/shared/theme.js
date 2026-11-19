/* Nimbus – theme engine. Turns appearance settings into CSS custom properties. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NimbusTheme = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Each preset defines a light and a dark palette. Keys map to --n-<key> CSS variables.
  const PRESETS = {
    nimbus: {
      light: { frame: '#e4eaf2', toolbar: '#f3f6fa', surface: '#ffffff', text: '#16202c', muted: '#586679', border: '#c9d3df', accent: '#3a56d4', accentText: '#ffffff', hover: 'rgba(22,32,44,.07)', danger: '#c23934' },
      dark: { frame: '#10151c', toolbar: '#1a212b', surface: '#232c38', text: '#e5eaf1', muted: '#93a0b2', border: '#313c4b', accent: '#8ea2ff', accentText: '#0c1430', hover: 'rgba(229,234,241,.08)', danger: '#ff7a73' }
    },
    graphite: {
      light: { frame: '#e6e6e6', toolbar: '#f4f4f4', surface: '#ffffff', text: '#1d1d1d', muted: '#5f5f5f', border: '#cfcfcf', accent: '#2f2f2f', accentText: '#ffffff', hover: 'rgba(0,0,0,.06)', danger: '#c0392b' },
      dark: { frame: '#161616', toolbar: '#202020', surface: '#2a2a2a', text: '#ececec', muted: '#a0a0a0', border: '#3a3a3a', accent: '#e8e8e8', accentText: '#161616', hover: 'rgba(255,255,255,.07)', danger: '#ff6b5e' }
    },
    fjord: {
      light: { frame: '#dfeae8', toolbar: '#eef5f3', surface: '#ffffff', text: '#122321', muted: '#4f6763', border: '#c3d6d2', accent: '#0f7a6c', accentText: '#ffffff', hover: 'rgba(18,35,33,.07)', danger: '#b8402f' },
      dark: { frame: '#0d1817', toolbar: '#152321', surface: '#1d2e2c', text: '#e1eeec', muted: '#8fa9a5', border: '#2a403d', accent: '#4fd1bd', accentText: '#062320', hover: 'rgba(225,238,236,.08)', danger: '#ff8471' }
    },
    ember: {
      light: { frame: '#efe4dc', toolbar: '#f8f1ec', surface: '#ffffff', text: '#2a1a12', muted: '#735a4b', border: '#dccabd', accent: '#b4441f', accentText: '#ffffff', hover: 'rgba(42,26,18,.07)', danger: '#b02a2a' },
      dark: { frame: '#1a120e', toolbar: '#241a15', surface: '#2f231d', text: '#f2e6de', muted: '#b39d90', border: '#43332a', accent: '#ff9a6b', accentText: '#2a0f03', hover: 'rgba(242,230,222,.08)', danger: '#ff7b7b' }
    },
    orchid: {
      light: { frame: '#ebe3f0', toolbar: '#f6f1f9', surface: '#ffffff', text: '#24152d', muted: '#685474', border: '#d8cadf', accent: '#8a3fb8', accentText: '#ffffff', hover: 'rgba(36,21,45,.07)', danger: '#c0392b' },
      dark: { frame: '#150f19', toolbar: '#201726', surface: '#2b2032', text: '#efe5f4', muted: '#ad9bb8', border: '#3d2f46', accent: '#d39bff', accentText: '#25083a', hover: 'rgba(239,229,244,.08)', danger: '#ff7b72' }
    },
    contrast: {
      light: { frame: '#ffffff', toolbar: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#1f1f1f', border: '#000000', accent: '#0000c8', accentText: '#ffffff', hover: 'rgba(0,0,0,.12)', danger: '#a00000' },
      dark: { frame: '#000000', toolbar: '#000000', surface: '#000000', text: '#ffffff', muted: '#e6e6e6', border: '#ffffff', accent: '#ffe600', accentText: '#000000', hover: 'rgba(255,255,255,.18)', danger: '#ff6a6a' }
    }
  };

  const DENSITY = {
    compact: { toolbarH: 34, tabH: 28, gap: 4, control: 26 },
    comfortable: { toolbarH: 42, tabH: 34, gap: 6, control: 30 },
    spacious: { toolbarH: 50, tabH: 40, gap: 8, control: 36 }
  };

  const FONTS = {
    system: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", Ubuntu, Cantarell, sans-serif',
    humanist: '"Segoe UI Variable", "Segoe UI", "Noto Sans", "DejaVu Sans", sans-serif',
    rounded: '"Nunito", "Varela Round", "Segoe UI", "Noto Sans", sans-serif',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Noto Serif", Georgia, serif',
    mono: '"Cascadia Code", "JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace',
    display: '"Bricolage Grotesque Variable", system-ui, sans-serif'
  };

  function hexToRgb(hex) {
    const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Pick readable text (black/white) for a background. */
  function readableOn(bg) {
    return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#000000') ? '#ffffff' : '#000000';
  }

  function resolveScheme(mode, systemDark) {
    if (mode === 'light' || mode === 'dark') return mode;
    return systemDark ? 'dark' : 'light';
  }

  /**
   * appearance: settings.appearance
   * returns { scheme, vars: { '--n-frame': '#..', ... }, css: ':root{...}' }
   */
  function compute(appearance, systemDark) {
    const a = appearance || {};
    const scheme = resolveScheme(a.mode, systemDark);
    const preset = PRESETS[a.preset] || PRESETS.nimbus;
    const palette = Object.assign({}, preset[scheme]);
    if (a.accent && hexToRgb(a.accent)) {
      palette.accent = a.accent;
      palette.accentText = readableOn(a.accent);
    }
    const custom = (a.customColors && a.customColors[scheme]) || {};
    for (const [k, v] of Object.entries(custom)) if (v && palette[k] !== undefined) palette[k] = v;

    const d = DENSITY[a.density] || DENSITY.comfortable;
    const vars = {};
    for (const [k, v] of Object.entries(palette)) vars['--n-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())] = v;
    vars['--n-font'] = a.font === 'custom' && a.customFont ? `"${a.customFont}", ${FONTS.system}` : (FONTS[a.font] || FONTS.system);
    vars['--n-font-size'] = (Number(a.fontSize) || 13) + 'px';
    vars['--n-radius'] = (Number.isFinite(Number(a.radius)) ? Number(a.radius) : 8) + 'px';
    vars['--n-toolbar-h'] = d.toolbarH + 'px';
    vars['--n-tab-h'] = d.tabH + 'px';
    vars['--n-gap'] = d.gap + 'px';
    vars['--n-control'] = d.control + 'px';
    vars['--n-speed'] = a.animations === false ? '0ms' : '140ms';
    const css = ':root{' + Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';') + `;color-scheme:${scheme}}`;
    return { scheme, palette, vars, css };
  }

  // ------------------------------------------------------------------ site colours

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const toHex = (rgb) => '#' + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

  /** Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla() → [r,g,b] or null. Transparent colours are ignored. */
  function parseColor(input) {
    const c = String(input || '').trim().toLowerCase();
    let m = c.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = h.split('').map((x) => x + x).join('');
      if (h.length === 8 && parseInt(h.slice(6, 8), 16) < 128) return null;
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    m = c.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean);
      if (p.length < 3) return null;
      const ch = p.slice(0, 3).map((x) => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)));
      const a = p[3] !== undefined ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1;
      if (ch.some((x) => !Number.isFinite(x)) || a < 0.5) return null;
      return ch.map((x) => clamp(Math.round(x), 0, 255));
    }
    m = c.match(/^hsla?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean);
      if (p.length < 3) return null;
      const h = ((parseFloat(p[0]) % 360) + 360) % 360, sat = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100;
      const a = p[3] !== undefined ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1;
      if (![h, sat, l].every(Number.isFinite) || a < 0.5) return null;
      const k = (n) => (n + h / 30) % 12;
      const f = (n) => l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
    }
    return null;
  }

  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  /**
   * Palette for the browser bar when it takes on a website's colour.
   * `soft` (colour guessed from the favicon) blends it with the theme so it isn't loud.
   * Text, icons and borders are chosen so they stay readable on the result.
   */
  function sitePalette(color, base, { soft = false } = {}) {
    let rgb = parseColor(color);
    if (!rgb) return null;
    const baseToolbar = hexToRgb(base.toolbar) || [243, 246, 250];
    if (soft) rgb = mixRgb(baseToolbar, rgb, 0.42);
    let toolbar = toHex(rgb);
    const dark = contrastRatio(toolbar, '#ffffff') >= contrastRatio(toolbar, '#111820');
    const text = dark ? '#ffffff' : '#111820';
    // very saturated colours (pure red …) are nudged just enough for readable text
    for (let i = 0; i < 20 && contrastRatio(text, toolbar) < 4.6; i++) {
      rgb = mixRgb(rgb, dark ? [0, 0, 0] : [255, 255, 255], 0.04);
      toolbar = toHex(rgb);
    }
    const textRgb = hexToRgb(text);
    const frame = toHex(mixRgb(rgb, [0, 0, 0], dark ? 0.22 : 0.08));
    const surface = toHex(dark ? mixRgb(rgb, [0, 0, 0], 0.28) : mixRgb(rgb, [255, 255, 255], 0.72));
    let muted = toHex(mixRgb(textRgb, rgb, 0.3));
    for (let t = 0.3; t > 0 && contrastRatio(muted, toolbar) < 4.5; t -= 0.05) muted = toHex(mixRgb(textRgb, rgb, t));
    const accent = contrastRatio(base.accent, toolbar) >= 3 && contrastRatio(base.accent, surface) >= 3 ? base.accent : text;
    return {
      frame, toolbar, surface, text, muted, accent,
      accentText: readableOn(accent),
      border: dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.16)',
      hover: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)',
      dark
    };
  }

  return { PRESETS, DENSITY, FONTS, compute, contrastRatio, readableOn, hexToRgb, parseColor, sitePalette };
});
