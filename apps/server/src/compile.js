import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';

// Kompilerer main.tex (+ bilder) med latexmk i en midlertidig mappe.
// Med keep=true beholdes mappa (for SyncTeX) og må fjernes av kalleren.
export async function compileTex({ tex, files = {}, engine = 'pdfLaTeX', timeoutMs = 90000, keep = false }) {
  const dir = await mkdtemp(join(tmpdir(), 'kobling-'));
  let kept = false;
  try {
    await writeFile(join(dir, 'main.tex'), tex);
    for (const [name, b64] of Object.entries(files)) {
      const rel = normalize(name);
      if (rel.startsWith('..') || rel.startsWith('/')) throw Object.assign(new Error('Ugyldig filnavn: ' + name), { status: 400 });
      await mkdir(dirname(join(dir, rel)), { recursive: true });
      await writeFile(join(dir, rel), Buffer.from(b64, 'base64'));
    }
    const flag = engine === 'XeLaTeX' ? '-xelatex' : engine === 'LuaLaTeX' ? '-lualatex' : '-pdf';
    const t0 = Date.now();
    const { code, out } = await run('latexmk', [flag, '-interaction=nonstopmode', '-halt-on-error', '-synctex=1', '-no-shell-escape', 'main.tex'], dir, timeoutMs);
    const log = await readFile(join(dir, 'main.log'), 'utf8').catch(() => out);
    if (code !== 0) return { ok: false, log, errors: texErrors(log), warnings: texWarnings(log), ms: Date.now() - t0 };
    const pdf = await readFile(join(dir, 'main.pdf'));
    kept = keep;
    return { ok: true, pdf, log, warnings: texWarnings(log), ms: Date.now() - t0, dir: keep ? dir : null };
  } finally {
    if (!kept) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Norsk forklaring til vanlige TeX-meldinger (vises under den engelske meldingen i loggen).
const EXPLAIN = [
  [/Option clash for package/, 'Pakken lastes flere ganger med ulike valg. Slå valgene sammen i én \\usepackage-linje.'],
  [/Undefined control sequence/, 'Ukjent kommando. Sjekk stavemåten, eller om pakken som definerer den er lastet.'],
  [/Missing \$ inserted/, 'Matte-tegn (_ ^ \\alpha …) brukt utenfor matte-modus. Sett uttrykket i $ … $.'],
  [/File `([^']+)' not found/, 'Filen mangler. Last opp bildet med akkurat dette navnet, eller rett filnavnet.'],
  [/Environment (\S+) undefined/, 'Ukjent miljø. Mangler du en pakke i preamblen?'],
  [/Missing \} inserted|Extra \}|Extra alignment tab|Runaway argument|Paragraph ended before/, 'Klammene { } stemmer ikke, eller en kommando mangler argument.'],
  [/\\begin\{([^}]+)\} on input line \d+ ended by \\end/, '\\begin og \\end hører ikke sammen.'],
  [/Misplaced alignment tab character &/, '& brukt utenfor en tabell. Skriv \\& for et vanlig &-tegn.'],
  [/Reference `[^']+' on page \d+ undefined/, 'Referansen peker på en \\label som ikke finnes.'],
  [/Label `[^']+' multiply defined/, 'Samme \\label er brukt flere ganger.'],
  [/Citation `[^']+'.*undefined/, 'Kilden finnes ikke i litteraturlisten.']
];
export const explain = msg => (EXPLAIN.find(([re]) => re.test(msg)) || [, ''])[1];

// Feil («! …» med «l.NN») og advarsler («LaTeX Warning: … on input line NN») fra latexmk-loggen.
// Linjenumrene gjelder main.tex, som er den samme koden som vises i kodevisningen.
export function texErrors(log) {
  const out = [], lines = log.split('\n');
  lines.forEach((l, i) => {
    // «==> Fatal error occurred» er bare følgen av feilen over, ikke en egen feil
    if (!l.startsWith('! ') || (/^!\s*==> Fatal error/.test(l) && out.length)) return;
    const ln = lines.slice(i, i + 8).join('\n').match(/l\.(\d+)/);
    const message = l.slice(2).replace(/^LaTeX Error: /, '');
    out.push({ message, line: ln ? Number(ln[1]) : null, hint: explain(message) });
  });
  return out;
}

export function texWarnings(log) {
  const out = [], seen = new Set();
  // advarsler kan gå over flere linjer (fortsettelser starter med mellomrom eller «(pakke)»)
  log.replace(/\r/g, '').split(/\n(?=[^\s(])|\n\n/).forEach(chunk => {
    const t = chunk.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(?:LaTeX|Package \S+) Warning: (.*?)(?: on input line (\d+))?\.?$/);
    if (!m || /^There were undefined references|^Label\(s\) may have changed|^Rerun to get/.test(m[1])) return;
    const k = m[1] + '|' + m[2];
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ message: m[1], line: m[2] ? Number(m[2]) : null, hint: explain(m[1]) });
  });
  return out;
}

// Holder de siste kompileringene på disk så SyncTeX kan slå opp i dem.
export function compileCache(max = 24) {
  const m = new Map();
  return {
    put(dir) {
      const id = randomBytes(8).toString('hex');
      m.set(id, dir);
      while (m.size > max) { const [k, d] = m.entries().next().value; m.delete(k); rm(d, { recursive: true, force: true }).catch(() => {}) }
      return id;
    },
    get: id => m.get(id),
    clear() { for (const d of m.values()) rm(d, { recursive: true, force: true }).catch(() => {}); m.clear() }
  };
}

const num = (out, k) => { const m = out.match(new RegExp('^' + k + ':(-?[\\d.]+)', 'm')); return m ? Number(m[1]) : null };

// PDF-punkt (bp fra øvre venstre hjørne) -> linje i main.tex
export async function synctexEdit(dir, page, x, y) {
  const { code, out } = await run('synctex', ['edit', '-o', `${page}:${x}:${y}:main.pdf`, '-d', dir], dir, 10000);
  if (code !== 0) return null;
  return num(out, 'Line');
}

// Linje i main.tex -> bokser i PDF-en
export async function synctexView(dir, line) {
  const { code, out } = await run('synctex', ['view', '-i', `${line}:0:main.tex`, '-o', 'main.pdf', '-d', dir], dir, 10000);
  if (code !== 0) return [];
  return out.split('Output:').slice(1).map(b => ({ page: num(b, 'Page'), x: num(b, 'h'), y: num(b, 'v'), w: num(b, 'W'), h: num(b, 'H') }))
    .filter(b => b.page != null && b.w != null);
}

function run(cmd, args, cwd, timeoutMs) {
  return new Promise(res => {
    let out = '';
    const p = spawn(cmd, args, { cwd, env: { ...process.env, openout_any: 'p' } });
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('error', e => { clearTimeout(t); res({ code: -1, out: String(e) }) });
    p.on('close', code => { clearTimeout(t); res({ code, out }) });
  });
}
