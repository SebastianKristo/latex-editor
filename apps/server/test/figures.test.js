import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractFigures } from '@kobling/core';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createUser, newSession } from '../src/auth.js';

// README §9: figurene tegnes med ekte latex + dvisvgm (hoppes over uten dvisvgm)
let hasTools = true;
try { execFileSync('dvisvgm', ['--version']) } catch { hasTools = false }

let app, dir, tok, otherTok, docId;
const H = t => ({ authorization: 'Bearer ' + t });
const TEX = fig => `\\documentclass{article}
\\usepackage{tikz}
\\usepackage[european]{circuitikz}
\\newcommand{\\Rl}{R_\\mathrm{L}}
\\begin{document}
Tekst.

\\resizebox{0.5\\textwidth}{!}{%
${fig}
}
\\end{document}`;
const GOOD = '\\begin{circuitikz}\n\\draw (0,0) to[R=$\\Rl$] (2,0);\n\\end{circuitikz}';
const BAD = '\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\ukjent\n\\end{tikzpicture}';

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kobling-fig-test-'));
  const cfg = loadConfig({ KOBLING_DATA: dir, KOBLING_ADMIN_EMAIL: 'admin@test.no', KOBLING_ADMIN_PASSWORD: 'hemmelig', SMTP_HOST: '' });
  app = await buildApp(cfg, { background: false, compile: async () => ({ ok: true, pdf: Buffer.from('%PDF-1.5'), ms: 1, dir: mkdtempSync(join(tmpdir(), 'kobling-c-')) }) });
  tok = (await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'hemmelig' } })).json().token;
  otherTok = newSession(app.db, createUser(app.db, { email: 'ola@test.no', name: 'Ola' }).id);
  docId = (await app.inject({ method: 'POST', url: '/api/docs', headers: H(tok), payload: { doc: { title: 'Figurer' } } })).json().id;
});
after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }) });

const compile = tex => app.inject({ method: 'POST', url: '/api/compile', headers: H(tok), payload: { tex, doc: docId } });
const logOf = async res => (await app.inject({ method: 'GET', url: '/api/compile/' + res.headers['x-compile-id'] + '/log', headers: H(tok) })).json();

test('figur tegnes som SVG, mellomlagres og har dokumentets tilgang', { skip: !hasTools && 'dvisvgm mangler' }, async () => {
  const tex = TEX(GOOD), [f] = extractFigures(tex);
  assert.ok(f.code.startsWith('\\resizebox{0.5\\textwidth}{!}{'));
  let t0 = Date.now();
  const log = await logOf(await compile(tex));
  assert.deepEqual(log.figs, { [f.hash]: 'ok' });
  assert.deepEqual(log.figErrors, []);
  const first = Date.now() - t0;

  const svg = await app.inject({ method: 'GET', url: `/api/docs/${docId}/fig/${f.hash}.svg`, headers: H(tok) });
  assert.equal(svg.statusCode, 200);
  assert.match(svg.headers['content-type'], /image\/svg\+xml/);
  assert.match(svg.headers['content-security-policy'], /default-src 'none'/);
  assert.match(svg.body, /<svg[\s>]/);
  // andre brukere uten tilgang til dokumentet får ikke figuren
  assert.equal((await app.inject({ method: 'GET', url: `/api/docs/${docId}/fig/${f.hash}.svg`, headers: H(otherTok) })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: `/api/docs/${docId}/fig/${'0'.repeat(64)}.svg`, headers: H(tok) })).statusCode, 404);

  // uendret figur kompileres ikke på nytt
  t0 = Date.now();
  assert.deepEqual((await logOf(await compile(tex))).figs, { [f.hash]: 'ok' });
  assert.ok(Date.now() - t0 < first / 2, `mellomlager: ${Date.now() - t0} ms mot ${first} ms`);
});

test('feil i en figur gir linjenummer i main.tex', { skip: !hasTools && 'dvisvgm mangler' }, async () => {
  // uten \resizebox (der leser TeX hele boksen før feilen, og linjen blir slutten av boksen)
  const tex = TEX(BAD).replace('\\resizebox{0.5\\textwidth}{!}{%\n', '').replace('\\end{tikzpicture}\n}', '\\end{tikzpicture}'), [f] = extractFigures(tex);
  assert.ok(f.code.startsWith('\\begin{tikzpicture}'));
  const log = await logOf(await compile(tex));
  assert.equal(log.figs[f.hash], 'error');
  const e = log.figErrors[0];
  assert.match(e.message, /Undefined control sequence/);
  assert.equal(tex.split('\n')[e.line - 1], '\\ukjent');
});

test('bare figurene klienten ber om tegnes', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/compile', headers: H(tok), payload: { tex: TEX(GOOD).replace('R=$', 'L=$'), doc: docId, figs: [] } });
  assert.deepEqual((await logOf(res)).figs, {});
});

test('uten dokument-id eller tilgang tegnes ingen figurer', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/compile', headers: H(otherTok), payload: { tex: TEX(GOOD), doc: docId } });
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/compile/' + res.headers['x-compile-id'] + '/log', headers: H(otherTok) })).json().figs, {});
});
