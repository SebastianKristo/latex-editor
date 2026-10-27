// Kobler appen til Kobling-serveren: dokumenter og kommentarer via Yjs, deling, admin-innstillinger,
// kompilering til ekte PDF (pdf.js) og SyncTeX. Prototypens lokale demo-logikk byttes ut her,
// mens visningsmodellen (renderVals) og malen er de samme.
import React from 'react';
import { docCode, lintTex, figPreamble, extractFigures, clone, now, slug, smtpFrom, skeleton, EMAIL_RE, DEF_DUCK, DEF_SMB, DEF_SMTP, DEF_DEP, DEF_SET, DEF_UPD } from '@kobling/core';
import { applyDocToY, docFromY, commentsFromY, applyCommentsToY, historyFromY, pushHistory, isEmptyY } from '@kobling/core/ydoc';
import { api, b64, setToken, serverBase, authQuery } from './api';
import { YSocket } from './ysocket';
import { PdfView } from './PdfView';

const HUES = [30, 150, 300, 80, 200, 250, 340, 110];
export const colorFor = id => 'oklch(0.62 0.13 ' + HUES[[...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length] + ')';
export const initialsOf = name => String(name || '?').split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
const LINK_ROLE = { none: 'Ingen tilgang', 'Kan lese': 'Kan lese', 'Kan kommentere': 'Kan kommentere', 'Kan redigere': 'Kan redigere' };
const fmtSize = n => (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB');
const ago = ms => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'redigert nå' : m < 60 ? 'redigert for ' + m + ' min siden' : m < 1440 ? 'redigert for ' + Math.round(m / 60) + ' t siden' : 'redigert ' + new Date(ms).toLocaleDateString('nb-NO');
};
const toDoc = d => ({ authors: '', group: '', folder: 'Privat', meta: ago(d.updated || Date.now()), blocks: [], ...d });
// Historikk lagres uten bildedata (de kan være store); bildene hentes fra dokumentet ved gjenoppretting.
const lean = blocks => blocks.map(b => (b.type === 'img' ? { ...b, src: '' } : b));
export const cacheKey = () => 'kobling-cache:' + (serverBase() || location.origin);
export function readCache() {
  try { return JSON.parse(localStorage.getItem(cacheKey()) || 'null') } catch { return null }
}
const download = (name, blob) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 800);
};

export class ServerSession {
  constructor({ user, docs, access }) {
    this.user = user;
    this.access = { histOthers: true, ...(access || {}) };
    this.docs = docs.map(toDoc);
    this.lsKey = 'kobling-user-' + user.id;
    this.persistKeys = ['settings', 'rightW', 'recent', 'sideHidden'];
    this.ys = null;
    this.remote = false;
    this.pdf = null;
    this.seq = 0;
    this.figs = {}; // figurnøkkel → 'ok' | 'error' (README §9)
    this.adminLoaded = false;
    this.adminRemote = false;
  }

  account() {
    const u = this.user;
    return { id: initialsOf(u.name), initials: initialsOf(u.name), name: u.name, email: u.email, admin: u.role === 'admin', color: colorFor(u.id) };
  }

  attach(app) {
    this.app = app;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.lsKey) || '{}') || {} } catch { /* */ }
    const want = new URLSearchParams(location.search).get('doc');
    const ids = this.docs.map(d => d.id);
    const recent = (saved.recent || []).filter(id => ids.includes(id));
    const cur = ids.includes(want) ? want : recent[0] || ids[0];
    const me = this.account();
    Object.assign(app.state, {
      docs: this.docs, cur, recent: [cur, ...recent.filter(x => x !== cur)].slice(0, 8),
      // histOthers er en serverinnstilling (admin), ikke en personlig en
      settings: { ...DEF_SET, ...app.state.settings, ...(saved.settings || {}), server: serverBase() || location.origin, histOthers: this.access.histOthers },
      rightW: saved.rightW || app.state.rightW,
      sideHidden: !!saved.sideHidden,
      comments: [], history: [], people: [], mails: [], backups: [], presence: {}, remotePresence: [],
      me: me.id, view: app.state.view === 'settings' || app.state.view === 'projects' ? app.state.view : 'editor',
      duck: { ...DEF_DUCK }, smb: { ...DEF_SMB }, smtp: { ...DEF_SMTP }, deploy: { ...DEF_DEP },
      upd: { ...DEF_UPD, lastCheck: '' }, updUi: { checking: false, found: null, run: null }, restore: null, fetchingBk: false,
      duckUi: { log: [], ip: '', last: '', busy: false, showToken: false },
      linkRole: 'Ingen tilgang', smtpReady: false, pdfBoxes: []
    });

    // Prototypens demo-metoder byttes mot ekte kall.
    app.compile = () => this.compile();
    app.printPdf = () => this.openPdf();
    app.duckUpdate = () => this.duckUpdate();
    app.testSmb = () => this.testSmb();
    app.runBackup = () => this.runBackup();
    app.testSmtp = () => this.testSmtp();
    app.sendDocMail = () => this.sendDocMail();
    app.deleteDoc = id => this.deleteDoc(id);
    app.duplicateDoc = () => this.duplicateDoc();
    app.fetchBackups = () => this.loadBackups(true);
    app.openRestore = k => this.openRestore(k);
    app.doRestore = () => this.doRestore();
    app.onBackupFile = e => this.onBackupFile(e);
    app.smbConnect = () => this.smbConnect();
    app.publicBase = () => this.linkBase();
    app.checkUpdate = () => this.checkUpdate();
    app.runUpdate = (target, rollback) => this.runUpdate(rollback);
    app.smbNode = cwd => this.smbNode(cwd);
    app.smbMkdir = () => this.smbMkdir();
    app.smtpOk = () => !!app.state.smtpReady;
    app.tickPresence = () => {};
    return this;
  }

  // ---------- livssyklus ----------
  mount() {
    this.bind(this.app.state.cur);
    this.loadPeople();
    if (this.user.role === 'admin') this.loadAdmin();
    this.loadMails();
  }
  unmount() { this.worker?.terminate(); this.ys?.destroy(); this.yh?.destroy(); clearTimeout(this.adminTimer); clearInterval(this.bkTimer); clearInterval(this.duckPoll) }

  update(ps) {
    const s = this.app.state;
    if (ps.cur !== s.cur) { this.pdf = null; this.app.setState({ pdfBoxes: [], people: [] }); this.bind(s.cur); this.loadPeople() }
    else if (!this.remote && this.ys && this.ys.synced) {
      if (ps.docs !== s.docs) {
        const d = s.docs.find(x => x.id === s.cur);
        if (d && d !== ps.docs.find(x => x.id === s.cur)) applyDocToY(this.ys.doc, d, 'app');
      }
      if (ps.comments !== s.comments) applyCommentsToY(this.ys.doc, s.comments.filter(c => c.doc === s.cur).map(({ doc, ...c }) => c), 'app');
    }
    // Endringer i andre dokumenter enn det åpne (f.eks. «Erstatt alle» i alle prosjekter) skrives til deres egne rom
    if (!this.remote && !this.refreshing && ps.docs !== s.docs && ps.cur === s.cur)
      s.docs.forEach(d => {
        if (d.id === s.cur) return;
        const was = ps.docs.find(x => x.id === d.id);
        if (was && was !== d && JSON.stringify(was.blocks) !== JSON.stringify(d.blocks)) this.pushOther(d);
      });
    if (!this.remoteHist && this.yh && this.yh.synced && ps.history !== s.history) {
      const have = new Set(historyFromY(this.yh.doc).map(h => h.id));
      s.history.filter(h => !have.has(h.id)).reverse().forEach(h => pushHistory(this.yh.doc, { ...h, snap: h.snap ? lean(h.snap) : null }, 'app'));
    }
    // Admin slår historikk for andre av/på: lagres på serveren
    if (this.user.role === 'admin' && ps.settings.histOthers !== s.settings.histOthers)
      api('PUT', '/api/admin/settings', { access: { histOthers: s.settings.histOthers !== false } }).catch(e => this.app.toast(e.message));
    // «Frakoblet modus» i profilmenyen kobler faktisk fra serveren
    if (ps.net && s.net && ps.net.sim !== s.net.sim) { this.ys?.setPaused(s.net.sim); this.yh?.setPaused(s.net.sim) }
    if (ps.docs !== s.docs || ps.cur !== s.cur) this.saveCache();
    if (ps.active !== s.active) {
      this.ys?.awareness.setLocalStateField('bid', s.active || null);
      this.syncView(s.active);
    }
    if (!ps.share && s.share) { this.loadPeople(); this.loadMails() }
    if (ps.view !== s.view && s.view === 'projects') this.refreshDocs();
    if (ps.setTab !== s.setTab && s.setTab === 'backup' && this.user.role === 'admin') this.loadBackups();
    // DuckDNS-fanen: hent loggen jevnlig, så HTTPS-status og IP-oppdateringer vises uten å laste på nytt.
    const onDuck = s.view === 'settings' && s.setTab === 'duck' && this.user.role === 'admin';
    if (onDuck && !this.duckPoll) this.duckPoll = setInterval(() => this.refreshDuckLog(), 4000);
    if (!onDuck && this.duckPoll) { clearInterval(this.duckPoll); this.duckPoll = null }
    if (this.adminLoaded && !this.adminRemote && ['duck', 'smb', 'smtp', 'deploy', 'upd'].some(k => ps[k] !== s[k])) {
      clearTimeout(this.adminTimer);
      this.adminTimer = setTimeout(() => this.saveAdmin(), 600);
    }
  }

  // ---------- Yjs ----------
  bind(docId) {
    this.ys?.destroy();
    this.bindHistory(docId);
    const ys = new YSocket(docId);
    this.ys = ys;
    const me = this.account();
    ys.awareness.setLocalState({ user: { name: me.name.split(' ')[0], color: me.color, initials: me.initials }, bid: this.app.state.active || null });
    ys.doc.on('update', (_u, origin) => { if (origin === ys) this.pull() });
    ys.onSynced = () => {
      const local = this.app.state.docs.find(d => d.id === docId);
      if (isEmptyY(ys.doc) && local) applyDocToY(ys.doc, local, 'app');
      else this.pull();
    };
    // Lokal kopi (y-indexeddb) er klar før serveren svarer, og uten nett
    ys.onLocal = () => { if (!ys.synced && !isEmptyY(ys.doc)) this.pull() };
    if (this.app.netOff()) ys.setPaused(!!this.app.state.net.sim);
    ys.awareness.on('change', () => {
      const list = [];
      ys.awareness.getStates().forEach((st, id) => {
        if (id !== ys.doc.clientID && st && st.user && st.bid) list.push({ name: st.user.name, color: st.user.color, bid: st.bid });
      });
      this.app.setState({ remotePresence: list });
    });
    ys.onDenied = () => {
      this.app.toast('Du har bare lesetilgang til dette dokumentet');
      clearTimeout(this.denyTimer);
      this.denyTimer = setTimeout(() => { if (this.ys === ys) this.bind(docId) }, 400);
    };
    ys.onNotice = text => this.app.toast(text);
    ys.onStatus = (st, code) => {
      // Etter en oppdatering av serveren lastes appen på nytt, så klienten passer til serveren
      if (st === 'online') api('GET', '/api/health').then(h => {
        if (!this.version) this.version = h.version;
        else if (h.version && h.version !== this.version && !this.updTimer) { this.app.toast('Kobling er oppdatert til ' + h.version + '. Laster på nytt …'); setTimeout(() => location.reload(), 1800) }
      }).catch(() => {});
      // Nettstatus i topplinjen følger forbindelsen til serveren
      if (st === 'online' && this.app.state.net && !this.app.state.net.on) this.app.setNet({ on: true });
      if (st === 'offline' && this.app.state.net && this.app.state.net.on) this.app.setNet({ on: false });
      if (st === 'closed' && (code === 4401 || code === 4000)) location.reload();
      if (st === 'closed' && code === 4403) this.app.toast('Du har ikke tilgang til dette dokumentet');
    };
  }

  // Versjonshistorikken har eget rom; serveren stenger det (4403) når den er slått av for andre.
  bindHistory(docId) {
    this.yh?.destroy();
    this.yh = null;
    if (this.user.role !== 'admin' && this.access.histOthers === false) return this.app.setState({ history: [] });
    const yh = new YSocket(docId + '~hist', { persist: false });
    this.yh = yh;
    const pullHist = () => {
      this.remoteHist = true;
      this.app.setState({ history: historyFromY(yh.doc) }, () => { this.remoteHist = false });
    };
    yh.doc.on('update', (_u, origin) => { if (origin === yh) pullHist() });
    yh.onSynced = pullHist;
    yh.onStatus = (st, code) => { if (st === 'closed' && code === 4403) { this.access.histOthers = false; this.app.setState({ history: [] }) } };
  }

  // ---------- stavekontroll (Hunspell i Web Worker) ----------
  // Starter når Sjekk-fanen åpnes første gang. Ord med stor forbokstav (navn) og forkortelser hoppes over.
  spellFix(w, lang) {
    if (!this.spellOn) {
      if (this.app.state.right !== 'check') return undefined;
      this.spellOn = true;
    }
    if (w.length < 3 || w[0] !== w[0].toLowerCase()) return undefined;
    const k = lang + ':' + w;
    this.spellRes = this.spellRes || new Map();
    if (this.spellRes.has(k)) return this.spellRes.get(k) || undefined;
    this.spellQ = this.spellQ || new Set();
    this.spellQ.add(k);
    clearTimeout(this.spellT);
    this.spellT = setTimeout(() => this.spellFlush(), 250);
    return undefined;
  }

  spellFlush() {
    if (!this.spellQ || !this.spellQ.size) return;
    if (!this.worker) {
      this.worker = new Worker(new URL('./spell.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = e => {
        const { lang, out, error, words } = e.data;
        if (error) {
          if (!this.spellErr) this.app.toast('Stavekontrollen kunne ikke lastes: ' + error);
          this.spellErr = true;
        }
        (this.spellSent.get(e.data.id) || []).forEach(w => this.spellRes.set(lang + ':' + w, error ? null : out[w] || null));
        this.spellSent.delete(e.data.id);
        this.app.setState({ spellTick: Date.now() });
      };
      this.spellSent = new Map();
      this.spellId = 0;
    }
    const byLang = {};
    this.spellQ.forEach(k => { const i = k.indexOf(':'); (byLang[k.slice(0, i)] = byLang[k.slice(0, i)] || []).push(k.slice(i + 1)) });
    this.spellQ.clear();
    Object.entries(byLang).forEach(([lang, words]) => {
      const id = ++this.spellId;
      this.spellSent.set(id, words);
      words.forEach(w => this.spellRes.set(lang + ':' + w, null)); // ikke spør på nytt mens svaret er på vei
      this.worker.postMessage({ id, lang, base: serverBase() || location.origin, words });
    });
  }

  // Til oppstart uten nett: bruker, tilgang og dokumentliste (uten bildedata) lagres lokalt
  saveCache() {
    clearTimeout(this.cacheT);
    this.cacheT = setTimeout(() => {
      try {
        const docs = this.app.state.docs.map(d => ({ ...d, files: (d.files || []).map(f => ({ ...f, src: '' })), blocks: lean(d.blocks || []) }));
        localStorage.setItem(cacheKey(), JSON.stringify({ user: this.user, access: this.access, docs }));
      } catch { /* full lagring: hoppes over */ }
    }, 1500);
  }

  pushOther(d) {
    const ys = new YSocket(d.id);
    let done = false;
    const end = () => { if (!done) { done = true; setTimeout(() => ys.destroy(), 600) } };
    ys.onSynced = () => { applyDocToY(ys.doc, d, 'app'); end() };
    ys.onDenied = () => { this.app.toast('Du har bare lesetilgang til «' + d.title + '»'); end() };
    setTimeout(end, 15000);
  }

  pull() {
    const ys = this.ys, id = this.app.state.cur;
    if (!ys) return;
    const d = docFromY(ys.doc, id);
    this.remote = true;
    this.app.setState(
      s => ({
        docs: s.docs.map(x => (x.id === id ? { ...x, ...d } : x)),
        comments: commentsFromY(ys.doc).map(c => ({ ...c, doc: id }))
      }),
      () => { this.remote = false; this.app.schedule() }
    );
  }

  // ---------- kompilering og PDF ----------
  // Som i v2: rask sjekk i klienten (lintTex) først. Feil der stopper kompileringen;
  // ellers kompilerer serveren med latexmk, og feil/advarsler derfra havner i samme logg.
  async compile() {
    const app = this.app, doc = app.curDoc(), S = app.state.settings;
    clearTimeout(app.ct);
    clearTimeout(app.ct2);
    const gen = docCode(doc, S), genText = gen.map(l => l.s).join('\n');
    const tex = app.codeTextNow(), src = tex.split('\n');
    const lines = tex === genText ? gen : src.map(s => ({ s, bid: null }));
    const withCode = d => ({ ...d, code: (src[d.line - 1] || '').trim() });
    const lint = lintTex(tex, app.fileSet(doc)).map(withCode);
    const count = log => ({ nE: log.filter(d => d.sev === 'error').length, nW: log.filter(d => d.sev !== 'error').length });
    if (lint.some(d => d.sev === 'error')) return app.setState({ compile: { status: 'error', time: '', log: lint, ...count(lint) } });
    // Uten nett: feilsjekken og forhåndsvisningen i appen; PDF-en lages når serveren er tilbake
    if (app.netOff()) return app.setState({ compile: { status: 'ok', time: '', log: lint, ...count(lint) }, pdfSnap: clone(doc) });
    const files = {};
    const add = (name, url) => { if (url && url.startsWith('data:')) files['bilder/' + name] = url.split(',')[1] };
    (doc.files || []).forEach(f => add(f.file, f.src));
    doc.blocks.filter(b => b.type === 'img').forEach(b => add(b.file, b.src));
    const seq = ++this.seq;
    app.setState(s => ({ compile: { ...s.compile, status: 'running' } }));
    const fromServer = (list, sev) => (list || []).map(d => withCode({ line: d.line || 0, sev, msg: d.message, hint: d.hint || '' }));
    try {
      // Bare figurer i LaTeX-blokker trenger bilde fra serveren (kretseditoren tegner sine egne)
      const block = id => doc.blocks.find(b => b.id === id);
      const figs = tex === genText ? extractFigures(tex).filter(f => { const b = block(lines[f.line - 1] && lines[f.line - 1].bid); return !b || b.type === 'raw' }).map(f => f.hash) : undefined;
      const res = await api('POST', '/api/compile', { tex, files, engine: S.engine, doc: doc.id, figs }, { raw: true });
      const data = new Uint8Array(await res.arrayBuffer());
      if (seq !== this.seq) return;
      const id = res.headers.get('x-compile-id');
      this.pdf = { data, id, lines };
      const ms = Number(res.headers.get('x-compile-ms') || 0);
      let warn = [];
      try {
        if (id) {
          const r = await api('GET', '/api/compile/' + id + '/log');
          // PDF-en er laget; en figur som ikke kunne tegnes til forhåndsvisningen er en advarsel
          warn = [...fromServer(r.warnings, 'warning'), ...this.takeFigs(r, 'warning')];
        }
      } catch { /* */ }
      const log = [...lint, ...warn.filter(w => !lint.some(l => l.line === w.line && l.msg === w.msg))];
      app.setState({ compile: { status: 'ok', time: (ms / 1000).toFixed(1).replace('.', ','), log, ...count(log) }, pdfSnap: clone(doc) }, () => this.syncView(app.state.active));
    } catch (e) {
      if (seq !== this.seq) return;
      const errs = e.data && e.data.errors ? fromServer(e.data.errors, 'error') : [];
      const figErr = e.data ? this.takeFigs(e.data, 'error').filter(f => !errs.some(x => x.line === f.line)) : [];
      const log = e.data && e.data.errors
        ? [...errs, ...figErr, ...lint, ...fromServer(e.data.warnings, 'warning')]
        : [{ line: 0, sev: 'error', msg: e.message, hint: 'Serveren kunne ikke kompilere dokumentet.', code: '' }];
      app.setState({ compile: { status: 'error', time: '', log, ...count(log) } });
    }
  }

  // Figurstatus fra serveren; feil i figurene legges i loggen med linjenummer i main.tex.
  takeFigs(r, sev) {
    Object.assign(this.figs, r.figs || {});
    const src = this.app.codeTextNow().split('\n');
    return (r.figErrors || []).map(d => ({ line: d.line || 0, sev, msg: 'Figur: ' + d.message, hint: d.hint || 'Figuren kunne ikke tegnes i forhåndsvisningen.', code: (src[(d.line || 1) - 1] || '').trim() }));
  }

  figCtx(doc, S) {
    const pre = figPreamble(docCode(doc, S).map(l => l.s).join('\n'));
    return {
      pre,
      url: h => serverBase() + '/api/docs/' + doc.id + '/fig/' + h + '.svg' + authQuery(),
      state: h => (this.figs[h] === 'ok' ? 'ok' : this.app.state.compile && this.app.state.compile.status === 'running' ? 'busy' : this.figs[h])
    };
  }

  bidAt(lines, line) {
    for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) if (lines[i].bid) return lines[i].bid;
    return null;
  }

  async pick(page, x, y) {
    const p = this.pdf;
    if (!p || !p.id) return;
    try {
      const { line } = await api('POST', '/api/compile/' + p.id + '/edit', { page, x, y });
      const bid = line ? this.bidAt(p.lines, line) : null;
      if (bid) this.app.focusBlock(bid, 'pdf');
    } catch { /* gammel kompilering */ }
  }

  async syncView(bid) {
    const p = this.pdf;
    if (!p || !p.id || !bid) return this.app.state.pdfBoxes.length && this.app.setState({ pdfBoxes: [] });
    const i = p.lines.findIndex(l => l.bid === bid);
    if (i < 0) return;
    // Første linje med innhold (hopper over \begin{...})
    let line = i + 1;
    while (line < p.lines.length && p.lines[line - 1].bid === bid && /^\\(begin|centering)|^\s*\\(centering|caption)/.test(p.lines[line - 1].s.trim()) && p.lines[line].bid === bid) line++;
    try {
      const { boxes } = await api('POST', '/api/compile/' + p.id + '/view', { line });
      if (this.app.state.active === bid) this.app.setState({ pdfBoxes: boxes.slice(0, 6) });
    } catch { /* */ }
  }

  openPdf() {
    if (!this.pdf) return this.app.toast('Kompiler først (' + (this.app.state.platform === 'mac' ? '⌘' : 'Ctrl+') + 'S)');
    const url = URL.createObjectURL(new Blob([this.pdf.data], { type: 'application/pdf' }));
    const w = window.open(url, '_blank');
    if (!w) download(slug(this.app.curDoc().title) + '.pdf', new Blob([this.pdf.data], { type: 'application/pdf' }));
  }

  // ---------- dokumenter ----------
  async refreshDocs() {
    try {
      const list = (await api('GET', '/api/docs')).map(toDoc);
      const cur = this.app.state.cur;
      this.refreshing = true;
      this.app.setState(s => ({ docs: list.map(d => (d.id === cur ? s.docs.find(x => x.id === cur) || d : d)) }), () => { this.refreshing = false });
    } catch { /* */ }
  }

  async createDoc(doc) {
    const { id } = await api('POST', '/api/docs', { doc });
    const d = toDoc({ ...doc, id, updated: Date.now() });
    this.app.setState(s => ({ docs: [...s.docs, d], newProj: null }), () => this.app.openDoc(id));
  }

  async duplicateDoc() {
    const d = this.app.curDoc();
    try { await this.createDoc({ ...clone(d), id: undefined, title: d.title + ' (kopi)' }); this.app.toast('Dokumentet er duplisert') }
    catch (e) { this.app.toast(e.message) }
  }

  async deleteDoc(id) {
    const s = this.app.state;
    if (s.docs.length < 2) return this.app.toast('Du må ha minst ett dokument');
    const d = s.docs.find(x => x.id === id);
    if (!window.confirm('Slette «' + d.title + '»? Det kan gjenopprettes fra backup.')) return;
    try {
      await api('DELETE', '/api/docs/' + id);
      const rest = s.docs.filter(x => x.id !== id);
      this.app.setState({ docs: rest, cur: s.cur === id ? rest[0].id : s.cur, pdfSnap: null });
      this.app.toast('«' + d.title + '» er slettet');
    } catch (e) { this.app.toast(e.message) }
  }

  // ---------- deling ----------
  async loadPeople() {
    const id = this.app.state.cur;
    try {
      const r = await api('GET', '/api/docs/' + id + '/people');
      const people = r.people.map(p => ({ id: p.id, name: p.id === this.user.id ? p.name + ' (deg)' : p.name, email: p.email, initials: initialsOf(p.name), color: colorFor(p.id), role: p.role }))
        .concat(r.invites.map(i => ({ id: 'inv:' + i.email, name: i.email, email: i.email, initials: initialsOf(i.email), color: colorFor(i.email), role: i.role, status: 'Invitert', pending: true })));
      if (this.app.state.cur === id) this.app.setState({ people, linkRole: LINK_ROLE[r.linkRole] || 'Ingen tilgang', smtpReady: r.smtpReady, linkBase: r.link || null });
    } catch { /* */ }
  }

  async loadMails() {
    try {
      const list = await api('GET', '/api/mails');
      const title = id => (this.app.state.docs.find(d => d.id === id) || {}).title || '';
      this.app.setState({
        mails: list.map(m => {
          const d = new Date(m.created);
          return {
            id: 'm' + m.id, kind: m.kind === 'invite' ? 'invite' : 'doc', to: m.to_addr, subject: m.subject, body: m.body || '', link: m.url,
            att: JSON.parse(m.attachments || '[]'), status: m.status, time: d.toTimeString().slice(0, 5), date: d.toLocaleDateString('nb-NO'), docTitle: title(m.doc_id)
          };
        })
      });
    } catch { /* */ }
  }

  async sendInvite() {
    const app = this.app, s = app.state, x = s.invite.trim();
    if (!x) return app.setState({ inviteErr: 'Skriv inn en e-postadresse.' });
    if (!EMAIL_RE.test(x)) return app.setState({ inviteErr: 'Ugyldig e-postadresse.' });
    if (s.people.some(p => p.email === x.toLowerCase() && !p.pending)) return app.setState({ inviteErr: x + ' har allerede tilgang.' });
    try {
      const r = await api('POST', '/api/docs/' + s.cur + '/invites', { email: x, role: s.inviteRole, sendMail: s.inviteMail, message: s.inviteMsg });
      app.setState({ invite: '', inviteMsg: '' });
      if (s.inviteMail) app.toast(r.mail && r.mail.ok ? 'Invitasjon sendt på e-post til ' + x : r.mail && r.mail.queued ? 'Invitasjonen ligger i utboksen til SMTP er satt opp' : 'E-posten feilet: ' + ((r.mail && r.mail.error) || ''));
      else app.toast((r.existing || x) + ' har fått tilgang');
      this.loadPeople(); this.loadMails();
    } catch (e) { app.setState({ inviteErr: e.message }) }
  }

  async setRole(p, role) {
    if (p.pending) return this.app.toast('Invitasjonen gjelder til den er godtatt eller utløper');
    try { await api('PUT', '/api/docs/' + this.app.state.cur + '/people/' + p.id, { role }); this.loadPeople() }
    catch (e) { this.app.toast(e.message) }
  }

  async setLinkRole(label) {
    const role = label === 'Ingen tilgang' ? 'none' : label;
    try { const r = await api('PUT', '/api/docs/' + this.app.state.cur + '/link', { role }); this.app.setState({ linkRole: LINK_ROLE[r.linkRole] }) }
    catch (e) { this.app.toast(e.message) }
  }

  async sendDocMail() {
    const app = this.app, s = app.state, doc = app.curDoc(), to = s.sendTo.split(/[,;\s]+/).filter(Boolean);
    if (!to.length) return app.setState({ sendErr: 'Skriv inn minst én mottaker.' });
    const bad = to.find(x => !EMAIL_RE.test(x));
    if (bad) return app.setState({ sendErr: 'Ugyldig e-postadresse: ' + bad });
    const attachments = [];
    if (s.att.pdf) {
      if (!this.pdf) await this.compile();
      if (this.pdf) attachments.push({ name: slug(doc.title) + '.pdf', b64: await b64(new Blob([this.pdf.data])) });
    }
    if (s.att.tex) attachments.push({ name: slug(doc.title) + '.tex', b64: await b64(new Blob([docCode(doc, s.settings).map(l => l.s).join('\n')])) });
    if (s.att.img) for (const b of doc.blocks.filter(b => b.type === 'img' && b.src && b.src.startsWith('data:'))) attachments.push({ name: b.file, b64: b.src.split(',')[1] });
    try {
      const r = await api('POST', '/api/docs/' + s.cur + '/send', { to: to.join(', '), subject: s.sendSubj || doc.title, message: s.sendMsg, attachments });
      app.setState({ sendErr: '', sendMsg: '' });
      app.toast(r.ok ? 'E-posten er sendt til ' + to.join(', ') : r.queued ? 'Lagt i utboksen. Sett opp SMTP for å sende.' : 'E-posten feilet: ' + r.error);
      this.loadMails();
    } catch (e) { app.setState({ sendErr: e.message }) }
  }

  // ---------- administrasjon ----------
  async loadAdmin() {
    try {
      const r = await api('GET', '/api/admin/settings');
      this.adminRemote = true;
      this.app.setState(s => ({
        duck: { ...DEF_DUCK, ...pick(r.duck, { ...DEF_DUCK, links: true }) },
        smb: { ...DEF_SMB, ...pick(r.smb, DEF_SMB) },
        smtp: { ...DEF_SMTP, ...pick(r.smtp, { ...DEF_SMTP, fromName: '' }) },
        deploy: { ...DEF_DEP, ...pick(r.deploy, DEF_DEP) },
        upd: { ...DEF_UPD, ...pick(r.update, DEF_UPD), ...(r.version ? { ver: r.version.ver, built: r.version.built } : {}) },
        updateMode: r.updateMode,
        serverUsers: r.users ? { n: r.users.n, admins: r.users.admins || 0 } : null,
        duckUi: { ...s.duckUi, log: (r.duckLog || []).map(logRow), ip: (r.duckLog || []).find(l => l.ip)?.ip || s.duckUi.ip }
      }), () => { this.adminRemote = false; this.adminLoaded = true });
    } catch { /* ikke admin */ }
  }

  async saveAdmin() {
    const s = this.app.state;
    const { channel, auto, time, backup, notify } = s.upd;
    const body = { duck: s.duck, smb: s.smb, smtp: { ...s.smtp, from: smtpFrom(s.smtp) }, deploy: s.deploy, update: { channel, auto, time, backup, notify } };
    // Ugyldige DuckDNS-verdier vises som feil i skjemaet; de lagres ikke før de er rettet.
    if (body.duck.domain && !/^[a-z0-9-]{1,63}$/.test(body.duck.domain)) delete body.duck;
    else if (body.duck.token && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.duck.token)) delete body.duck;
    try { await api('PUT', '/api/admin/settings', body); if (body.duck) this.loadPeople() } catch (e) { if (e.status !== 400) this.app.toast(e.message) }
  }

  async refreshDuckLog() {
    try {
      const r = await api('GET', '/api/admin/settings');
      this.app.dku(x => ({ log: (r.duckLog || []).map(logRow), ip: (r.duckLog || []).find(l => l.ip)?.ip || x.ip }));
    } catch { /* */ }
  }

  async duckUpdate() {
    const app = this.app;
    app.dku({ busy: true });
    clearTimeout(this.adminTimer);
    await this.saveAdmin();
    try {
      const r = await api('POST', '/api/admin/duckdns/update');
      app.dku(x => ({ busy: false, ip: r.ip || x.ip, last: r.ok ? now() : x.last, log: (r.log || []).map(logRow) }));
      const d = app.state.duck;
      app.toast(r.ok ? d.domain + '.duckdns.org peker nå på ' + r.ip : r.msg);
    } catch (e) { app.dku({ busy: false }); app.toast(e.message) }
  }

  async testSmb() {
    const app = this.app, e = app.smbErr();
    if (e) return app.sbu({ test: { ok: false, msg: e } });
    app.sbu({ testing: true, test: null });
    clearTimeout(this.adminTimer);
    await this.saveAdmin();
    try { const r = await api('POST', '/api/admin/backup/test'); app.sbu({ testing: false, test: r }) }
    catch (err) { app.sbu({ testing: false, test: { ok: false, msg: err.message } }) }
  }

  async runBackup() {
    const app = this.app, e = app.smbErr();
    if (e) return app.sbu({ test: { ok: false, msg: e } });
    clearTimeout(this.adminTimer);
    await this.saveAdmin();
    try { await api('POST', '/api/admin/backup/run') } catch (err) { return app.toast(err.message) }
    app.sbu({ run: { pct: 0, step: 'Starter …' }, test: null });
    clearInterval(this.bkTimer);
    this.bkTimer = setInterval(async () => {
      try {
        const st = await api('GET', '/api/admin/backup/status');
        if (st.run) return app.sbu({ run: st.run });
        clearInterval(this.bkTimer);
        app.sbu({ run: null, test: st.last && !st.last.ok ? { ok: false, msg: st.last.msg } : null });
        app.toast(st.last && st.last.ok ? 'Backup fullført' : 'Backup feilet');
        this.loadBackups();
      } catch { clearInterval(this.bkTimer); app.sbu({ run: null }) }
    }, 400);
  }

  async loadBackups(manual) {
    const app = this.app, b = app.state.smb;
    if (manual && (!b.host || !b.share)) return app.toast('Fyll inn server og share først');
    if (manual) { clearTimeout(this.adminTimer); await this.saveAdmin(); app.setState({ fetchingBk: true }) }
    try {
      const list = await api('GET', '/api/admin/backups');
      app.setState(s => ({
        fetchingBk: false,
        backups: [...s.backups.filter(k => k.fromFile), ...list.map(x => {
          const d = new Date(x.date), ok = !isNaN(d);
          return { id: x.name, name: x.name, date: ok ? d.toLocaleDateString('nb-NO') : x.date, time: ok ? d.toTimeString().slice(0, 5) : '', size: fmtSize(x.size), bytes: x.size, remote: true };
        })]
      }));
      if (manual) app.toast('Fant ' + list.length + ' backuper på //' + b.host + '/' + b.share);
    } catch (e) { app.setState({ fetchingBk: false }); if (manual) app.toast(e.message) }
  }

  // Gjenopprett-dialogen: dokumentlisten hentes fra backupen på serveren.
  async openRestore(k) {
    const app = this.app;
    try {
      const r = k.docs ? k : await api('GET', '/api/admin/backups/' + encodeURIComponent(k.id) + '/docs');
      const docs = r.docs.map(d => ({ ...d, blocks: d.blocks && d.blocks.length !== undefined ? d.blocks : new Array(d.blocks || 0) }));
      app.setState(s => ({
        backups: s.backups.map(x => (x.id === k.id ? { ...x, docs, files: docs.length } : x)),
        restore: { id: k.id, mode: 'merge', sel: Object.fromEntries(docs.map(d => [d.id, true])), safety: true }
      }));
    } catch (e) { app.toast(e.message) }
  }

  async doRestore() {
    const app = this.app, r = app.state.restore, k = app.state.backups.find(x => x.id === r.id);
    if (!k) return;
    const ids = k.docs.filter(d => r.sel[d.id]).map(d => d.id);
    if (!ids.length) return;
    app.setState({ restore: null });
    app.toast('Gjenoppretter …');
    try {
      const res = await api('POST', '/api/admin/backups/' + encodeURIComponent(k.id) + '/restore', { mode: r.mode, ids, safety: r.safety });
      if (!res.ok) return app.toast(res.msg);
      app.toast((r.mode === 'replace' ? 'Erstattet alt med ' : 'Gjenopprettet ' + res.restored + ' dokument' + (res.restored > 1 ? 'er' : '') + ' fra ') + k.name);
      setTimeout(() => location.reload(), 1200);
    } catch (e) { app.toast(e.message) }
  }

  async onBackupFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const app = this.app;
    try {
      const r = await api('POST', '/api/admin/backups/upload', { name: f.name, b64: await b64(f) });
      const d = new Date();
      const k = { id: r.id, name: r.name, date: d.toLocaleDateString('nb-NO'), time: now(), size: fmtSize(f.size), fromFile: true, files: r.docs.length, docs: r.docs };
      app.setState(s => ({ backups: [k, ...s.backups] }), () => this.openRestore(k));
    } catch (err) { app.toast(err.message) }
  }

  async downloadBackup(k) {
    try { const res = await api('GET', '/api/admin/backups/' + encodeURIComponent(k.name), undefined, { raw: true }); download(k.name, await res.blob()) }
    catch (e) { this.app.toast(e.message) }
  }

  // ---------- SMB-mappevelger: sharer og mapper hentes fra serveren etter hvert som man blar ----------
  smbBody(extra) {
    const b = this.app.state.smb;
    return { host: b.host.trim(), user: b.user, pass: b.pass, domain: b.domain, ver: b.ver, ...extra };
  }

  async smbConnect() {
    const app = this.app, b = app.state.smb, u = app.state.smbUi;
    if (u.conn && u.conn.ok) return app.sbu({ conn: null, cwd: [], newDir: '' });
    if (u.conn && u.conn.busy) return;
    const host = b.host.trim();
    app.sbu({ conn: { busy: true } });
    try {
      const r = await api('POST', '/api/admin/smb/browse', this.smbBody());
      if (!r.ok) return app.sbu({ conn: { err: r.msg } });
      const fs = Object.fromEntries(r.shares.sort((a, c) => a.localeCompare(c, 'nb')).map(n => [n, {}]));
      this.smbLoaded = new Set();
      this.smbHost = host;
      // Lagret mappe åpnes direkte; mappene lastes når de vises
      const cwd = b.share && fs[b.share] ? [b.share, ...(b.path || '').split('/').filter(Boolean)] : [];
      let n = fs;
      cwd.forEach(p => (n = n[p] = n[p] || {}));
      app.setState(s => ({ smbFs: { ...(s.smbFs || {}), [host]: fs }, smbUi: { ...s.smbUi, conn: { ok: true, host }, cwd, newDir: '' } }));
    } catch (e) { app.sbu({ conn: { err: e.message } }) }
  }

  smbNode(cwd) {
    const s = this.app.state, u = s.smbUi, host = u.conn && u.conn.host;
    let n = (s.smbFs || {})[host];
    for (const p of cwd) n = n && n[p];
    const key = cwd.join('/');
    if (n && cwd.length && this.smbHost === host && !this.smbLoaded.has(key)) {
      this.smbLoaded.add(key);
      api('POST', '/api/admin/smb/browse', this.smbBody({ share: cwd[0], path: cwd.slice(1).join('/') }))
        .then(r => {
          if (!r.ok) return this.app.toast(r.msg);
          this.app.setState(st => {
            const fs = clone(st.smbFs[host]);
            let m = fs;
            for (const p of cwd) m = m[p] = m[p] || {};
            const old = { ...m };
            Object.keys(m).forEach(k => delete m[k]);
            r.dirs.sort((a, c) => a.localeCompare(c, 'nb')).forEach(d => (m[d] = old[d] || {}));
            return { smbFs: { ...st.smbFs, [host]: fs } };
          });
        })
        .catch(e => this.app.toast(e.message));
    }
    return n;
  }

  async smbMkdir() {
    const app = this.app, u = app.state.smbUi, name = (u.newDir || '').trim();
    if (!name || !u.cwd.length) return;
    if (/[\\/:*?"<>|;]/.test(name)) return app.toast('Ugyldige tegn i mappenavnet');
    const cwd = u.cwd, host = u.conn.host;
    try {
      const r = await api('POST', '/api/admin/smb/mkdir', this.smbBody({ share: cwd[0], path: cwd.slice(1).join('/'), name }));
      if (!r.ok) return app.toast(r.msg);
      this.smbLoaded.add([...cwd, name].join('/'));
      app.setState(s => {
        const fs = clone(s.smbFs[host]);
        let n = fs;
        for (const p of cwd) n = n[p] = n[p] || {};
        n[name] = n[name] || {};
        return { smbFs: { ...s.smbFs, [host]: fs }, smbUi: { ...s.smbUi, newDir: '', cwd: [...cwd, name] } };
      });
      app.toast('Opprettet mappen ' + name);
    } catch (e) { app.toast(e.message) }
  }

  // ---------- oppdatering av serveren ----------
  async checkUpdate() {
    const app = this.app;
    app.uu({ checking: true, found: null });
    clearTimeout(this.adminTimer);
    await this.saveAdmin();
    try {
      const r = await api('POST', '/api/admin/update/check', { channel: app.state.upd.channel });
      this.adminRemote = true;
      app.setState(s => ({ upd: { ...s.upd, lastCheck: r.lastCheck } }), () => { this.adminRemote = false });
      app.uu({ checking: false, found: r.found || 'none' });
    } catch (e) { app.uu({ checking: false }); app.toast(e.message) }
  }

  async runUpdate(rollback) {
    const app = this.app;
    let r;
    try { r = await api('POST', '/api/admin/update/run', rollback ? { rollback: true } : {}) } catch (e) { return app.toast(e.message) }
    if (!r.ok) return app.toast(r.msg);
    app.uu({ run: { pct: 4, step: 'Starter …', log: [], to: '' } });
    const from = app.state.upd.ver;
    let down = false, t0 = Date.now();
    clearInterval(this.updTimer);
    this.updTimer = setInterval(async () => {
      try {
        const st = await api('GET', '/api/admin/update/status', undefined, { timeout: 2500 });
        const run = st.run || {};
        if (run.done || (down && st.current && st.current.ver !== from)) {
          clearInterval(this.updTimer);
          const ok = run.done ? run.ok : true, to = run.to || (st.current && st.current.ver);
          const log = [...(app.state.updUi.run?.log || []), ...(down ? ['✓ Migrerer database', '✓ Starter kobling-server ' + to] : []), '✓ Helsesjekk: /api/health'];
          app.uu({ run: { pct: 100, done: true, ok, step: ok ? 'Ferdig' : 'Oppdateringen feilet', log: ok ? log : [...log.slice(0, -1), '✗ Se /var/lib/kobling/update/log.txt'], to, rollback: !!rollback }, found: null });
          if (ok) {
            app.toast((rollback ? 'Tilbake på ' : 'Serveren er oppdatert til ') + to + '. Laster appen på nytt …');
            setTimeout(() => location.reload(), 2500);
          } else app.toast('Oppdateringen feilet. Den forrige versjonen kjører fortsatt.');
          return;
        }
        if (!down) app.uu({ run: { ...run, pct: run.pct || 4, log: run.log || [] } });
      } catch {
        // Serveren starter på nytt
        if (!down) {
          down = true;
          const cur = app.state.updUi.run || { log: [] };
          app.uu({ run: { ...cur, pct: 90, step: 'Starter kobling-server ' + (cur.to || '') + ' …', log: [...(cur.log || []), '✓ ' + String(cur.step || '').replace(' …', '')] } });
        }
        if (Date.now() - t0 > 20 * 60000) { clearInterval(this.updTimer); app.toast('Serveren svarer ikke etter oppdateringen') }
      }
    }, 1200);
  }

  async testSmtp() {
    const app = this.app, fail = msg => app.setState(s => ({ smtpUi: { ...s.smtpUi, testing: false, test: { ok: false, msg } } }));
    app.setState(s => ({ smtpUi: { ...s.smtpUi, testing: true, test: null } }));
    clearTimeout(this.adminTimer);
    await this.saveAdmin();
    try {
      const r = await api('POST', '/api/admin/smtp/test');
      if (!r.ok) return fail(r.msg);
      app.setState(s => ({ smtpUi: { ...s.smtpUi, testing: false, test: { ok: true, msg: r.msg } } }));
    } catch (e) { fail(e.message) }
  }

  async logout() {
    try { await api('POST', '/api/logout') } catch { /* */ }
    setToken('');
    location.href = location.pathname;
  }

  kontoRows({ head, btns, note }) {
    return [head('ØKT'), note('Dokumentene lagres på serveren og synkroniseres i sanntid med alle som har tilgang.'), btns([['Logg ut', () => this.logout()]])];
  }

  // Lenkebasen kommer fra serveren (DuckDNS-adressen når den er på og brukes i lenker).
  linkBase() {
    return this.app.state.linkBase || { url: serverBase() || location.origin, ext: false };
  }

  // ---------- visningsmodell ----------
  view(v) {
    const app = this.app, s = app.state;
    v.isDemo = false;
    v.sendInvite = () => this.sendInvite();
    v.onInviteKey = e => { if (e.key === 'Enter') this.sendInvite() };
    v.onLinkRole = e => this.setLinkRole(e.target.value);
    v.people = v.people.map(p => ({ ...p, onRole: e => this.setRole(p, e.target.value) }));
    v.avatars = s.people.filter(p => !p.pending).slice(0, 4).map(p => ({ initials: p.initials, color: p.color, name: p.name }));
    if (!v.avatars.length) { const me = this.account(); v.avatars = [{ initials: me.initials, color: me.color, name: me.name }] }
    const pb = this.linkBase(), link = pb.url + '/?doc=' + s.cur;
    v.shareFull = link;
    v.shareUrl = link.replace(/^https?:\/\//, '');
    v.linkExt = pb.ext;
    v.linkLocal = !pb.ext;
    v.linkNote = pb.ext ? 'Ekstern adresse via DuckDNS. Fungerer utenfor hjemmenettet.' : 'Lenken bruker serveradressen ' + pb.url.replace(/^https?:\/\//, '') + '. Slå på DuckDNS for å dele utenfor hjemmenettet.';
    v.linkNoteAction = this.user.role === 'admin' && !pb.ext ? 'Sett opp DuckDNS' : '';
    v.hasLinkAction = !!v.linkNoteAction;
    v.copyLink = () => {
      try { navigator.clipboard.writeText(link) } catch { /* */ }
      app.setState({ copied: true });
      setTimeout(() => app.setState({ copied: false }), 1600);
    };
    if (v.mp && v.mp.to) v.mp.from = s.smtp && smtpFrom(s.smtp) ? smtpFrom(s.smtp) : 'Kobling';

    if (s.newProj) {
      const create = () => {
        const ti = s.newProj.title.trim();
        if (!ti) return app.setState(x => ({ newProj: { ...x.newProj, err: 'Gi obligen en tittel.' } }));
        const cd = app.curDoc();
        this.createDoc({ title: ti, authors: cd.authors || this.user.name, group: cd.group || '', folder: s.group, meta: 'Opprettet nå', blocks: skeleton(s.newProj.tpl) })
          .catch(e => app.setState(x => ({ newProj: { ...x.newProj, err: e.message } })));
      };
      v.np = { ...v.np, onCreate: create, onKey: e => { if (e.key === 'Enter') create() } };
    }

    const cur = app.curDoc();
    v.historyList = v.historyList.map(h => ({
      ...h,
      onRestore: () => {
        if (!h.snap) return;
        const imgs = {};
        cur.blocks.filter(b => b.type === 'img').forEach(b => { imgs[b.id] = b.src; imgs['f:' + b.file] = b.src });
        app.setBlocks(() => clone(h.snap).map(b => (b.type === 'img' && !b.src ? { ...b, src: imgs[b.id] || imgs['f:' + b.file] || '' } : b)), `Gjenopprettet «${h.what}»`);
        app.toast('Versjon gjenopprettet');
      }
    }));

    if (v.setRows && s.setTab === 'update' && s.updUi.found && s.updUi.found !== 'none')
      v.setRows = v.setRows.map(r => (r.isUpd ? { ...r, fMeta: 'Utgitt ' + s.updUi.found.date + (s.updUi.found.size ? ' · ' + s.updUi.found.size : '') } : r));
    if (v.backupList) v.backupList = s.backups.map(k => ({
      name: k.name, meta: k.date + (k.time ? ' ' + k.time : '') + ' · ' + k.size + (k.files ? ' · ' + k.files + ' dokumenter' : ''), isRemote: !!k.remote,
      onRestore: () => this.openRestore(k), onDownload: () => (k.fromFile ? app.toast('Filen ligger allerede hos deg') : this.downloadBackup(k))
    }));
    // «Finnes»/«Slettet» gjelder hele serveren, ikke bare dokumentene administratoren selv har
    if (v.rs && v.rs.docs && s.restore) {
      const k = s.backups.find(x => x.id === s.restore.id);
      if (k && k.docs) v.rs.docs = v.rs.docs.map((x, i) => {
        const ex = k.docs[i] && k.docs[i].exists;
        return ex === undefined ? x : { ...x, tag: ex ? 'Finnes' : 'Slettet', tagBg: ex ? 'var(--kf3f1ed,#f3f1ed)' : 'var(--koklch096003075,oklch(0.96 0.03 75))', tagColor: ex ? 'var(--k6b6862,#6b6862)' : 'var(--k8a5310,#8a5310)' };
      });
    }

    if (this.pdf) {
      v.pages = [];
      v.pdfView = React.createElement(PdfView, { data: this.pdf.data, zoom: v.pdfZoom, boxes: s.pdfBoxes || [], onPick: (p, x, y) => this.pick(p, x, y) });
    }
    return v;
  }
}

function pick(obj, shape) {
  const o = {};
  Object.keys(shape).forEach(k => { if (obj && obj[k] !== undefined && obj[k] !== null) o[k] = typeof shape[k] === 'string' && typeof obj[k] === 'number' ? String(obj[k]) : obj[k] });
  return o;
}
function logRow(l) {
  const d = new Date(l.t);
  return { t: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), ok: l.ok, txt: l.txt };
}
