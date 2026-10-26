import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, normalize } from 'node:path';

// Kompilerer main.tex (+ bilder) med latexmk -pdf i en midlertidig mappe.
export async function compileTex({ tex, files = {}, engine = 'pdfLaTeX', timeoutMs = 60000 }) {
  const dir = await mkdtemp(join(tmpdir(), 'kobling-'));
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
    const synctex = await readFile(join(dir, 'main.synctex.gz')).catch(() => null);
    return { ok: true, pdf, synctex, log, ms: Date.now() - t0 };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
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
