import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Backup til SMB med smbclient (ingen mount, virker i uprivilegerte LXC-er).
// Arkivet er .tar.zst av et JSON-dump per tabell; gjenoppretting leser det tilbake.

// docs: dokumenter med figurer, bilder, kommentarer og versjoner (alt ligger i Yjs-tilstanden).
// figs og hist er med i docs; hist tar i tillegg med e-postloggen.
const TABLES = { docs: ['documents', 'ydocs', 'memberships', 'invites'], figs: [], hist: ['mail_log'], users: ['users', 'sessions'] };

function run(cmd, args, opts = {}) {
  return new Promise(res => {
    let out = '';
    const p = spawn(cmd, args, { ...opts, env: { ...process.env, ...(opts.env || {}) } });
    p.stdout?.on('data', d => out += d); p.stderr?.on('data', d => out += d);
    p.on('error', e => res({ code: -1, out: String(e) }));
    p.on('close', code => res({ code, out }));
  });
}

const target = s => `//${s.host}/${s.share}`;
function smbArgs(s, command) {
  return [target(s), '-U', `${s.domain ? s.domain + '\\' : ''}${s.user}%${s.pass}`, '-m', 'SMB' + (s.ver === '2.1' ? '2' : '3'), '-c', command];
}
const quote = x => '"' + String(x).replace(/"/g, '') + '"';

export async function testSmb(s) {
  if (!s.host || !s.share) return { ok: false, msg: 'Fyll inn server og share.' };
  const r = await run('smbclient', smbArgs(s, `mkdir ${quote(s.path)}; cd ${quote(s.path)}; ls`));
  if (r.code === 0 || /NT_STATUS_OBJECT_NAME_COLLISION/.test(r.out)) return { ok: true, msg: 'Koblet til ' + target(s) + '/' + s.path };
  return { ok: false, msg: (r.out.match(/NT_STATUS_\w+/) || [r.out.trim().split('\n').pop()])[0] };
}

export async function runBackup(db, s, onStep = () => {}, suffix = '') {
  const dir = await mkdtemp(join(tmpdir(), 'kobling-bk-'));
  try {
    onStep('Pakker dokumenter og figurer …', 10);
    const name = backupName(suffix);
    onStep('Komprimerer med zstd …', 35);
    const tar = await packDump(dumpDb(db, s.include), dir, name);
    if (tar.code !== 0) return { ok: false, msg: 'Pakking feilet: ' + tar.out };
    onStep('Kopierer til ' + target(s) + '/' + s.path + ' …', 60);
    const up = await run('smbclient', smbArgs(s, `mkdir ${quote(s.path)}; cd ${quote(s.path)}; put ${quote(name)}`), { cwd: dir });
    if (up.code !== 0 && !/putting file/.test(up.out)) return { ok: false, msg: 'Opplasting feilet: ' + up.out.trim().split('\n').pop() };
    onStep('Fjerner backuper utover de ' + s.keep + ' nyeste …', 90);
    await prune(s);
    onStep('Ferdig', 100);
    const size = (await stat(join(dir, name))).size;
    return { ok: true, name, size };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const backupName = suffix => `kobling-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}${suffix}.tar.zst`;

export function dumpDb(db, include = Object.keys(TABLES)) {
  const dump = {};
  for (const k of include) for (const t of TABLES[k] || []) dump[t] = db.prepare(`SELECT * FROM ${t}`).all().map(r =>
    Object.fromEntries(Object.entries(r).map(([c, v]) => [c, v instanceof Uint8Array ? { b64: Buffer.from(v).toString('base64') } : v])));
  return dump;
}

async function packDump(dump, dir, name) {
  await mkdir(join(dir, 'kobling'), { recursive: true });
  await writeFile(join(dir, 'kobling', 'dump.json'), JSON.stringify(dump));
  return run('tar', ['--zstd', '-cf', name, 'kobling'], { cwd: dir });
}

// Sikkerhetskopi før gjenoppretting: til sharen når SMB er satt opp, ellers i datamappen.
export async function safetyBackup(db, s, dataDir) {
  if (s.host && s.share && s.user) {
    const r = await runBackup(db, { ...s, include: Object.keys(TABLES) }, () => {}, '_for-gjenoppretting');
    return r.ok ? { ok: true, name: r.name, where: '//' + s.host + '/' + s.share + '/' + s.path } : r;
  }
  const dir = join(dataDir, 'backups'), name = backupName('_for-gjenoppretting');
  const tmp = await mkdtemp(join(tmpdir(), 'kobling-sf-'));
  try {
    const t = await packDump(dumpDb(db), tmp, name);
    if (t.code !== 0) return { ok: false, msg: 'Pakking feilet: ' + t.out };
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), await readFile(join(tmp, name)));
    return { ok: true, name, where: dir };
  } finally { rm(tmp, { recursive: true, force: true }).catch(() => {}) }
}

// Leser en backup (.tar.zst fra sharen eller fil, eller .json) til et dump.
export async function readBackupBuffer(buf, filename) {
  if (/\.json$/i.test(filename) || buf[0] === 0x7b || buf[0] === 0x5b) {
    let j;
    try { j = JSON.parse(buf.toString('utf8')) } catch { return null }
    if (j && Array.isArray(j.documents)) return j;
    // Prototypens format: en liste med dokumenter (eller { docs: [...] })
    const docs = Array.isArray(j) ? j : j && Array.isArray(j.docs) ? j.docs : null;
    if (!docs || !docs.every(d => d && d.id && Array.isArray(d.blocks))) return null;
    return { documents: docs.map(d => ({ id: String(d.id), owner: null, title: d.title || 'Uten tittel', data: JSON.stringify(d), link_role: 'none', updated: Date.now() })) };
  }
  const dir = await mkdtemp(join(tmpdir(), 'kobling-up-'));
  try {
    await writeFile(join(dir, 'b.tar.zst'), buf);
    const un = await run('tar', ['--zstd', '-xf', 'b.tar.zst'], { cwd: dir });
    if (un.code !== 0) return null;
    return JSON.parse(await readFile(join(dir, 'kobling', 'dump.json'), 'utf8'));
  } catch { return null } finally { rm(dir, { recursive: true, force: true }).catch(() => {}) }
}

export async function readBackup(s, name) {
  const buf = await downloadBackup(s, name);
  return buf ? readBackupBuffer(buf, name) : null;
}

// Dokumentene i en backup, merket med om de finnes på serveren nå.
export function backupDocs(db, dump) {
  return (dump.documents || []).map(r => {
    let d = {};
    try { d = JSON.parse(r.data) } catch { /* */ }
    return { id: r.id, title: r.title || d.title || 'Uten tittel', folder: d.folder || '', blocks: (d.blocks || []).length, exists: !!db.prepare('SELECT 1 FROM documents WHERE id = ?').get(r.id) };
  });
}

// Slå sammen: valgte dokumenter erstattes eller legges tilbake, resten beholdes.
// Erstatt alt: alle dokumenter på serveren erstattes med de valgte.
export function restoreDocs(db, dump, { mode = 'merge', ids, owner }) {
  const want = new Set(ids || (dump.documents || []).map(d => d.id));
  const pick = (dump.documents || []).filter(d => want.has(d.id));
  const rooms = id => [id, id + '~hist'];
  const userIds = new Set(db.prepare('SELECT id FROM users').all().map(u => u.id));
  const dumpUsers = new Map((dump.users || []).map(u => [u.id, u]));
  // Eiere som ikke finnes lenger: samme e-post tas over, ellers blir den som gjenoppretter eier
  const ownerOf = id => {
    if (id && userIds.has(id)) return id;
    const u = id && dumpUsers.get(id), same = u && db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    return same ? same.id : owner;
  };
  const ins = (t, r) => {
    const cols = Object.keys(r);
    db.prepare(`INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map(c => r[c] && typeof r[c] === 'object' && 'b64' in r[c] ? Buffer.from(r[c].b64, 'base64') : r[c]));
  };
  db.exec('BEGIN');
  try {
    const gone = mode === 'replace' ? db.prepare('SELECT id FROM documents').all().map(d => d.id) : pick.map(d => d.id);
    for (const id of gone) {
      for (const t of ['memberships', 'invites', 'figs']) db.prepare(`DELETE FROM ${t} WHERE doc_id = ?`).run(id);
      for (const r of rooms(id)) db.prepare('DELETE FROM ydocs WHERE doc_id = ?').run(r);
      db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    }
    for (const d of pick) {
      ins('documents', { ...d, owner: ownerOf(d.owner), link_role: d.link_role || 'none', updated: d.updated || Date.now() });
      for (const y of (dump.ydocs || []).filter(y => rooms(d.id).includes(y.doc_id))) ins('ydocs', y);
      for (const m of (dump.memberships || []).filter(m => m.doc_id === d.id && userIds.has(m.user_id))) ins('memberships', m);
      for (const v of (dump.invites || []).filter(v => v.doc_id === d.id)) ins('invites', v);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e }
  return pick.length;
}

export async function listBackups(s) {
  const r = await run('smbclient', smbArgs(s, `cd ${quote(s.path)}; ls kobling-*.tar.zst`));
  return [...r.out.matchAll(/^\s+(kobling-[\w-]+\.tar\.zst)\s+\w*\s+(\d+)\s+(.*)$/gm)]
    .map(m => ({ name: m[1], size: Number(m[2]), date: m[3].trim() })).sort((a, b) => b.name.localeCompare(a.name));
}

async function prune(s) {
  const all = await listBackups(s);
  for (const b of all.slice(s.keep)) await run('smbclient', smbArgs(s, `cd ${quote(s.path)}; del ${quote(b.name)}`));
}

export async function downloadBackup(s, name) {
  if (!/^kobling-[\w-]+\.tar\.zst$/.test(name)) return null;
  const dir = await mkdtemp(join(tmpdir(), 'kobling-dl-'));
  try {
    const get = await run('smbclient', smbArgs(s, `cd ${quote(s.path)}; get ${quote(name)}`), { cwd: dir });
    if (get.code !== 0) return null;
    return await readFile(join(dir, name));
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function restoreDump(db, dump) {
  db.exec('BEGIN');
  try {
    for (const [t, rows] of Object.entries(dump)) {
      if (!Object.values(TABLES).flat().includes(t)) continue;
      db.exec(`DELETE FROM ${t}`);
      for (const r of rows) {
        const cols = Object.keys(r);
        db.prepare(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
          .run(...cols.map(c => r[c] && typeof r[c] === 'object' && 'b64' in r[c] ? Buffer.from(r[c].b64, 'base64') : r[c]));
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e }
}

// ---- mappevelger for SMB (Innstillinger › Backup) ----
const HOST_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*)$/i;
// smbclient deler -c-kommandoer på «;», så navn med slike tegn avvises
const BAD_NAME = /[\\/:*?"<>|;\x00-\x1f]/;
const auth = s => ['-U', `${s.domain ? s.domain + '\\' : ''}${s.user}%${s.pass || ''}`, '-m', 'SMB' + (s.ver === '2.1' ? '2' : '3'), '-t', '6'];

export function smbError(out, host) {
  if (/NT_STATUS_LOGON_FAILURE/.test(out)) return 'Feil brukernavn eller passord (NT_STATUS_LOGON_FAILURE).';
  if (/NT_STATUS_ACCESS_DENIED/.test(out)) return 'Ingen tilgang til mappen (NT_STATUS_ACCESS_DENIED).';
  if (/NT_STATUS_(IO_TIMEOUT|HOST_UNREACHABLE|CONNECTION_REFUSED|NETWORK_UNREACHABLE|CONNECTION_RESET)|Connection to .* failed|getaddrinfo|Name or service not known/.test(out))
    return 'Fikk ikke kontakt med ' + host + ' på port 445. Er serveren på samme nettverk?';
  if (/NT_STATUS_BAD_NETWORK_NAME/.test(out)) return 'Fant ikke sharen.';
  if (/NT_STATUS_OBJECT_(NAME|PATH)_NOT_FOUND/.test(out)) return 'Fant ikke mappen.';
  return (out.match(/NT_STATUS_\w+/) || [out.trim().split('\n').pop() || 'Ukjent feil'])[0];
}

export function checkSmbTarget(s, share, path = '', name) {
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s.host || '');
  if (!s.host) return 'Skriv inn IP-adressen eller vertsnavnet til serveren.';
  if (ip && ip.slice(1).some(n => +n > 255)) return 'Ugyldig IP-adresse.';
  if (!HOST_RE.test(s.host)) return 'Ugyldig vertsnavn.';
  if (!s.user) return 'Fyll inn brukernavn.';
  if ([share, ...String(path).split('/'), name].some(x => x && BAD_NAME.test(x))) return 'Ugyldige tegn i mappenavnet';
  return '';
}

// smbclient avslutter ofte med 0 selv når en kommando i -c feiler
const failed = out => /NT_STATUS_(?!OBJECT_NAME_COLLISION)\w+/.test(out);

// Uten share: sharene på serveren. Med share: undermappene i path.
export async function browseSmb(s, share, path = '') {
  const e = checkSmbTarget(s, share, path);
  if (e) return { ok: false, msg: e };
  if (!share) {
    const r = await run('smbclient', ['-L', '//' + s.host, ...auth(s), '-g']);
    const shares = [...r.out.matchAll(/^Disk\|([^|]+)\|/gm)].map(m => m[1]).filter(n => !n.endsWith('$'));
    if (r.code !== 0 && !shares.length) return { ok: false, msg: smbError(r.out, s.host) };
    return { ok: true, shares };
  }
  const dir = String(path).split('/').filter(Boolean).join('\\');
  const r = await run('smbclient', ['//' + s.host + '/' + share, ...auth(s), '-c', (dir ? `cd ${quote(dir)}; ` : '') + 'ls']);
  if (r.code !== 0 || failed(r.out)) return { ok: false, msg: smbError(r.out, s.host) };
  const dirs = [...r.out.matchAll(/^ {2}(.+?)\s+([A-Z]*D[A-Z]*)\s+\d+\s+[A-Z][a-z]{2} [A-Z][a-z]{2}/gm)].map(m => m[1]).filter(n => n !== '.' && n !== '..');
  return { ok: true, dirs };
}

export async function mkdirSmb(s, share, path, name) {
  const e = !share || !name ? 'Velg en share for å fortsette' : checkSmbTarget(s, share, path, name);
  if (e) return { ok: false, msg: e };
  const dir = [...String(path).split('/').filter(Boolean), name].join('\\');
  const r = await run('smbclient', ['//' + s.host + '/' + share, ...auth(s), '-c', `mkdir ${quote(dir)}`]);
  if (r.code !== 0 || failed(r.out)) return { ok: false, msg: smbError(r.out, s.host) };
  return { ok: true };
}
