/* Nimbus – keyboard shortcut helpers. Accelerators look like "Ctrl+Shift+T". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NimbusAccel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const KEY_ALIASES = {
    ' ': 'Space', Spacebar: 'Space', Esc: 'Escape', Del: 'Delete', Ins: 'Insert',
    ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
    '+': 'Plus', Add: 'Plus', '-': 'Minus', Subtract: 'Minus', '=': '=', Return: 'Enter'
  };
  const MOD_ALIASES = {
    cmdorctrl: 'Ctrl', commandorcontrol: 'Ctrl', control: 'Ctrl', ctrl: 'Ctrl',
    alt: 'Alt', option: 'Alt', altgr: 'Alt', shift: 'Shift',
    meta: 'Meta', super: 'Meta', cmd: 'Meta', command: 'Meta', win: 'Meta'
  };

  function normalizeKey(key) {
    if (!key) return '';
    if (KEY_ALIASES[key]) return KEY_ALIASES[key];
    if (key.length === 1) return key.toUpperCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /** Normalize an accelerator string so equal shortcuts compare equal. */
  function normalize(accel) {
    if (!accel) return '';
    const parts = String(accel).split('+');
    // handle "Ctrl++" (plus key)
    const cleaned = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '' && i === parts.length - 1) cleaned.push('Plus');
      else if (parts[i] !== '') cleaned.push(parts[i].trim());
    }
    const mods = new Set();
    let key = '';
    for (const p of cleaned) {
      const m = MOD_ALIASES[p.toLowerCase()];
      if (m) mods.add(m); else key = normalizeKey(p);
    }
    if (!key) return '';
    return MOD_ORDER.filter((m) => mods.has(m)).concat(key).join('+');
  }

  /**
   * Convert a keyboard event (DOM KeyboardEvent or Electron Input) to an accelerator.
   * Uses `code` for letters/digits so shortcuts work on any keyboard layout (QWERTZ etc.).
   */
  function fromEvent(e) {
    const key = e.key;
    if (!key || ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS', 'Dead', 'Process', 'Unidentified'].includes(key)) return '';
    const mods = [];
    const ctrl = e.control !== undefined ? e.control : e.ctrlKey;
    const alt = e.alt !== undefined ? e.alt : e.altKey;
    const shift = e.shift !== undefined ? e.shift : e.shiftKey;
    const meta = e.meta !== undefined ? e.meta : e.metaKey;
    if (ctrl) mods.push('Ctrl');
    if (alt) mods.push('Alt');
    if (shift) mods.push('Shift');
    if (meta) mods.push('Meta');
    let k;
    const code = e.code || '';
    if (/^Key[A-Z]$/.test(code) && (ctrl || alt || meta)) k = code.slice(3);
    else if (/^Digit\d$/.test(code)) k = code.slice(5);
    else if (/^Numpad\d$/.test(code)) k = code.slice(6);
    else if (code === 'NumpadAdd') k = 'Plus';
    else if (code === 'NumpadSubtract') k = 'Minus';
    else if (code === 'Equal' && shift && key === '+') k = 'Plus';
    else k = normalizeKey(key);
    // Shifted punctuation: keep the produced character, drop Shift for things like "?" except when combined with ctrl/alt
    return normalize(mods.concat(k).join('+'));
  }

  /** Pretty label for display. */
  function label(accel) {
    return normalize(accel).replace('Plus', '+').replace('Minus', '-');
  }

  /** Build lookup map: normalized accelerator -> command id. */
  function buildMap(shortcuts) {
    const map = new Map();
    for (const [cmd, list] of Object.entries(shortcuts || {})) {
      for (const a of [].concat(list || [])) {
        const n = normalize(a);
        if (n && !map.has(n)) map.set(n, cmd);
      }
    }
    return map;
  }

  /** Find conflicts: accelerators bound to more than one command. */
  function conflicts(shortcuts) {
    const seen = new Map();
    const out = [];
    for (const [cmd, list] of Object.entries(shortcuts || {})) {
      for (const a of [].concat(list || [])) {
        const n = normalize(a);
        if (!n) continue;
        if (seen.has(n) && seen.get(n) !== cmd) out.push({ accel: n, commands: [seen.get(n), cmd] });
        else seen.set(n, cmd);
      }
    }
    return out;
  }

  return { normalize, fromEvent, label, buildMap, conflicts };
});
