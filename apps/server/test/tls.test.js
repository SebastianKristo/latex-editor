import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { startTls, duckTxt, loadCert } from '../src/tls.js';

test('DuckDNS TXT settes og fjernes via API-et', async () => {
  const calls = [];
  const f = async url => { calls.push(url); return { text: async () => 'OK' } };
  const d = { domain: 'mitt-navn', token: '11111111-2222-3333-4444-555555555555' };
  await duckTxt(d, 'abc_DEF-123', f);
  await duckTxt(d, null, f);
  assert.match(calls[0], /^https:\/\/www\.duckdns\.org\/update\?domains=mitt-navn&token=1111.*&txt=abc_DEF-123&verbose=true$/);
  assert.match(calls[1], /&txt=removed&clear=true/);
  await assert.rejects(duckTxt(d, 'x', async () => ({ text: async () => 'KO' })), /avviste/);
});

test('HTTPS-serveren svarer med eksisterende sertifikat selv om fornyelse feiler', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kobling-tls-'));
  mkdirSync(join(dir, 'tls'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'tls/key.pem'), '-out', join(dir, 'tls/cert.pem'), '-days', '90', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  assert.ok((await loadCert(join(dir, 'tls'))).days > 80);
  const app = await buildApp(loadConfig({ KOBLING_DATA: dir }), { background: false });
  await app.listen({ port: 0 });
  const logs = [];
  const port = 18000 + Math.floor(Math.random() * 1000);
  let on = true;
  const tls = await startTls(app, { getDuck: () => ({ tls: on, domain: 'mitt-navn', token: 'x' }), dataDir: dir, port, email: 'a@b.no', log: x => logs.push(x), directoryUrl: 'http://127.0.0.1:1/dir' });
  await new Promise(r => setTimeout(r, 200));
  const body = await new Promise((res, rej) => request({ host: '127.0.0.1', port, path: '/api/health', rejectUnauthorized: false }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(b)) }).on('error', rej).end());
  assert.equal(JSON.parse(body).ok, true);
  assert.ok(logs.some(l => l.txt === `HTTPS kjører på port ${port}`));
  // slås av i innstillingene -> lytteren stoppes uten omstart
  on = false; await tls.ensure();
  assert.ok(logs.some(l => l.txt === 'HTTPS er slått av'));
  await assert.rejects(new Promise((res, rej) => request({ host: '127.0.0.1', port, path: '/api/health', rejectUnauthorized: false }, res).on('error', rej).end()));
  tls.stop(); await app.close(); rmSync(dir, { recursive: true, force: true });
});
