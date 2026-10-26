import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Backup til SMB med smbclient (ingen mount, virker i uprivilegerte LXC-er).
// Arkivet er .tar.zst av et JSON-dump per tabell; gjenoppretting leser det tilbake.

const TABLES = { docs: ['documents', 'memberships', 'invites'], figs: ['files'], hist: ['versions', 'comments'], users: ['users'] };

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

export async function runBackup(db, s, onStep = () => {}) {
  const dir = await mkdtemp(join(tmpdir(), 'kobling-bk-'));
  try {
    onStep('Pakker data', 10);
    const dump = {};
    for (const k of s.include) for (const t of TABLES[k] || []) dump[t] = db.prepare(`SELECT * FROM ${t}`).all().map(r =>
      Object.fromEntries(Object.entries(r).map(([c, v]) => [c, v instanceof Uint8Array ? { b64: Buffer.from(v).toString('base64') } : v])));
    await mkdir(join(dir, 'kobling'));
    await writeFile(join(dir, 'kobling', 'dump.json'), JSON.stringify(dump));
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');
    const name = `kobling-${stamp}.tar.zst`;
    const tar = await run('tar', ['--zstd', '-cf', name, 'kobling'], { cwd: dir });
    if (tar.code !== 0) return { ok: false, msg: 'Pakking feilet: ' + tar.out };
    onStep('Laster opp', 60);
    const up = await run('smbclient', smbArgs(s, `mkdir ${quote(s.path)}; cd ${quote(s.path)}; put ${quote(name)}`), { cwd: dir });
    if (up.code !== 0 && !/putting file/.test(up.out)) return { ok: false, msg: 'Opplasting feilet: ' + up.out.trim().split('\n').pop() };
    onStep('Rydder gamle', 90);
    await prune(s);
    onStep('Ferdig', 100);
    return { ok: true, name };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
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

export async function restoreBackup(db, s, name) {
  if (!/^kobling-[\w-]+\.tar\.zst$/.test(name)) return { ok: false, msg: 'Ugyldig filnavn.' };
  const dir = await mkdtemp(join(tmpdir(), 'kobling-rs-'));
  try {
    const get = await run('smbclient', smbArgs(s, `cd ${quote(s.path)}; get ${quote(name)}`), { cwd: dir });
    if (get.code !== 0) return { ok: false, msg: 'Nedlasting feilet.' };
    const un = await run('tar', ['--zstd', '-xf', name], { cwd: dir });
    if (un.code !== 0) return { ok: false, msg: 'Utpakking feilet.' };
    restoreDump(db, JSON.parse(await readFile(join(dir, 'kobling', 'dump.json'), 'utf8')));
    return { ok: true };
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
