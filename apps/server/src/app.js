import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWs from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import cron from 'node-cron';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { openDb, getSetting, setSetting } from './db.js';
import { checkPass, hashPass, createUser, ensureAdmin, newSession, userFromToken, tokenOf, docRole, RANK } from './auth.js';
import { compileTex, compileCache, synctexEdit, synctexView } from './compile.js';
import { sendMail, inviteMail, sharedMail, commentMail, testMail, smtpProblem, transport } from './mail.js';
import { duckUpdate, startDuck, DUCK_RE, TOKEN_RE } from './duckdns.js';
import { testSmb, runBackup, listBackups, restoreBackup, downloadBackup } from './backup.js';
import { createSync } from './ysync.js';
import { startTls } from './tls.js';

const WEEK = 7 * 864e5;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROLES = ['Kan redigere', 'Kan kommentere', 'Kan lese'];

export async function buildApp(cfg, { compile = compileTex, fetchImpl = fetch, background = true } = {}) {
  const db = openDb(cfg.dataDir);
  ensureAdmin(db, cfg);
  const app = Fastify({ logger: background, bodyLimit: 50 * 1024 * 1024 });
  app.decorate('db', db);
  await app.register(fastifyWs);
  // Desktop-appen (Tauri) kjører fra egen opprinnelse og trenger CORS.
  await app.register(fastifyCors, {
    origin: (o, cb) => cb(null, !o || /^(tauri:\/\/localhost|https?:\/\/tauri\.localhost)$/.test(o)),
    credentials: true,
    exposedHeaders: ['x-compile-id', 'x-compile-ms']
  });

  // Admin-innstillinger: miljøvariabler er standard, lagrede endringer overstyrer.
  const CRON = { hourly: '0 * * * *', daily: '0 3 * * *', weekly: '0 3 * * 1' };
  const eff = k => {
    const v = { ...cfg[k], ...getSetting(db, k, {}) };
    // Klienten lagrer tidsplan og innhold som i skjemaet; serveren bruker cron og liste.
    if (k === 'smb') {
      if (v.schedule && CRON[v.schedule]) v.cron = CRON[v.schedule];
      if (v.incl) v.include = Object.keys(v.incl).filter(x => v.incl[x]);
      v.keep = Number(v.keep) || 14;
    }
    return v;
  };
  const publicUrl = req => cfg.publicUrl || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`;
  const docUrl = (req, id) => publicUrl(req) + '/?doc=' + id;

  app.decorateRequest('user', null);
  app.addHook('onRequest', async req => { req.user = userFromToken(db, tokenOf(req)) });
  const authed = async (req, reply) => { if (!req.user) return reply.code(401).send({ error: 'Logg inn først.' }) };
  const admin = async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Logg inn først.' });
    if (req.user.role !== 'admin') return reply.code(403).send({ error: 'Bare for administrator' });
  };
  const needRole = min => async (req, reply) => {
    const r = docRole(db, req.params.id, req.user);
    if (!r) return reply.code(req.user ? 404 : 401).send({ error: 'Fant ikke dokumentet.' });
    if (RANK[r] < RANK[min]) return reply.code(403).send({ error: 'Du har ikke tilgang til dette.' });
    req.docRole = r;
  };
  const setCookie = (reply, token, age = 30 * 86400) =>
    reply.header('set-cookie', `kobling=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}`);
  const login = (reply, u) => {
    const token = newSession(db, u.id);
    setCookie(reply, token);
    return { token, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
  };
  const docTitle = id => (db.prepare('SELECT title FROM documents WHERE id = ?').get(id) || {}).title || '';

  // ---- sanntid (Yjs) ----
  const sync = createSync(db, {
    onComment: (docId, by, c) => {
      const smtp = eff('smtp');
      if (!smtp.notify || !c) return;
      const d = db.prepare('SELECT title, owner FROM documents WHERE id = ?').get(docId);
      if (!d) return;
      const url = (cfg.publicUrl || '') + '/?doc=' + docId;
      db.prepare(`SELECT email FROM users WHERE id != ? AND (id = ? OR id IN (SELECT user_id FROM memberships WHERE doc_id = ?))`)
        .all(by.id, d.owner, docId)
        .forEach(o => sendMail(db, smtp, 'kommentar', o.email, commentMail({ from: by.name, docTitle: d.title, text: c.text, url }), [], { userId: by.id, docId, url }));
    }
  });

  // ---- konto ----
  app.get('/api/setup', async () => ({ needed: !db.prepare('SELECT 1 FROM users LIMIT 1').get() }));
  app.post('/api/setup', async (req, reply) => {
    if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return reply.code(409).send({ error: 'Serveren er allerede satt opp.' });
    const { email, name, password } = req.body || {};
    if (!EMAIL_RE.test(String(email || ''))) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    if (String(password || '').length < 8) return reply.code(400).send({ error: 'Passordet må ha minst 8 tegn.' });
    return login(reply, createUser(db, { email, name: name || email.split('@')[0], password, role: 'admin' }));
  });
  app.post('/api/login', async (req, reply) => {
    const { email, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
    if (!u || !checkPass(String(password || ''), u.pass)) return reply.code(401).send({ error: 'Feil e-post eller passord.' });
    return login(reply, u);
  });
  app.post('/api/logout', async (req, reply) => {
    const t = tokenOf(req);
    if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
    setCookie(reply, '', 0);
    return { ok: true };
  });
  app.get('/api/me', { preHandler: authed }, async req => ({ user: req.user }));
  app.put('/api/me', { preHandler: authed }, async (req, reply) => {
    const { name, password, current } = req.body || {};
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).slice(0, 80), req.user.id);
    if (password) {
      const u = db.prepare('SELECT pass FROM users WHERE id = ?').get(req.user.id);
      if (u.pass && !checkPass(String(current || ''), u.pass)) return reply.code(400).send({ error: 'Nåværende passord er feil.' });
      if (String(password).length < 8) return reply.code(400).send({ error: 'Passordet må ha minst 8 tegn.' });
      db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPass(String(password)), req.user.id);
    }
    return { user: db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.id) };
  });
  // E-poster jeg har sendt (SISTE E-POSTER i delingspanelet)
  app.get('/api/mails', { preHandler: authed }, async req =>
    db.prepare(`SELECT id, kind, to_addr, subject, status, created, doc_id, url, body, attachments FROM mail_log
      WHERE user_id = ? AND kind IN ('invite', 'doc') ORDER BY id DESC LIMIT 30`).all(req.user.id));

  // ---- dokumenter ----
  app.get('/api/docs', { preHandler: authed }, async req => db.prepare(`
    SELECT d.id, d.data, d.updated, CASE WHEN d.owner = ? THEN 'Eier' ELSE m.role END AS role
    FROM documents d LEFT JOIN memberships m ON m.doc_id = d.id AND m.user_id = ?
    WHERE d.owner = ? OR m.user_id IS NOT NULL ORDER BY d.updated DESC`).all(req.user.id, req.user.id, req.user.id)
    .map(r => ({ ...JSON.parse(r.data), id: r.id, role: r.role, updated: r.updated })));
  app.post('/api/docs', { preHandler: authed }, async req => {
    const doc = req.body?.doc || {};
    const id = randomUUID();
    db.prepare('INSERT INTO documents (id, owner, title, data, updated) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.user.id, doc.title || 'Uten tittel', JSON.stringify({ ...doc, id, blocks: doc.blocks || [] }), Date.now());
    return { id };
  });
  app.get('/api/docs/:id', { preHandler: needRole('Kan lese') }, async req => ({ doc: sync.readDoc(req.params.id), role: req.docRole }));
  app.delete('/api/docs/:id', { preHandler: needRole('Eier') }, async req => {
    for (const t of ['memberships', 'invites', 'ydocs']) db.prepare(`DELETE FROM ${t} WHERE doc_id = ?`).run(req.params.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    return { ok: true };
  });

  // ---- deling ----
  app.get('/api/docs/:id/people', { preHandler: needRole('Kan lese') }, async req => ({
    people: db.prepare(`SELECT u.id, u.name, u.email, CASE WHEN d.owner = u.id THEN 'Eier' ELSE m.role END AS role FROM documents d
      JOIN users u ON u.id = d.owner OR u.id IN (SELECT user_id FROM memberships WHERE doc_id = d.id)
      LEFT JOIN memberships m ON m.doc_id = d.id AND m.user_id = u.id WHERE d.id = ? ORDER BY CASE WHEN d.owner = u.id THEN 0 ELSE 1 END, u.name`).all(req.params.id),
    invites: db.prepare(`SELECT email, role, expires FROM invites WHERE doc_id = ? AND accepted IS NULL AND expires > ?
      AND email NOT IN (SELECT u.email FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.doc_id = ?)`).all(req.params.id, Date.now(), req.params.id),
    linkRole: db.prepare('SELECT link_role FROM documents WHERE id = ?').get(req.params.id).link_role,
    smtpReady: !smtpProblem(eff('smtp'))
  }));
  app.post('/api/docs/:id/invites', { preHandler: needRole('Kan redigere') }, async (req, reply) => {
    const email = String(req.body?.email || '').trim().toLowerCase(), role = req.body?.role || 'Kan redigere';
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    if (!ROLES.includes(role)) return reply.code(400).send({ error: 'Ukjent rolle.' });
    const existing = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
    const code = randomBytes(9).toString('base64url');
    db.prepare('INSERT INTO invites (code, doc_id, email, role, invited_by, expires) VALUES (?, ?, ?, ?, ?, ?)').run(code, req.params.id, email, role, req.user?.id || '', Date.now() + WEEK);
    if (existing) db.prepare('INSERT INTO memberships (doc_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(doc_id, user_id) DO UPDATE SET role = excluded.role').run(req.params.id, existing.id, role);
    const url = publicUrl(req) + '/i/' + code;
    let mail = null;
    if (req.body?.sendMail !== false) {
      mail = await sendMail(db, eff('smtp'), 'invite', email,
        inviteMail({ from: req.user?.name || 'Noen', docTitle: docTitle(req.params.id), role, url, message: req.body?.message }), [],
        { userId: req.user?.id, docId: req.params.id, url, body: req.body?.message });
    }
    return { url, code, mail, existing: existing ? existing.name : null };
  });
  app.put('/api/docs/:id/people/:uid', { preHandler: needRole('Eier') }, async (req, reply) => {
    const role = req.body?.role;
    if (role === 'Fjern') db.prepare('DELETE FROM memberships WHERE doc_id = ? AND user_id = ?').run(req.params.id, req.params.uid);
    else if (ROLES.includes(role)) db.prepare('UPDATE memberships SET role = ? WHERE doc_id = ? AND user_id = ?').run(role, req.params.id, req.params.uid);
    else return reply.code(400).send({ error: 'Ukjent rolle.' });
    return { ok: true };
  });
  app.put('/api/docs/:id/link', { preHandler: needRole('Eier') }, async req => {
    const role = ROLES.includes(req.body?.role) ? req.body.role : 'none';
    db.prepare('UPDATE documents SET link_role = ? WHERE id = ?').run(role, req.params.id);
    return { linkRole: role };
  });
  app.post('/api/docs/:id/send', { preHandler: needRole('Kan lese') }, async (req, reply) => {
    const { to, subject, message, attachments = [] } = req.body || {};
    const list = String(to || '').split(/[,;\s]+/).filter(Boolean);
    if (!list.length || list.some(x => !EMAIL_RE.test(x))) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    const url = docUrl(req, req.params.id);
    const mail = sharedMail({ from: req.user?.name || 'Noen', docTitle: docTitle(req.params.id), url, message });
    if (subject) mail.subject = subject;
    const att = attachments.map(a => ({ filename: a.name, content: Buffer.from(a.b64, 'base64') }));
    const results = [];
    for (const x of list) results.push(await sendMail(db, eff('smtp'), 'doc', x, mail, att, { userId: req.user?.id, docId: req.params.id, url, body: message }));
    return { ok: results.every(r => r.ok), queued: results.some(r => r.queued), error: results.find(r => r.error)?.error };
  });

  // Invitasjonslenke: gyldig 7 dager, virker uten konto (oppretter konto uten passord).
  app.get('/i/:code', async (req, reply) => {
    const inv = db.prepare('SELECT * FROM invites WHERE code = ?').get(req.params.code);
    if (!inv || inv.expires < Date.now()) return reply.code(410).type('text/html; charset=utf-8')
      .send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#fbfaf8;color:#1f1e1c;padding:48px"><b>Kobling</b><p>Invitasjonen er utløpt eller finnes ikke. Be om en ny lenke.</p>');
    let u = db.prepare('SELECT * FROM users WHERE email = ?').get(inv.email);
    if (!u) u = createUser(db, { email: inv.email, name: inv.email.split('@')[0] });
    if (!db.prepare('SELECT 1 FROM documents WHERE id = ? AND owner = ?').get(inv.doc_id, u.id))
      db.prepare('INSERT INTO memberships (doc_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(doc_id, user_id) DO UPDATE SET role = excluded.role').run(inv.doc_id, u.id, inv.role);
    db.prepare('UPDATE invites SET accepted = ? WHERE code = ?').run(Date.now(), inv.code);
    setCookie(reply, newSession(db, u.id));
    return reply.redirect('/?doc=' + inv.doc_id);
  });

  // ---- kompilering + SyncTeX ----
  const cache = compileCache();
  app.post('/api/compile', { preHandler: authed }, async (req, reply) => {
    const { tex, files, engine } = req.body || {};
    if (typeof tex !== 'string' || !tex.includes('\\documentclass')) return reply.code(400).send({ error: 'Mangler LaTeX-kilde.' });
    const r = await compile({ tex, files, engine, keep: true });
    if (!r.ok) return reply.code(422).send({ errors: r.errors, log: r.log.slice(-20000), ms: r.ms });
    reply.header('x-compile-ms', String(r.ms));
    if (r.dir) reply.header('x-compile-id', cache.put(r.dir));
    return reply.type('application/pdf').send(r.pdf);
  });
  app.post('/api/compile/:cid/edit', { preHandler: authed }, async (req, reply) => {
    const dir = cache.get(req.params.cid);
    if (!dir) return reply.code(404).send({ error: 'Kompiler på nytt.' });
    const { page, x, y } = req.body || {};
    return { line: await synctexEdit(dir, Number(page), Number(x), Number(y)) };
  });
  app.post('/api/compile/:cid/view', { preHandler: authed }, async (req, reply) => {
    const dir = cache.get(req.params.cid);
    if (!dir) return reply.code(404).send({ error: 'Kompiler på nytt.' });
    return { boxes: await synctexView(dir, Number(req.body?.line)) };
  });

  // ---- administrasjon (kun admin) ----
  const ADMIN_KEYS = ['duck', 'smb', 'smtp', 'deploy'];
  const adminState = () => Object.fromEntries(ADMIN_KEYS.map(k => [k, eff(k)]));
  const duckLog = [];
  let backupRun = null;
  app.get('/api/admin/settings', { preHandler: admin }, async () => ({ ...adminState(), duckLog, backupRun }));
  app.put('/api/admin/settings', { preHandler: admin }, async (req, reply) => {
    const body = req.body || {};
    if (body.duck?.domain && !DUCK_RE.test(body.duck.domain)) return reply.code(400).send({ error: 'Subdomenet kan bare ha små bokstaver, tall og bindestrek.' });
    if (body.duck?.token && !TOKEN_RE.test(body.duck.token)) return reply.code(400).send({ error: 'Token må være en UUID.' });
    for (const k of ADMIN_KEYS) if (body[k] && typeof body[k] === 'object') setSetting(db, k, { ...getSetting(db, k, {}), ...body[k] });
    reschedule();
    return adminState();
  });
  app.get('/api/admin/users', { preHandler: admin }, async () => db.prepare('SELECT id, email, name, role, created FROM users ORDER BY created').all());
  app.post('/api/admin/users', { preHandler: admin }, async (req, reply) => {
    const { email, name, password, role } = req.body || {};
    if (!EMAIL_RE.test(String(email || ''))) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(String(email).toLowerCase())) return reply.code(409).send({ error: 'Brukeren finnes allerede.' });
    return createUser(db, { email, name: name || email.split('@')[0], password, role: role === 'admin' ? 'admin' : 'user' });
  });
  app.post('/api/admin/duckdns/update', { preHandler: admin }, async () => {
    const r = await duckUpdate(eff('duck'), fetchImpl);
    duckLog.unshift({ t: Date.now(), ok: r.ok, txt: r.msg, ip: r.ip || '' });
    duckLog.length = Math.min(duckLog.length, 8);
    return { ...r, log: duckLog };
  });
  app.post('/api/admin/smtp/test', { preHandler: admin }, async req => {
    const m = eff('smtp'), p = smtpProblem(m);
    if (p) return { ok: false, msg: p };
    try { await transport(m).verify() } catch (e) { return { ok: false, msg: 'Kunne ikke koble til: ' + e.message } }
    const to = req.user.email;
    const r = await sendMail(db, m, 'test', to, testMail(publicUrl(req)), [], { userId: req.user.id, url: publicUrl(req) });
    return r.ok ? { ok: true, msg: `Koblet til ${m.host}:${m.port} med ${String(m.sec).toUpperCase()} som ${m.user || '(ingen bruker)'}. Test-e-post sendt til ${to}.` } : { ok: false, msg: r.error };
  });
  app.get('/api/admin/mail-log', { preHandler: admin }, async () => db.prepare('SELECT * FROM mail_log ORDER BY id DESC LIMIT 100').all());
  app.post('/api/admin/backup/test', { preHandler: admin }, async () => testSmb(eff('smb')));
  app.post('/api/admin/backup/run', { preHandler: admin }, async (req, reply) => {
    if (backupRun) return reply.code(409).send({ error: 'En backup kjører allerede.' });
    sync.flushAll();
    backupRun = { pct: 0, step: '' };
    runBackup(db, eff('smb'), (step, pct) => { backupRun = { step, pct } })
      .then(r => { backupRun = null; lastBackup = r })
      .catch(e => { backupRun = null; lastBackup = { ok: false, msg: e.message } });
    return { started: true };
  });
  let lastBackup = null;
  app.get('/api/admin/backup/status', { preHandler: admin }, async () => ({ run: backupRun, last: lastBackup }));
  app.get('/api/admin/backups', { preHandler: admin }, async () => listBackups(eff('smb')));
  app.get('/api/admin/backups/:name', { preHandler: admin }, async (req, reply) => {
    const buf = await downloadBackup(eff('smb'), req.params.name);
    if (!buf) return reply.code(404).send({ error: 'Fant ikke backupen.' });
    return reply.type('application/zstd').header('content-disposition', `attachment; filename="${req.params.name}"`).send(buf);
  });
  app.post('/api/admin/backups/:name/restore', { preHandler: admin }, async req => {
    const r = await restoreBackup(db, eff('smb'), req.params.name);
    if (r.ok) sync.reset();
    return r;
  });

  app.get('/sync/:id', { websocket: true }, (socket, req) => {
    const role = docRole(db, req.params.id, req.user);
    if (!req.user && !role) { socket.close(4401, 'Logg inn først'); return }
    if (!role) { socket.close(4403, 'Ingen tilgang'); return }
    sync.handle(socket, req.params.id, req.user || { id: null, name: 'Gjest' }, role);
  });

  // ---- web-klienten ----
  app.get('/api/health', async () => ({ ok: true }));
  if (cfg.webDir && existsSync(cfg.webDir)) {
    await app.register(fastifyStatic, { root: cfg.webDir });
    app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Finnes ikke.' }) : reply.sendFile('index.html'));
  }

  // ---- bakgrunnsjobber ----
  let job = null, stopDuck = null, stopTls = null;
  function reschedule() {
    if (!background) return;
    job?.stop();
    const s = eff('smb');
    if (s.on && cron.validate(s.cron)) job = cron.schedule(s.cron, () => { sync.flushAll(); runBackup(db, eff('smb')).then(r => { lastBackup = r; app.log.info({ backup: r }) }) });
  }
  if (background) {
    reschedule();
    stopDuck = startDuck(() => eff('duck'), r => { duckLog.unshift({ t: Date.now(), ok: r.ok, txt: r.msg, ip: r.ip || '' }); duckLog.length = Math.min(duckLog.length, 8) });
    app.addHook('onReady', async () => {
      stopTls = await startTls(app, { getDuck: () => eff('duck'), dataDir: cfg.dataDir, port: cfg.httpsPort, email: cfg.adminEmail || eff('smtp').user, log: x => app.log.info(x) });
    });
  }
  app.addHook('onClose', async () => { job?.stop(); stopDuck?.(); stopTls?.(); sync.flushAll(); cache.clear(); db.close() });
  app.decorate('sync', sync);
  return app;
}
