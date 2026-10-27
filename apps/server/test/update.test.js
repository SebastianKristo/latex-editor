import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { currentVersion } from '../src/update.js';

// Oppdatering av serveren (README §10) mot et falskt GitHub Releases-API
const cur = currentVersion().ver.split('.').map(Number);
const next = [cur[0], cur[1] + 1, 0].join('.'), beta = [cur[0], cur[1] + 2, 0].join('.') + '-beta.1';
const RELEASES = [
  { tag_name: 'v' + beta, prerelease: true, draft: false, published_at: '2026-10-25T10:00:00Z', body: '- Ekte TikZ i editoren', assets: [] },
  { tag_name: 'v' + next, prerelease: false, draft: false, published_at: '2026-10-24T10:00:00Z', body: '## Nytt\n- Gjenoppretting fra backup\n- Mørk modus', assets: [{ size: 3 * 1048576 }] },
  { tag_name: 'v9.9.9', prerelease: false, draft: true, published_at: '2026-10-24T10:00:00Z', body: '', assets: [] },
  { tag_name: 'v' + currentVersion().ver, prerelease: false, draft: false, published_at: '2026-10-20T10:00:00Z', body: '', assets: [] }
];
const fakeFetch = async url => (String(url).startsWith('https://api.github.com/repos/SebastianKristo/latex-editor/releases')
  ? { ok: true, status: 200, json: async () => RELEASES } : { ok: false, status: 404, json: async () => ({}) });

async function make(install, helper) {
  const dir = mkdtempSync(join(tmpdir(), 'kobling-upd-'));
  const cfg = loadConfig({ KOBLING_DATA: dir, KOBLING_ADMIN_EMAIL: 'admin@test.no', KOBLING_ADMIN_PASSWORD: 'hemmelig', SMTP_HOST: '', KOBLING_INSTALL: install });
  const app = await buildApp(cfg, { background: false, fetchImpl: fakeFetch, updaterOpts: { helperReady: () => helper } });
  const tok = (await app.inject({ method: 'POST', url: '/api/login', payload: { email: 'admin@test.no', password: 'hemmelig' } })).json().token;
  const call = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: 'Bearer ' + tok } });
  return { app, dir, call };
}

let px, dk;
before(async () => { px = await make('proxmox', true); dk = await make('docker', false) });
after(async () => { for (const x of [px, dk]) { await x.app.close(); rmSync(x.dir, { recursive: true, force: true }) } });

test('stabil kanal finner nyeste vanlige release, beta tar med forhåndsversjoner', async () => {
  const st = (await px.call('POST', '/api/admin/update/check', { channel: 'stable' })).json();
  assert.equal(st.found.ver, next);
  assert.equal(st.found.size, '3 MB');
  assert.deepEqual(st.found.notes, ['Gjenoppretting fra backup', 'Mørk modus']);
  assert.match(st.lastCheck, /kl\. \d\d:\d\d$/);
  assert.equal((await px.call('POST', '/api/admin/update/check', { channel: 'beta' })).json().found.ver, beta);
  assert.equal((await px.call('GET', '/api/health')).json().version, currentVersion().ver);
});

test('«Oppdater nå» på Proxmox bestiller kobling-update for taggen og viser stegene', async () => {
  const r = (await px.call('POST', '/api/admin/update/run')).json();
  assert.equal(r.ok, true);
  const req = JSON.parse(readFileSync(join(px.dir, 'update', 'request.json'), 'utf8'));
  assert.equal(req.ref, 'v' + next);
  const run = (await px.call('GET', '/api/admin/update/status')).json().run;
  assert.equal(run.to, next);
  assert.match(run.step, /^Laster ned kobling-server:/);
  assert.ok(run.log.includes('✓ Varsler innloggede brukere'));
  // forrige versjon huskes for «Gå tilbake til …»
  const s = (await px.call('GET', '/api/admin/update')).json().settings;
  assert.equal(s.prev, currentVersion().ver);
  // kobling-update skriver loggen; serveren viser riktig steg
  writeFileSync(join(px.dir, 'update', 'log.txt'), '› Installerer systempakker\n› Henter Kobling\n› Bygger (pnpm, klient og server)\n');
  await new Promise(r => setTimeout(r, 900));
  assert.match((await px.call('GET', '/api/admin/update/status')).json().run.step, /^Bygger kobling-server/);
});

test('etter omstart vises resultatet fra kobling-update', async () => {
  const { app, dir, call } = await make('proxmox', true);
  mkdirSync(join(dir, 'update'), { recursive: true });
  writeFileSync(join(dir, 'update', 'status.json'), JSON.stringify({ done: true, ok: true, to: next, at: Date.now() }));
  assert.deepEqual(((await call('GET', '/api/admin/update/status')).json().run), { done: true, ok: true, to: next, pct: 100, log: [], step: 'Ferdig' });
  await app.close(); rmSync(dir, { recursive: true, force: true });
});

test('i Docker gir «Oppdater nå» beskjed om update.sh, og tilbakerulling krever en tidligere versjon', async () => {
  const r = (await dk.call('POST', '/api/admin/update/run')).json();
  assert.equal(r.manual, true);
  assert.match(r.msg, /update\.sh/);
  assert.equal(existsSync(join(dk.dir, 'update', 'request.json')), false);
  assert.equal((await dk.call('POST', '/api/admin/update/run', { rollback: true })).statusCode, 400);
  assert.equal((await dk.call('GET', '/api/admin/update')).json().mode, 'docker');
});
