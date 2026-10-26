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
    if (code !== 0) return { ok: false, log, errors: texErrors(log), ms: Date.now() - t0 };
    const pdf = await readFile(join(dir, 'main.pdf'));
    kept = keep;
    return { ok: true, pdf, log, ms: Date.now() - t0, dir: keep ? dir : null };
  } finally {
    if (!kept) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function texErrors(log) {
  const out = [], lines = log.split('\n');
  lines.forEach((l, i) => {
    if (!l.startsWith('! ')) return;
    const ln = lines.slice(i, i + 8).join('\n').match(/l\.(\d+)/);
    out.push({ message: l.slice(2), line: ln ? Number(ln[1]) : null });
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
