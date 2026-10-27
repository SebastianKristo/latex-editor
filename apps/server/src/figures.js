import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir, readdir, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, normalize } from 'node:path';
import { extractFigures, figPreamble } from '@kobling/core';
import { texErrors } from './compile.js';

// TikZ/CircuiTikZ-figurer som SVG til forhåndsvisningen (README §9). Hver figur kompileres for seg
// med standalone og samme preamble, deretter dvisvgm. Mellomlageret er nøklet på SHA-256 av
// preamble + figurkode, så uendrede figurer aldri kompileres på nytt.
const MAX_FILES = 3000;

export function figureStore(dir) {
  const path = h => join(dir, h + '.svg');
  let n = 0;
  return {
    dir,
    path,
    has: h => /^[0-9a-f]{64}$/.test(h) && existsSync(path(h)),
    read: h => readFile(path(h)),
    async put(h, svg) {
      await mkdir(dir, { recursive: true });
      await writeFile(path(h) + '.tmp', svg);
      await rename(path(h) + '.tmp', path(h));
      if (++n % 50 === 0) prune(dir).catch(() => {});
    }
  };
}

async function prune(dir) {
  const names = (await readdir(dir)).filter(f => f.endsWith('.svg'));
  if (names.length <= MAX_FILES) return;
  const st = await Promise.all(names.map(async f => [f, (await stat(join(dir, f))).mtimeMs]));
  st.sort((a, b) => a[1] - b[1]);
  for (const [f] of st.slice(0, names.length - MAX_FILES)) await rm(join(dir, f), { force: true });
}

// pdfLaTeX → latex (DVI), XeLaTeX → xelatex -no-pdf (XDV), LuaLaTeX → dvilualatex
const ENGINES = { pdfLaTeX: ['latex', 'dvi', true], XeLaTeX: ['xelatex', 'xdv', false], LuaLaTeX: ['dvilualatex', 'dvi', true] };

// only: nøklene klienten trenger (figurer i LaTeX-blokker); kretseditorens figurer tegner klienten selv.
export async function renderFigures({ tex, files = {}, engine = 'pdfLaTeX', store, only, timeoutMs = 30000, parallel = 2 }) {
  const want = Array.isArray(only) ? new Set(only) : null;
  const figs = extractFigures(tex).filter(f => !want || want.has(f.hash)), pre = figPreamble(tex);
  const state = {}, errors = [], todo = [];
  for (const f of figs) {
    if (state[f.hash]) continue;
    if (store.has(f.hash)) state[f.hash] = 'ok';
    else { state[f.hash] = 'busy'; todo.push(f) }
  }
  const one = async f => {
    const r = await renderOne({ pre, f, files, engine, timeoutMs });
    if (r.svg) { await store.put(f.hash, r.svg); state[f.hash] = 'ok' }
    else { state[f.hash] = 'error'; errors.push(...r.errors) }
  };
  const q = [...todo];
  await Promise.all(Array.from({ length: Math.min(parallel, q.length) }, async () => { while (q.length) await one(q.shift()) }));
  return { figs: state, errors, rendered: todo.length };
}

async function renderOne({ pre, f, files, engine, timeoutMs }) {
  const [cmd, ext, dvisvgmOpt] = ENGINES[engine] || ENGINES.pdfLaTeX;
  const dir = await mkdtemp(join(tmpdir(), 'kobling-fig-'));
  try {
    for (const [name, b64] of Object.entries(files)) {
      const rel = normalize(name);
      if (rel.startsWith('..') || rel.startsWith('/')) continue;
      await mkdir(dirname(join(dir, rel)), { recursive: true });
      await writeFile(join(dir, rel), Buffer.from(b64, 'base64'));
    }
    const head = `\\documentclass[${dvisvgmOpt ? 'dvisvgm,' : ''}tikz,border=2pt]{standalone}\n${pre}\n\\begin{document}\n`;
    const first = head.split('\n').length; // linjen figurkoden starter på i fig.tex
    await writeFile(join(dir, 'fig.tex'), head + f.code + '\n\\end{document}\n');
    const args = ['-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', ...(cmd === 'xelatex' ? ['-no-pdf'] : []), 'fig.tex'];
    const t = await run(cmd, args, dir, timeoutMs);
    const log = await readFile(join(dir, 'fig.log'), 'utf8').catch(() => t.out);
    // Linjenummer i standalone-loggen oversettes til main.tex
    const at = l => (l ? f.line + Math.max(0, l - first) : f.line);
    if (t.code !== 0) {
      const errs = texErrors(log).map(e => ({ ...e, line: at(e.line) }));
      return { errors: errs.length ? errs : [{ message: 'Figuren kunne ikke kompileres.', line: f.line, hint: '' }] };
    }
    const d = await run('dvisvgm', ['--no-fonts', '--exact-bbox', '-o', 'fig.svg', 'fig.' + ext], dir, timeoutMs);
    const svg = await readFile(join(dir, 'fig.svg')).catch(() => null);
    if (d.code !== 0 || !svg) return { errors: [{ message: 'dvisvgm: ' + (d.out.trim().split('\n').pop() || 'ukjent feil'), line: f.line, hint: 'Figuren kompilerte, men kunne ikke gjøres om til SVG.' }] };
    return { svg };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
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
