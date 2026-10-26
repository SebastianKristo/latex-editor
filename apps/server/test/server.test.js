import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createUser, newSession } from '../src/auth.js';
import { texErrors } from '../src/compile.js';
import { restoreDump } from '../src/backup.js';

let app, dir, adminTok, userTok;
const H = t => ({ authorization: 'Bearer ' + t });

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kobling-test-'));
  const cfg = loadConfig({ KOBLING_DATA: dir, KOBLING_ADMIN_EMAIL: 'admin@test.no', KOBLING_ADMIN_PASSWORD: 'hemmelig', KOBLING_PUBLIC_URL: 'https://kob.test', SMTP_HOST: '' });
  app = await buildApp(cfg, { background: false, compile: async ({ tex }) => tex.includes('FEIL') ? { ok: false, log: '! Undefined control sequence.\nl.7 \\FEIL', errors: texErrors('! Undefined control sequence.\nl.7 \\FEIL') } : { ok: true, pdf: Buffer.from('%PDF-1.5'), ms: 1 } });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'hemmelig' } });
  adminTok = login.json().token;
  const u = createUser(app.db, { email: 'mia@test.no', name: 'Mia' });
  userTok = newSession(app.db, u.id);
});
after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }) });

test('feil passord gir 401', async () => {
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'nei' } });
  assert.equal(r.statusCode, 401);
});

test('ikke-admin får 403 på alle admin-API-er', async () => {
  const routes = [['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings'], ['GET', '/api/admin/users'], ['POST', '/api/admin/users'],
    ['POST', '/api/admin/duckdns/update'], ['POST', '/api/admin/smtp/test'], ['GET', '/api/admin/mail-log'], ['POST', '/api/admin/backup/test'],
    ['POST', '/api/admin/backup/run'], ['GET', '/api/admin/backups'], ['POST', '/api/admin/backups/x.tar.zst/restore']];
  for (const [method, url] of routes) {
    const r = await app.inject({ method, url, headers: H(userTok), payload: {} });
    assert.equal(r.statusCode, 403, method + ' ' + url);
    const anon = await app.inject({ method, url, payload: {} });
    assert.equal(anon.statusCode, 401, 'anonym ' + method + ' ' + url);
  }
});

test('admin-innstillinger maskerer hemmeligheter og validerer', async () => {
  const bad = await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { duck: { domain: 'Ugyldig_Navn' } } });
  assert.equal(bad.statusCode, 400);
  const ok = await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { smtp: { host: 'smtp.protonmail.ch', user: 'meg@eget.no', pass: 'token123' } } });
  assert.equal(ok.json().smtp.pass, '••••••••');
  // maskert verdi tilbake endrer ikke passordet
  await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { smtp: { pass: '••••••••' } } });
  const raw = JSON.parse(app.db.prepare("SELECT value FROM settings WHERE key='smtp'").get().value);
  assert.equal(raw.pass, 'token123');
  await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { smtp: { host: '' } } });
});

test('dokument, invitasjon og tilgang', async () => {
  const c = await app.inject({ method: 'POST', url: '/api/docs', headers: H(adminTok), payload: { doc: { title: 'Oblig 4', blocks: [] } } });
  const id = c.json().id;
  assert.equal((await app.inject({ method: 'GET', url: '/api/docs/' + id, headers: H(userTok) })).statusCode, 404);
  const inv = await app.inject({ method: 'POST', url: `/api/docs/${id}/invites`, headers: H(adminTok), payload: { email: 'ny@student.no', role: 'Kan kommentere' } });
  const { url, mail } = inv.json();
  assert.match(url, /^https:\/\/kob\.test\/i\/[\w-]+$/);
  assert.equal(mail.queued, true); // SMTP ikke satt opp -> utboks
  const acc = await app.inject({ method: 'GET', url: url.replace('https://kob.test', '') });
  assert.equal(acc.statusCode, 302);
  const cookie = acc.headers['set-cookie'].split(';')[0];
  const read = await app.inject({ method: 'GET', url: '/api/docs/' + id, headers: { cookie } });
  assert.equal(read.json().role, 'Kan kommentere');
  const write = await app.inject({ method: 'PUT', url: '/api/docs/' + id, headers: { cookie }, payload: { doc: { title: 'x' } } });
  assert.equal(write.statusCode, 403);
  const com = await app.inject({ method: 'POST', url: `/api/docs/${id}/comments`, headers: { cookie }, payload: { text: 'Bra!' } });
  assert.equal(com.statusCode, 200);
});

test('kompilering gir PDF eller feil med linjenummer', async () => {
  const ok = await app.inject({ method: 'POST', url: '/api/compile', payload: { tex: '\\documentclass{article}\\begin{document}x\\end{document}' } });
  assert.equal(ok.headers['content-type'], 'application/pdf');
  const bad = await app.inject({ method: 'POST', url: '/api/compile', payload: { tex: '\\documentclass{article}\n\\FEIL' } });
  assert.equal(bad.statusCode, 422);
  assert.deepEqual(bad.json().errors, [{ message: 'Undefined control sequence.', line: 7 }]);
});

test('backup-dump kan gjenopprettes', () => {
  const before = app.db.prepare('SELECT COUNT(*) n FROM documents').get().n;
  const dump = { documents: app.db.prepare('SELECT * FROM documents').all() };
  app.db.exec('DELETE FROM documents');
  restoreDump(app.db, dump);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM documents').get().n, before);
});

test('sanntid: to klienter ser hverandres endringer', async () => {
  await app.listen({ port: 0 });
  const port = app.server.address().port;
  const url = `ws://127.0.0.1:${port}/sync/d4`;
  const a = new WebSocket(url, { headers: H(adminTok) }), b = new WebSocket(url, { headers: H(userTok) });
  await Promise.all([a, b].map(s => new Promise(r => s.onopen = r)));
  const t0 = Date.now();
  const got = new Promise(r => b.onmessage = e => r(JSON.parse(e.data)));
  a.send(JSON.stringify({ docs: [{ id: 'd4', title: 'Endret' }] }));
  const m = await got;
  assert.equal(m.docs[0].title, 'Endret');
  assert.ok(Date.now() - t0 < 300);
  a.close(); b.close();
});
