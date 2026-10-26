import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWs from '@fastify/websocket';
import cron from 'node-cron';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { openDb, getSetting, setSetting } from './db.js';
import { mask } from './config.js';
import { checkPass, createUser, ensureAdmin, newSession, userFromToken, tokenOf, docRole, RANK } from './auth.js';
import { compileTex } from './compile.js';
import { sendMail, inviteMail, sharedMail, commentMail, smtpProblem, transport } from './mail.js';
import { duckUpdate, startDuck, DUCK_RE, TOKEN_RE } from './duckdns.js';
import { testSmb, runBackup, listBackups, restoreBackup } from './backup.js';

const WEEK = 7 * 864e5;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function buildApp(cfg, { compile = compileTex, fetchImpl = fetch, background = true } = {}) {
  const db = openDb(cfg.dataDir);
  ensureAdmin(db, cfg);
  const app = Fastify({ logger: background, bodyLimit: 50 * 1024 * 1024 });
  app.decorate('db', db);
  await app.register(fastifyWs);

  // Admin-innstillinger: miljøvariabler er standard, lagrede endringer overstyrer.
  const eff = k => ({ ...cfg[k], ...getSetting(db, k, {}) });
  const publicUrl = req => cfg.publicUrl || `${req.protocol}://${req.headers.host}`;

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
  const setCookie = (reply, token) => reply.header('set-cookie', `kobling=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);

  // ---- konto ----
  app.post('/api/login', async (req, reply) => {
    const { email, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
    if (!u || !checkPass(String(password || ''), u.pass)) return reply.code(401).send({ error: 'Feil e-post eller passord.' });
    const token = newSession(db, u.id);
    setCookie(reply, token);
    return { token, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
  });
  app.get('/api/me', { preHandler: authed }, async req => ({ user: req.user }));

  // ---- dokumenter ----
  app.get('/api/docs', { preHandler: authed }, async req => db.prepare(`
    SELECT d.id, d.title, d.updated, CASE WHEN d.owner = ? THEN 'Eier' ELSE m.role END AS role
    FROM documents d LEFT JOIN memberships m ON m.doc_id = d.id AND m.user_id = ?
    WHERE d.owner = ? OR m.user_id IS NOT NULL ORDER BY d.updated DESC`).all(req.user.id, req.user.id, req.user.id));
  app.post('/api/docs', { preHandler: authed }, async req => {
    const doc = req.body?.doc || {};
    const id = randomUUID();
    db.prepare('INSERT INTO documents (id, owner, title, data, updated) VALUES (?, ?, ?, ?, ?)').run(id, req.user.id, doc.title || 'Uten tittel', JSON.stringify({ ...doc, id }), Date.now());
    return { id };
  });
  app.get('/api/docs/:id', { preHandler: needRole('Kan lese') }, async req => {
    const d = db.prepare('SELECT data FROM documents WHERE id = ?').get(req.params.id);
    return { doc: JSON.parse(d.data), role: req.docRole };
  });
  app.put('/api/docs/:id', { preHandler: [needRole('Kan redigere')] }, async req => {
    const doc = req.body?.doc;
    db.prepare('UPDATE documents SET data = ?, title = ?, updated = ? WHERE id = ?').run(JSON.stringify(doc), doc.title || '', Date.now(), req.params.id);
    if (req.body.what) db.prepare('INSERT INTO versions (doc_id, user_id, what, snapshot, created) VALUES (?, ?, ?, ?, ?)').run(req.params.id, req.user?.id || null, req.body.what, JSON.stringify(doc.blocks || []), Date.now());
    return { ok: true };
  });
  app.delete('/api/docs/:id', { preHandler: needRole('Eier') }, async req => {
    for (const t of ['memberships', 'invites', 'comments', 'versions', 'files']) db.prepare(`DELETE FROM ${t} WHERE doc_id = ?`).run(req.params.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    return { ok: true };
  });
  app.get('/api/docs/:id/versions', { preHandler: needRole('Kan lese') }, async req =>
    db.prepare('SELECT v.id, v.what, v.created, u.name AS who FROM versions v LEFT JOIN users u ON u.id = v.user_id WHERE doc_id = ? ORDER BY v.id DESC LIMIT 200').all(req.params.id));
  app.get('/api/docs/:id/versions/:vid', { preHandler: needRole('Kan lese') }, async req => {
    const v = db.prepare('SELECT snapshot FROM versions WHERE id = ? AND doc_id = ?').get(req.params.vid, req.params.id);
    return v ? { blocks: JSON.parse(v.snapshot) } : { blocks: null };
  });

  // ---- kommentarer ----
  app.get('/api/docs/:id/comments', { preHandler: needRole('Kan lese') }, async req =>
    db.prepare('SELECT c.*, u.name AS by_name FROM comments c JOIN users u ON u.id = c.user_id WHERE doc_id = ? ORDER BY created').all(req.params.id));
  app.post('/api/docs/:id/comments', { preHandler: needRole('Kan kommentere') }, async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Logg inn først.' });
    const text = String(req.body?.text || '').trim();
    if (!text) return reply.code(400).send({ error: 'Skriv en kommentar først.' });
    const id = randomUUID();
    db.prepare('INSERT INTO comments (id, doc_id, user_id, bid, text, created) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.params.id, req.user.id, req.body.bid || null, text, Date.now());
    const smtp = eff('smtp');
    if (smtp.notify) {
      const d = db.prepare('SELECT title, owner FROM documents WHERE id = ?').get(req.params.id);
      const others = db.prepare(`SELECT email FROM users WHERE id != ? AND (id = ? OR id IN (SELECT user_id FROM memberships WHERE doc_id = ?))`).all(req.user.id, d.owner, req.params.id);
      for (const o of others) sendMail(db, smtp, 'kommentar', o.email, commentMail({ from: req.user.name, docTitle: d.title, text, url: publicUrl(req) + '/?doc=' + req.params.id }));
    }
    return { id };
  });
  app.patch('/api/docs/:id/comments/:cid', { preHandler: needRole('Kan kommentere') }, async req => {
    db.prepare('UPDATE comments SET resolved = ? WHERE id = ? AND doc_id = ?').run(req.body?.resolved ? 1 : 0, req.params.cid, req.params.id);
    return { ok: true };
  });

  // ---- deling ----
  app.get('/api/docs/:id/people', { preHandler: needRole('Kan lese') }, async req => ({
    people: db.prepare(`SELECT u.id, u.name, u.email, CASE WHEN d.owner = u.id THEN 'Eier' ELSE m.role END AS role FROM documents d
      JOIN users u ON u.id = d.owner OR u.id IN (SELECT user_id FROM memberships WHERE doc_id = d.id)
      LEFT JOIN memberships m ON m.doc_id = d.id AND m.user_id = u.id WHERE d.id = ?`).all(req.params.id),
    invites: db.prepare('SELECT email, role, expires FROM invites WHERE doc_id = ? AND accepted IS NULL AND expires > ?').all(req.params.id, Date.now()),
    linkRole: db.prepare('SELECT link_role FROM documents WHERE id = ?').get(req.params.id).link_role,
    smtpReady: !smtpProblem(eff('smtp'))
  }));
  app.post('/api/docs/:id/invites', { preHandler: needRole('Kan redigere') }, async (req, reply) => {
    const email = String(req.body?.email || '').trim().toLowerCase(), role = req.body?.role || 'Kan redigere';
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    if (!RANK[role] || role === 'Eier') return reply.code(400).send({ error: 'Ukjent rolle.' });
    const code = randomBytes(9).toString('base64url');
    db.prepare('INSERT INTO invites (code, doc_id, email, role, invited_by, expires) VALUES (?, ?, ?, ?, ?, ?)').run(code, req.params.id, email, role, req.user?.id || '', Date.now() + WEEK);
    const url = publicUrl(req) + '/i/' + code;
    let mail = null;
    if (req.body?.sendMail !== false) {
      const d = db.prepare('SELECT title FROM documents WHERE id = ?').get(req.params.id);
      mail = await sendMail(db, eff('smtp'), 'invitasjon', email, inviteMail({ from: req.user?.name || 'Noen', docTitle: d.title, role, url, message: req.body?.message }));
    }
    return { url, mail };
  });
  app.put('/api/docs/:id/people/:uid', { preHandler: needRole('Eier') }, async (req, reply) => {
    const role = req.body?.role;
    if (role === 'Fjern') db.prepare('DELETE FROM memberships WHERE doc_id = ? AND user_id = ?').run(req.params.id, req.params.uid);
    else if (RANK[role] && role !== 'Eier') db.prepare('UPDATE memberships SET role = ? WHERE doc_id = ? AND user_id = ?').run(role, req.params.id, req.params.uid);
    else return reply.code(400).send({ error: 'Ukjent rolle.' });
    return { ok: true };
  });
  app.put('/api/docs/:id/link', { preHandler: needRole('Eier') }, async req => {
    const role = RANK[req.body?.role] && req.body.role !== 'Eier' ? req.body.role : 'none';
    db.prepare('UPDATE documents SET link_role = ? WHERE id = ?').run(role, req.params.id);
    return { linkRole: role };
  });
  app.post('/api/docs/:id/send', { preHandler: needRole('Kan lese') }, async (req, reply) => {
    const { to, subject, message, attachments = [] } = req.body || {};
    if (!EMAIL_RE.test(String(to || ''))) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    const d = db.prepare('SELECT title FROM documents WHERE id = ?').get(req.params.id);
    const mail = sharedMail({ from: req.user?.name || 'Noen', docTitle: d.title, url: publicUrl(req) + '/?doc=' + req.params.id, message });
    if (subject) mail.subject = subject;
    return sendMail(db, eff('smtp'), 'dokument', to, mail, attachments.map(a => ({ filename: a.name, content: Buffer.from(a.b64, 'base64') })));
  });

  // Invitasjonslenke: gyldig 7 dager, virker uten konto (oppretter gjestekonto).
  app.get('/i/:code', async (req, reply) => {
    const inv = db.prepare('SELECT * FROM invites WHERE code = ?').get(req.params.code);
    if (!inv || inv.expires < Date.now()) return reply.code(410).type('text/html').send('<p style="font-family:sans-serif">Invitasjonen er utløpt eller finnes ikke.</p>');
    let u = db.prepare('SELECT * FROM users WHERE email = ?').get(inv.email);
    if (!u) u = createUser(db, { email: inv.email, name: inv.email.split('@')[0] });
    db.prepare('INSERT INTO memberships (doc_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(doc_id, user_id) DO UPDATE SET role = excluded.role').run(inv.doc_id, u.id, inv.role);
    db.prepare('UPDATE invites SET accepted = ? WHERE code = ?').run(Date.now(), inv.code);
    setCookie(reply, newSession(db, u.id));
    return reply.redirect('/?doc=' + inv.doc_id);
  });

  // ---- kompilering ----
  app.post('/api/compile', async (req, reply) => {
    const { tex, files, engine } = req.body || {};
    if (typeof tex !== 'string' || !tex.includes('\\documentclass')) return reply.code(400).send({ error: 'Mangler LaTeX-kilde.' });
    const r = await compile({ tex, files, engine });
    if (!r.ok) return reply.code(422).send({ errors: r.errors, log: r.log.slice(-20000), ms: r.ms });
    reply.header('x-compile-ms', String(r.ms));
    return reply.type('application/pdf').send(r.pdf);
  });

  // ---- administrasjon (kun admin) ----
  const ADMIN_KEYS = ['duck', 'smb', 'smtp'];
  app.get('/api/admin/settings', { preHandler: admin }, async () => Object.fromEntries(ADMIN_KEYS.map(k => [k, mask(eff(k))])));
  app.put('/api/admin/settings', { preHandler: admin }, async (req, reply) => {
    const body = req.body || {};
    if (body.duck?.domain && !DUCK_RE.test(body.duck.domain)) return reply.code(400).send({ error: 'Subdomenet kan bare ha små bokstaver, tall og bindestrek.' });
    if (body.duck?.token && !/^•+$/.test(body.duck.token) && !TOKEN_RE.test(body.duck.token)) return reply.code(400).send({ error: 'Token må være en UUID.' });
    for (const k of ADMIN_KEYS) if (body[k]) {
      const cur = getSetting(db, k, {}), next = { ...cur };
      for (const [f, v] of Object.entries(body[k])) if (!(typeof v === 'string' && /^•+$/.test(v))) next[f] = v; // maskert = uendret
      setSetting(db, k, next);
    }
    reschedule();
    return Object.fromEntries(ADMIN_KEYS.map(k => [k, mask(eff(k))]));
  });
  app.get('/api/admin/users', { preHandler: admin }, async () => db.prepare('SELECT id, email, name, role, created FROM users ORDER BY created').all());
  app.post('/api/admin/users', { preHandler: admin }, async (req, reply) => {
    const { email, name, password, role } = req.body || {};
    if (!EMAIL_RE.test(String(email || ''))) return reply.code(400).send({ error: 'Skriv en gyldig e-postadresse.' });
    return createUser(db, { email, name: name || email.split('@')[0], password, role: role === 'admin' ? 'admin' : 'user' });
  });
  app.post('/api/admin/duckdns/update', { preHandler: admin }, async () => duckUpdate(eff('duck'), fetchImpl));
  app.post('/api/admin/smtp/test', { preHandler: admin }, async () => {
    const m = eff('smtp'), p = smtpProblem(m);
    if (p) return { ok: false, msg: p };
    try { await transport(m).verify(); return { ok: true, msg: 'Tilkoblet ' + m.host + ':' + m.port } } catch (e) { return { ok: false, msg: e.message } }
  });
  app.get('/api/admin/mail-log', { preHandler: admin }, async () => db.prepare('SELECT * FROM mail_log ORDER BY id DESC LIMIT 100').all());
  app.post('/api/admin/backup/test', { preHandler: admin }, async () => testSmb(eff('smb')));
  app.post('/api/admin/backup/run', { preHandler: admin }, async () => runBackup(db, eff('smb')));
  app.get('/api/admin/backups', { preHandler: admin }, async () => listBackups(eff('smb')));
  app.post('/api/admin/backups/:name/restore', { preHandler: admin }, async req => restoreBackup(db, eff('smb'), req.params.name));

  // ---- sanntid: rom per dokument, siste tilstand lagres og sendes til nye deltakere ----
  const rooms = new Map();
  app.get('/sync/:room', { websocket: true }, (socket, req) => {
    const room = String(req.params.room).slice(0, 80);
    const open = !cfg.adminEmail; // uten konfigurert admin (utvikling) er synk åpen
    if (!open && !req.user) { socket.close(4401, 'Logg inn først'); return }
    if (!rooms.has(room)) rooms.set(room, new Set());
    const peers = rooms.get(room);
    peers.add(socket);
    const last = getSetting(db, 'sync:' + room, null);
    if (last) socket.send(JSON.stringify(last));
    socket.on('message', raw => {
      let msg; try { msg = JSON.parse(String(raw)) } catch { return }
      if (msg && msg.docs) setSetting(db, 'sync:' + room, msg);
      for (const p of peers) if (p !== socket && p.readyState === 1) p.send(String(raw));
    });
    socket.on('close', () => { peers.delete(socket); if (!peers.size) rooms.delete(room) });
  });

  // ---- web-klienten ----
  if (cfg.webDir && existsSync(cfg.webDir)) {
    await app.register(fastifyStatic, { root: cfg.webDir });
    app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Finnes ikke.' }) : reply.sendFile('index.html'));
  }
  app.get('/api/health', async () => ({ ok: true }));

  // ---- bakgrunnsjobber ----
  let job = null, stopDuck = null;
  function reschedule() {
    if (!background) return;
    job?.stop();
    const s = eff('smb');
    if (s.on && cron.validate(s.cron)) job = cron.schedule(s.cron, () => runBackup(db, s).then(r => app.log.info({ backup: r })));
  }
  if (background) {
    reschedule();
    stopDuck = startDuck(() => eff('duck'), r => app.log.info({ duckdns: r }));
  }
  app.addHook('onClose', async () => { job?.stop(); stopDuck?.(); db.close() });
  return app;
}
