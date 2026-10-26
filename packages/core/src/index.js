// Opprinnelig løftet fra prototypen (tools/extract-prototype.mjs). Ren logikk uten DOM.
/* eslint-disable */
const ACC = 'oklch(0.52 0.15 250)',
  ACCL = 'oklch(0.95 0.03 250)',
  ACCB = 'oklch(0.86 0.06 250)',
  HL = 'oklch(0.93 0.04 250)';
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
const KIND = { abstract: 'abs', h1: '§', h2: '§§', p: '¶', eq: 'eq', fig: 'fig', img: 'img', table: 'tab' };
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
  s.t === 'text' ? esc(s.v) : s.t === 'unit' ? qtyCode(s) : s.t === 'sym' ? symCode(s) : `\\cref{${s.target}}`;
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
    re = /(\\[a-zA-Z]+|%.*$|\$[^$]*\$)/g;
  let last = 0,
    m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), c: '#3d3a36' });
    const x = m[0];
    let c;
    if (x[0] === '%') c = '#a29e97';
    else if (x[0] === '$') c = 'oklch(0.5 0.13 150)';
    else if (/^\\(qty|unit|num|cref|Cref|label|ref|caption)$/.test(x)) c = 'oklch(0.5 0.15 250)';
    else if (
      /^\\(ohm|volt|ampere|watt|farad|henry|hertz|second|siemens|decibel|coulomb|joule|kelvin|degree|kilo|mega|giga|milli|micro|nano|pico)$/.test(
        x
      )
    )
      c = 'oklch(0.52 0.15 30)';
    else c = 'oklch(0.48 0.15 300)';
    out.push({ t: x, c });
    last = m.index + x.length;
  }
  if (last < s.length) out.push({ t: s.slice(last), c: '#3d3a36' });
  if (!out.length) out.push({ t: ' ', c: '#3d3a36' });
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
function docCode(doc, S) {
  const L = [],
    P = (s, bid) => L.push({ s, bid: bid || null });
  preamble(S).forEach(s => P(s));
  P('');
  P(`\\title{${esc(doc.title)}}`);
  P(`\\author{${esc(doc.authors)}\\\\${esc(doc.group)}}`);
  P('\\date{}');
  P('\\begin{document}');
  P('\\maketitle');
  doc.blocks.forEach(b => {
    const i = b.id;
    P('', null);
    if (b.type === 'abstract') {
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
  sync: true
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
  if (/^\s*(#|<!--)/.test(s)) return [{ t: s, c: '#a29e97' }];
  const m = s.match(/^(\s*)([A-Z_][A-Z0-9_]*)(=)(.*)$/);
  if (m)
    return [
      { t: m[1] + m[2], c: 'oklch(0.5 0.15 250)' },
      { t: '=', c: '#3d3a36' },
      { t: m[4] || ' ', c: 'oklch(0.5 0.13 150)' }
    ];
  const out = [],
    re = /(<\/?[A-Za-z?][^>]*>|"[^"]*")/g;
  let last = 0,
    mm;
  while ((mm = re.exec(s))) {
    if (mm.index > last) out.push({ t: s.slice(last, mm.index), c: '#3d3a36' });
    out.push({ t: mm[0], c: mm[0][0] === '<' ? 'oklch(0.48 0.15 300)' : 'oklch(0.5 0.13 150)' });
    last = mm.index + mm[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), c: '#3d3a36' });
  return out.length ? out : [{ t: ' ', c: '#3d3a36' }];
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
      return { segs: parseInline(body.replace(/\s*\n\s*/g, ' ')) };
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
const ACCOUNTS = [
  { id: 'SK', name: 'Sebastian Kristoffersen', email: 'sebastian@kristo.no', admin: true },
  { id: 'MH', name: 'Mia Hansen', email: 'mia.hansen@student.no', admin: false },
  { id: 'EL', name: 'Emil Larsen', email: 'emil.larsen@student.no', admin: false }
];
const ADMIN_TABS = ['server', 'duck', 'backup', 'smtp', 'install'];
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
  unesc,
  parseInline,
  parseBlock,
  ACCOUNTS,
  ADMIN_TABS,
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
