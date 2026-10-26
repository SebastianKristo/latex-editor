// LaTeX → dokument: leser et helt main.tex (eller et innlimt utdrag) tilbake til blokker.
// Hver bit prøves som en kjent blokktype; den brukes bare hvis koden vi genererer for den blir lik
// det som står der (bortsett fra mellomrom). Ellers blir biten en «raw»-blokk som skrives ut uendret.
// Slik går ingenting tapt, og vanlige endringer (tekst, overskrifter, enheter, tabeller) blir redigerbare.
import { docCode, preamble, parseBlock, parseInline, parseCircuit, segTex, unesc, uid } from './index.js';

const SECTION = /^\\(section|subsection)\*?\s*(\[[^\]]*\])?\s*\{/;
const BLOCK_START = /^\s*(\\begin\{|\\(sub)*section\*?\s*[[{]|\\(chapter|paragraph)\b|%)/;
// Sammenligner kode uten å bry seg om mellomrom eller om indekser står i klammer (R_1 = R_{1}).
const norm = s => s.replace(/_\{([A-Za-z0-9])\}/g, '_$1').replace(/\s+/g, ' ').trim();

// Finner slutten på en {…}-gruppe som starter på posisjon i (ved «{»).
function braceEnd(s, i) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue }
    if (c === '{') d++;
    else if (c === '}' && --d === 0) return j;
  }
  return -1;
}

// \cmd{…} med balanserte klammer; gir { inner, start, end } eller null
function command(s, name) {
  const m = new RegExp('\\\\' + name + '\\s*\\{').exec(s);
  if (!m) return null;
  const open = m.index + m[0].length - 1, close = braceEnd(s, open);
  return close < 0 ? null : { inner: s.slice(open + 1, close), start: m.index, end: close + 1 };
}

const lineAt = (text, pos) => text.slice(0, pos).split('\n').length;

// Deler kroppen i biter: miljøer, overskrifter, kommentarer og avsnitt (skilt med tom linje).
function chunks(body, line0) {
  const out = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    const rest = body.slice(i), start = i;
    let end;
    const env = rest.match(/^\\begin\{([^}]+)\}/);
    if (env) {
      const name = env[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('\\\\(begin|end)\\{' + name + '\\}', 'g');
      let d = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(rest))) { if (m[1] === 'begin') d++; else if (--d === 0) break }
      if (!m) throw new Error(`Linje ${line0 + lineAt(body, i) - 1}: \\begin{${env[1]}} mangler \\end{${env[1]}}.`);
      end = i + m.index + m[0].length;
    } else if (SECTION.test(rest)) {
      const open = rest.indexOf('{', rest.match(SECTION)[0].length - 1), close = braceEnd(rest, open);
      if (close < 0) throw new Error(`Linje ${line0 + lineAt(body, i) - 1}: mangler } i overskriften.`);
      end = i + close + 1;
    } else if (rest[0] === '%') {
      // sammenhengende kommentarlinjer holdes samlet
      const m = rest.match(/^(?:[ \t]*%.*(?:\n|$))+/);
      end = i + m[0].replace(/\n$/, '').length;
    } else {
      // avsnitt: til tom linje, eller til en linje som starter et miljø/overskrift
      const lines = rest.split('\n');
      let len = 0;
      for (let k = 0; k < lines.length; k++) {
        if (k > 0 && (!lines[k].trim() || BLOCK_START.test(lines[k]))) break;
        len += lines[k].length + 1;
      }
      end = i + Math.min(len, rest.length);
    }
    out.push({ text: body.slice(start, end).replace(/\s+$/, ''), line: line0 + lineAt(body, start) - 1 });
    i = end;
  }
  return out;
}

// Koden vi selv ville skrevet for én blokk
const blockCode = (b, S) => docCode({ title: '', authors: '', group: '', blocks: [b] }, S).filter(l => l.bid === b.id).map(l => l.s).join('\n');
const same = (b, text, S) => norm(blockCode(b, S)) === norm(text);

function classify(text, S, prev) {
  const raw = () => ({ type: 'raw', src: text });
  const tryType = (base, extra) => {
    try {
      const b = { id: '_', ...base, ...parseBlock({ id: '_', ...base }, text), ...(extra || {}) };
      return same(b, text, S) ? b : null;
    } catch { return null }
  };
  const sec = text.match(/^\\(section|subsection)\*?\s*\{/);
  if (sec) return tryType({ type: sec[1] === 'section' ? 'h1' : 'h2', text: '' }) || raw();
  const env = (text.match(/^\\begin\{([^}]+)\}/) || [])[1];
  if (env === 'abstract') return tryType({ type: 'abstract', text: '' }) || raw();
  if (env === 'equation') return tryType({ type: 'eq', src: '', label: '' }) || raw();
  if (env === 'itemize') return tryType({ type: 'table', style: 'list', caption: '', label: '', rows: [['Antall', 'Komponent', 'Merknad']] }) || raw();
  if (env === 'table') {
    const style = /\\toprule/.test(text) ? 'booktabs' : /\\hline/.test(text) ? 'grid' : 'simple';
    return tryType({ type: 'table', style, caption: '', label: '', rows: [] }) || raw();
  }
  if (env === 'figure' || env === 'figure*') {
    if (/\\begin\{circuitikz\}/.test(text)) {
      // Kretser skrives om av kretseditoren, så her godtas alt parseren forstår uten advarsler.
      try {
        const r = parseCircuit(text);
        if (r.data && !r.warn.length) {
          const meta = parseBlock({ id: '_', type: 'fig', caption: '', label: '' }, text);
          if (meta.label) return { type: 'fig', ...meta, circuit: { ...r.data, manual: true } };
        }
      } catch { /* faller til raw */ }
      return raw();
    }
    const file = (text.match(/\\includegraphics(?:\[[^\]]*\])?\{bilder\/([^}]+)\}/) || [])[1];
    const old = file && prev.find(b => b.type === 'img' && b.file === file);
    if (old) return tryType({ type: 'img', src: old.src, file, w: old.w, caption: '', label: '' }, { src: old.src, file }) || raw();
    return raw();
  }
  if (env || text[0] === '%') return raw();
  try {
    const b = { id: '_', type: 'p', segs: parseInline(text.replace(/\s*\n\s*/g, ' ')) };
    if (norm(b.segs.map(segTex).join('')) === norm(text)) return b;
  } catch { /* $…$ som ikke er et enkelt symbol, osv. */ }
  return raw();
}

// tex: hele dokumentet eller et utdrag. prev: dokumentet slik det er nå (for å beholde id-er og bilder).
// Gir { title?, authors?, group?, preamble?, blocks }. Kaster Error med linjenummer ved ubalanserte miljøer.
export function parseDocument(tex, { S, prev = { blocks: [] } } = {}) {
  const text = tex.replace(/\r\n?/g, '\n');
  const bi = text.indexOf('\\begin{document}');
  const out = {};
  let body = text, line0 = 1;
  if (bi >= 0) {
    const ei = text.lastIndexOf('\\end{document}');
    if (ei < 0) throw new Error('Mangler \\end{document}.');
    let pre = text.slice(0, bi);
    for (const [k, name] of [['title', 'title'], ['author', 'author'], ['date', 'date']]) {
      const c = command(pre, name);
      if (!c) continue;
      if (k === 'title') out.title = unesc(c.inner.trim());
      if (k === 'author') {
        const [a, g = ''] = c.inner.split(/\\\\/);
        out.authors = unesc(a.trim()); out.group = unesc(g.trim());
      }
      pre = pre.slice(0, c.start) + pre.slice(c.end);
    }
    // Linjer som ikke kommer fra mal-oppsettet, tas vare på som egen preamble (f.eks. ekstra \usepackage).
    const known = new Set(preamble(S).map(l => l.trim()));
    out.preamble = pre.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() && !known.has(l.trim())).join('\n');
    body = text.slice(bi + '\\begin{document}'.length, ei).replace(/^\s*\\maketitle\s*$/m, '');
    line0 = lineAt(text, bi);
  }
  const prevBlocks = prev.blocks || [];
  // Biter som er uendret fra dagens dokument, gjenbrukes direkte (beholder id, krets, bilde).
  const byCode = new Map();
  prevBlocks.forEach(b => { const k = norm(blockCode(b, S)); if (!byCode.has(k)) byCode.set(k, b) });
  const used = new Set();
  out.blocks = chunks(body, line0).map((c, i) => {
    const hit = byCode.get(norm(c.text));
    if (hit && !used.has(hit.id)) { used.add(hit.id); return hit }
    const b = classify(c.text, S, prevBlocks);
    const old = prevBlocks[i];
    const id = old && old.type === b.type && !used.has(old.id) ? old.id : uid();
    used.add(id);
    return { ...b, id };
  });
  // Tomme avsnitt (plassholdere i editoren) gir ingen kode; sett dem tilbake der de sto.
  prevBlocks.forEach((b, i) => {
    if (used.has(b.id) || norm(blockCode(b, S)) !== '') return;
    let at = 0;
    for (let k = i - 1; k >= 0; k--) {
      const j = out.blocks.findIndex(x => x.id === prevBlocks[k].id);
      if (j >= 0) { at = j + 1; break }
    }
    out.blocks.splice(at, 0, b);
    used.add(b.id);
  });
  return out;
}
