import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Y, applyDocToY, docFromY, applyCommentsToY } from '@kobling/core/ydoc';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createUser, newSession } from '../src/auth.js';
import { texErrors } from '../src/compile.js';
import { restoreDump } from '../src/backup.js';

let app, dir, adminTok, userTok, port;
const H = t => ({ authorization: 'Bearer ' + t });
const wait = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kobling-test-'));
  const cfg = loadConfig({ KOBLING_DATA: dir, KOBLING_ADMIN_EMAIL: 'admin@test.no', KOBLING_ADMIN_PASSWORD: 'hemmelig', KOBLING_PUBLIC_URL: 'https://kob.test', SMTP_HOST: '' });
  app = await buildApp(cfg, { background: false, compile: async ({ tex }) => tex.includes('FEIL') ? { ok: false, log: '! Undefined control sequence.\nl.7 \\FEIL', errors: texErrors('! Undefined control sequence.\nl.7 \\FEIL') } : { ok: true, pdf: Buffer.from('%PDF-1.5'), ms: 1 } });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'hemmelig' } });
  adminTok = login.json().token;
  const u = createUser(app.db, { email: 'mia@test.no', name: 'Mia' });
  userTok = newSession(app.db, u.id);
  await app.listen({ port: 0 });
  port = app.server.address().port;
});
after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }) });

// Minimal y-websocket-klient for testene.
function yClient(docId, headers) {
  const doc = new Y.Doc(), ws = new WebSocket(`ws://127.0.0.1:${port}/sync/${docId}`, { headers });
  ws.binaryType = 'arraybuffer';
  let denied = false, closed = null, synced;
  const ready = new Promise(r => synced = r);
  ws.onmessage = e => {
    const dec = decoding.createDecoder(new Uint8Array(e.data));
    const t = decoding.readVarUint(dec);
    if (t === 9) { denied = true; return }
    if (t !== 0) return;
    const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0);
    const st = syncProtocol.readSyncMessage(dec, enc, doc, 'remote');
    if (encoding.length(enc) > 1) ws.send(encoding.toUint8Array(enc));
    if (st === syncProtocol.messageYjsSyncStep2 || st === syncProtocol.messageYjsSyncStep1) synced();
  };
  ws.onopen = () => { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeSyncStep1(enc, doc); ws.send(encoding.toUint8Array(enc)) };
  ws.onclose = e => { closed = e.code; synced() };
  doc.on('update', (u, origin) => {
    if (origin === 'remote' || ws.readyState !== 1) return;
    const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeUpdate(enc, u); ws.send(encoding.toUint8Array(enc));
  });
  return { doc, ws, ready, get denied() { return denied }, get closed() { return closed } };
}

test('første oppsett er stengt når det finnes brukere', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/setup' })).json().needed, false);
  assert.equal((await app.inject({ method: 'POST', url: '/api/setup', payload: { email: 'x@y.no', password: '12345678' } })).statusCode, 409);
});

test('feil passord gir 401, utlogging fjerner økten', async () => {
  assert.equal((await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'nei' } })).statusCode, 401);
  const t = (await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'hemmelig' } })).json().token;
  await app.inject({ method: 'POST', url: '/api/logout', headers: H(t) });
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: H(t) })).statusCode, 401);
});

test('ikke-admin får 403 på alle admin-API-er', async () => {
  const routes = [['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings'], ['GET', '/api/admin/users'], ['POST', '/api/admin/users'],
    ['POST', '/api/admin/duckdns/update'], ['POST', '/api/admin/smtp/test'], ['GET', '/api/admin/mail-log'], ['POST', '/api/admin/backup/test'],
    ['POST', '/api/admin/backup/run'], ['GET', '/api/admin/backup/status'], ['GET', '/api/admin/backups'], ['GET', '/api/admin/backups/x.tar.zst'],
    ['POST', '/api/admin/backups/x.tar.zst/restore']];
  for (const [method, url] of routes) {
    assert.equal((await app.inject({ method, url, headers: H(userTok), payload: {} })).statusCode, 403, method + ' ' + url);
    assert.equal((await app.inject({ method, url, payload: {} })).statusCode, 401, 'anonym ' + method + ' ' + url);
  }
});

test('admin-innstillinger valideres og lagres', async () => {
  const bad = await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { duck: { domain: 'Ugyldig_Navn' } } });
  assert.equal(bad.statusCode, 400);
  const ok = await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { smb: { schedule: 'weekly', incl: { docs: true, figs: false, hist: false, users: true } } } });
  assert.equal(ok.json().smb.cron, '0 3 * * 1');
  assert.deepEqual(ok.json().smb.include, ['docs', 'users']);
});

let docId;
test('dokument, invitasjon og tilgang', async () => {
  docId = (await app.inject({ method: 'POST', url: '/api/docs', headers: H(adminTok), payload: { doc: { title: 'Oblig 4', authors: 'A', group: 'G', folder: 'F', blocks: [{ id: 'b1', type: 'p', segs: [{ t: 'text', v: 'Hei' }] }] } } })).json().id;
  assert.equal((await app.inject({ method: 'GET', url: '/api/docs/' + docId, headers: H(userTok) })).statusCode, 404);
  const inv = await app.inject({ method: 'POST', url: `/api/docs/${docId}/invites`, headers: H(adminTok), payload: { email: 'ny@student.no', role: 'Kan kommentere' } });
  const { url, mail } = inv.json();
  assert.match(url, /^https:\/\/kob\.test\/i\/[\w-]+$/);
  assert.equal(mail.queued, true); // SMTP ikke satt opp -> utboks
  const acc = await app.inject({ method: 'GET', url: url.replace('https://kob.test', '') });
  assert.equal(acc.statusCode, 302);
  const cookie = acc.headers['set-cookie'].split(';')[0];
  const read = await app.inject({ method: 'GET', url: '/api/docs/' + docId, headers: { cookie } });
  assert.equal(read.json().role, 'Kan kommentere');
  assert.equal(read.json().doc.title, 'Oblig 4');
  const people = (await app.inject({ method: 'GET', url: `/api/docs/${docId}/people`, headers: H(adminTok) })).json();
  assert.deepEqual(people.people.map(p => p.role), ['Eier', 'Kan kommentere']);
  const mails = (await app.inject({ method: 'GET', url: '/api/mails', headers: H(adminTok) })).json();
  assert.equal(mails[0].status, 'I utboks');
  assert.equal(mails[0].url, url);
  // eksisterende bruker får tilgang med en gang
  const inv2 = (await app.inject({ method: 'POST', url: `/api/docs/${docId}/invites`, headers: H(adminTok), payload: { email: 'mia@test.no', role: 'Kan lese', sendMail: false } })).json();
  assert.equal(inv2.existing, 'Mia');
  assert.equal((await app.inject({ method: 'GET', url: '/api/docs/' + docId, headers: H(userTok) })).json().role, 'Kan lese');
});

test('delingslenker og invitasjoner bruker DuckDNS-adressen når den er på', async () => {
  const put = duck => app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { duck } });
  const link = async () => (await app.inject({ method: 'GET', url: `/api/docs/${docId}/people`, headers: H(adminTok) })).json().link;
  const inviteUrl = async () => (await app.inject({ method: 'POST', url: `/api/docs/${docId}/invites`, headers: H(adminTok), payload: { email: 'lenke@test.no', sendMail: false } })).json().url;
  assert.deepEqual(await link(), { url: 'https://kob.test', ext: false });
  await put({ on: true, domain: 'mitt-navn', tls: true, links: true });
  assert.deepEqual(await link(), { url: 'https://mitt-navn.duckdns.org:8443', ext: true });
  assert.match(await inviteUrl(), /^https:\/\/mitt-navn\.duckdns\.org:8443\/i\//);
  await put({ tls: false });
  assert.equal((await link()).url, 'http://mitt-navn.duckdns.org:8080');
  await put({ links: false });
  assert.match(await inviteUrl(), /^https:\/\/kob\.test\/i\//);
  await put({ on: false, links: true });
});

test('kompilering krever innlogging og gir PDF eller feil med linjenummer', async () => {
  const tex = '\\documentclass{article}\\begin{document}x\\end{document}';
  assert.equal((await app.inject({ method: 'POST', url: '/api/compile', payload: { tex } })).statusCode, 401);
  const ok = await app.inject({ method: 'POST', url: '/api/compile', headers: H(userTok), payload: { tex } });
  assert.equal(ok.headers['content-type'], 'application/pdf');
  const bad = await app.inject({ method: 'POST', url: '/api/compile', headers: H(userTok), payload: { tex: '\\documentclass{article}\n\\FEIL' } });
  assert.equal(bad.statusCode, 422);
  assert.deepEqual(bad.json().errors.map(e => [e.message, e.line, !!e.hint]), [['Undefined control sequence.', 7, true]]);
});

test('sanntid med Yjs: endringer flettes og lagres, roller håndheves', async () => {
  const a = yClient(docId, H(adminTok)), b = yClient(docId, H(adminTok));
  await Promise.all([a.ready, b.ready]);
  await wait(50);
  assert.equal(docFromY(a.doc, docId).title, 'Oblig 4');

  // to klienter endrer hver sin blokk samtidig
  const da = docFromY(a.doc, docId), db2 = docFromY(b.doc, docId);
  applyDocToY(a.doc, { ...da, blocks: [...da.blocks, { id: 'b2', type: 'h1', text: 'Fra A' }] });
  applyDocToY(b.doc, { ...db2, title: 'Oblig 4 (B)' });
  const t0 = Date.now();
  while (Date.now() - t0 < 1000 && !(docFromY(b.doc, docId).blocks.length === 2 && docFromY(a.doc, docId).title === 'Oblig 4 (B)')) await wait(5);
  assert.ok(Date.now() - t0 < 300, 'synk tok ' + (Date.now() - t0) + ' ms');
  assert.deepEqual(docFromY(a.doc, docId), docFromY(b.doc, docId));

  // leser (Mia) får ikke gjennom endringer
  const r = yClient(docId, H(userTok));
  await r.ready; await wait(30);
  applyDocToY(r.doc, { ...docFromY(r.doc, docId), title: 'Hacket' });
  await wait(100);
  assert.ok(r.denied);
  assert.equal(docFromY(a.doc, docId).title, 'Oblig 4 (B)');

  [a, b, r].forEach(c => c.ws.close());
  await wait(100);
  const saved = (await app.inject({ method: 'GET', url: '/api/docs/' + docId, headers: H(adminTok) })).json().doc;
  assert.equal(saved.title, 'Oblig 4 (B)');
  assert.equal(saved.blocks.length, 2);
});

test('kommentator kan bare kommentere; ny kommentar varsler på e-post', async () => {
  const inv = (await app.inject({ method: 'POST', url: `/api/docs/${docId}/invites`, headers: H(adminTok), payload: { email: 'emil@test.no', role: 'Kan kommentere', sendMail: false } })).json();
  const cookie = (await app.inject({ method: 'GET', url: '/i/' + inv.code })).headers['set-cookie'].split(';')[0];
  const c = yClient(docId, { cookie });
  await c.ready; await wait(30);
  applyCommentsToY(c.doc, [{ id: 'k1', by: 'Emil', text: 'Fin figur!', bid: 'b1', ts: 1, resolved: false }]);
  await wait(100);
  assert.equal(c.denied, false);
  applyDocToY(c.doc, { ...docFromY(c.doc, docId), title: 'Nei' });
  await wait(100);
  assert.ok(c.denied);
  c.ws.close(); await wait(50);
  const log = (await app.inject({ method: 'GET', url: '/api/admin/mail-log', headers: H(adminTok) })).json();
  assert.ok(log.some(m => m.kind === 'kommentar' && m.to_addr === 'admin@test.no'));
});

test('versjonshistorikk: eget rom, kan slås av for andre enn admin (akseptanse 13)', async () => {
  // Mia har lesetilgang fra testen over
  const meOn = (await app.inject({ method: 'GET', url: '/api/me', headers: H(userTok) })).json();
  assert.equal(meOn.access.histOthers, true);
  const a = yClient(docId + '~hist', H(userTok));
  await a.ready; await wait(30);
  assert.equal(a.closed, null);
  await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { access: { histOthers: false } } });
  await wait(50);
  assert.equal(a.closed, 4403, 'åpen tilkobling kastes ut');
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: H(userTok) })).json().access.histOthers, false);
  const b = yClient(docId + '~hist', H(userTok));
  await b.ready;
  assert.equal(b.closed, 4403);
  const adm = yClient(docId + '~hist', H(adminTok));
  await adm.ready; await wait(30);
  assert.equal(adm.closed, null, 'admin ser fortsatt historikken');
  adm.ws.close();
  await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: H(adminTok), payload: { access: { histOthers: true } } });
});

test('eksisterende historikk flyttes til historikkrommet', async () => {
  const id = (await app.inject({ method: 'POST', url: '/api/docs', headers: H(adminTok), payload: { doc: { title: 'Gammel', blocks: [] } } })).json().id;
  const old = new Y.Doc();
  applyDocToY(old, { title: 'Gammel', authors: '', group: '', folder: '', blocks: [] });
  old.getArray('history').push([{ id: 'h1', what: 'Før' }, { id: 'h2', what: 'Enda før' }]);
  app.db.prepare('INSERT INTO ydocs (doc_id, state, updated) VALUES (?, ?, ?)').run(id, Y.encodeStateAsUpdate(old), Date.now());
  const m = yClient(id, H(adminTok)), h = yClient(id + '~hist', H(adminTok));
  await Promise.all([m.ready, h.ready]); await wait(50);
  assert.equal(m.doc.getArray('history').length, 0);
  assert.deepEqual(h.doc.getArray('history').toArray().map(x => x.id), ['h1', 'h2']);
  m.ws.close(); h.ws.close();
});

test('uten innlogging og uten lenketilgang stenges sanntid', async () => {
  const c = yClient(docId, {});
  await c.ready;
  assert.equal(c.closed, 4401);
});

test('backup-dump kan gjenopprettes', () => {
  const n = app.db.prepare('SELECT COUNT(*) n FROM documents').get().n;
  const dump = { documents: app.db.prepare('SELECT * FROM documents').all() };
  app.db.exec('DELETE FROM documents');
  restoreDump(app.db, dump);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM documents').get().n, n);
});
