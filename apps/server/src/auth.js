import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';

const DAY = 864e5;

export const hashPass = p => { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(p, salt, 32).toString('hex') };
export const checkPass = (p, stored) => {
  if (!stored) return false;
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = scryptSync(p, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function createUser(db, { email, name, password, role = 'user' }) {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, email, name, role, pass, created) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase(), name, role, password ? hashPass(password) : null, Date.now());
  return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id);
}

export function ensureAdmin(db, cfg) {
  if (!cfg.adminEmail || !cfg.adminPassword) return;
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(cfg.adminEmail.toLowerCase());
  if (!u) createUser(db, { email: cfg.adminEmail, name: cfg.adminEmail.split('@')[0], password: cfg.adminPassword, role: 'admin' });
}

export function newSession(db, userId) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)').run(token, userId, Date.now() + 30 * DAY);
  return token;
}

export function userFromToken(db, token) {
  if (!token) return null;
  return db.prepare(`SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires > ?`).get(token, Date.now()) || null;
}

export function tokenOf(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)kobling=([a-f0-9]+)/);
  if (m) return m[1];
  // Nettlesere kan ikke sette headere på WebSocket; desktop-appen sender token i URL-en.
  const q = req.query && req.query.token;
  return typeof q === 'string' && /^[a-f0-9]{64}$/.test(q) ? q : null;
}

// Rolle per dokument: Eier > Kan redigere > Kan kommentere > Kan lese
export const RANK = { 'Kan lese': 1, 'Kan kommentere': 2, 'Kan redigere': 3, 'Eier': 4 };
export function docRole(db, docId, user) {
  const d = db.prepare('SELECT owner, link_role FROM documents WHERE id = ?').get(docId);
  if (!d) return null;
  if (user && d.owner === user.id) return 'Eier';
  const m = user && db.prepare('SELECT role FROM memberships WHERE doc_id = ? AND user_id = ?').get(docId, user.id);
  if (m) return m.role;
  return RANK[d.link_role] ? d.link_role : null;
}
