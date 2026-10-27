// Opprinnelig løftet fra prototypen (tools/extract-prototype.mjs). Kretssymboler som SVG (React-elementer).
/* eslint-disable */
import React from 'react';
import {
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
  citeSeg,
  MATH,
  SPELL_NB,
  SPELL_EN,
  parseCSV,
  parseGrid,
  plotSvg,
  plotLines,
  citeNums,
  bibTxt,
  bibList,
  bibKey,
  parseBibtex,
  toBibtex,
  wdiff,
  blockTxt,
  textFields,
  SP_LINE,
  isSpice,
  SPU,
  SPP,
  spiceVal,
  spiceToTikz,
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
} from '@kobling/core';
function symEls(type, style, paper, col) {
  const h = React.createElement,
    P = (d, k) => h('path', { key: k, d }),
    bub = x => h('circle', { key: 'o', cx: x, cy: 0, r: 4, fill: paper }),
    txt = (s, x, y, fs) =>
      h(
        'text',
        {
          key: 't' + s,
          x,
          y,
          fontSize: fs || 15,
          textAnchor: 'middle',
          fill: col,
          stroke: 'none',
          fontFamily: 'STIX Two Text, serif'
        },
        s
      );
  const AND = 'M20 -28h26a28 28 0 0 1 0 56h-26z',
    OR = 'M16 -28q16 28 0 56q36 0 58 -28q-22 -28 -58 -28z',
    zig = h('polyline', { key: 'z', points: '0,0 20,0 23.3,-7 30,7 36.7,-7 43.3,7 50,-7 56.7,7 60,0 80,0' }),
    rbox = [P('M0 0H22M58 0H80', 'l'), h('rect', { key: 'r', x: 22, y: -7, width: 36, height: 14, fill: paper })];
  const diode = bar => [
    h('polygon', { key: 't', points: '30,-10 30,10 50,0', fill: paper }),
    P('M0 0H30M50 0H80' + bar, 'l')
  ];
  switch (type) {
    case 'R':
      return style === 'european' ? rbox : [zig];
    case 'vR':
      return [...(style === 'european' ? rbox : [zig]), P('M22 14L58 -14M58 -14l-8 1M58 -14l-2 8', 'a')];
    case 'C':
      return [P('M0 0H36M44 0H80M36 -12V12M44 -12V12', 'c')];
    case 'eC':
      return [P('M0 0H36M47 0H80M36 -12V12M27 -10H33M30 -13V-7', 'c'), P('M50 -12q-6 12 0 24', 'k')];
    case 'L':
      return [P('M0 0H20a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0H80', 'l')];
    case 'fuse':
      return [P('M0 0H80', 'l'), h('rect', { key: 'r', x: 22, y: -6, width: 36, height: 12, fill: 'none' })];
    case 'xtal':
      return [
        P('M0 0H30M50 0H80M30 -12V12M50 -12V12', 'l'),
        h('rect', { key: 'r', x: 34, y: -9, width: 12, height: 18, fill: paper })
      ];
    case 'D':
      return diode('M50 -10V10');
    case 'zD':
      return diode('M46 -13L50 -10V10L54 13');
    case 'sD':
      return diode('M45 -6V-10H50V10H55V6');
    case 'led':
      return diode('M50 -10V10M40 -13l6 -8M47 -11l6 -8');
    case 'pD':
      return diode('M50 -10V10M56 -24l-7 9M49 -26l-7 9');
    case 'V':
      return [
        h('circle', { key: 'c', cx: 40, cy: 0, r: 16, fill: paper }),
        P('M0 0H24M56 0H80M28 0H34M31 -3V3M46 0H52', 'l')
      ];
    case 'sV':
      return [
        h('circle', { key: 'c', cx: 40, cy: 0, r: 16, fill: paper }),
        P('M0 0H24M56 0H80M30 0q5 -9 10 0t10 0', 'l')
      ];
    case 'I':
      return [
        h('circle', { key: 'c', cx: 40, cy: 0, r: 16, fill: paper }),
        P('M0 0H24M56 0H80M30 0H50M50 0l-6 -5M50 0l-6 5', 'l')
      ];
    case 'bat':
      return [P('M0 0H37M43 0H80M37 -14V14', 'l'), h('path', { key: 's', d: 'M43 -7V7', strokeWidth: 3 })];
    case 'sw':
      return [
        P('M0 0H31.5M48.5 0H80M36 -2L50 -13', 'l'),
        h('circle', { key: 'a', cx: 34, cy: 0, r: 2.5, fill: paper }),
        h('circle', { key: 'b', cx: 46, cy: 0, r: 2.5, fill: paper })
      ];
    case 'btn':
      return [
        P('M0 0H31.5M48.5 0H80M30 -9H50M40 -9V-15', 'l'),
        h('circle', { key: 'a', cx: 34, cy: 0, r: 2.5, fill: paper }),
        h('circle', { key: 'b', cx: 46, cy: 0, r: 2.5, fill: paper })
      ];
    case 'lamp':
      return [
        h('circle', { key: 'c', cx: 40, cy: 0, r: 14, fill: paper }),
        P('M0 0H26M54 0H80M30 -10L50 10M50 -10L30 10', 'l')
      ];
    case 'am':
    case 'vm':
      return [
        h('circle', { key: 'c', cx: 40, cy: 0, r: 14, fill: paper }),
        P('M0 0H26M54 0H80', 'l'),
        txt(type === 'am' ? 'A' : 'V', 40, 5, 14)
      ];
    case 'npn':
      return [
        P('M0 0H38M38 -18V18M38 -8L60 -24V-40M38 8L60 24V40', 'l'),
        h('polygon', { key: 'a', points: '56,21 46.3,18.9 51.1,12.5', fill: col })
      ];
    case 'pnp':
      return [
        P('M0 0H38M38 -18V18M38 -8L60 -24V-40M38 8L60 24V40', 'l'),
        h('polygon', { key: 'a', points: '44,-12.4 47.9,-18.9 51.5,-14.1', fill: col })
      ];
    case 'nmos':
      return [
        P('M0 0H32M32 -16V16M40 -22V22M40 -14H60V-40M40 14H60V40', 'l'),
        h('polygon', { key: 'a', points: '41,14 50,10 50,18', fill: col })
      ];
    case 'pmos':
      return [
        P('M0 0H25M32 -16V16M40 -22V22M40 -14H60V-40M40 14H60V40', 'l'),
        h('circle', { key: 'o', cx: 28.5, cy: 0, r: 3.5, fill: paper }),
        h('polygon', { key: 'a', points: '58,-14 49,-18 49,-10', fill: col })
      ];
    case 'opamp':
      return [
        h('polygon', { key: 'b', points: '16,-40 16,40 86,0', fill: paper }),
        P('M0 -20H16M0 20H16M86 0H100', 'l'),
        txt('−', 26, -15, 14),
        txt('+', 26, 25, 14)
      ];
    case 'and':
      return [P('M0 -20H20M0 20H20M74 0H100', 'l'), h('path', { key: 'b', d: AND, fill: paper })];
    case 'nand':
      return [P('M0 -20H20M0 20H20M82 0H100', 'l'), h('path', { key: 'b', d: AND, fill: paper }), bub(78)];
    case 'or':
      return [P('M0 -20H22M0 20H22M74 0H100', 'l'), h('path', { key: 'b', d: OR, fill: paper })];
    case 'nor':
      return [P('M0 -20H22M0 20H22M82 0H100', 'l'), h('path', { key: 'b', d: OR, fill: paper }), bub(78)];
    case 'xor':
      return [P('M0 -20H22M0 20H22M74 0H100M8 -28q16 28 0 56', 'l'), h('path', { key: 'b', d: OR, fill: paper })];
    case 'xnor':
      return [
        P('M0 -20H22M0 20H22M82 0H100M8 -28q16 28 0 56', 'l'),
        h('path', { key: 'b', d: OR, fill: paper }),
        bub(78)
      ];
    case 'not':
      return [
        P('M0 0H24M76 0H100', 'l'),
        h('polygon', { key: 'b', points: '24,-22 24,22 68,0', fill: paper }),
        bub(72)
      ];
    case 'buf':
      return [P('M0 0H24M68 0H100', 'l'), h('polygon', { key: 'b', points: '24,-22 24,22 68,0', fill: paper })];
    case 'gnd':
      return [P('M0 0V10M-10 10H10M-6 15H6M-2 20H2', 'g')];
    case 'vcc':
      return [P('M0 0V-16M-6 -9L0 -17L6 -9', 'v')];
    case 'vee':
      return [P('M0 0V16M-6 9L0 17L6 9', 'v')];
    case 'net':
      return [P('M0 0H10', 'n')];
    case 'pt':
      return [];
  }
  return [];
}
function drawCircuit(d, o) {
  const h = React.createElement,
    S = 40,
    pad = o.pad || 0,
    X = v => pad + v * S,
    ink = 'var(--k1f1e1c,#1f1e1c)',
    paper = 'var(--kfff,#fff)',
    serif = 'STIX Two Text, serif';
  const m = {};
  d.comps.forEach(c => (m[c.id] = c));
  const tp = r => {
    const c = m[r.c];
    return c ? terms(c)[r.t] : null;
  };
  const els = [],
    counts = {},
    kk = p => p.x + ',' + p.y;
  d.wires.forEach(w => {
    const a = tp(w.a),
      b = tp(w.b);
    if (!a || !b) return;
    [a, b].forEach(p => (counts[kk(p)] = (counts[kk(p)] || 0) + 1));
    const dd = 'M' + X(a.x) + ' ' + X(a.y) + 'H' + X(b.x) + 'V' + X(b.y);
    const sel = o.sel === 'w:' + w.id;
    els.push(h('path', { key: w.id, d: dd, stroke: sel ? ACC : ink, strokeWidth: sel ? 2.2 : 1.4 }));
    if (o.interactive)
      els.push(
        h('path', {
          key: w.id + 'h',
          d: dd,
          stroke: 'transparent',
          strokeWidth: 12,
          style: { cursor: 'pointer' },
          onPointerDown: e => {
            e.stopPropagation();
            o.onWire(w.id);
          }
        })
      );
  });
  Object.entries(counts).forEach(([k, n]) => {
    if (n >= 2) {
      const [x, y] = k.split(',').map(Number);
      els.push(h('circle', { key: 'j' + k, cx: X(x), cy: X(y), r: 2.8, fill: ink, stroke: 'none' }));
    }
  });
  const nameEls = (n, ital) => {
    const ov = n.startsWith('~'),
      s = ov ? n.slice(1) : n,
      [b, sub] = s.split('_');
    return [
      h('tspan', { key: 'b', fontStyle: ital ? 'italic' : 'normal', textDecoration: ov ? 'overline' : undefined }, b),
      sub ? h('tspan', { key: 's', fontSize: 9, dy: 3 }, sub) : null,
      sub ? h('tspan', { key: 'r', dy: -3 }, '') : null
    ];
  };
  d.comps.forEach(c => {
    const T = CT[c.type] || CT.R,
      sel = o.sel === c.id,
      col = sel ? ACC : ink;
    const tr = 'translate(' + X(c.x) + ' ' + X(c.y) + ')' + (T.two && c.rot ? ' rotate(90)' : '');
    const kids = symEls(c.type, o.style, paper, col);
    if (o.interactive) {
      let hb;
      if (T.two) hb = { x: -4, y: -18, width: 88, height: 36 };
      else if (c.type === 'gnd') hb = { x: -13, y: -4, width: 26, height: 28 };
      else if (c.type === 'vcc') hb = { x: -13, y: -22, width: 26, height: 28 };
      else if (c.type === 'vee') hb = { x: -13, y: -4, width: 26, height: 28 };
      else if (c.type === 'net') hb = { x: -4, y: -12, width: 70, height: 24 };
      else if (c.type === 'pt') hb = { x: -6, y: -6, width: 12, height: 12 };
      else {
        const e = ext(T);
        hb = {
          x: e.mnx * S - 4,
          y: (e.mny - 0.8) * S,
          width: (e.mxx - e.mnx) * S + 8,
          height: (e.mxy - e.mny + 1.6) * S
        };
      }
      kids.push(
        h('rect', {
          key: 'hit',
          ...hb,
          fill: 'transparent',
          stroke: sel ? ACC : 'none',
          strokeDasharray: '3 3',
          strokeWidth: 1
        })
      );
    }
    els.push(
      h(
        'g',
        {
          key: c.id,
          transform: tr,
          stroke: col,
          strokeWidth: sel ? 1.8 : 1.4,
          style: o.interactive ? { cursor: o.tool === 'wire' ? 'crosshair' : 'move' } : undefined,
          onPointerDown: o.interactive ? e => o.onComp(e, c.id) : undefined
        },
        kids
      )
    );
    let lx,
      ly,
      anchor = 'middle';
    if (T.two) {
      if (c.rot) {
        lx = X(c.x) + 22;
        ly = X(c.y) + 44;
        anchor = 'start';
      } else {
        lx = X(c.x) + 40;
        ly = X(c.y) - 15;
      }
    } else if (T.gate) {
      lx = X(c.x) + 46;
      ly = X(c.y) - 36;
    } else if (c.type === 'opamp') {
      lx = X(c.x) + 46;
      ly = X(c.y) - 48;
    } else if (T.pins.length === 3) {
      lx = X(c.x) + 70;
      ly = X(c.y) + 5;
      anchor = 'start';
    } else if (c.type === 'vcc') {
      lx = X(c.x);
      ly = X(c.y) - 23;
    } else if (c.type === 'vee') {
      lx = X(c.x);
      ly = X(c.y) + 33;
    } else if (c.type === 'net') {
      lx = X(c.x) + 14;
      ly = X(c.y) + 5;
      anchor = 'start';
    }
    if (lx != null && (c.name || c.val)) {
      let parts = [];
      if (c.type === 'vcc' || c.type === 'vee')
        parts = [h('tspan', { key: 'v' }, (c.type === 'vcc' ? '+' : '−') + qtyText(c.val, o.dec))];
      else if (c.type === 'net') parts = nameEls(c.name + (c.sub ? '_' + c.sub : ''), true);
      else {
        if (c.name)
          parts.push(
            h(
              'tspan',
              { key: 'n', fontStyle: T.gate || T.pins ? 'normal' : 'italic', fontWeight: T.gate ? 600 : 400 },
              c.name
            )
          );
        if (c.sub) parts.push(h('tspan', { key: 's', fontSize: 9, dy: 3 }, c.sub));
        if (c.ic)
          parts.push(h('tspan', { key: 'ic', fontSize: 10, fill: '#8d8982', dy: c.sub ? -3 : 0 }, '\u2002' + c.ic));
        if (c.val) parts.push(h('tspan', { key: 'v', dy: c.sub && !c.ic ? -3 : 0 }, '\u2002' + qtyText(c.val, o.dec)));
      }
      els.push(
        h(
          'text',
          {
            key: c.id + 'l',
            x: lx,
            y: ly,
            textAnchor: anchor,
            fontSize: 13,
            fill: col,
            stroke: 'none',
            fontFamily: serif,
            style: { pointerEvents: 'none', userSelect: 'none' }
          },
          parts
        )
      );
    }
    if (T.io && c.pinl)
      T.pins.forEach(([k, dx, dy]) => {
        const pl = c.pinl[k];
        if (!pl) return;
        const px = X(c.x + dx),
          py = X(c.y + dy),
          left = dx === 0;
        if (pl.name)
          els.push(
            h(
              'text',
              {
                key: c.id + k + 'n',
                x: left ? px - 6 : px + 6,
                y: py + 4,
                textAnchor: left ? 'end' : 'start',
                fontSize: 13,
                fill: col,
                stroke: 'none',
                fontFamily: serif,
                style: { pointerEvents: 'none' }
              },
              nameEls(pl.name, true)
            )
          );
        if (pl.pin)
          els.push(
            h(
              'text',
              {
                key: c.id + k + 'p',
                x: left ? px + 7 : px - 7,
                y: py - 4,
                textAnchor: left ? 'start' : 'end',
                fontSize: 9,
                fill: '#8d8982',
                stroke: 'none',
                style: { pointerEvents: 'none' }
              },
              pl.pin
            )
          );
      });
    if (o.interactive && (o.tool === 'wire' || sel)) {
      Object.entries(terms(c)).forEach(([k, p]) => {
        const pend = o.pending && o.pending.c === c.id && o.pending.t === k;
        els.push(
          h('circle', {
            key: c.id + k,
            cx: X(p.x),
            cy: X(p.y),
            r: pend ? 6 : 5,
            fill: pend ? ACC : '#fff',
            stroke: ACC,
            strokeWidth: 1.5,
            style: { cursor: 'crosshair' },
            onPointerDown: e => {
              e.stopPropagation();
              o.onTerm(c.id, k);
            }
          })
        );
      });
    }
  });
  if (o.interactive)
    return h(
      'svg',
      {
        width: '100%',
        height: '100%',
        style: { display: 'block', position: 'absolute', inset: 0, touchAction: 'none' },
        fill: 'none',
        onPointerDown: o.onBg
      },
      els
    );
  const b = cbox(d);
  const vw = (b.x1 - b.x0) * S,
    vh = (b.y1 - b.y0) * S;
  return h(
    'svg',
    {
      viewBox: b.x0 * S + ' ' + b.y0 * S + ' ' + vw + ' ' + vh,
      fill: 'none',
      style: {
        display: 'block',
        width: Math.round(vw * o.k) + 'px',
        maxWidth: '100%',
        height: 'auto',
        maxHeight: o.maxH ? o.maxH + 'px' : undefined
      }
    },
    els
  );
}

export { symEls, drawCircuit };
