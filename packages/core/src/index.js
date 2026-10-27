import { FIG_ENV, figKey, figWrap, figInner } from './figures.js';
// Opprinnelig løftet fra prototypen (tools/extract-prototype.mjs). Ren logikk uten DOM.
/* eslint-disable */
const ACC = 'oklch(0.55 0.17 255)',
  ACCL = 'var(--koklch095003250,oklch(0.95 0.03 250))',
  ACCB = 'var(--koklch086006250,oklch(0.86 0.06 250))',
  HL = 'var(--koklch093004250,oklch(0.93 0.04 250))';
const PFX = [
  { k: '', s: '', n: 'ingen', c: '' },
  { k: 'p', s: 'p', n: 'piko', c: '\\pico' },
  { k: 'n', s: 'n', n: 'nano', c: '\\nano' },
  { k: 'u', s: 'µ', n: 'mikro', c: '\\micro' },
  { k: 'm', s: 'm', n: 'milli', c: '\\milli' },
  { k: 'k', s: 'k', n: 'kilo', c: '\\kilo' },
  { k: 'M', s: 'M', n: 'mega', c: '\\mega' },
  { k: 'G', s: 'G', n: 'giga', c: '\\giga' }
];
const UNITS = [
  { k: 'ohm', s: 'Ω', n: 'ohm', c: '\\ohm' },
  { k: 'V', s: 'V', n: 'volt', c: '\\volt' },
  { k: 'A', s: 'A', n: 'ampere', c: '\\ampere' },
  { k: 'W', s: 'W', n: 'watt', c: '\\watt' },
  { k: 'F', s: 'F', n: 'farad', c: '\\farad' },
  { k: 'H', s: 'H', n: 'henry', c: '\\henry' },
  { k: 'Hz', s: 'Hz', n: 'hertz', c: '\\hertz' },
  { k: 's', s: 's', n: 'sekund', c: '\\second' },
  { k: 'S', s: 'S', n: 'siemens', c: '\\siemens' },
  { k: 'dB', s: 'dB', n: 'desibel', c: '\\decibel' },
  { k: 'C', s: 'C', n: 'coulomb', c: '\\coulomb' },
  { k: 'J', s: 'J', n: 'joule', c: '\\joule' },
  { k: 'K', s: 'K', n: 'kelvin', c: '\\kelvin' },
  { k: 'deg', s: '°', n: 'grader', c: '\\degree' }
];
const SYMS = [
  { base: 'v', tex: 'v', n: 'spenning' },
  { base: 'i', tex: 'i', n: 'strøm' },
  { base: 'R', tex: 'R', n: 'motstand' },
  { base: 'C', tex: 'C', n: 'kapasitans' },
  { base: 'L', tex: 'L', n: 'induktans' },
  { base: 'P', tex: 'P', n: 'effekt' },
  { base: 'ℓ', tex: '\\ell', n: 'liten l' },
  { base: 'ω', tex: '\\omega', n: 'omega' },
  { base: 'τ', tex: '\\tau', n: 'tau' },
  { base: 'φ', tex: '\\varphi', n: 'fi' },
  { base: 'Δ', tex: '\\Delta', n: 'delta' },
  { base: 'α', tex: '\\alpha', n: 'alfa' },
  { base: 'β', tex: '\\beta', n: 'beta' },
  { base: 'θ', tex: '\\theta', n: 'theta' }
];
const MACROS = {
  '\\qty': '#1\\,\\mathrm{#2}',
  '\\unit': '\\mathrm{#1}',
  '\\ohm': '\\Omega',
  '\\volt': 'V',
  '\\ampere': 'A',
  '\\watt': 'W',
  '\\farad': 'F',
  '\\henry': 'H',
  '\\hertz': 'Hz',
  '\\second': 's',
  '\\kilo': 'k',
  '\\mega': 'M',
  '\\giga': 'G',
  '\\milli': 'm',
  '\\micro': '\\mu ',
  '\\nano': 'n',
  '\\pico': 'p'
};
const V0 = (num, prefix, unit) => ({ num, prefix, unit });
const P2 = [
    ['in1', 0, -0.5, 'in 1'],
    ['in2', 0, 0.5, 'in 2'],
    ['out', 2.5, 0, 'out']
  ],
  P1 = [
    ['in1', 0, 0, 'in'],
    ['out', 2.5, 0, 'out']
  ];
const CT = {
  R: { n: 'Motstand', two: 1, p: 'R', val: V0('220', '', 'ohm'), tz: 'R' },
  vR: { n: 'Variabel motstand', two: 1, p: 'R', val: V0('10', 'k', 'ohm'), tz: 'vR' },
  C: { n: 'Kondensator', two: 1, p: 'C', val: V0('100', 'n', 'F'), tz: 'C' },
  eC: { n: 'Elektrolytt', two: 1, p: 'C', val: V0('10', 'u', 'F'), tz: 'eC' },
  L: { n: 'Spole', two: 1, p: 'L', val: V0('10', 'm', 'H'), tz: 'L' },
  fuse: { n: 'Sikring', two: 1, p: 'F', val: V0('500', 'm', 'A'), tz: 'fuse' },
  xtal: { n: 'Krystall', two: 1, p: 'X', val: V0('16', 'M', 'Hz'), tz: 'piezoelectric' },
  D: { n: 'Diode', two: 1, p: 'D', tz: 'D' },
  zD: { n: 'Zenerdiode', two: 1, p: 'D', val: V0('5,1', '', 'V'), tz: 'zD' },
  sD: { n: 'Schottky', two: 1, p: 'D', tz: 'sD' },
  led: { n: 'LED', two: 1, p: 'D', tz: 'led' },
  pD: { n: 'Fotodiode', two: 1, p: 'D', tz: 'pD' },
  V: { n: 'DC-kilde', two: 1, p: 'v', val: V0('5', '', 'V'), tz: 'V' },
  sV: { n: 'AC-kilde', two: 1, p: 'v', val: V0('230', '', 'V'), tz: 'sV' },
  I: { n: 'Strømkilde', two: 1, p: 'i', val: V0('10', 'm', 'A'), tz: 'I' },
  bat: { n: 'Batteri', two: 1, p: 'B', val: V0('9', '', 'V'), tz: 'battery1' },
  sw: { n: 'Bryter', two: 1, p: 'S', tz: 'nos' },
  btn: { n: 'Trykknapp', two: 1, p: 'S', tz: 'push button' },
  lamp: { n: 'Lampe', two: 1, p: 'H', tz: 'lamp' },
  am: { n: 'Amperemeter', two: 1, p: '', tz: 'ammeter' },
  vm: { n: 'Voltmeter', two: 1, p: '', tz: 'voltmeter' },
  npn: {
    n: 'NPN',
    p: 'Q',
    tz: 'npn',
    pins: [
      ['B', 0, 0, 'B'],
      ['C', 1.5, -1, 'C'],
      ['E', 1.5, 1, 'E']
    ]
  },
  pnp: {
    n: 'PNP',
    p: 'Q',
    tz: 'pnp',
    pins: [
      ['B', 0, 0, 'B'],
      ['E', 1.5, -1, 'E'],
      ['C', 1.5, 1, 'C']
    ]
  },
  nmos: {
    n: 'N-MOSFET',
    p: 'Q',
    tz: 'nmos',
    pins: [
      ['G', 0, 0, 'G'],
      ['D', 1.5, -1, 'D'],
      ['S', 1.5, 1, 'S']
    ]
  },
  pmos: {
    n: 'P-MOSFET',
    p: 'Q',
    tz: 'pmos',
    pins: [
      ['G', 0, 0, 'G'],
      ['S', 1.5, -1, 'S'],
      ['D', 1.5, 1, 'D']
    ]
  },
  opamp: {
    n: 'Op-amp',
    p: 'U',
    tz: 'op amp',
    pins: [
      ['m', 0, -0.5, '-'],
      ['p', 0, 0.5, '+'],
      ['out', 2.5, 0, 'out']
    ],
    io: 1
  },
  and: { n: 'AND', gate: 1, p: 'G', tz: 'and port', pins: P2, io: 1 },
  nand: { n: 'NAND', gate: 1, p: 'G', tz: 'nand port', pins: P2, io: 1 },
  or: { n: 'OR', gate: 1, p: 'G', tz: 'or port', pins: P2, io: 1 },
  nor: { n: 'NOR', gate: 1, p: 'G', tz: 'nor port', pins: P2, io: 1 },
  xor: { n: 'XOR', gate: 1, p: 'G', tz: 'xor port', pins: P2, io: 1 },
  xnor: { n: 'XNOR', gate: 1, p: 'G', tz: 'xnor port', pins: P2, io: 1 },
  not: { n: 'NOT', gate: 1, p: 'G', tz: 'not port', pins: P1, io: 1 },
  buf: { n: 'Buffer', gate: 1, p: 'G', tz: 'buffer port', pins: P1, io: 1 },
  vcc: { n: 'Forsyning', p: '', val: V0('5', '', 'V'), pins: [['p', 0, 0]] },
  vee: { n: 'Negativ forsyning', p: '', val: V0('5', '', 'V'), pins: [['p', 0, 0]] },
  gnd: { n: 'Jord', p: '', pins: [['p', 0, 0]] },
  net: { n: 'Nettnavn', p: '', pins: [['p', 0, 0]] },
  pt: { n: 'Punkt', p: '', pins: [['p', 0, 0]], hidden: 1 }
};
const PAL = [
  { g: 'PASSIVE', items: ['R', 'vR', 'C', 'eC', 'L', 'fuse', 'xtal'] },
  { g: 'DIODER', items: ['D', 'zD', 'sD', 'led', 'pD'] },
  { g: 'KILDER', items: ['V', 'sV', 'I', 'bat'] },
  { g: 'BRYTERE OG MÅLERE', items: ['sw', 'btn', 'lamp', 'am', 'vm'] },
  { g: 'TRANSISTORER OG OP-AMP', items: ['npn', 'pnp', 'nmos', 'pmos', 'opamp'] },
  { g: 'LOGIKK', items: ['and', 'nand', 'or', 'nor', 'xor', 'xnor', 'not', 'buf'] },
  { g: 'NODER OG NETT', items: ['vcc', 'vee', 'gnd', 'net'] }
];
const PINLBL = { in1: 'Inngang 1', in2: 'Inngang 2', out: 'Utgang', m: 'Inngang −', p: 'Inngang +' },
  PINPH = { in1: 'A', in2: 'B', out: 'Y', m: '', p: '' };
const pinTex = n => {
  const ov = n.startsWith('~'),
    s = ov ? n.slice(1) : n,
    [b, sub] = s.split('_'),
    tx = b + (sub ? '_{' + sub + '}' : '');
  return ov ? '\\overline{' + tx + '}' : tx;
};
const iconVB = k => {
  const T = CT[k];
  return T.two
    ? '-4 -18 88 36'
    : T.gate
      ? '-4 -32 108 64'
      : k === 'opamp'
        ? '-4 -44 108 88'
        : T.pins.length === 3
          ? '-4 -44 72 88'
          : k === 'gnd'
            ? '-14 -4 28 28'
            : k === 'vee'
              ? '-14 -4 28 26'
              : k === 'net'
                ? '-4 -14 40 28'
                : '-14 -22 28 26';
};
const USERS = {
  SK: { name: 'Sebastian', full: 'Sebastian Kristoffersen', color: 'oklch(0.62 0.13 30)' },
  MH: { name: 'Mia', full: 'Mia Hansen', color: 'oklch(0.62 0.13 150)' },
  EL: { name: 'Emil', full: 'Emil Larsen', color: 'oklch(0.62 0.13 300)' }
};
const KIND = { abstract: 'abs', h1: '§', h2: '§§', p: '¶', eq: 'eq', fig: 'fig', img: 'img', table: 'tab', raw: 'TeX' };
const GROUPS = ['ADK 61 · ELI1300', 'Lab-par · ELPE1300', 'Privat'];
const TPLS = [
  { k: 'rapport', name: 'Rapportmal ELI1300', desc: 'Jetlund 2025 · tospalte, 11pt, siunitx, circuitikz' },
  { k: 'lab', name: 'Labjournal', desc: 'Mål, oppkobling, måletabell og observasjoner' },
  { k: 'tom', name: 'Tom artikkel', desc: 'Bare preamble fra mal-oppsettet' }
];
const uid = () => Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const clean = s => (s || '').replace(/\u200B/g, '').replace(/\n+$/, '');
const now = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
const t = v => ({ t: 'text', v }),
  u = (num, prefix, unit) => ({ t: 'unit', num, prefix, unit }),
  sy = (base, sub, tex) => ({ t: 'sym', base, sub, tex: tex || base }),
  rf = target => ({ t: 'ref', target });
const pf = k => PFX.find(p => p.k === k) || PFX[0],
  un = k => UNITS.find(x => x.k === k) || UNITS[0];
const fmtNum = (n, dec) => (dec === '.' ? String(n).replace(',', '.') : String(n).replace('.', ','));
const qtyText = (v, dec) => `${fmtNum(v.num, dec)}\u2009${pf(v.prefix).s}${un(v.unit).s}`;
const qtyCode = v => `\\qty{${v.num}}{${pf(v.prefix).c}${un(v.unit).c}}`;
const esc = s => (s || '').replace(/([%&#_$])/g, '\\$1');
const symCode = s => `$${s.tex}${s.sub ? '_{' + s.sub + '}' : ''}$`;
const segTex = s =>
  s.t === 'text'
    ? esc(s.v)
        .replace(/\u200B/g, '')
        .replace(/\n/g, '\\\\\n')
    : s.t === 'unit'
      ? qtyCode(s)
      : s.t === 'sym'
        ? symCode(s)
        : `\\cref{${s.target}}`;
const norm = segs => {
  const o = [];
  segs.forEach(s => {
    const l = o[o.length - 1];
    if (s.t === 'text' && l && l.t === 'text') l.v += s.v;
    else o.push({ ...s });
  });
  if (!o.length || o[o.length - 1].t !== 'text') o.push(t(''));
  return o;
};
const slug = s =>
  (s || '')
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
function terms(c) {
  const T = CT[c.type] || CT.R;
  if (T.two) return { a: { x: c.x, y: c.y }, b: c.rot ? { x: c.x, y: c.y + 2 } : { x: c.x + 2, y: c.y } };
  const o = {};
  T.pins.forEach(([k, dx, dy]) => (o[k] = { x: c.x + dx, y: c.y + dy }));
  return o;
}
const gname = c => (c.name || 'G') + (c.sub || '');
function ext(T) {
  const xs = T.pins.map(p => p[1]),
    ys = T.pins.map(p => p[2]);
  return { mnx: Math.min(...xs), mxx: Math.max(...xs, 1.6), mny: Math.min(...ys), mxy: Math.max(...ys) };
}
function cbox(d) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  const add = (x, y) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  d.comps.forEach(c => {
    const T = CT[c.type] || CT.R;
    Object.values(terms(c)).forEach(p => add(p.x, p.y));
    if (T.two) {
      if (c.rot) {
        add(c.x - 0.5, c.y);
        add(c.x + (c.name || c.val ? 2.3 : 0.5), c.y + 2);
      } else {
        add(c.x, c.y - 0.8);
        add(c.x + 2, c.y + 0.5);
      }
    } else if (c.type === 'gnd') add(c.x - 0.3, c.y + 0.6);
    else if (c.type === 'vcc') add(c.x - 0.7, c.y - 1);
    else if (c.type === 'vee') add(c.x - 0.7, c.y + 1);
    else if (c.type === 'net') {
      add(c.x + 1.8, c.y + 0.2);
      add(c.x, c.y - 0.3);
    } else if (c.type === 'pt') {
    } else {
      const e = ext(T);
      add(c.x + e.mnx - (T.io ? 1.1 : 0), c.y + e.mny - (T.io ? 1.2 : 0.3));
      add(c.x + e.mxx + (T.io ? 1.1 : 1.6), c.y + e.mxy + 0.6);
    }
  });
  return { x0: x0 - 0.3, y0: y0 - 0.25, x1: x1 + 0.3, y1: y1 + 0.25 };
}
function circLines(d, style) {
  const m = {};
  d.comps.forEach(c => (m[c.id] = c));
  const f = v => {
    const r = Math.round(v * 100) / 100;
    return String(Object.is(r, -0) ? 0 : r);
  };
  const P = p => '(' + f(p.x) + ',' + f(-p.y) + ')';
  const L = [{ s: '\\begin{circuitikz}[' + style + ']' }];
  d.comps.forEach(c => {
    const T = CT[c.type] || CT.R,
      tm = terms(c);
    if (T.two) {
      const o = [T.tz];
      if (c.name) o.push('l=$' + c.name + (c.sub ? '_{' + c.sub + '}' : '') + '$');
      if (c.val) o.push('a=' + qtyCode(c.val));
      if (c.type === 'V' || c.type === 'bat') o.push('invert');
      L.push({ s: '  \\draw ' + P(tm.a) + ' to[' + o.join(', ') + '] ' + P(tm.b) + ';', cid: c.id });
    } else if (c.type === 'gnd') L.push({ s: '  \\draw ' + P(tm.p) + ' node[ground]{};', cid: c.id });
    else if (c.type === 'vcc')
      L.push({ s: '  \\draw ' + P(tm.p) + ' node[vcc]{$+' + qtyCode(c.val) + '$};', cid: c.id });
    else if (c.type === 'vee')
      L.push({ s: '  \\draw ' + P(tm.p) + ' node[vee]{$-' + qtyCode(c.val) + '$};', cid: c.id });
    else if (c.type === 'net')
      L.push({
        s: '  \\draw ' + P(tm.p) + ' -- ++(0.25,0) node[right]{$' + pinTex(c.name + (c.sub ? '_' + c.sub : '')) + '$};',
        cid: c.id
      });
    else if (c.type === 'pt') {
    } else {
      const nm = gname(c),
        p0 = T.pins[0];
      L.push({ s: '  \\node[' + T.tz + ', anchor=' + p0[3] + '] (' + nm + ') at ' + P(tm[p0[0]]) + ' {};', cid: c.id });
      if (c.name)
        L.push({
          s:
            '  \\node[' +
            (T.io ? 'above' : 'right') +
            '] at (' +
            nm +
            '.' +
            (T.io ? 'north' : 'east') +
            ') {$' +
            c.name +
            (c.sub ? '_{' + c.sub + '}' : '') +
            '$' +
            (c.ic ? ' {\\scriptsize ' + c.ic + '}' : '') +
            '};',
          cid: c.id
        });
      if (T.io && c.pinl)
        T.pins.forEach(([k, dx, , a]) => {
          const pl = c.pinl[k];
          if (!pl || (!pl.name && !pl.pin)) return;
          const left = dx === 0;
          let s = '  \\draw (' + nm + '.' + a + ')';
          if (pl.name) s += ' node[' + (left ? 'left' : 'right') + ']{$' + pinTex(pl.name) + '$}';
          if (pl.pin) s += ' node[above ' + (left ? 'right' : 'left') + ',font=\\tiny]{' + pl.pin + '}';
          L.push({ s: s + ';', cid: c.id });
        });
    }
  });
  d.wires.forEach(w => {
    const r = e => {
      const c = m[e.c];
      if (!c) return null;
      const T = CT[c.type] || CT.R;
      if (!T.two && T.pins.length > 1) {
        const pn = T.pins.find(p => p[0] === e.t);
        return '(' + gname(c) + '.' + (pn ? pn[3] : e.t) + ')';
      }
      return P(terms(c)[e.t]);
    };
    const a = r(w.a),
      b = r(w.b);
    if (a && b) L.push({ s: '  \\draw ' + a + ' -| ' + b + ';', cid: 'w:' + w.id });
  });
  L.push({ s: '\\end{circuitikz}' });
  return L;
}
function tok(s) {
  const out = [],
    P = (t, c, fs) => out.push({ t, c, fs: fs || 'normal' }),
    re =
      /(\\(begin|end|label|cref|Cref|ref|eqref|includegraphics|usepackage|documentclass|input)\{[^}]*\}|\\[a-zA-Z]+|%.*$|\$[^$]*\$)/g;
  let last = 0,
    m;
  while ((m = re.exec(s))) {
    if (m.index > last) P(s.slice(last, m.index), 'var(--syn-txt,#30343c)');
    const x = m[0];
    if (x[0] === '%') P(x, 'var(--syn-com,#8b919c)');
    else if (x[0] === '$') P(x, 'var(--syn-math,oklch(0.52 0.14 150))');
    else if (m[2]) {
      const k = x.indexOf('{');
      P(x.slice(0, k), 'var(--syn-cmd,oklch(0.5 0.16 270))', 'italic');
      P('{', 'var(--syn-txt,#30343c)');
      P(x.slice(k + 1, -1), 'var(--syn-arg,oklch(0.56 0.14 60))', 'italic');
      P('}', 'var(--syn-txt,#30343c)');
    } else if (
      /^\\(ohm|volt|ampere|watt|farad|henry|hertz|second|siemens|decibel|coulomb|joule|kelvin|degree|kilo|mega|giga|milli|micro|nano|pico)$/.test(
        x
      )
    )
      P(x, 'var(--syn-unit,oklch(0.56 0.14 60))', 'italic');
    else P(x, 'var(--syn-cmd,oklch(0.5 0.16 270))', 'italic');
    last = m.index + x.length;
  }
  if (last < s.length) P(s.slice(last), 'var(--syn-txt,#30343c)');
  if (!out.length) P(' ', 'var(--syn-txt,#30343c)');
  return out;
}
function preamble(S) {
  return [
    `\\documentclass[${S.size},a4paper${S.cols === 2 ? ',twocolumn' : ''}]{article}`,
    '\\usepackage[norsk]{babel}',
    '\\usepackage[a4paper,top=2cm,bottom=2cm,left=3cm,right=3cm]{geometry}',
    '\\usepackage{amsmath}',
    '\\usepackage[shortlabels]{enumitem}',
    '\\usepackage{graphicx}',
    // opplastede bilder ligger i bilder/; \includegraphics{fil.png} skal også finne dem
    '\\graphicspath{{bilder/}}',
    '\\usepackage{booktabs}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{siunitx}',
    '\\sisetup{',
    `  output-complex-root = \\ensuremath{\\mathit{${S.imag}}},`,
    '  complex-root-position = before-number,',
    '  exponent-product = \\cdot,',
    `  output-decimal-marker = {${S.dec}}`,
    '}',
    '\\usepackage{tikz}',
    `\\usepackage[${S.style}]{circuitikz}`,
    '\\usepackage{pgfplots}',
    '\\pgfplotsset{compat=1.18}',
    '\\usepackage[norsk]{cleveref}',
    ...(S.indent ? [] : ['\\setlength{\\parindent}{0pt}'])
  ];
}
// Egne preambel-linjer går foran de genererte når de laster samme pakke, ellers blir
// pakken lastet to ganger («Option clash for package geometry»).
const USEPKG = /^\s*\\usepackage(?:\[([^\]]*)\])?\{([^}]*)\}\s*(%.*)?$/;
const pkgsOf = s => {
  const m = s.match(USEPKG);
  return m ? { opts: (m[1] || '').trim(), names: m[2].split(',').map(x => x.trim()).filter(Boolean) } : null;
};
// Preamblen som hele setninger: linjer slås sammen til { } og [ ] går opp, så
// \usepackage[a4paper,\n top=2cm]{geometry} og \newcommand over flere linjer blir én enhet.
function texStatements(lines) {
  const out = [];
  let cur = null,
    depth = 0;
  const done = () => {
    cur.text = cur.lines.join('\n');
    out.push(cur);
    cur = null;
    depth = 0;
  };
  lines.forEach(l => {
    if (!cur) cur = { lines: [] };
    cur.lines.push(l);
    const code = l.replace(/(^|[^\\])%.*$/, '$1');
    for (let k = 0; k < code.length; k++) {
      const c = code[k];
      if (c === '\\') k++;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
    }
    if (depth <= 0) done();
  });
  if (cur) done();
  return out;
}
// Til sammenligning: uten kommentarer og med mellomrom slått sammen
const texNorm = t =>
  t
    .replace(/(^|[^\\])%[^\n]*/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*([,{}\[\]=])\s*/g, '$1')
    .trim();
function ownPreamble(gen, pre) {
  const out = gen.slice(),
    rest = [],
    at = name => out.findIndex(s => (pkgsOf(s)?.names || []).includes(name)),
    drop = name => {
      const k = at(name);
      if (k >= 0) out.splice(k, 1);
    };
  texStatements(pre).forEach(st => {
    const p = pkgsOf(texNorm(st.text)),
      dup = p ? p.names.filter(n => at(n) >= 0) : [];
    if (!dup.length) return rest.push(...st.lines);
    if (!p.opts) {
      // samme pakke uten valg: den genererte linja dekker den allerede
      const left = p.names.filter(n => at(n) < 0);
      if (left.length) rest.push('\\usepackage{' + left.join(',') + '}');
    } else if (p.names.length === 1) out.splice(at(p.names[0]), 1, ...st.lines);
    else {
      dup.forEach(drop);
      rest.push(...st.lines);
    }
  });
  // cleveref må lastes etter hyperref
  if (texStatements(rest).some(st => (pkgsOf(texNorm(st.text))?.names || []).includes('hyperref'))) {
    const k = at('cleveref');
    if (k >= 0) {
      const [c] = out.splice(k, 1);
      return [...out, ...rest, c];
    }
  }
  return [...out, ...rest];
}
function docCode(doc, S) {
  const L = [],
    P = (s, bid) => L.push({ s, bid: bid || null });
  ownPreamble(preamble(S), doc.pre || []).forEach(s => P(s));
  P('');
  P(`\\title{${esc(doc.title)}}`);
  P(`\\author{${esc(doc.authors)}\\\\${esc(doc.group)}}`);
  P('\\date{}');
  P('\\begin{document}');
  P('\\maketitle');
  doc.blocks.forEach(b => {
    const i = b.id;
    P('', null);
    if (b.type === 'raw') (b.src || '').split('\n').forEach(x => P(x, i));
    else if (b.type === 'abstract') {
      P('\\begin{abstract}', i);
      P('  ' + esc(b.text), i);
      P('\\end{abstract}', i);
    } else if (b.type === 'h1') P(`\\section{${esc(b.text)}}`, i);
    else if (b.type === 'h2') P(`\\subsection{${esc(b.text)}}`, i);
    else if (b.type === 'p') P(b.segs.map(segTex).join(''), i);
    else if (b.type === 'eq') {
      P('\\begin{equation}', i);
      P('  ' + b.src, i);
      P(`  \\label{${b.label}}`, i);
      P('\\end{equation}', i);
    } else if (b.type === 'fig' || b.type === 'img') {
      const env = b.span && S.cols === 2 ? 'figure*' : 'figure';
      P('\\begin{' + env + '}[' + (env === 'figure*' ? 't' : 'ht') + ']', i);
      P('  \\centering', i);
      if (b.type === 'fig') circLines(b.circuit, S.style).forEach(l => P('  ' + l.s, i));
      else P('  \\includegraphics[width=' + (b.w === 1 ? '' : b.w) + '\\linewidth]{bilder/' + b.file + '}', i);
      P(`  \\caption{${esc(b.caption)}}`, i);
      P(`  \\label{${b.label}}`, i);
      P('\\end{' + env + '}', i);
    } else if (b.type === 'table') {
      const st = b.style || 'grid',
        ct = r => r.map(cellTex);
      if (st === 'list') {
        P('\\begin{itemize}', i);
        b.rows.slice(1).forEach(r => {
          const it = listItem(r, true);
          if (it) P('  \\item ' + it, i);
        });
        P('\\end{itemize}', i);
      } else {
        P('\\begin{table}[ht]', i);
        P('  \\centering', i);
        P('  \\caption{' + esc(b.caption) + '}', i);
        P('  \\label{' + b.label + '}', i);
        if (st === 'grid') {
          P('  \\begin{tabular}{|l|l|l|}\\hline', i);
          b.rows.forEach((r, ri) => P('    ' + ct(r).join(' & ') + ' \\\\' + (ri === 0 ? '\\hline\\hline' : ''), i));
          P('    \\hline', i);
        } else if (st === 'booktabs') {
          P('  \\begin{tabular}{lll}', i);
          P('    \\toprule', i);
          b.rows.forEach((r, ri) => {
            P('    ' + ct(r).join(' & ') + ' \\\\', i);
            if (ri === 0) P('    \\midrule', i);
          });
          P('    \\bottomrule', i);
        } else {
          P('  \\begin{tabular}{lll}', i);
          b.rows.forEach((r, ri) =>
            P('    ' + (ri === 0 ? ct(r).map(x => (x ? '\\textbf{' + x + '}' : '')) : ct(r)).join(' & ') + ' \\\\', i)
          );
        }
        P('  \\end{tabular}', i);
        P('\\end{table}', i);
      }
    }
  });
  P('');
  P('\\end{document}');
  return L;
}
function numberDoc(blocks) {
  const num = {},
    labels = {};
  let sec = 0,
    sub = 0,
    fig = 0,
    tab = 0,
    eq = 0;
  blocks.forEach(b => {
    if (b.type === 'h1') {
      sec++;
      sub = 0;
      num[b.id] = '' + sec;
    } else if (b.type === 'h2') {
      sub++;
      num[b.id] = sec + '.' + sub;
    } else if (b.type === 'fig' || b.type === 'img') {
      fig++;
      num[b.id] = fig;
      labels[b.label] = { k: 'figur', n: fig, id: b.id };
    } else if (b.type === 'table' && b.style !== 'list') {
      tab++;
      num[b.id] = tab;
      labels[b.label] = { k: 'tabell', n: tab, id: b.id };
    } else if (b.type === 'eq') {
      eq++;
      num[b.id] = eq;
      labels[b.label] = { k: 'likning', n: eq, id: b.id };
    }
  });
  return {
    num,
    labels,
    refText: l => {
      const x = labels[l];
      return x ? (x.k === 'likning' ? `likning (${x.n})` : `${x.k} ${x.n}`) : '??';
    }
  };
}
const plain = (b, dec) =>
  b.segs
    .map(s =>
      s.t === 'text' ? s.v : s.t === 'unit' ? qtyText(s, dec) : s.t === 'sym' ? s.base + (s.sub || '') : 'figur 1'
    )
    .join('');
function paginate(blocks, cols, dec) {
  const cpl = cols === 2 ? 46 : 100,
    cap = (cols === 2 ? 96 : 48) * 0.86;
  const pages = [[]];
  let used = cols === 2 ? 16 : 8;
  const w = b => {
    switch (b.type) {
      case 'abstract':
        return Math.ceil(((b.text || '').length + 12) / (cpl * 0.85)) + 3;
      case 'h1':
        return 2.6;
      case 'h2':
        return 2;
      case 'p':
        return Math.ceil(Math.max(1, plain(b, dec).length) / cpl) + 0.7;
      case 'eq':
        return 3.4;
      case 'fig':
        return cols === 2 ? (b.span ? 7 : 11) : 13;
      case 'img':
        return Math.round((cols === 2 && !b.span ? 15 : 11) * (b.w || 0.8)) + 3;
      case 'raw': {
        const s = (b.src || '').replace(/\\begin\{(tikzpicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g, '\n\n\n\n\n\n');
        const cols2 = /\\begin\{multicols\}\{2\}/.test(s) && cols !== 2 ? 0.55 : 1;
        return Math.max(1.5, (s.split('\n').filter(l => l.trim()).length * 0.95 + (s.length / cpl) * 0.25) * cols2);
      }
      case 'table':
        return b.style === 'list' ? b.rows.length * 1.3 + 1 : b.rows.length * 1.5 + 4;
      default:
        return 1;
    }
  };
  blocks.forEach(b => {
    const x = w(b);
    if (used + x > cap && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(b);
    used += x;
    if (used > cap) pages[pages.length - 1].over = true;
  });
  return pages;
}
function diode() {
  return {
    comps: [
      { id: 'c1', type: 'V', x: 1, y: 1, rot: 1, name: 'v', sub: 's', val: { num: '9', prefix: '', unit: 'V' } },
      { id: 'c2', type: 'R', x: 2, y: 1, rot: 0, name: 'R', sub: '1', val: { num: '220', prefix: '', unit: 'ohm' } },
      { id: 'c3', type: 'led', x: 5, y: 1, rot: 1, name: 'D', sub: '1', val: null }
    ],
    wires: [
      { id: 'w1', a: { c: 'c1', t: 'a' }, b: { c: 'c2', t: 'a' } },
      { id: 'w2', a: { c: 'c2', t: 'b' }, b: { c: 'c3', t: 'a' } },
      { id: 'w3', a: { c: 'c3', t: 'b' }, b: { c: 'c1', t: 'b' } }
    ]
  };
}
function gamepad() {
  return {
    comps: [
      { id: 'g1', type: 'vcc', x: 1, y: 0.5, rot: 0, name: '', sub: '', val: { num: '5', prefix: '', unit: 'V' } },
      { id: 'g2', type: 'btn', x: 1, y: 1, rot: 1, name: 'S', sub: 'U', val: null },
      { id: 'g3', type: 'R', x: 0, y: 3.5, rot: 1, name: 'R', sub: '1', val: { num: '10', prefix: 'k', unit: 'ohm' } },
      { id: 'g4', type: 'gnd', x: 0, y: 5.5, rot: 0, name: '', sub: '', val: null },
      { id: 'g5', type: 'nand', x: 2, y: 3.5, rot: 0, name: 'G', sub: '1', val: null },
      { id: 'g6', type: 'R', x: 5, y: 3.5, rot: 0, name: 'R', sub: '5', val: { num: '470', prefix: '', unit: 'ohm' } },
      { id: 'g7', type: 'led', x: 8, y: 3.5, rot: 1, name: 'Y', sub: 'U', val: null },
      { id: 'g8', type: 'gnd', x: 8, y: 5.5, rot: 0, name: '', sub: '', val: null }
    ],
    wires: [
      { id: 'x1', a: { c: 'g2', t: 'b' }, b: { c: 'g3', t: 'a' } },
      { id: 'x2', a: { c: 'g2', t: 'b' }, b: { c: 'g5', t: 'in1' } },
      { id: 'x3', a: { c: 'g5', t: 'in1' }, b: { c: 'g5', t: 'in2' } },
      { id: 'x4', a: { c: 'g5', t: 'out' }, b: { c: 'g6', t: 'a' } },
      { id: 'x5', a: { c: 'g6', t: 'b' }, b: { c: 'g7', t: 'a' } }
    ]
  };
}
function skeleton(tpl) {
  const B = x => ({ id: uid(), ...x });
  if (tpl === 'tom') return [B({ type: 'p', segs: [t('')] })];
  if (tpl === 'lab')
    return [
      B({ type: 'h1', text: 'Mål' }),
      B({ type: 'p', segs: [t('')] }),
      B({ type: 'h1', text: 'Oppkobling' }),
      B({ type: 'p', segs: [t('')] }),
      B({ type: 'h1', text: 'Målinger' }),
      B({
        type: 'table',
        caption: 'Måleresultater',
        label: 'tab:maling',
        rows: [
          ['Måling', 'Beregnet', 'Målt'],
          ['', '', '']
        ]
      }),
      B({ type: 'h1', text: 'Observasjoner' }),
      B({ type: 'p', segs: [t('')] })
    ];
  return [
    B({ type: 'abstract', text: '' }),
    B({ type: 'h1', text: 'Innledning' }),
    B({ type: 'h2', text: 'Hensikt' }),
    B({ type: 'p', segs: [t('')] }),
    B({ type: 'h2', text: 'Utstyrsliste' }),
    B({
      type: 'table',
      caption: 'Utstyrsliste',
      label: 'tab:utstyr',
      rows: [
        ['Utstyr', 'Type', 'Fabrikat'],
        ['', '', '']
      ]
    }),
    B({ type: 'h1', text: 'Teoretisk del' }),
    B({ type: 'p', segs: [t('')] }),
    B({ type: 'h1', text: 'Praktisk arbeid' }),
    B({ type: 'p', segs: [t('')] }),
    B({ type: 'h1', text: 'Resultater' }),
    B({ type: 'p', segs: [t('')] }),
    B({ type: 'h1', text: 'Diskusjon' }),
    B({ type: 'p', segs: [t('')] }),
    B({ type: 'h1', text: 'Konklusjon' }),
    B({ type: 'p', segs: [t('')] })
  ];
}
function makeDocs() {
  const base = {
    authors: 'Sebastian Kristoffersen, Mia Hansen, Emil Larsen',
    group: 'Gruppe ADK 61',
    folder: GROUPS[0]
  };
  const d4 = {
    ...base,
    id: 'd4',
    title: 'Gamepad-emulator med NAND-porter',
    meta: 'Oblig 4 · redigert nå',
    blocks: [
      {
        id: 'b-abs',
        type: 'abstract',
        text: 'Rapporten beskriver design og bygging av en gamepad-emulator med 20 stk. 2-inngangs NAND-porter fordelt på fem 74HC00N.'
      },
      { id: 'b-h1', type: 'h1', text: 'Innledning' },
      {
        id: 'b-p1',
        type: 'p',
        segs: [
          t('Fire trykknapper styrer fire lysdioder gjennom et nettverk av NAND-porter. Kretsen forsynes med '),
          u('5', '', 'V'),
          t(' fra USB-C.')
        ]
      },
      { id: 'b-h2', type: 'h2', text: 'Utstyrsliste' },
      { id: 'b-p2', type: 'p', segs: [t('Følgende utstyr ble benyttet:')] },
      {
        id: 'b-tab',
        type: 'table',
        caption: 'Utstyrsliste',
        label: 'tab:utstyr',
        style: 'list',
        rows: [
          ['Antall', 'Komponent', 'Merknad'],
          ['5 stk.', '74HC00', 'fire 2-inngangs NAND-porter'],
          ['4', 'trykknapper', ''],
          ['4', 'motstander, 10 kΩ', 'pull-down'],
          ['4', 'motstander, 470 Ω', ''],
          ['4', 'røde lysdioder', ''],
          ['', 'Spenningskilde, 5 V', '']
        ]
      },
      { id: 'b-h3', type: 'h1', text: 'Teoretisk del' },
      {
        id: 'b-p3',
        type: 'p',
        segs: [
          t('Strømmen gjennom lysdioden er gitt ved '),
          rf('eq:led'),
          t(', der '),
          sy('v', 'D'),
          t(' er diodespenningen.')
        ]
      },
      { id: 'b-eq', type: 'eq', src: 'i_D = \\frac{v_s - v_D}{R}', label: 'eq:led' },
      { id: 'b-h4', type: 'h1', text: 'Praktisk arbeid' },
      {
        id: 'b-p4',
        type: 'p',
        segs: [
          t('Kretsen ble koblet opp på breadboard som vist i '),
          rf('fig:diode'),
          t('. Kilden gir '),
          sy('v', 's'),
          t(' = '),
          u('9', '', 'V'),
          t(' over en formotstand på '),
          u('220', '', 'ohm'),
          t('.')
        ]
      },
      {
        id: 'b-fig1',
        type: 'fig',
        caption: 'Diodekretsen fra introkurset tegnet med CircuiTikZ.',
        label: 'fig:diode',
        circuit: diode()
      },
      {
        id: 'b-fig2',
        type: 'fig',
        caption: 'Utdrag av kretsskjemaet for opp-knappen.',
        label: 'fig:opp',
        circuit: gamepad()
      },
      { id: 'b-h5', type: 'h1', text: 'Resultater' },
      {
        id: 'b-p5',
        type: 'p',
        segs: [t('Målt strøm gjennom lysdioden ble '), u('31,2', 'm', 'A'), t(', noe høyere enn beregnet.')]
      },
      { id: 'b-h6', type: 'h1', text: 'Diskusjon' },
      {
        id: 'b-disk',
        type: 'p',
        segs: [
          t(
            'Avviket skyldes trolig toleransen til formotstanden og at diodespenningen var lavere enn databladverdien. Hver 74HC00N avkobles med en kondensator på '
          ),
          u('100', 'n', 'F'),
          t(' så nær pinne 14 og 7 som mulig.')
        ]
      },
      { id: 'b-h7', type: 'h1', text: 'Konklusjon' },
      { id: 'b-p7', type: 'p', segs: [t('Emulatoren fungerte som forventet for alle fire retninger.')] }
    ]
  };
  const mk = (id, title, meta, folder, tpl) => ({
    ...base,
    id,
    title,
    meta,
    folder,
    blocks: skeleton(tpl || 'rapport')
  });
  return [
    d4,
    mk('d3', 'Logiske porter og sannhetstabeller', 'Oblig 3 · levert 12. okt', GROUPS[0]),
    mk('d2', 'Spenningsdeler med last', 'Oblig 2 · levert 28. sep', GROUPS[0]),
    mk('d1', 'Diodekarakteristikk', 'Oblig 1 · levert 14. sep', GROUPS[0]),
    mk('l2', 'Transistor som bryter', 'Lab 2 · utkast', GROUPS[1], 'lab')
  ];
}
const DEF_SET = {
  size: '11pt',
  cols: 2,
  dec: ',',
  imag: 'j',
  style: 'european',
  indent: false,
  warn: true,
  maxPages: 5,
  engine: 'pdfLaTeX',
  auto: true,
  server: 'https://kobling.app',
  sync: true,
  histOthers: true,
  theme: 'system'
};
const DEF_DUCK = { on: false, domain: '', token: '', interval: 5, ipv6: false, tls: false };
const DEF_SMB = {
  on: false,
  host: '',
  share: 'backup',
  path: 'kobling',
  user: '',
  pass: '',
  domain: 'WORKGROUP',
  ver: '3.0',
  schedule: 'daily',
  keep: 14,
  incl: { docs: true, figs: true, hist: true, users: true }
};
const DEF_DEP = {
  target: 'proxmox',
  ctid: '120',
  hostname: 'kobling',
  cores: '2',
  ram: '2048',
  disk: '8',
  storage: 'local-lvm',
  bridge: 'vmbr0',
  ip: 'dhcp',
  gw: '',
  port: '8080',
  appdata: '/mnt/user/appdata/kobling',
  datadir: './data'
};
const DUCK_RE = /^[a-z0-9-]{1,63}$/,
  TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function tokSh(s) {
  return tokSh0(s).map(p => ({ fs: 'normal', ...p }));
}
function tokSh0(s) {
  if (/^\s*(#|<!--)/.test(s)) return [{ t: s, c: 'var(--ka29e97,#a29e97)' }];
  const m = s.match(/^(\s*)([A-Z_][A-Z0-9_]*)(=)(.*)$/);
  if (m)
    return [
      { t: m[1] + m[2], c: 'var(--koklch05015250,oklch(0.5 0.15 250))' },
      { t: '=', c: 'var(--k3d3a36,#3d3a36)' },
      { t: m[4] || ' ', c: 'var(--koklch05013150,oklch(0.5 0.13 150))' }
    ];
  const out = [],
    re = /(<\/?[A-Za-z?][^>]*>|"[^"]*")/g;
  let last = 0,
    mm;
  while ((mm = re.exec(s))) {
    if (mm.index > last) out.push({ t: s.slice(last, mm.index), c: 'var(--k3d3a36,#3d3a36)' });
    out.push({
      t: mm[0],
      c: mm[0][0] === '<' ? 'var(--koklch048015300,oklch(0.48 0.15 300))' : 'var(--koklch05013150,oklch(0.5 0.13 150))'
    });
    last = mm.index + mm[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), c: 'var(--k3d3a36,#3d3a36)' });
  return out.length ? out : [{ t: ' ', c: 'var(--k3d3a36,#3d3a36)' }];
}
const unesc = s => (s || '').replace(/\\([%&#_$])/g, '$1');
function parseInline(s) {
  const segs = [],
    re = /\\qty\{([^}]*)\}\{([^}]*)\}|\\cref\{([^}]*)\}|\$([^$]*)\$/g;
  let last = 0,
    m;
  while ((m = re.exec(s))) {
    if (m.index > last) segs.push(t(unesc(s.slice(last, m.index))));
    if (m[1] != null) {
      const us = m[2].trim(),
        p = PFX.find(x => x.c && us.startsWith(x.c)),
        rest = p ? us.slice(p.c.length) : us,
        uu = UNITS.find(x => x.c === rest);
      if (!uu) throw new Error('Ukjent enhet: ' + us);
      if (!/^-?\d+([.,]\d+)?$/.test(m[1].trim())) throw new Error('Ugyldig tall i \\qty: ' + m[1]);
      segs.push({ t: 'unit', num: m[1].trim(), prefix: p ? p.k : '', unit: uu.k });
    } else if (m[3] != null) segs.push(rf(m[3].trim()));
    else {
      const mm = m[4].match(/^\s*(\\[A-Za-z]+|[A-Za-z])\s*(?:_\{?([^}]*)\}?)?\s*$/);
      if (!mm) throw new Error('Kan ikke tolke $' + m[4] + '$. Bruk f.eks. $v_{s}$.');
      const sym = SYMS.find(x => x.tex === mm[1]);
      segs.push({ t: 'sym', base: sym ? sym.base : mm[1].replace(/^\\/, ''), sub: (mm[2] || '').trim(), tex: mm[1] });
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) segs.push(t(unesc(s.slice(last))));
  return norm(segs.length ? segs : [t('')]);
}
function parseBlock(b, code) {
  const body = code.trim(),
    grab = re => {
      const m = body.match(re);
      return m ? m[1] : null;
    },
    lab = () => grab(/\\label\{([^}]*)\}/);
  switch (b.type) {
    case 'raw':
      return { src: code.replace(/^\n+|\s+$/g, '') };
    case 'h1': {
      const x = grab(/^\\section\*?\{([\s\S]*)\}$/);
      if (x == null) throw new Error('Forventet \\section{…}');
      return { text: unesc(x) };
    }
    case 'h2': {
      const x = grab(/^\\subsection\*?\{([\s\S]*)\}$/);
      if (x == null) throw new Error('Forventet \\subsection{…}');
      return { text: unesc(x) };
    }
    case 'abstract': {
      const x = grab(/\\begin\{abstract\}([\s\S]*)\\end\{abstract\}/);
      if (x == null) throw new Error('Forventet \\begin{abstract} … \\end{abstract}');
      return { text: unesc(x.trim()) };
    }
    case 'p':
      return {
        segs: parseInline(
          body
            .replace(/\\\\[ \t]*\n?/g, '\u0001')
            .replace(/\s*\n\s*/g, ' ')
            .replace(/\s*\u0001\s*/g, '\u0001')
        ).map(sg => (sg.t === 'text' ? { ...sg, v: sg.v.replace(/\u0001/g, '\n') } : sg))
      };
    case 'eq': {
      const x = grab(/\\begin\{equation\}([\s\S]*)\\end\{equation\}/);
      if (x == null) throw new Error('Forventet \\begin{equation} … \\end{equation}');
      return { src: x.replace(/\\label\{[^}]*\}/, '').trim(), label: lab() || b.label };
    }
    case 'fig': {
      const cap = grab(/\\caption\{(.*)\}/);
      return { caption: cap != null ? unesc(cap) : b.caption, label: lab() || b.label, span: /figure\*/.test(body) };
    }
    case 'img': {
      const cap = grab(/\\caption\{(.*)\}/),
        w = grab(/width=([0-9.]*)\\(?:line|text)width/);
      return {
        caption: cap != null ? unesc(cap) : b.caption,
        label: lab() || b.label,
        span: /figure\*/.test(body),
        w: w === '' ? 1 : w != null ? Math.max(0.1, Math.min(1, parseFloat(w))) : b.w
      };
    }
    case 'table': {
      if (b.style === 'list') {
        const items = [...body.matchAll(/\\item\s+(.*)/g)].map(m => listCells(m[1].trim()));
        if (!items.length) throw new Error('Fant ingen punkter (\\item).');
        return { rows: [b.rows[0] || ['Antall', 'Komponent', 'Merknad'], ...items] };
      }
      const cap = grab(/\\caption\{(.*)\}/);
      const rows = body
        .split('\n')
        .filter(l => l.includes('&'))
        .map(l => {
          const c = l
            .replace(/\\\\.*$/, '')
            .replace(/\\textbf\{([^}]*)\}/g, '$1')
            .split('&')
            .map(x => cellText(x.trim()));
          while (c.length < 3) c.push('');
          return c.slice(0, 3);
        });
      if (!rows.length) throw new Error('Fant ingen tabellrader (kolonner skilles med &).');
      return { caption: cap != null ? unesc(cap) : b.caption, label: lab() || b.label, rows };
    }
  }
  return {};
}
const qtyBack = s =>
  s.replace(/\\qty\{([^}]*)\}\{([^}]*)\}/g, (m, n, us) => {
    us = us.trim();
    const p = PFX.find(x => x.c && us.startsWith(x.c)),
      rest = p ? us.slice(p.c.length) : us,
      uu = UNITS.find(x => x.c === rest);
    return uu ? n + ' ' + (p ? p.s : '') + uu.s : m;
  });
const cellBack = s => unesc(qtyBack(s.replace(/\\textbf\{([^}]*)\}/g, '$1')).trim());
const wsn = s => (s || '').replace(/%.*$/gm, '').replace(/\s+/g, ' ').trim();
function parseDoc(src, doc, S) {
  const lines = src.split('\n'),
    E = (line, msg) => {
      throw { line, msg };
    };
  const settings = {},
    pre = [],
    gen = new Set(texStatements(preamble(S)).map(st => texNorm(st.text)));
  let title = doc.title,
    authors = doc.authors,
    group = doc.group,
    noIndent = false;
  const bi = lines.findIndex(l => /^\s*\\begin\{document\}/.test(l));
  if (bi < 0) E(lines.length, 'Fant ikke \\begin{document}');
  let ei = -1;
  for (let i = lines.length - 1; i > bi; i--)
    if (/^\s*\\end\{document\}/.test(lines[i])) {
      ei = i;
      break;
    }
  if (ei < 0) E(lines.length, 'Mangler \\end{document}');
  for (const st of texStatements(lines.slice(0, bi))) {
    const tl = texNorm(st.text),
      // tittel og forfattere: bare kommentarer og linjeskift fjernes (mellomrom etter komma beholdes)
      tx = st.text
        .replace(/(^|[^\\])%[^\n]*/g, '$1')
        .replace(/\s*\n\s*/g, ' ')
        .trim();
    let m;
    if (!st.text.trim()) continue;
    // ren kommentar: tas vare på
    if (!tl) {
      pre.push(...st.lines);
      continue;
    }
    if ((m = tl.match(/^\\documentclass(?:\[([^\]]*)\])?\{([^}]*)\}/))) {
      const o = (m[1] || '').split(',').map(x => x.trim());
      const sz = o.find(x => /^(10|11|12)pt$/.test(x));
      if (sz) settings.size = sz;
      settings.cols = o.includes('twocolumn') ? 2 : 1;
      continue;
    }
    if ((m = tx.match(/^\\title\{(.*)\}$/))) {
      title = unesc(m[1]);
      continue;
    }
    if ((m = tx.match(/^\\author\{(.*)\}$/))) {
      const p = m[1].split('\\\\');
      authors = unesc(p[0].trim());
      group = unesc((p[1] || '').trim());
      continue;
    }
    if (/^\\date\{/.test(tl)) continue;
    // \sisetup: desimaltegn og imaginær enhet blir innstillinger; andre nøkler beholdes som egen linje
    if (/^\\sisetup\{/.test(tl)) {
      if ((m = tl.match(/output-decimal-marker=\{(.)\}/))) settings.dec = m[1];
      if ((m = tl.match(/output-complex-root=[^,]*\\mathit\{(.)\}/))) settings.imag = m[1];
      const keys = tl
        .slice(9, -1)
        .split(/,(?![^{]*\})/)
        .map(x => x.split('=')[0].trim())
        .filter(Boolean);
      if (keys.every(k => /^(output-complex-root|complex-root-position|exponent-product|output-decimal-marker)$/.test(k))) continue;
      pre.push(...st.lines);
      continue;
    }
    if ((m = tl.match(/^\\usepackage\[(european|american)\]\{circuitikz\}/))) {
      settings.style = m[1];
      continue;
    }
    if (tl === '\\setlength{\\parindent}{0pt}') {
      noIndent = true;
      continue;
    }
    if (gen.has(tl)) continue;
    pre.push(...st.lines);
  }
  settings.indent = !noIndent;
  const raw = [];
  let i = bi + 1;
  while (i < ei) {
    const l = lines[i].trim();
    if (!l || l === '\\maketitle' || l[0] === '%') {
      i++;
      continue;
    }
    let m = l.match(/^\\begin\{(abstract|equation|figure\*?|table|itemize)\}/);
    if (m) {
      const env = m[1];
      let j = i;
      while (j < ei && !lines[j].includes('\\end{' + env + '}')) j++;
      if (j >= ei) E(i + 1, 'Mangler \\end{' + env + '}');
      raw.push({ env, text: lines.slice(i, j + 1).join('\n'), line: i + 1 });
      i = j + 1;
      continue;
    }
    if ((m = l.match(/^\\(sub)?section\*?\{/))) {
      raw.push({ env: m[1] ? 'h2' : 'h1', text: l, line: i + 1 });
      i++;
      continue;
    }
    if ((m = l.match(/^\\begin\{([^}]+)\}/))) {
      const env = m[1],
        b = '\\begin{' + env + '}',
        e = '\\end{' + env + '}';
      let dep = 0,
        j = i;
      for (; j < ei; j++) {
        dep += lines[j].split(b).length - 1;
        dep -= lines[j].split(e).length - 1;
        if (dep <= 0) break;
      }
      if (j >= ei) E(i + 1, 'Mangler ' + e);
      raw.push({ env: 'raw', text: lines.slice(i, j + 1).join('\n'), line: i + 1 });
      i = j + 1;
      continue;
    }
    const st = i;
    while (i < ei) {
      const x = lines[i].trim();
      if (!x || (i > st && /^\\(begin\{|section|subsection)/.test(x))) break;
      i++;
    }
    raw.push({ env: 'p', text: lines.slice(st, i).join('\n'), line: st + 1 });
  }
  const pool = {};
  doc.blocks.forEach(b => (pool[b.type] = pool[b.type] || []).push(b));
  const take = (type, pred) => {
    const q = pool[type] || [];
    let k = pred ? q.findIndex(pred) : -1;
    if (k < 0) k = 0;
    return q.length ? q.splice(k, 1)[0] : null;
  };
  const blocks = raw.map(r => {
    try {
      const cap = () => {
          const m = r.text.match(/\\caption\{(.*)\}/);
          return m ? unesc(m[1]) : '';
        },
        lab = () => {
          const m = r.text.match(/\\label\{([^}]*)\}/);
          return m ? m[1] : null;
        };
      if (r.env === 'raw') {
        const o = take('raw') || { id: uid(), type: 'raw' };
        return { ...o, src: r.text };
      }
      if (r.env === 'p' && /^\\(?!qty\{|cref\{)([a-zA-Z]+|\[)/.test(r.text.trim())) {
        const o = take('raw') || { id: uid(), type: 'raw' };
        return { ...o, src: r.text };
      }
      if (r.env === 'p') {
        const o = take('p');
        try {
          const b0 = o || { id: uid(), type: 'p' };
          return { ...b0, ...parseBlock(b0, r.text) };
        } catch (err) {
          if (o) (pool.p = pool.p || []).unshift(o);
          const q = take('raw') || { id: uid(), type: 'raw' };
          return { ...q, src: r.text };
        }
      }
      if (r.env === 'h1' || r.env === 'h2' || r.env === 'abstract') {
        const o = take(r.env) || { id: uid(), type: r.env };
        return { ...o, ...parseBlock(o, r.text) };
      }
      if (r.env === 'equation') {
        const o = take('eq') || { id: uid(), type: 'eq', label: 'eq:' + uid().slice(0, 4) };
        return { ...o, ...parseBlock(o, r.text) };
      }
      if (r.env.startsWith('figure')) {
        const span = r.env === 'figure*';
        const tz = r.text.match(/\\begin\{circuitikz\}[\s\S]*?\\end\{circuitikz\}/);
        if (tz) {
          const o = take('fig') || { id: uid(), type: 'fig', label: 'fig:krets-' + uid().slice(0, 4) };
          let circuit = o.circuit;
          if (
            !circuit ||
            wsn(
              circLines(circuit, S.style)
                .map(x => x.s)
                .join('\n')
            ) !== wsn(tz[0])
          ) {
            const pr = parseCircuit(tz[0]);
            if (!pr.data) throw new Error(pr.warn.join(' ') || 'Kunne ikke tolke CircuiTikZ-koden');
            circuit = pr.data;
          }
          return { ...o, circuit, caption: cap(), label: lab() || o.label, span };
        }
        const ig = r.text.match(/\\includegraphics(?:\[([^\]]*)\])?\{(?:bilder\/)?([^}]*)\}/);
        if (ig) {
          let o = take('img', b => b.file === ig[2]);
          if (!o || o.file !== ig[2]) {
            const lf = (doc.files || []).find(x => x.file === ig[2]);
            if (!lf)
              throw new Error('Bildet «' + ig[2] + '» finnes ikke i bilder/. Slipp det i fillisten til venstre først.');
            o = {
              id: uid(),
              type: 'img',
              src: lf.src,
              file: lf.file,
              w: 0.8,
              label: 'fig:' + slug(lf.file.replace(/\.[^.]+$/, ''))
            };
          }
          const w = (ig[1] || '').match(/width=([0-9.]*)\\(?:line|text)width/);
          return {
            ...o,
            caption: cap(),
            label: lab() || o.label,
            span,
            w: w ? (w[1] === '' ? 1 : Math.max(0.1, Math.min(1, parseFloat(w[1])))) : o.w
          };
        }
        throw new Error('Figuren må inneholde circuitikz eller \\includegraphics');
      }
      if (r.env === 'table') {
        const o = take('table') || { id: uid(), type: 'table', label: 'tab:' + uid().slice(0, 4) };
        const rows = r.text
          .split('\n')
          .filter(l => l.includes('&'))
          .map(l => {
            const c = l
              .replace(/\\\\.*$/, '')
              .split('&')
              .map(cellBack);
            while (c.length < 3) c.push('');
            return c.slice(0, 3);
          });
        if (!rows.length) throw new Error('Fant ingen tabellrader (kolonner skilles med &).');
        return {
          ...o,
          caption: cap(),
          label: lab() || o.label,
          rows,
          style: /\\toprule/.test(r.text) ? 'booktabs' : /\\hline/.test(r.text) ? 'grid' : 'plain'
        };
      }
      if (r.env === 'itemize') {
        const o = take('table', b => b.style === 'list') || {
          id: uid(),
          type: 'table',
          label: 'tab:' + uid().slice(0, 4),
          caption: 'Liste',
          rows: [['Antall', 'Komponent', 'Merknad']]
        };
        const items = (r.text.match(/\\item\s+.*/g) || []).map(x => {
          let s = cellBack(x.replace(/^\\item\s+/, '')),
            c = '';
          const pm = s.match(/^(.*?)\s*\(([^()]*)\)$/);
          if (pm) {
            s = pm[1];
            c = pm[2];
          }
          const nm = s.match(/^(\d+\s*(?:stk\.)?)\s+(.*)$/);
          return nm ? [nm[1], nm[2], c] : ['', s, c];
        });
        return { ...o, style: 'list', rows: [o.rows[0], ...items] };
      }
    } catch (e) {
      E(r.line, e.msg || e.message || String(e));
    }
  });
  return { title, authors, group, pre, blocks, settings };
}
const escH = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function texLabels(code) {
  const map = {},
    sec = [0, 0, 0];
  let fig = 0,
    tab = 0,
    eq = 0,
    last = null,
    env = [];
  const re = /\\begin\{([^}]*)\}|\\end\{([^}]*)\}|\\captionof\{(figure|table)\}|\\caption\{|\\label\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) {
      env.push(m[1]);
      if (/^equation$/.test(m[1])) {
        eq++;
        last = { k: 'likning', n: eq };
      }
    } else if (m[2]) {
      env.pop();
    } else if (m[3]) {
      if (m[3] === 'figure') {
        fig++;
        last = { k: 'figur', n: fig };
      } else {
        tab++;
        last = { k: 'tabell', n: tab };
      }
    } else if (m[0] === '\\caption{') {
      const e = env
        .slice()
        .reverse()
        .find(x => /^(table|figure)\*?$/.test(x));
      if (e && /^figure/.test(e)) {
        fig++;
        last = { k: 'figur', n: fig };
      } else {
        tab++;
        last = { k: 'tabell', n: tab };
      }
    } else if (m[4] != null && last) map[m[4]] = last;
  }
  return map;
}
function texMacros(lines) {
  const M = {};
  (lines || []).forEach(l => {
    const m = l.match(/^\s*\\(?:re)?newcommand\*?\{?\\([A-Za-z]+)\}?(?:\[(\d)\])?\{(.*)\}\s*$/);
    if (m) M['\\' + m[1]] = m[3];
  });
  return M;
}
function readGroup(s, i) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  if (s[j] !== '{') return null;
  let d = 0;
  for (let k = j; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') {
      k++;
      continue;
    }
    if (c === '{') d++;
    else if (c === '}') {
      d--;
      if (d === 0) return [s.slice(j + 1, k), k + 1];
    }
  }
  return [s.slice(j + 1), s.length];
}
function readOpt(s, i) {
  let j = i;
  while (j < s.length && /[ \t]/.test(s[j])) j++;
  if (s[j] !== '[') return null;
  let d = 0;
  for (let k = j; k < s.length; k++) {
    if (s[k] === '[') d++;
    else if (s[k] === ']') {
      d--;
      if (d === 0) return [s.slice(j + 1, k), k + 1];
    }
  }
  return null;
}
function findEnd(s, i, env) {
  const b = '\\begin{' + env + '}',
    e = '\\end{' + env + '}';
  let d = 1,
    k = i;
  while (k < s.length) {
    const nb = s.indexOf(b, k),
      ne = s.indexOf(e, k);
    if (ne < 0) return [s.slice(i), s.length];
    if (nb >= 0 && nb < ne) {
      d++;
      k = nb + b.length;
    } else {
      d--;
      if (d === 0) return [s.slice(i, ne), ne + e.length];
      k = ne + e.length;
    }
  }
  return [s.slice(i), s.length];
}
const tx_splitTop = (s, sep) => {
  const out = [];
  let d = 0,
    st = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\' && s.slice(k, k + sep.length) !== sep) {
      k++;
      continue;
    }
    if (c === '{') d++;
    else if (c === '}') d--;
    else if (d === 0 && s.slice(k, k + sep.length) === sep) {
      out.push(s.slice(st, k));
      st = k + sep.length;
      k += sep.length - 1;
    }
  }
  out.push(s.slice(st));
  return out;
};
const SI_UNIT = u => {
  let o = u.trim();
  PFX.forEach(p => {
    if (p.c) o = o.split(p.c).join(p.s);
  });
  UNITS.forEach(x => {
    o = o.split(x.c).join(x.s);
  });
  return o
    .replace(/\\per/g, '/')
    .replace(/\\squared/g, '²')
    .replace(/\\cubed/g, '³')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '');
};
const DROP =
  /^(label|vspace|hspace|setlength|markcell|addtolength|newcommand|renewcommand|def|usetikzlibrary|ctikzset|tikzset|sisetup|pagestyle|thispagestyle|bibliographystyle|columnbreak|newpage|clearpage|FloatBarrier|centering|noindent|small|footnotesize|scriptsize|tiny|large|Large|normalsize|hfill|vfill|medskip|bigskip|smallskip|raggedright|maketitle|par|indent|selectfont|hline|toprule|midrule|bottomrule|cline|cmidrule)$/;
// Figur fra serveren (README §9): bilde når det finnes, ellers plassholder (puls under kompilering, rød ved feil).
function figHtml(ctx, env, raw) {
  const w = ctx.figWrap && ctx.figWrap.inner === raw ? ctx.figWrap : null,
    h = figKey(ctx.fig.pre, w ? w.pre + raw + '}' : raw),
    st = ctx.fig.state(h);
  if (st === 'ok')
    return (
      '<div style="margin:.4em auto;text-align:center;break-inside:avoid"><img src="' +
      escH(ctx.fig.url(h)) +
      '" alt="' +
      escH(env) +
      '" style="max-width:92%;height:auto;filter:var(--fig-filter,none)"></div>'
    );
  const err = st === 'error';
  return (
    '<div data-fig="' +
    h +
    '" style="margin:.4em auto;max-width:92%;border:1px dashed ' +
    (err ? 'var(--kb3261e,#b3261e)' : 'currentColor') +
    ';color:' +
    (err ? 'var(--kb3261e,#b3261e)' : 'inherit') +
    ';opacity:' +
    (err ? 1 : 0.55) +
    ';border-radius:4px;padding:1.3em .6em;text-align:center;font-family:Geist Mono,monospace;font-size:.8em;break-inside:avoid' +
    (st === 'busy' ? ';animation:kobling-pulse 1.4s ease-in-out infinite' : '') +
    '">' +
    (err ? 'Figuren kunne ikke tegnes · se logg' : escH(env) + ' · tegnes av serveren etter kompilering') +
    '</div>'
  );
}
function texRender(src, ctx) {
  const k = window.katex;
  const km = (t, d) => {
    t = t.replace(/\\label\{[^}]*\}/g, '').replace(/\\(nonumber|notag)\b/g, '');
    if (!k) return '<code>' + escH(t) + '</code>';
    try {
      return k.renderToString(t, { displayMode: d, throwOnError: false, macros: { ...MACROS, ...(ctx.macros || {}) } });
    } catch (e) {
      return escH(t);
    }
  };
  const ref = l => {
    const x = (ctx.labels || {})[l];
    return (
      '<span style="color:inherit">' +
      (x ? (x.k === 'likning' ? 'likning (' + x.n + ')' : x.k + ' ' + x.n) : '??') +
      '</span>'
    );
  };
  const cap = (kind, body) => {
    const x = ctx.cap || {};
    ctx.capN = ctx.capN || {};
    ctx.capN[kind] = (ctx.capN[kind] || 0) + 1;
    return (
      '<div style="text-align:center;margin:.35em 0 .5em;font-size:.95em">' +
      (kind === 'figure' ? 'Figur ' : 'Tabell ') +
      ctx.capN[kind] +
      ': ' +
      R(body) +
      '</div>'
    );
  };
  const heading = (lvl, star, body) => {
    let num = '';
    if (!star) {
      if (lvl === 1) {
        ctx.sec = (ctx.sec || 0) + 1;
        ctx.sub = 0;
        ctx.ssub = 0;
        num = ctx.sec + '';
      } else if (lvl === 2) {
        ctx.sub = (ctx.sub || 0) + 1;
        ctx.ssub = 0;
        num = (ctx.sec || 0) + '.' + ctx.sub;
      } else {
        ctx.ssub = (ctx.ssub || 0) + 1;
        num = (ctx.sec || 0) + '.' + (ctx.sub || 0) + '.' + ctx.ssub;
      }
    }
    const fs = lvl === 1 ? '1.2em' : lvl === 2 ? '1.07em' : '1em';
    return (
      '<div style="font-weight:700;font-size:' +
      fs +
      ';margin:.7em 0 .3em;break-after:avoid">' +
      (num ? num + '\u2003' : '') +
      R(body) +
      '</div>'
    );
  };
  const table = (spec, body) => {
    const rows = [];
    tx_splitTop(body, '\\\\').forEach(ch => {
      let t = ch.trim();
      const top = /^(\s*\\(toprule|midrule|hline|cline\{[^}]*\}|cmidrule(\([^)]*\))?\{[^}]*\})\s*)+/.exec(t);
      let rule = '';
      if (top) {
        rule = /toprule/.test(top[0]) ? '1px' : '.6px';
        t = t.slice(top[0].length).trim();
      }
      const bot = /\\(bottomrule|hline)\s*$/.test(t);
      t = t.replace(/\\(bottomrule|hline)\s*$/, '').trim();
      if (!t) {
        if (rows.length && (rule || bot))
          rows[rows.length - 1].bottom = bot && /bottomrule/.test(ch) ? '1px' : rule || '.6px';
        return;
      }
      rows.push({ cells: tx_splitTop(t, '&'), top: rule, bottom: bot ? '.6px' : '' });
    });
    return (
      '<table style="border-collapse:collapse;margin:.3em auto;font-size:.95em">' +
      rows
        .map(
          r =>
            '<tr style="' +
            (r.top ? 'border-top:' + r.top + ' solid currentColor;' : '') +
            (r.bottom ? 'border-bottom:' + r.bottom + ' solid currentColor' : '') +
            '">' +
            r.cells.map(c => '<td style="padding:.12em .55em;text-align:center">' + R(c.trim()) + '</td>').join('') +
            '</tr>'
        )
        .join('') +
      '</table>'
    );
  };
  const envR = (env, body, args, raw) => {
    const e = env.replace(/\*$/, '');
    if (/^(equation|align|gather|multline|flalign|alignat|eqnarray|displaymath|math)$/.test(e)) {
      let num = '';
      if (env === 'equation') {
        ctx.eq = (ctx.eq || 0) + 1;
        num = ctx.eq;
      }
      const inner =
        e === 'equation' || e === 'displaymath'
          ? body
          : '\\begin{' +
            (e === 'eqnarray' ? 'align' : e) +
            '*}' +
            body +
            '\\end{' +
            (e === 'eqnarray' ? 'align' : e) +
            '*}';
      return (
        '<div style="display:flex;align-items:center;margin:.4em 0;break-inside:avoid"><div style="flex:1;min-width:0;overflow:hidden">' +
        km(inner, true) +
        '</div>' +
        (num ? '<span style="padding-left:.6em">(' + num + ')</span>' : '') +
        '</div>'
      );
    }
    if (e === 'multicols') {
      return (
        '<div style="column-count:' + (args[0] || '2').trim() + ';column-gap:1.4em;margin:.2em 0">' + R(body) + '</div>'
      );
    }
    if (e === 'center') return '<div style="text-align:center;margin:.4em 0">' + R(body) + '</div>';
    if (e === 'flushright') return '<div style="text-align:right">' + R(body) + '</div>';
    if (e === 'itemize' || e === 'enumerate' || e === 'description') {
      const tag = e === 'enumerate' ? 'ol' : 'ul';
      const items = tx_splitTop(body, '\\item').slice(1);
      return (
        '<' +
        tag +
        ' style="margin:.3em 0;padding-left:1.4em">' +
        items.map(x => '<li style="margin:.1em 0">' + R(x.replace(/^\s*\[[^\]]*\]/, '').trim()) + '</li>').join('') +
        '</' +
        tag +
        '>'
      );
    }
    if (e === 'tabular' || e === 'tabularx' || e === 'array' || e === 'longtable')
      return table(args[e === 'tabularx' ? 1 : 0] || '', body);
    if (e === 'table' || e === 'figure') {
      const st = ctx.env || [];
      ctx.env = [...st, e];
      const o = '<div style="margin:.5em 0;break-inside:avoid">' + R(body) + '</div>';
      ctx.env = st;
      return o;
    }
    if (FIG_ENV.test(e) && ctx.fig && raw) return figHtml(ctx, env, raw);
    if (/^(tikzpicture|circuitikz|axis|scope)$/.test(e))
      return (
        '<div style="margin:.4em auto;max-width:92%;border:1px dashed currentColor;opacity:.55;border-radius:4px;padding:1.3em .6em;text-align:center;font-family:Geist Mono,monospace;font-size:.8em;break-inside:avoid">' +
        escH(env) +
        ' · tegnes av serveren etter kompilering</div>'
      );
    if (e === 'abstract')
      return (
        '<div style="margin:.3em 1.5em .7em;font-size:.95em"><div style="text-align:center;font-weight:700;margin-bottom:.2em">Sammendrag</div>' +
        R(body) +
        '</div>'
      );
    if (e === 'minipage')
      return (
        '<div style="display:inline-block;vertical-align:top;width:' +
        (/\\(text|line)width/.test(args[0] || '') ? Math.round((parseFloat(args[0]) || 1) * 100) + '%' : 'auto') +
        '">' +
        R(body) +
        '</div>'
      );
    return R(body);
  };
  function R(s) {
    let out = '',
      i = 0,
      txt = '';
    const flush = () => {
      if (txt) {
        out += escH(txt)
          .replace(/---/g, '\u2014')
          .replace(/--/g, '\u2013')
          .replace(/~/g, '\u00a0')
          .replace(/\n\s*\n/g, '<div style="height:.5em"></div>');
        txt = '';
      }
    };
    while (i < s.length) {
      const c = s[i];
      if (c === '%') {
        const j = s.indexOf('\n', i);
        i = j < 0 ? s.length : j + 1;
        continue;
      }
      if (c === '$') {
        flush();
        if (s[i + 1] === '$') {
          const j = s.indexOf('$$', i + 2);
          const t = s.slice(i + 2, j < 0 ? s.length : j);
          out += '<div style="margin:.4em 0">' + km(t, true) + '</div>';
          i = j < 0 ? s.length : j + 2;
          continue;
        }
        const j = s.indexOf('$', i + 1);
        out += km(s.slice(i + 1, j < 0 ? s.length : j), false);
        i = j < 0 ? s.length : j + 1;
        continue;
      }
      if (c === '{' || c === '}') {
        if (c === '{') {
          const g = readGroup(s, i);
          if (g) {
            flush();
            out += R(g[0]);
            i = g[1];
            continue;
          }
        }
        i++;
        continue;
      }
      if (c === '&') {
        txt += ' ';
        i++;
        continue;
      }
      if (c !== '\\') {
        txt += c;
        i++;
        continue;
      }
      const m = s.slice(i + 1).match(/^([A-Za-z]+\*?|.)/);
      if (!m) {
        i++;
        continue;
      }
      const name = m[1];
      let j = i + 1 + name.length;
      if (name === '[') {
        const e = s.indexOf('\\]', j);
        flush();
        out +=
          '<div style="margin:.45em 0;break-inside:avoid">' + km(s.slice(j, e < 0 ? s.length : e), true) + '</div>';
        i = e < 0 ? s.length : e + 2;
        continue;
      }
      if (name === '(') {
        const e = s.indexOf('\\)', j);
        flush();
        out += km(s.slice(j, e < 0 ? s.length : e), false);
        i = e < 0 ? s.length : e + 2;
        continue;
      }
      if (name === '\\' || name === 'newline') {
        flush();
        out += '<br>';
        const o = readOpt(s, j);
        i = o ? o[1] : j;
        continue;
      }
      if (name === ' ' || name === '\n') {
        txt += ' ';
        i = j;
        continue;
      }
      if (name === ',') {
        txt += '\u2009';
        i = j;
        continue;
      }
      if (name === ';' || name === ':' || name === 'quad') {
        txt += ' ';
        i = j;
        continue;
      }
      if (/^[%&#_$&{}]$/.test(name)) {
        txt += name;
        i = j;
        continue;
      }
      if (name === 'begin') {
        const g = readGroup(s, j);
        if (!g) {
          i = j;
          continue;
        }
        const env = g[0];
        j = g[1];
        const args = [];
        let o = readOpt(s, j);
        if (o) j = o[1];
        if (/^(multicols\*?|tabular\*?|tabularx|array|minipage|longtable)$/.test(env)) {
          let gg;
          while ((gg = readGroup(s, j)) && args.length < 2) {
            args.push(gg[0]);
            j = gg[1];
            if (env !== 'tabularx') break;
          }
        }
        const [body, nj] = findEnd(s, j, env);
        flush();
        out += envR(env, body, args, s.slice(i, nj));
        i = nj;
        continue;
      }
      if (name === 'end') {
        const g = readGroup(s, j);
        i = g ? g[1] : j;
        continue;
      }
      const st = name.replace(/\*$/, '');
      if (/^(section|subsection|subsubsection|paragraph)$/.test(st)) {
        const g = readGroup(s, j);
        flush();
        if (g) {
          out +=
            st === 'paragraph'
              ? '<b>' + R(g[0]) + '</b> '
              : heading(st === 'section' ? 1 : st === 'subsection' ? 2 : 3, /\*$/.test(name), g[0]);
          i = g[1];
        } else i = j;
        continue;
      }
      if (st === 'SI' || st === 'qty') {
        const o = readOpt(s, j);
        if (o) j = o[1];
        const a = readGroup(s, j),
          b = a && readGroup(s, a[1]);
        if (a && b) {
          txt += a[0].replace('.', ctx.dec || ',') + '\u2009' + SI_UNIT(b[0]);
          i = b[1];
        } else i = j;
        continue;
      }
      if (st === 'si' || st === 'unit') {
        const a = readGroup(s, j);
        if (a) {
          txt += SI_UNIT(a[0]);
          i = a[1];
        } else i = j;
        continue;
      }
      if (st === 'num') {
        const a = readGroup(s, j);
        if (a) {
          txt += a[0].replace('.', ctx.dec || ',');
          i = a[1];
        } else i = j;
        continue;
      }
      if (/^(cref|Cref|ref|eqref|autoref|pageref)$/.test(st)) {
        const a = readGroup(s, j);
        flush();
        if (a) {
          const r = a[0]
            .split(',')
            .map(x => ref(x.trim()))
            .join(', ');
          out += st === 'Cref' ? r.replace(/>(\w)/, (m0, c0) => '>' + c0.toUpperCase()) : st === 'eqref' ? r : r;
          i = a[1];
        } else i = j;
        continue;
      }
      if (st === 'caption') {
        const o = readOpt(s, j);
        if (o) j = o[1];
        const a = readGroup(s, j);
        flush();
        if (a) {
          const env = (ctx.env || []).slice(-1)[0];
          out += cap(env === 'figure' ? 'figure' : 'table', a[0]);
          i = a[1];
        } else i = j;
        continue;
      }
      if (st === 'captionof') {
        const t = readGroup(s, j),
          a = t && readGroup(s, t[1]);
        flush();
        if (a) {
          out += cap(t[0].trim() === 'figure' ? 'figure' : 'table', a[0]);
          i = a[1];
        } else i = j;
        continue;
      }
      if (st === 'includegraphics') {
        const o = readOpt(s, j);
        if (o) j = o[1];
        const a = readGroup(s, j);
        flush();
        if (a) {
          const f = a[0].trim().replace(/^bilder\//, ''),
            src = (ctx.files || {})[f],
            w = o && o[0].match(/width=([0-9.]*)\\(?:text|line)width/);
          const pct = w ? Math.round(parseFloat(w[1] || '1') * 100) : 80;
          out += src
            ? '<img src="' + src + '" style="display:block;margin:.3em auto;max-width:' + pct + '%;width:' + pct + '%">'
            : '<div style="margin:.3em auto;width:' +
              pct +
              '%;aspect-ratio:16/9;border:1px dashed #b3261e;color:#b3261e;display:flex;align-items:center;justify-content:center;font-size:.8em;text-align:center;padding:.4em">Mangler bilder/' +
              escH(f) +
              '</div>';
          i = a[1];
        } else i = j;
        continue;
      }
      if (/^(textbf|textit|emph|underline|texttt|textsc|textrm|textsf|mbox|text|fbox)$/.test(st)) {
        const a = readGroup(s, j);
        flush();
        if (a) {
          const tg = {
            textbf: ['<b>', '</b>'],
            textit: ['<i>', '</i>'],
            emph: ['<i>', '</i>'],
            underline: ['<u>', '</u>'],
            texttt: ['<code>', '</code>'],
            fbox: ['<span style="border:.5px solid currentColor;padding:0 .2em">', '</span>']
          }[st] || ['', ''];
          out += tg[0] + R(a[0]) + tg[1];
          i = a[1];
        } else i = j;
        continue;
      }
      if (st === 'resizebox' || st === 'scalebox') {
        const a1 = readGroup(s, j);
        let a = a1;
        if (st === 'resizebox' && a) a = readGroup(s, a[1]);
        const b = a && readGroup(s, a[1]);
        flush();
        if (b) {
          // en figur alene i boksen får boksen med i figurkoden (samme nøkkel som på serveren)
          const pw = ctx.figWrap;
          ctx.figWrap = { inner: figInner(b[0]), pre: figWrap(st, a1[0], a[0]) };
          out += R(b[0]);
          ctx.figWrap = pw;
          i = b[1];
        } else i = j;
        continue;
      }
      if (st === 'color' || st === 'textcolor') {
        const a = readGroup(s, j);
        if (st === 'textcolor' && a) {
          const b = readGroup(s, a[1]);
          if (b) {
            flush();
            out += R(b[0]);
            i = b[1];
            continue;
          }
        }
        i = a ? a[1] : j;
        continue;
      }
      if (st === 'item') {
        flush();
        out += '<br>• ';
        i = j;
        continue;
      }
      if (st === 'today') {
        txt += new Date().toLocaleDateString('nb-NO');
        i = j;
        continue;
      }
      if (DROP.test(st)) {
        let o = readOpt(s, j);
        if (o) j = o[1];
        if (
          /^(label|vspace|hspace|setlength|markcell|addtolength|usetikzlibrary|ctikzset|tikzset|sisetup|pagestyle|thispagestyle|bibliographystyle|cline|cmidrule)$/.test(
            st
          )
        ) {
          let g = readGroup(s, j);
          if (g) {
            j = g[1];
            if (/^(setlength|addtolength)$/.test(st)) {
              const g2 = readGroup(s, j);
              if (g2) j = g2[1];
            }
          }
        } else if (/^(newcommand|renewcommand)$/.test(st)) {
          const g = readGroup(s, j);
          if (g) j = g[1];
          const o2 = readOpt(s, j);
          if (o2) j = o2[1];
          const g2 = readGroup(s, j);
          if (g2) j = g2[1];
        } else if (st === 'def') {
          const mm = s.slice(j).match(/^\\[A-Za-z]+/);
          if (mm) j += mm[0].length;
          const g = readGroup(s, j);
          if (g) j = g[1];
        }
        i = j;
        continue;
      }
      i = j;
    }
    flush();
    return out;
  }
  return '<div style="text-wrap:pretty">' + R(src) + '</div>';
}
function rawHtml(src, ctx) {
  return texRender(src || '', ctx || {});
}
const ENV_BUILTIN = new Set(
  'document abstract itemize enumerate description center flushleft flushright quote quotation verse verbatim figure figure* table table* tabular tabular* minipage equation array eqnarray thebibliography titlepage list trivlist picture'.split(
    ' '
  )
);
const ENV_PKG = {
  align: 'amsmath',
  'align*': 'amsmath',
  gather: 'amsmath',
  'gather*': 'amsmath',
  multline: 'amsmath',
  'multline*': 'amsmath',
  flalign: 'amsmath',
  'flalign*': 'amsmath',
  alignat: 'amsmath',
  'alignat*': 'amsmath',
  split: 'amsmath',
  aligned: 'amsmath',
  cases: 'amsmath',
  matrix: 'amsmath',
  pmatrix: 'amsmath',
  bmatrix: 'amsmath',
  vmatrix: 'amsmath',
  'equation*': 'amsmath',
  multicols: 'multicol',
  'multicols*': 'multicol',
  tikzpicture: 'tikz',
  circuitikz: 'circuitikz',
  axis: 'pgfplots',
  subfigure: 'subcaption',
  wrapfigure: 'wrapfig',
  longtable: 'longtable',
  tabularx: 'tabularx',
  lstlisting: 'listings'
};
const MATH_ENV = /^(equation|align|gather|multline|flalign|alignat|eqnarray|math|displaymath)\*?$/,
  AMP_ENV =
    /^(tabular\*?|tabularx|longtable|array|align\*?|alignat\*?|flalign\*?|eqnarray|split|aligned|cases|[pbvV]?matrix)$/;
function lintTex(src, files) {
  const D = [],
    seen = new Set(),
    add = (line, sev, msg, hint) => {
      const k = line + '|' + msg;
      if (seen.has(k) || D.length >= 200) return;
      seen.add(k);
      D.push({ line, sev, msg, hint: hint || '' });
    },
    nl = s => {
      ln += (s.match(/\n/g) || []).length;
    },
    inTikz = () => envs.some(e => /^(tikzpicture|circuitikz|axis|scope)$/.test(e.env));
  const pk = new Set(),
    defs = new Set();
  const pkOpts = {};
  src.replace(/\\usepackage(?:\[([^\]]*)\])?\{([^}]*)\}/g, (m, o, a, at) => {
    const opts = (o || '').split(',').map(x => x.trim()).filter(Boolean);
    a.split(',').forEach(x => {
      x = x.trim();
      pk.add(x);
      const first = pkOpts[x];
      if (!first) pkOpts[x] = opts;
      // LaTeX godtar en ny lasting bare hvis valgene allerede er med i den første
      else if (opts.some(v => !first.includes(v)))
        add(
          src.slice(0, at).split('\n').length,
          'error',
          'LaTeX Error: Option clash for package ' + x + '.',
          'Pakken «' + x + '» lastes flere ganger med ulike valg. Slå valgene sammen i én \\usepackage-linje.'
        );
    });
    return m;
  });
  src.replace(/\\newenvironment\{([^}]*)\}/g, (m, a) => {
    defs.add(a);
    return m;
  });
  if (!/\\begin\{document\}/.test(src))
    add(1, 'error', 'LaTeX Error: Missing \\begin{document}.', 'Dokumentet må ha \\begin{document} etter preambelen.');
  let math = null,
    inDoc = false,
    ln = 1;
  const braces = [],
    envs = [],
    labels = {},
    refs = [];
  const lineStart = [0];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') {
      ln++;
      const nl = src.indexOf('\n', i + 1),
        cur = src.slice(i + 1, nl < 0 ? src.length : nl);
      if (!cur.trim() && math && (math.kind === '$' || math.kind === '\\(')) {
        add(
          math.line,
          'error',
          'Missing $ inserted.',
          'Inline-matte som starter her, er ikke lukket før avsnittet slutter.'
        );
        math = null;
      }
      continue;
    }
    if (c === '%') {
      const j = src.indexOf('\n', i);
      if (j < 0) break;
      i = j - 1;
      continue;
    }
    if (c === '\\') {
      const m = src.slice(i + 1, i + 40).match(/^([A-Za-z]+\*?|[\s\S])/);
      if (!m) continue;
      const name = m[1];
      i += name.length;
      if (name === '\n') {
        ln++;
        continue;
      }
      const rest = () => src.slice(i + 1, i + 400);
      if (name === 'begin' || name === 'end') {
        const em = rest().match(/^\s*\{([^}]*)\}/);
        if (!em) continue;
        const env = em[1];
        i += em[0].length;
        nl(em[0]);
        if (name === 'begin') {
          if (env === 'document') inDoc = true;
          if (!ENV_BUILTIN.has(env) && !defs.has(env)) {
            const p = ENV_PKG[env];
            if (p === undefined)
              add(
                ln,
                'error',
                'LaTeX Error: Environment ' + env + ' undefined.',
                'Miljøet «' + env + '» finnes ikke. Sjekk stavemåten, eller legg til pakken som definerer det.'
              );
            else if (!pk.has(p))
              add(
                ln,
                'error',
                'LaTeX Error: Environment ' + env + ' undefined.',
                'Legg til \\usepackage{' + p + '} i preambelen.'
              );
          }
          envs.push({ env, line: ln });
          if (MATH_ENV.test(env) && !math) math = { kind: 'env', env, line: ln };
        } else {
          const top = envs[envs.length - 1];
          if (!top)
            add(
              ln,
              'error',
              'LaTeX Error: \\end{' + env + '} without matching \\begin.',
              'Det finnes ingen åpen \\begin{' + env + '} her.'
            );
          else if (top.env !== env) {
            add(
              ln,
              'error',
              'LaTeX Error: \\begin{' + top.env + '} on input line ' + top.line + ' ended by \\end{' + env + '}.',
              '«' + top.env + '» fra linje ' + top.line + ' må lukkes før «' + env + '».'
            );
            const k = envs.map(e => e.env).lastIndexOf(env);
            if (k >= 0) envs.length = k;
          } else envs.pop();
          if (math && math.kind === 'env' && math.env === env) math = null;
        }
        continue;
      }
      if (name === '[') {
        if (math)
          add(
            ln,
            'error',
            'LaTeX Error: Bad math environment delimiter.',
            '\\[ står inne i matte som allerede er åpen.'
          );
        else math = { kind: '\\[', line: ln };
        continue;
      }
      if (name === ']') {
        if (!math || math.kind !== '\\[')
          add(ln, 'error', 'LaTeX Error: Bad math environment delimiter.', '\\] uten tilhørende \\[.');
        else math = null;
        continue;
      }
      if (name === '(') {
        if (!math) math = { kind: '\\(', line: ln };
        continue;
      }
      if (name === ')') {
        if (math && math.kind === '\\(') math = null;
        else add(ln, 'error', 'LaTeX Error: Bad math environment delimiter.', '\\) uten tilhørende \\(.');
        continue;
      }
      if (
        /^(label|ref|cref|Cref|eqref|autoref|pageref|includegraphics|usepackage|documentclass|url|input|include|bibliography|newenvironment)$/.test(
          name
        )
      ) {
        const am = rest().match(/^\s*(\[[^\]]*\])?\s*\{([^}]*)\}/);
        if (!am) continue;
        const ln0 = ln;
        i += am[0].length;
        nl(am[0]);
        const arg = am[2].trim();
        if (name === 'label') {
          if (labels[arg])
            add(
              ln0,
              'warning',
              'LaTeX Warning: Label `' + arg + "' multiply defined.",
              'Samme \\label brukes også på linje ' + labels[arg] + '.'
            );
          else labels[arg] = ln0;
        } else if (/ref$/i.test(name)) arg.split(',').forEach(k => refs.push({ k: k.trim(), line: ln0 }));
        else if (name === 'includegraphics' && files && inDoc) {
          const f = arg.replace(/^bilder\//, '');
          if (!files.has(f)) {
            add(
              ln0,
              'error',
              'LaTeX Error: File `' + arg + "' not found.",
              'Bildet finnes ikke i bilder/. Last det opp, så får det riktig filnavn automatisk.'
            );
            D[D.length - 1].fix = { label: 'Last opp bildet …', upload: f };
          }
        }
        continue;
      }
      continue;
    }
    if (c === '$') {
      if (src[i + 1] === '$') {
        i++;
        if (math && math.kind === '$$') math = null;
        else if (!math) math = { kind: '$$', line: ln };
        else add(ln, 'error', 'Display math should end with $$.', '');
        continue;
      }
      if (math && math.kind === '$') math = null;
      else if (!math) math = { kind: '$', line: ln };
      else add(ln, 'error', 'LaTeX Error: Bad math environment delimiter.', '$ står inne i display-matte.');
      continue;
    }
    if (c === '{') {
      braces.push(ln);
      continue;
    }
    if (c === '}') {
      if (!braces.length) add(ln, 'error', "Too many }'s.", 'Det er en } for mye på denne linjen.');
      else braces.pop();
      continue;
    }
    if (!inDoc) continue;
    if ((c === '_' || c === '^') && !math && !inTikz()) {
      add(
        ln,
        'error',
        'Missing $ inserted.',
        '«' +
          c +
          '» virker bare i matte. Skriv $…$ rundt, eller \\' +
          (c === '_' ? '_' : 'textasciicircum{}') +
          ' for selve tegnet.'
      );
      continue;
    }
    if (c === '&' && !inTikz() && !envs.some(e => AMP_ENV.test(e.env))) {
      add(
        ln,
        'error',
        'Misplaced alignment tab character &.',
        '& brukes bare i tabeller og align. Skriv \\& for selve tegnet.'
      );
      continue;
    }
    if (
      c === '#' &&
      !inTikz() &&
      !/\\(newcommand|renewcommand|def|newenvironment)/.test(src.slice(src.lastIndexOf('\n', i) + 1, i))
    ) {
      add(
        ln,
        'error',
        "You can't use `macro parameter character #' in horizontal mode.",
        'Skriv \\# for selve tegnet.'
      );
      continue;
    }
  }
  if (math) add(math.line, 'error', 'Missing $ inserted.', 'Matten som starter her, blir aldri lukket.');
  if (braces.length) {
    const bl = src.split('\n')[braces[0] - 1] || '',
      nc = bl.match(/\\(newcommand|renewcommand|def)\s*\{?\\?([A-Za-z]+)/);
    const SL = src.split('\n');
    let end = braces[0] - 1;
    for (let k = braces[0]; k < SL.length; k++) {
      if (!SL[k].trim() || /^\s*\\(begin|end|section|title|newcommand|renewcommand|def)\b/.test(SL[k])) break;
      end = k;
    }
    add(
      braces[0],
      'error',
      'Runaway argument? File ended while scanning use of {.',
      nc
        ? 'Definisjonen av \\' + nc[2] + ' mangler avsluttende }. Den bør lukkes etter linje ' + (end + 1) + '.'
        : 'En { på denne linjen blir aldri lukket.'
    );
    D[D.length - 1].fix = { label: 'Legg til } på linje ' + (end + 1), line: end + 1, append: '}' };
  }
  envs.forEach(e =>
    add(
      e.line,
      'error',
      e.env === 'document'
        ? '*** (job aborted, no legal \\end found)'
        : 'LaTeX Error: \\begin{' + e.env + '} on input line ' + e.line + ' ended by \\end{document}.',
      'Mangler \\end{' + e.env + '}.'
    )
  );
  refs.forEach(r => {
    if (r.k && !labels[r.k])
      add(
        r.line,
        'warning',
        'LaTeX Warning: Reference `' + r.k + "' on page 1 undefined.",
        'Ingen \\label{' + r.k + '} finnes. Vises som ?? i PDF-en.'
      );
  });
  return D.sort((a, b) => a.line - b.line || (a.sev === 'error' ? -1 : 1));
}
const ACCOUNTS = [
  { id: 'SK', name: 'Sebastian Kristoffersen', email: 'sebastian@kristo.no', admin: true },
  { id: 'MH', name: 'Mia Hansen', email: 'mia.hansen@student.no', admin: false },
  { id: 'EL', name: 'Emil Larsen', email: 'emil.larsen@student.no', admin: false }
];
const ADMIN_TABS = ['server', 'duck', 'backup', 'smtp', 'install', 'update'];
const DEF_UPD = {
  ver: '1.4.2',
  built: '12.10.2026',
  prev: null,
  channel: 'stable',
  auto: false,
  time: '04:00',
  backup: true,
  notify: true,
  lastCheck: ''
};
const RELEASES = {
  stable: {
    ver: '1.5.0',
    date: '24.10.2026',
    size: '182 MB',
    notes: [
      'Redigerbar LaTeX-kode med feilsjekk og logg',
      'Bilder i fillisten med dra og slipp',
      'Gjenoppretting fra tidligere backup',
      'Mørk modus og nytt utseende',
      'Raskere kompilering (latexmk med mellomlager)'
    ]
  },
  beta: {
    ver: '1.6.0-beta.2',
    date: '25.10.2026',
    size: '186 MB',
    notes: [
      'Alt i 1.5.0',
      'Ekte TikZ-forhåndsvisning i editoren',
      'Eksport til Word (.docx)',
      'Kjent feil: kretseditoren kan hakke på store skjema'
    ]
  }
};
const vcmp = (a, b) => {
  const p = x => x.split(/[.-]/).map(n => (isNaN(+n) ? -1 : +n));
  const A = p(a),
    B = p(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d;
  }
  return 0;
};
const DEF_SMTP = {
  provider: 'proton',
  host: 'smtp.protonmail.ch',
  port: '587',
  sec: 'starttls',
  user: '',
  pass: '',
  from: '',
  fromName: '',
  notify: true
};
const PROTON_FREE = /@(proton\.me|protonmail\.com|protonmail\.ch|pm\.me)$/i;
const SMTP_PRESETS = {
  proton: { host: 'smtp.protonmail.ch', port: '587', sec: 'starttls' },
  bridge: { host: '127.0.0.1', port: '1025', sec: 'starttls' },
  gmail: { host: 'smtp.gmail.com', port: '587', sec: 'starttls' },
  outlook: { host: 'smtp-mail.outlook.com', port: '587', sec: 'starttls' },
  custom: {}
};
const smtpFrom = m =>
  m.user && (m.provider === 'proton' || m.provider === 'bridge')
    ? m.fromName
      ? m.fromName + ' <' + m.user + '>'
      : m.user
    : m.from;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UNIT_RE = /(\d+(?:[.,]\d+)?)\s?([pnµumkMG]?)(Ω|Hz|V|A|F|H|W)(?![A-Za-zæøåÆØÅ])/g;
const cellTex = s =>
  esc(s || '').replace(UNIT_RE, (m, n, p, u) => {
    const pk = p === 'µ' ? 'u' : p,
      pp = PFX.find(x => x.k === pk),
      uu = UNITS.find(x => x.s === u);
    return pp && uu ? qtyCode({ num: n, prefix: pk, unit: uu.k }) : m;
  });
const listItem = (r, tex) => {
  const c = r.map(x => (x || '').trim()).map(x => (tex ? cellTex(x) : x));
  const a = [c[0], c[1]].filter(Boolean).join(' ');
  return a + (c[2] ? (a ? ' ' : '') + '(' + c[2] + ')' : '');
};
const TZ2 = {
  R: 'R',
  resistor: 'R',
  'european resistor': 'R',
  'american resistor': 'R',
  vR: 'vR',
  'variable resistor': 'vR',
  C: 'C',
  capacitor: 'C',
  eC: 'eC',
  ecapacitor: 'eC',
  L: 'L',
  inductor: 'L',
  'cute inductor': 'L',
  'american inductor': 'L',
  fuse: 'fuse',
  piezoelectric: 'xtal',
  D: 'D',
  diode: 'D',
  'D*': 'D',
  zD: 'zD',
  'zD*': 'zD',
  sD: 'sD',
  'sD*': 'sD',
  led: 'led',
  leD: 'led',
  pD: 'pD',
  photodiode: 'pD',
  V: 'V',
  vsource: 'V',
  'american voltage source': 'V',
  'european voltage source': 'V',
  sV: 'sV',
  'sinusoidal voltage source': 'sV',
  vsourcesin: 'sV',
  I: 'I',
  isource: 'I',
  'american current source': 'I',
  battery1: 'bat',
  battery: 'bat',
  battery2: 'bat',
  nos: 'sw',
  switch: 'sw',
  spst: 'sw',
  'push button': 'btn',
  pushbutton: 'btn',
  nopb: 'btn',
  lamp: 'lamp',
  ammeter: 'am',
  voltmeter: 'vm'
};
const TZN = {
  'and port': 'and',
  'nand port': 'nand',
  'or port': 'or',
  'nor port': 'nor',
  'xor port': 'xor',
  'xnor port': 'xnor',
  'not port': 'not',
  'buffer port': 'buf',
  npn: 'npn',
  pnp: 'pnp',
  nmos: 'nmos',
  pmos: 'pmos',
  nfet: 'nmos',
  pfet: 'pmos',
  'op amp': 'opamp'
};
// Invers av cellTex: \qty{10}{\kilo\ohm} -> «10 kΩ».
const cellText = s =>
  unesc(
    s.replace(/\\qty\{([^}]*)\}\{([^}]*)\}/g, (m, n, us) => {
      const p = PFX.find(x => x.c && us.startsWith(x.c)),
        rest = p ? us.slice(p.c.length) : us,
        uu = UNITS.find(x => x.c === rest);
      return uu ? n + ' ' + (p ? p.s : '') + uu.s : m;
    })
  );
// Invers av listItem: «antall komponent (merknad)» -> [antall, komponent, merknad].
const listCells = s => {
  s = cellText(s);
  let note = '';
  const nm = s.match(/^(.*?)\s*\(([^()]*)\)$/);
  if (nm) {
    s = nm[1];
    note = nm[2];
  }
  const cm = s.match(/^(\d+(?:[.,]\d+)?(?:\s*stk\.)?)(?:\s+(.*))?$/);
  return cm ? [cm[1], cm[2] || '', note] : ['', s, note];
};
function splitTop(s) {
  const out = [];
  let d = 0,
    cur = '';
  for (const ch of s) {
    if (ch === '{' || ch === '[') d++;
    else if (ch === '}' || ch === ']') d--;
    if (ch === ',' && d === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const stripB = s => {
  s = (s || '').trim();
  while (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1).trim();
  return s;
};
function qtyFrom(s) {
  const m = (s || '').match(/\\(?:qty|SI)\{([^}]*)\}\{([^}]*)\}/);
  if (!m) return null;
  const us = m[2].trim(),
    p = PFX.find(x => x.c && us.startsWith(x.c)),
    rest = p ? us.slice(p.c.length) : us,
    uu = UNITS.find(x => x.c === rest);
  return uu ? { num: m[1].trim().replace('.', ','), prefix: p ? p.k : '', unit: uu.k } : null;
}
function texName(s) {
  s = stripB(s)
    .replace(/^\$|\$$/g, '')
    .trim();
  const ov = /^\\overline\{/.test(s);
  if (ov) s = s.replace(/^\\overline\{/, '').replace(/\}$/, '');
  const m = s.match(/^\\?([A-Za-z]+)\s*(?:_\{?([^}$]*)\}?)?/);
  return m ? { name: (ov ? '~' : '') + m[1], sub: (m[2] || '').trim() } : null;
}
function parseCircuit(src) {
  const warn = [];
  let s = src.replace(/%.*$/gm, '');
  const bm = s.match(/\\begin\{circuitikz\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{circuitikz\}/);
  if (bm) s = bm[1];
  const style = (src.match(/\\begin\{circuitikz\}\[([^\]]*)\]/) || [])[1];
  const comps = [],
    wires = [],
    named = {},
    coords = {};
  const EPS = 1e-6;
  const findTerm = (x, y) => {
    for (const c of comps) {
      const tm = terms(c);
      for (const k in tm) if (Math.abs(tm[k].x - x) < EPS && Math.abs(tm[k].y - y) < EPS) return { c: c.id, t: k };
    }
    return null;
  };
  const refOf = P => {
    if (P.ref) return P.ref;
    const f = findTerm(P.x, P.y);
    if (f) return f;
    const c = { id: uid(), type: 'pt', x: P.x, y: P.y, rot: 0, name: '', sub: '', val: null };
    comps.push(c);
    return { c: c.id, t: 'p' };
  };
  const wire = (A, B) => {
    const a = refOf(A),
      b = refOf(B);
    if (a.c === b.c && a.t === b.t) return;
    wires.push({ id: uid(), a, b });
  };
  const num = v => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const resolve = (inner, cur, rel) => {
    inner = inner.trim();
    const xy = inner.split(',');
    if (xy.length === 2 && num(xy[0]) != null && num(xy[1]) != null) {
      const x = num(xy[0]),
        y = -num(xy[1]);
      return rel && cur ? { x: cur.x + x, y: cur.y + y } : { x, y };
    }
    const dot = inner.lastIndexOf('.');
    if (dot > 0) {
      const nm = inner.slice(0, dot).trim(),
        an = inner.slice(dot + 1).trim(),
        c = named[nm];
      if (c) {
        const T = CT[c.type],
          pn = (T.pins || []).find(p => p[3] === an || p[0] === an);
        if (pn) {
          const p = terms(c)[pn[0]];
          return { x: p.x, y: p.y, ref: { c: c.id, t: pn[0] } };
        }
        warn.push('Ukjent anker ' + inner);
      }
    }
    if (coords[inner]) return { ...coords[inner] };
    const c = named[inner];
    if (c) {
      const p = Object.values(terms(c))[0];
      return { x: p.x, y: p.y };
    }
    warn.push('Ukjent koordinat (' + inner + ')');
    return null;
  };
  const stmts = s
    .split(';')
    .map(x => x.trim())
    .filter(Boolean);
  stmts.forEach(st => {
    const cm = st.match(/^\\coordinate\s*\(([^)]*)\)\s*at\s*\(([^)]*)\)/);
    if (cm) {
      const p = resolve(cm[2]);
      if (p) coords[cm[1].trim()] = p;
      return;
    }
    const nm = st.match(/^\\node\s*\[([^\]]*)\]\s*\(([^)]*)\)\s*at\s*\(([^)]*)\)/);
    if (!nm) return;
    const opts = splitTop(nm[1]);
    let type = null;
    opts.forEach(o => {
      const k = o.replace(/^(american|european|ieeestd|IEEE)\s+/, '').trim();
      if (TZN[k]) type = TZN[k];
    });
    if (!type) return;
    const T = CT[type],
      an = (opts.find(o => /^anchor\s*=/.test(o)) || '').split('=')[1];
    const at = resolve(nm[3]);
    if (!at) return;
    let dx = 0,
      dy = 0;
    const pn = an && T.pins.find(p => p[3] === an.trim());
    if (pn) {
      dx = pn[1];
      dy = pn[2];
    } else {
      dx = T.gate || type === 'opamp' ? 1.25 : 0.75;
    }
    const n = nm[2].trim(),
      mm = n.match(/^([A-Za-z]+)(.*)$/);
    const c = {
      id: uid(),
      type,
      x: at.x - dx,
      y: at.y - dy,
      rot: 0,
      name: mm ? mm[1] : T.p,
      sub: mm ? mm[2] : '',
      val: null,
      pinl: T.io ? {} : undefined
    };
    comps.push(c);
    named[n] = c;
  });
  const TOK =
    /(\+\+?)\s*\(([^()]*)\)|\(([^()]*)\)|to\s*\[([^\]]*)\]|(--|-\||\|-)|node\s*\[([^\]]*)\]\s*(?:\([^)]*\)\s*)?\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
  stmts.forEach(st => {
    if (!/^\\draw/.test(st)) return;
    let cur = null,
      op = null,
      oo = null,
      m;
    TOK.lastIndex = 0;
    const body = st.replace(/^\\draw\s*(\[[^\]]*\])?/, '');
    while ((m = TOK.exec(body))) {
      if (m[2] != null || m[3] != null) {
        const p = resolve(m[2] != null ? m[2] : m[3], cur, m[1] != null);
        if (!p) {
          cur = null;
          op = null;
          continue;
        }
        if (cur && op === 'to') addTwo(cur, p, oo);
        else if (cur && (op === '--' || op === '-|')) wire(cur, p);
        else if (cur && op === '|-') {
          const mid = { x: cur.x, y: p.y };
          wire(cur, mid);
          wire(mid, p);
        }
        cur = p;
        op = null;
      } else if (m[4] != null) {
        op = 'to';
        oo = m[4];
      } else if (m[5]) {
        op = m[5];
      } else if (m[6] != null && cur) {
        attach(cur, splitTop(m[6]), m[7] || '');
      }
    }
  });
  function addTwo(A, B, opts) {
    const ps = splitTop(opts);
    let type = null,
      lab = null,
      val = null;
    ps.forEach(o => {
      const eq = o.indexOf('=');
      if (eq < 0) {
        const k = o.trim();
        if (!type && TZ2[k]) type = TZ2[k];
        return;
      }
      const k = o.slice(0, eq).trim(),
        v = o.slice(eq + 1);
      if (/^l[_^]?$/.test(k)) {
        const q = qtyFrom(v);
        const t = stripB(v);
        if (q && !/=/.test(t)) val = q;
        else {
          lab = texName(t.split('=')[0]);
          if (q) val = q;
        }
      } else if (/^a[_^]?$/.test(k)) {
        const q = qtyFrom(v);
        if (q) val = q;
      }
    });
    if (!type) {
      if (ps[0] && ps[0] !== 'short') warn.push('Ukjent komponent «' + ps[0] + '», tegnet som ledning');
      wire(A, B);
      return;
    }
    const T = CT[type];
    const dx = B.x - A.x,
      dy = B.y - A.y;
    let c;
    if (Math.abs(dy) < EPS || (Math.abs(dx) >= EPS && Math.abs(dy) >= EPS)) {
      const y = A.y,
        x0 = Math.abs(dy) < EPS ? Math.min(A.x, B.x) : A.x,
        L = Math.abs(dy) < EPS ? Math.abs(dx) : 2;
      c = { id: uid(), type, x: x0 + (L > 2 ? (L - 2) / 2 : 0), y, rot: 0 };
      comps.push(c);
      const tm = terms(c);
      const left = Math.abs(dy) < EPS ? (A.x <= B.x ? A : B) : A,
        right = Math.abs(dy) < EPS ? (A.x <= B.x ? B : A) : B;
      if (Math.abs(left.x - tm.a.x) > EPS || left.ref) wire(left, { x: tm.a.x, y: tm.a.y, ref: { c: c.id, t: 'a' } });
      if (Math.abs(right.x - tm.b.x) > EPS || Math.abs(right.y - tm.b.y) > EPS || right.ref)
        wire({ x: tm.b.x, y: tm.b.y, ref: { c: c.id, t: 'b' } }, right);
    } else {
      const L = Math.abs(dy),
        y0 = Math.min(A.y, B.y);
      c = { id: uid(), type, x: A.x, y: y0 + (L > 2 ? (L - 2) / 2 : 0), rot: 1 };
      comps.push(c);
      const tm = terms(c);
      const top = A.y <= B.y ? A : B,
        bot = A.y <= B.y ? B : A;
      if (Math.abs(top.y - tm.a.y) > EPS || top.ref) wire(top, { x: tm.a.x, y: tm.a.y, ref: { c: c.id, t: 'a' } });
      if (Math.abs(bot.y - tm.b.y) > EPS || bot.ref) wire({ x: tm.b.x, y: tm.b.y, ref: { c: c.id, t: 'b' } }, bot);
    }
    c.name = lab ? lab.name : '';
    c.sub = lab ? lab.sub : '';
    c.val = val || (T.val && !lab ? null : null);
    if (!lab && !val && T.p) c.auto = 1;
  }
  function attach(P, opts, text) {
    const f = (opts[0] || '').trim();
    if (/ground$/.test(f)) {
      comps.push({ id: uid(), type: 'gnd', x: P.x, y: P.y, rot: 0, name: '', sub: '', val: null });
      return;
    }
    if (f === 'vcc' || f === 'vdd' || f === 'vee' || f === 'vss') {
      comps.push({
        id: uid(),
        type: f === 'vee' || f === 'vss' ? 'vee' : 'vcc',
        x: P.x,
        y: P.y,
        rot: 0,
        name: '',
        sub: '',
        val: qtyFrom(text) || { num: '5', prefix: '', unit: 'V' }
      });
      return;
    }
    if (/^o?circ$/.test(f) || !text.trim()) return;
    const r = P.ref && comps.find(c => c.id === P.ref.c);
    if (r && CT[r.type].io) {
      r.pinl = r.pinl || {};
      const cur = r.pinl[P.ref.t] || {};
      if (opts.some(o => /font/.test(o)) || /^\d+$/.test(stripB(text))) cur.pin = stripB(text);
      else {
        const tn = texName(text);
        if (tn) cur.name = tn.name + (tn.sub ? '_' + tn.sub : '');
      }
      r.pinl[P.ref.t] = cur;
      return;
    }
    const tn = texName(text);
    if (tn) comps.push({ id: uid(), type: 'net', x: P.x, y: P.y, rot: 0, name: tn.name, sub: tn.sub, val: null });
  }
  const cnt = {};
  comps.forEach(c => {
    const T = CT[c.type];
    if (c.auto && T.p) {
      cnt[T.p] = (cnt[T.p] || 0) + 1;
      c.name = T.p;
      c.sub = String(cnt[T.p]);
      delete c.auto;
    }
  });
  const real = comps.filter(c => c.type !== 'pt');
  if (!real.length && !wires.length)
    return { data: null, warn: warn.length ? warn : ['Fant ingen \\draw- eller \\node-kommandoer.'], style };
  let mx = 1e9,
    my = 1e9;
  comps.forEach(c => {
    const b = cbox({ comps: [c], wires: [] });
    mx = Math.min(mx, b.x0);
    my = Math.min(my, b.y0);
  });
  const sx = 1 - Math.round(mx * 2) / 2,
    sy = 1 - Math.round(my * 2) / 2;
  comps.forEach(c => {
    c.x += sx;
    c.y += sy;
  });
  return { data: { comps, wires }, warn, style, count: real.length };
}
function autoLayout(d) {
  const comps = d.comps.map(c => ({ ...c }));
  if (comps.length < 2) return d;
  const B = {};
  comps.forEach(c => (B[c.id] = c));
  const K = c => {
    if (c.type === 'gnd' || c.type === 'vee') return 'bot';
    if (c.type === 'vcc') return 'top';
    const T = CT[c.type] || CT.R;
    if (T.two) return 'two';
    if (c.type === 'pt' || c.type === 'net') return 'node';
    return 'dir';
  };
  const IN = new Set(['in1', 'in2', 'm', 'p', 'B', 'G']),
    isSrc = c => ['V', 'sV', 'I', 'bat'].includes(c.type),
    isInput = c => isSrc(c) || ['btn', 'sw'].includes(c.type),
    rail = c => K(c) === 'bot' || K(c) === 'top';
  const W = d.wires.filter(w => B[w.a.c] && B[w.b.c] && w.a.c !== w.b.c);
  const nbr = {};
  comps.forEach(c => (nbr[c.id] = []));
  W.forEach(w => {
    nbr[w.a.c].push({ o: w.b.c, my: w.a.t, th: w.b.t });
    nbr[w.b.c].push({ o: w.a.c, my: w.b.t, th: w.a.t });
  });
  const core = comps.filter(c => !rail(c));
  const shunt = new Set(
    core
      .filter(
        c => K(c) === 'two' && !isSrc(c) && nbr[c.id].some(n => rail(B[n.o])) && nbr[c.id].some(n => !rail(B[n.o]))
      )
      .map(c => c.id)
  );
  const lonely = core.filter(c => !shunt.has(c.id) && !nbr[c.id].some(n => !rail(B[n.o]) && !shunt.has(n.o)));
  const lone = new Set(lonely.map(c => c.id));
  const main = core.filter(c => !shunt.has(c.id) && !lone.has(c.id));
  const dist = {},
    q = [];
  let starts = main.filter(isInput);
  if (!starts.length) starts = main.filter(c => !nbr[c.id].some(n => IN.has(n.my)));
  if (!starts.length && main.length) starts = [main[0]];
  starts.forEach(c => {
    dist[c.id] = 0;
    q.push(c.id);
  });
  while (q.length) {
    const x = q.shift();
    nbr[x].forEach(n => {
      const o = B[n.o];
      if (dist[n.o] == null && !shunt.has(n.o) && !rail(o) && !lone.has(n.o)) {
        dist[n.o] = dist[x] + 1;
        q.push(n.o);
      }
    });
  }
  main.forEach(c => {
    if (dist[c.id] == null) dist[c.id] = 0;
  });
  const E = [];
  W.forEach(w => {
    const a = B[w.a.c],
      b = B[w.b.c];
    if (!main.includes(a) || !main.includes(b)) return;
    let e;
    if (K(b) === 'dir' && IN.has(w.b.t)) e = [a, b, w.a.t, w.b.t];
    else if (K(a) === 'dir' && IN.has(w.a.t)) e = [b, a, w.b.t, w.a.t];
    else if (K(a) === 'dir') e = [a, b, w.a.t, w.b.t];
    else if (K(b) === 'dir') e = [b, a, w.b.t, w.a.t];
    else e = dist[a.id] <= dist[b.id] ? [a, b, w.a.t, w.b.t] : [b, a, w.b.t, w.a.t];
    if (isInput(e[1]) && !isInput(e[0])) e = [e[1], e[0], e[3], e[2]];
    E.push({ u: e[0].id, v: e[1].id, tu: e[2], tv: e[3] });
  });
  const L = {};
  main.forEach(c => (L[c.id] = 0));
  for (let it = 0; it <= main.length; it++) {
    let ch = false;
    E.forEach(e => {
      if (isInput(B[e.v])) return;
      if (L[e.v] < L[e.u] + 1 && L[e.u] < main.length) {
        L[e.v] = L[e.u] + 1;
        ch = true;
      }
    });
    if (!ch) break;
  }
  const layers = [];
  main.forEach(c => {
    (layers[L[c.id]] = layers[L[c.id]] || []).push(c);
  });
  for (let i = 0; i < layers.length; i++) layers[i] = layers[i] || [];
  main.forEach(c => {
    if (K(c) !== 'two') return;
    if (isSrc(c)) {
      c.rot = 1;
      return;
    }
    const inc = E.filter(e => e.v === c.id).map(e => e.tv);
    c.rot = inc.includes('a') && inc.includes('b') ? 1 : 0;
  });
  shunt.forEach(id => (B[id].rot = 1));
  const ext1 = c => cbox({ comps: [{ ...c, x: 0, y: 0 }], wires: [] });
  const wid = c => {
    const b = ext1(c);
    return Math.max(0.5, b.x1 - Math.min(0, b.x0));
  };
  const hasSh = c => nbr[c.id].some(n => shunt.has(n.o));
  let x = 1;
  const colX = [];
  layers.forEach((ly, i) => {
    colX[i] = x;
    x += Math.max(0.5, ...ly.map(c => (K(c) === 'two' && c.rot ? 1.2 : wid(c)))) + (ly.some(hasSh) ? 1.5 : 1);
  });
  const off = (c, t) => terms({ ...c, x: 0, y: 0 })[t] || { x: 0, y: 0 };
  layers.forEach((ly, i) => {
    ly.forEach((c, j) => {
      c.x = colX[i] + (K(c) === 'two' && c.rot ? 0.5 : 0);
      const ins = E.filter(e => e.v === c.id && L[e.u] < i && B[e.u].y != null && B[e.u]._placed);
      c._d = ins.length
        ? ins.reduce((s, e) => s + terms(B[e.u])[e.tu].y - off(c, e.tv).y, 0) / ins.length
        : i === 0
          ? j * 3.5
          : 1e3 + j;
    });
    ly.sort((a, b) => a._d - b._d);
    let bottom = -1e9;
    ly.forEach(c => {
      const b = ext1(c);
      let y = Math.max(c._d < 1e3 ? c._d : bottom - b.y0 + 0.5, bottom - b.y0 + 0.5);
      if (!isFinite(y)) y = 1;
      y = Math.round(y * 2) / 2;
      c.y = y;
      c._placed = 1;
      bottom = y + b.y1 + (hasSh(c) ? 3 : 0);
    });
  });
  const used = {};
  shunt.forEach(id => {
    const s = B[id];
    const n = nbr[id].find(k => !rail(B[k.o]));
    const o = B[n.o];
    if (o.x == null) return;
    const p = terms(o)[n.th];
    const key = p.x + ',' + p.y;
    const k = (used[key] = (used[key] || 0) + 1);
    s.x = p.x + (k - 1) * 1.5;
    s.y = p.y + 1;
    s._placed = 1;
  });
  let mx = Math.max(
    1,
    ...main
      .concat([...shunt].map(i => B[i]))
      .filter(c => c._placed)
      .map(c => c.x + wid(c))
  );
  lonely.forEach((c, j) => {
    c.x = mx + 2;
    c.y = 1 + j * 2.5;
    c._placed = 1;
  });
  comps.filter(rail).forEach((r, j) => {
    const ps = nbr[r.id].map(n => (B[n.o]._placed ? terms(B[n.o])[n.th] : null)).filter(Boolean);
    if (!ps.length) {
      r.x = mx + 4;
      r.y = 1 + j * 1.5;
      return;
    }
    if (K(r) === 'top') {
      const p = ps.reduce((a, b) => (b.y < a.y ? b : a));
      r.x = p.x;
      r.y = p.y - 1;
    } else {
      const p = ps.reduce((a, b) => (b.y > a.y ? b : a));
      r.x = p.x;
      r.y = p.y + 1;
    }
  });
  const bb = cbox({ comps, wires: [] });
  const dx = 0.5 - Math.floor(bb.x0 * 2) / 2,
    dy = 0.5 - Math.floor(bb.y0 * 2) / 2;
  comps.forEach(c => {
    c.x = Math.round((c.x + dx) * 2) / 2;
    c.y = Math.round((c.y + dy) * 2) / 2;
    delete c._d;
    delete c._placed;
  });
  return { ...d, comps };
}

export { sha256, figPreamble, figKey, extractFigures } from './figures.js';
export {
  cellText,
  listCells,
  ACC,
  ACCL,
  ACCB,
  HL,
  PFX,
  UNITS,
  SYMS,
  MACROS,
  V0,
  P2,
  P1,
  CT,
  PAL,
  PINLBL,
  PINPH,
  pinTex,
  iconVB,
  USERS,
  KIND,
  GROUPS,
  TPLS,
  uid,
  clone,
  clean,
  now,
  t,
  u,
  sy,
  rf,
  pf,
  un,
  fmtNum,
  qtyText,
  qtyCode,
  esc,
  symCode,
  segTex,
  norm,
  slug,
  terms,
  gname,
  ext,
  cbox,
  circLines,
  tok,
  preamble,
  docCode,
  numberDoc,
  plain,
  paginate,
  diode,
  gamepad,
  skeleton,
  makeDocs,
  DEF_SET,
  DEF_DUCK,
  DEF_SMB,
  DEF_DEP,
  DUCK_RE,
  TOKEN_RE,
  tokSh,
  tokSh0,
  unesc,
  parseInline,
  parseBlock,
  qtyBack,
  cellBack,
  wsn,
  parseDoc,
  escH,
  texLabels,
  texMacros,
  readGroup,
  readOpt,
  findEnd,
  tx_splitTop,
  SI_UNIT,
  DROP,
  texRender,
  rawHtml,
  ENV_BUILTIN,
  ENV_PKG,
  MATH_ENV,
  AMP_ENV,
  lintTex,
  ACCOUNTS,
  ADMIN_TABS,
  DEF_UPD,
  RELEASES,
  vcmp,
  DEF_SMTP,
  PROTON_FREE,
  SMTP_PRESETS,
  smtpFrom,
  EMAIL_RE,
  UNIT_RE,
  cellTex,
  listItem,
  TZ2,
  TZN,
  splitTop,
  stripB,
  qtyFrom,
  texName,
  parseCircuit,
  autoLayout
};
