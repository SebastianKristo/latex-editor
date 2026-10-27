// TikZ/CircuiTikZ-figurer som bilder fra serveren (README §9).
// Klient og server regner ut samme nøkkel: SHA-256 av preamble + figurkode.

// SHA-256 av en tekst (UTF-8), synkron så den kan brukes mens forhåndsvisningen tegnes.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
export function sha256(str) {
  const msg = new TextEncoder().encode(str);
  const len = ((msg.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(len);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(len - 8, Math.floor((msg.length * 8) / 2 ** 32));
  dv.setUint32(len - 4, (msg.length * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < len; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(o + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = W[t - 15], b = W[t - 2];
      W[t] = (W[t - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + W[t - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((x, i) => (H[i] = (H[i] + x) >>> 0));
  }
  return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
}

export const FIG_ENV = /^(tikzpicture|circuitikz)$/;

// Preamblen figurene kompileres med: alt før \begin{document} unntatt \documentclass.
export function figPreamble(tex) {
  const m = /^[ \t]*\\begin\{document\}/m.exec(tex);
  return (m ? tex.slice(0, m.index) : tex)
    .split('\n')
    .filter(l => !/^\s*\\documentclass/.test(l))
    .join('\n')
    .trim();
}

const memo = new Map();
export function figKey(pre, code) {
  const k = pre + '\n%%kobling-fig\n' + code;
  let h = memo.get(k);
  if (!h) {
    if (memo.size > 200) memo.clear();
    memo.set(k, (h = sha256(k)));
  }
  return h;
}

// \resizebox{A}{B}{…} og \scalebox{F}{…} rundt én figur tas med i figurkoden.
export const figWrap = (cmd, a, b) => (cmd === 'resizebox' ? '\\resizebox{' + a + '}{' + b + '}{' : '\\scalebox{' + a + '}{');
// Mellomrom og %-kommentarer mellom boksen og figuren teller ikke.
const GAP = '(?:\\s|%[^\\n]*\\n)*';
const WRAP_BEFORE = new RegExp('\\\\(resizebox)\\{([^{}]*)\\}\\{([^{}]*)\\}\\{' + GAP + '$|\\\\(scalebox)\\{([^{}]*)\\}\\{' + GAP + '$');
const WRAP_AFTER = new RegExp('^' + GAP + '\\}');
export const figInner = s => s.replace(/^(?:\s|%[^\n]*\n)+/, '').replace(/(?:\s|%[^\n]*)+$/, '');

// Alle figurer i main.tex: { code, line (1-basert, der figuren starter), hash }
export function extractFigures(tex) {
  const pre = figPreamble(tex),
    out = [],
    start = /^[ \t]*\\begin\{document\}/m.exec(tex);
  const re = /\\begin\{(tikzpicture|circuitikz)\}/g;
  re.lastIndex = start ? start.index : 0;
  let m;
  while ((m = re.exec(tex))) {
    const env = m[1], b = '\\begin{' + env + '}', e = '\\end{' + env + '}';
    let d = 1, k = m.index + b.length, end = -1;
    while (k < tex.length) {
      const nb = tex.indexOf(b, k), ne = tex.indexOf(e, k);
      if (ne < 0) break;
      if (nb >= 0 && nb < ne) { d++; k = nb + b.length }
      else if (--d === 0) { end = ne + e.length; break }
      else k = ne + e.length;
    }
    if (end < 0) break;
    let code = tex.slice(m.index, end);
    const w = WRAP_BEFORE.exec(tex.slice(Math.max(0, m.index - 200), m.index));
    if (w && WRAP_AFTER.test(tex.slice(end))) code = (w[1] ? figWrap('resizebox', w[2], w[3]) : figWrap('scalebox', w[5])) + code + '}';
    out.push({ code, line: tex.slice(0, m.index).split('\n').length, hash: figKey(pre, code) });
    re.lastIndex = end;
  }
  return out;
}
