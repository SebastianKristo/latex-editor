// HTTPS med Let's Encrypt via DNS-01 mot DuckDNS (TXT-posten settes med DuckDNS-API-et).
// Sertifikatet lagres i /data/tls og fornyes når det er under 30 dager igjen.
import { createServer } from 'node:https';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';
import acme from 'acme-client';

const DAY = 864e5;
export const LE_PROD = acme.directory.letsencrypt.production;
export const LE_STAGING = acme.directory.letsencrypt.staging;

export async function duckTxt(d, value, fetchImpl = fetch) {
  const clear = value == null;
  const url = `https://www.duckdns.org/update?domains=${d.domain}&token=${d.token}&txt=${encodeURIComponent(clear ? 'removed' : value)}${clear ? '&clear=true' : ''}&verbose=true`;
  const body = (await (await fetchImpl(url)).text()).trim();
  if (!body.startsWith('OK')) throw new Error('DuckDNS avviste TXT-oppdateringen.');
}

const daysLeft = pem => (new Date(new X509Certificate(pem).validTo) - Date.now()) / DAY;

export async function loadCert(dir) {
  try {
    const [cert, key] = await Promise.all([readFile(join(dir, 'cert.pem'), 'utf8'), readFile(join(dir, 'key.pem'), 'utf8')]);
    return { cert, key, days: daysLeft(cert) };
  } catch { return null }
}

export async function obtainCert({ d, dir, email, directoryUrl = LE_PROD, fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  await mkdir(dir, { recursive: true });
  let accountKey;
  try { accountKey = await readFile(join(dir, 'account.pem')) } catch {
    accountKey = await acme.crypto.createPrivateKey();
    await writeFile(join(dir, 'account.pem'), accountKey, { mode: 0o600 });
  }
  const client = new acme.Client({ directoryUrl, accountKey });
  const domain = `${d.domain}.duckdns.org`;
  const [key, csr] = await acme.crypto.createCsr({ commonName: domain });
  const cert = await client.auto({
    csr, email, termsOfServiceAgreed: true, challengePriority: ['dns-01'],
    challengeCreateFn: async (_a, _c, keyAuthorization) => { await duckTxt(d, keyAuthorization, fetchImpl); await wait(30000) },
    challengeRemoveFn: async () => { await duckTxt(d, null, fetchImpl).catch(() => {}) }
  });
  await writeFile(join(dir, 'key.pem'), key, { mode: 0o600 });
  await writeFile(join(dir, 'cert.pem'), cert);
  return { cert: String(cert), key: String(key), days: daysLeft(String(cert)) };
}

// Starter HTTPS-serveren foran Fastify-appen og fornyer daglig ved behov.
export async function startTls(app, { getDuck, dataDir, port, email, log, directoryUrl }) {
  const dir = join(dataDir, 'tls');
  let cur = await loadCert(dir), server = null, stopped = false;
  const ensure = async () => {
    const d = getDuck();
    if (!d.tls || !d.domain || !d.token) return;
    if (!cur || cur.days < 30) {
      try { cur = await obtainCert({ d, dir, email, directoryUrl }); log({ tls: 'nytt sertifikat', days: Math.round(cur.days) }) }
      catch (e) {
        log({ tls: 'fornyelse feilet', error: e.message });
        if (!cur || cur.days <= 0) return; // ellers brukes sertifikatet vi har til det går ut
      }
    }
    if (!server) {
      server = createServer({ cert: cur.cert, key: cur.key }, (req, res) => app.routing(req, res));
      server.on('upgrade', (req, sock, head) => app.server.emit('upgrade', req, sock, head));
      server.listen(port, '0.0.0.0');
      log({ tls: 'lytter', port });
    } else server.setSecureContext({ cert: cur.cert, key: cur.key });
  };
  await ensure();
  const timer = setInterval(() => { if (!stopped) ensure() }, DAY);
  return () => { stopped = true; clearInterval(timer); server?.close() };
}
