// Integrasjonstest: backup til en ekte SMB-share med smbclient, endring, og gjenoppretting.
// Bruk: SMB_HOST=127.0.0.1 SMB_SHARE=backup SMB_USER=kobling SMB_PASS=… node tools/smb-backup-test.mjs
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../apps/server/src/db.js';
import { testSmb, runBackup, listBackups, readBackup, backupDocs, restoreDocs, safetyBackup } from '../apps/server/src/backup.js';

const e = process.env;
const s = { host: e.SMB_HOST || '127.0.0.1', share: e.SMB_SHARE || 'backup', path: 'kobling-ci-' + Date.now(), user: e.SMB_USER, pass: e.SMB_PASS, domain: 'WORKGROUP', ver: '3.0', keep: 2, include: ['docs', 'hist', 'users'] };
const dir = mkdtempSync(join(tmpdir(), 'kobling-smb-'));
const db = openDb(dir);
const fail = m => { console.error('FEIL:', m); process.exit(1) };

db.prepare('INSERT INTO documents (id, owner, title, data, updated) VALUES (?, ?, ?, ?, ?)').run('d1', 'u1', 'Før', '{"title":"Før","blocks":[]}', Date.now());
const t = await testSmb(s);
if (!t.ok) fail(t.msg);
console.log('OK  ', t.msg);
const steps = [];
const r = await runBackup(db, s, st => steps.push(st));
if (!r.ok) fail(r.msg);
console.log('OK   backup', r.name, r.size + ' B', '·', steps.join(' → '));
db.prepare("UPDATE documents SET title = 'Etter' WHERE id = 'd1'").run();
const list = await listBackups(s);
if (!list.some(b => b.name === r.name)) fail('backupen finnes ikke på sharen');
console.log('OK   ligger på sharen:', list.map(b => b.name).join(', '));
db.prepare('INSERT INTO documents (id, owner, title, data, updated) VALUES (?, ?, ?, ?, ?)').run('d2', 'u1', 'Ny', '{"title":"Ny","blocks":[]}', Date.now());
const dump = await readBackup(s, r.name);
if (!dump) fail('kunne ikke lese backupen fra sharen');
const docs = backupDocs(db, dump);
if (docs.length !== 1 || docs[0].title !== 'Før' || !docs[0].exists) fail('feil innhold: ' + JSON.stringify(docs));
const safe = await safetyBackup(db, s, dir);
if (!safe.ok || !/_for-gjenoppretting\.tar\.zst$/.test(safe.name)) fail('sikkerhetskopi: ' + JSON.stringify(safe));
if (!(await listBackups(s)).some(b => b.name === safe.name)) fail('sikkerhetskopien ligger ikke på sharen');
console.log('OK   sikkerhetskopi', safe.name);
restoreDocs(db, dump, { mode: 'merge', ids: ['d1'], owner: 'u1' });
const title = db.prepare("SELECT title FROM documents WHERE id = 'd1'").get().title;
if (title !== 'Før') fail('gjenopprettet tittel er ' + title);
if (!db.prepare("SELECT 1 FROM documents WHERE id = 'd2'").get()) fail('slå sammen fjernet et dokument som ikke var valgt');
console.log('OK   slå sammen: tittel er «' + title + '» igjen, andre dokumenter beholdt');
restoreDocs(db, dump, { mode: 'replace', ids: ['d1'], owner: 'u1' });
if (db.prepare('SELECT COUNT(*) AS n FROM documents').get().n !== 1) fail('erstatt alt beholdt andre dokumenter');
console.log('OK   erstatt alt: bare dokumentene fra backupen er igjen');
db.close(); rmSync(dir, { recursive: true, force: true });
