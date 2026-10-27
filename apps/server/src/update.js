import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { vcmp } from '@kobling/core';

// Oppdatering av serveren (Innstillinger › Administrasjon › Oppdatering, README §10).
// Nye versjoner er GitHub Releases. På Proxmox (native installasjon) kjører tjenesten som brukeren
// «kobling» og kan ikke oppdatere seg selv: den legger en forespørsel i datamappen, og systemd-enheten
// kobling-update.path (root) starter kobling-update for riktig tagg. I Docker oppdateres imaget på verten.

const PKG = new URL('../package.json', import.meta.url);
export const PATH_UNIT = '/etc/systemd/system/kobling-update.path';

export function currentVersion() {
  const p = JSON.parse(readFileSync(PKG, 'utf8'));
  // Installert fra en release-tagg: kobling-update skriver taggen i VERSION (den vinner over package.json)
  try { p.version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim().replace(/^v/, '') || p.version } catch { /* fra main */ }
  let commit = process.env.KOBLING_COMMIT || '';
  try { commit = commit || readFileSync(new URL('../BUILD', import.meta.url), 'utf8').trim() } catch { /* bygget uten git */ }
  return { ver: p.version, commit, built: statSync(PKG).mtime.toLocaleDateString('nb-NO') };
}

// Punktlister i release-teksten blir «nytt i versjonen»
const notesOf = body => {
  const ls = String(body || '').split('\n').map(l => l.trim());
  const items = ls.filter(l => /^[-*]\s+/.test(l)).map(l => l.replace(/^[-*]\s+/, '').replace(/\*\*/g, ''));
  return (items.length ? items : ls.filter(l => l && !l.startsWith('#'))).slice(0, 6);
};
const fmtSize = n => (n > 1048576 ? Math.round(n / 1048576) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB');

export async function latestRelease({ repo, channel = 'stable', fetchImpl = fetch }) {
  let r;
  try { r = await fetchImpl(`https://api.github.com/repos/${repo}/releases?per_page=30`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'kobling-server' }, signal: AbortSignal.timeout(15000) }) }
  catch { throw new Error('Fikk ikke kontakt med GitHub. Sjekk at serveren har tilgang til internett.') }
  if (!r.ok) throw new Error('GitHub svarte ' + r.status + '. Prøv igjen senere.');
  const list = (await r.json())
    .filter(x => !x.draft && /^v?\d+\.\d+/.test(x.tag_name) && (channel === 'beta' || !x.prerelease))
    .map(x => ({
      tag: x.tag_name, ver: x.tag_name.replace(/^v/, ''), date: new Date(x.published_at).toLocaleDateString('nb-NO'),
      size: (x.assets || []).length ? fmtSize(Math.max(...x.assets.map(a => a.size || 0))) : '', notes: notesOf(x.body), prerelease: !!x.prerelease
    }))
    .sort((a, b) => vcmp(b.ver, a.ver));
  return list[0] || null;
}

const MANUAL = {
  docker: 'Denne serveren kjører i Docker og kan ikke bytte sitt eget image. Kjør update.sh på verten (vist til høyre).',
  native: 'Automatisk oppdatering er ikke satt opp på denne serveren. Kjør kobling-update i containeren én gang, så virker knappen.'
};

export function createUpdater({ cfg, db, sync, eff, saveSettings, backup, fetchImpl = fetch, helperReady = () => existsSync(PATH_UNIT), log = () => {} }) {
  const dir = join(cfg.dataDir, 'update'), reqFile = join(dir, 'request.json'), statusFile = join(dir, 'status.json'), logFile = join(dir, 'log.txt');
  let run = null, timer = null;
  const mode = () => (cfg.install === 'proxmox' ? (helperReady() ? 'proxmox' : 'native') : cfg.install === 'docker' ? 'docker' : helperReady() ? 'proxmox' : 'native');

  async function check(channel) {
    const u = eff('update'), cur = currentVersion();
    const rel = await latestRelease({ repo: cfg.updateRepo, channel: channel || u.channel || 'stable', fetchImpl });
    const lastCheck = new Date().toLocaleDateString('nb-NO') + ' kl. ' + new Date().toTimeString().slice(0, 5);
    saveSettings({ lastCheck });
    return { found: rel && vcmp(rel.ver, cur.ver) > 0 ? rel : null, lastCheck, current: cur };
  }

  // Linjene fra kobling-update vises som stegene i appen
  const STEPS = [
    [/Installerer systempakker|Henter Kobling/, to => 'Laster ned kobling-server:' + to + ' …', 40],
    [/Bygger/, to => 'Bygger kobling-server ' + to + ' …', 60],
    [/Starter tjenesten/, () => 'Stopper tjenesten (aktive økter lagres) …', 85]
  ];
  function follow(to) {
    clearInterval(timer);
    timer = setInterval(() => {
      let txt = '';
      try { txt = readFileSync(logFile, 'utf8') } catch { return }
      for (const [re, label, pct] of STEPS) if (re.test(txt) && run && run.pct < pct) {
        if (run.step) run.log.push('✓ ' + run.step.replace(' …', ''));
        run = { ...run, pct, step: label(to) };
      }
    }, 700);
  }

  async function start({ tag, ver, rollback = false }) {
    const m = mode();
    if (m !== 'proxmox') return { ok: false, manual: true, msg: MANUAL[m === 'docker' ? 'docker' : 'native'] };
    if (run && !run.done) return { ok: false, msg: 'En oppdatering kjører allerede.' };
    const u = eff('update'), cur = currentVersion(), smb = eff('smb');
    run = { pct: 4, step: '', log: [], to: ver, rollback };
    const next = (step, pct) => { if (run.step) run.log.push('✓ ' + run.step.replace(' …', '')); run = { ...run, step, pct } };
    if (u.notify !== false) {
      next('Varsler innloggede brukere …', 8);
      sync.notice('Serveren oppdateres til ' + ver + ' nå. Endringene dine lagres og synkroniseres når den er oppe igjen.');
    }
    if (u.backup !== false && !rollback && smb.host && smb.share) {
      next('Tar backup til //' + smb.host + '/' + smb.share + '/' + smb.path + ' …', 15);
      sync.flushAll();
      const b = await backup(smb, '_for-oppdatering-' + ver);
      if (!b.ok) { run = { ...run, done: true, ok: false, step: 'Backup feilet: ' + b.msg }; return { ok: false, msg: 'Backup feilet, oppdateringen er avbrutt: ' + b.msg } }
    }
    saveSettings(rollback ? { prev: null, prevRef: null } : { prev: cur.ver, prevRef: cur.commit || 'v' + cur.ver });
    next('Laster ned kobling-server:' + ver + ' …', 25);
    sync.flushAll();
    mkdirSync(dir, { recursive: true });
    rmSync(statusFile, { force: true });
    writeFileSync(logFile, '');
    writeFileSync(reqFile, JSON.stringify({ ref: tag, to: ver, at: Date.now(), by: 'kobling-server' }));
    log('oppdatering bestilt: ' + tag);
    follow(ver);
    return { ok: true, started: true };
  }

  function status() {
    if (run && !run.done) return { run, current: currentVersion() };
    // Etter omstart: resultatet fra kobling-update (vises i 15 minutter)
    try {
      const st = JSON.parse(readFileSync(statusFile, 'utf8'));
      if (Date.now() - st.at < 15 * 60000) return { run: { done: true, ok: !!st.ok, to: st.to, pct: 100, log: [], step: st.ok ? 'Ferdig' : 'Oppdateringen feilet' }, current: currentVersion() };
    } catch { /* ingen */ }
    return { run, current: currentVersion() };
  }

  return { check, start, status, mode, stop: () => clearInterval(timer) };
}
