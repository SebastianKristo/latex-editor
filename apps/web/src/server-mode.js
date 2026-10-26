// Kobler appen til Kobling-serveren: dokumenter og kommentarer via Yjs, deling, admin-innstillinger,
// kompilering til ekte PDF (pdf.js) og SyncTeX. Prototypens lokale demo-logikk byttes ut her,
// mens visningsmodellen (renderVals) og malen er de samme.
import React from 'react';
import { docCode, clone, now, slug, smtpFrom, skeleton, EMAIL_RE, DEF_DUCK, DEF_SMB, DEF_SMTP, DEF_DEP, DEF_SET } from '@kobling/core';
import { applyDocToY, docFromY, commentsFromY, applyCommentsToY, historyFromY, pushHistory, isEmptyY } from '@kobling/core/ydoc';
import { api, b64, setToken, serverBase } from './api';
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
const download = (name, blob) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 800);
};

export class ServerSession {
  constructor({ user, docs }) {
    this.user = user;
    this.docs = docs.map(toDoc);
    this.lsKey = 'kobling-user-' + user.id;
    this.persistKeys = ['settings', 'rightW', 'recent'];
    this.ys = null;
    this.remote = false;
    this.pdf = null;
    this.seq = 0;
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
      settings: { ...DEF_SET, ...app.state.settings, ...(saved.settings || {}), server: serverBase() || location.origin },
      rightW: saved.rightW || app.state.rightW,
      comments: [], history: [], people: [], mails: [], backups: [], presence: {}, remotePresence: [],
      me: me.id, view: app.state.view === 'settings' || app.state.view === 'projects' ? app.state.view : 'editor',
      duck: { ...DEF_DUCK }, smb: { ...DEF_SMB }, smtp: { ...DEF_SMTP }, deploy: { ...DEF_DEP },
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
  unmount() { this.ys?.destroy(); clearTimeout(this.adminTimer); clearInterval(this.bkTimer) }

  update(ps) {
    const s = this.app.state;
    if (ps.cur !== s.cur) { this.pdf = null; this.app.setState({ pdfBoxes: [], people: [] }); this.bind(s.cur); this.loadPeople() }
    else if (!this.remote && this.ys && this.ys.synced) {
      if (ps.docs !== s.docs) {
        const d = s.docs.find(x => x.id === s.cur);
        if (d && d !== ps.docs.find(x => x.id === s.cur)) applyDocToY(this.ys.doc, d, 'app');
      }
      if (ps.comments !== s.comments) applyCommentsToY(this.ys.doc, s.comments.filter(c => c.doc === s.cur).map(({ doc, ...c }) => c), 'app');
      if (ps.history !== s.history) {
        const have = new Set(historyFromY(this.ys.doc).map(h => h.id));
        s.history.filter(h => !have.has(h.id)).reverse().forEach(h => pushHistory(this.ys.doc, { ...h, snap: h.snap ? lean(h.snap) : null }, 'app'));
      }
    }
    if (ps.active !== s.active) {
      this.ys?.awareness.setLocalStateField('bid', s.active || null);
      this.syncView(s.active);
    }
    if (!ps.share && s.share) { this.loadPeople(); this.loadMails() }
    if (ps.view !== s.view && s.view === 'projects') this.refreshDocs();
    if (ps.setTab !== s.setTab && s.setTab === 'backup' && this.user.role === 'admin') this.loadBackups();
    if (this.adminLoaded && !this.adminRemote && ['duck', 'smb', 'smtp', 'deploy'].some(k => ps[k] !== s[k])) {
      clearTimeout(this.adminTimer);
      this.adminTimer = setTimeout(() => this.saveAdmin(), 600);
    }
  }

  // ---------- Yjs ----------
  bind(docId) {
    this.ys?.destroy();
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
    ys.onStatus = (st, code) => {
      if (st === 'closed' && (code === 4401 || code === 4000)) location.reload();
      if (st === 'closed' && code === 4403) this.app.toast('Du har ikke tilgang til dette dokumentet');
    };
  }

  pull() {
    const ys = this.ys, id = this.app.state.cur;
    if (!ys) return;
    const d = docFromY(ys.doc, id);
    this.remote = true;
    this.app.setState(
      s => ({
        docs: s.docs.map(x => (x.id === id ? { ...x, ...d } : x)),
        comments: commentsFromY(ys.doc).map(c => ({ ...c, doc: id })),
        history: historyFromY(ys.doc)
      }),
      () => { this.remote = false; this.app.schedule() }
    );
  }

  // ---------- kompilering og PDF ----------
  async compile() {
    const app = this.app, doc = app.curDoc(), S = app.state.settings;
    clearTimeout(app.ct);
    const lines = docCode(doc, S), tex = lines.map(l => l.s).join('\n');
    const files = {};
    doc.blocks.filter(b => b.type === 'img' && b.src && b.src.startsWith('data:')).forEach(b => { files['bilder/' + b.file] = b.src.split(',')[1] });
    const seq = ++this.seq;
    app.setState(s => ({ compile: { ...s.compile, status: 'running' } }));
    try {
      const res = await api('POST', '/api/compile', { tex, files, engine: S.engine }, { raw: true });
      const data = new Uint8Array(await res.arrayBuffer());
      if (seq !== this.seq) return;
      this.pdf = { data, id: res.headers.get('x-compile-id'), lines };
      const ms = Number(res.headers.get('x-compile-ms') || 0);
      app.setState({ compile: { status: 'ok', time: (ms / 1000).toFixed(1).replace('.', ',') }, pdfSnap: clone(doc) }, () => this.syncView(app.state.active));
    } catch (e) {
      if (seq !== this.seq) return;
      const err = e.data && e.data.errors && e.data.errors[0];
      const bid = err && err.line ? this.bidAt(lines, err.line) : null;
      const msg = err ? (err.line ? 'linje ' + err.line + ': ' : '') + err.message : e.message;
      app.setState({ compile: { status: 'error', time: '', msg, bid } });
    }
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
      this.app.setState(s => ({ docs: list.map(d => (d.id === cur ? s.docs.find(x => x.id === cur) || d : d)) }));
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
      if (this.app.state.cur === id) this.app.setState({ people, linkRole: LINK_ROLE[r.linkRole] || 'Ingen tilgang', smtpReady: r.smtpReady });
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
        duck: { ...DEF_DUCK, ...pick(r.duck, DEF_DUCK) },
        smb: { ...DEF_SMB, ...pick(r.smb, DEF_SMB) },
        smtp: { ...DEF_SMTP, ...pick(r.smtp, { ...DEF_SMTP, fromName: '' }) },
        deploy: { ...DEF_DEP, ...pick(r.deploy, DEF_DEP) },
        duckUi: { ...s.duckUi, log: (r.duckLog || []).map(logRow), ip: (r.duckLog || []).find(l => l.ip)?.ip || s.duckUi.ip }
      }), () => { this.adminRemote = false; this.adminLoaded = true });
    } catch { /* ikke admin */ }
  }

  async saveAdmin() {
    const s = this.app.state;
    const body = { duck: s.duck, smb: s.smb, smtp: { ...s.smtp, from: smtpFrom(s.smtp) }, deploy: s.deploy };
    // Ugyldige DuckDNS-verdier vises som feil i skjemaet; de lagres ikke før de er rettet.
    if (body.duck.domain && !/^[a-z0-9-]{1,63}$/.test(body.duck.domain)) delete body.duck;
    else if (body.duck.token && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.duck.token)) delete body.duck;
    try { await api('PUT', '/api/admin/settings', body) } catch (e) { if (e.status !== 400) this.app.toast(e.message) }
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

  async loadBackups() {
    try {
      const list = await api('GET', '/api/admin/backups');
      this.app.setState({ backups: list.map(b => ({ id: b.name, name: b.name, date: b.date, time: '', size: fmtSize(b.size), bytes: b.size })) });
    } catch { /* ikke satt opp */ }
  }

  async restoreBackup(k) {
    if (!window.confirm('Gjenopprette «' + k.name + '»? Dokumentene erstattes med innholdet i backupen.')) return;
    try {
      const r = await api('POST', '/api/admin/backups/' + encodeURIComponent(k.name) + '/restore');
      if (!r.ok) return this.app.toast(r.msg);
      this.app.toast('Gjenopprettet fra ' + k.name);
      setTimeout(() => location.reload(), 900);
    } catch (e) { this.app.toast(e.message) }
  }

  async downloadBackup(k) {
    try { const res = await api('GET', '/api/admin/backups/' + encodeURIComponent(k.name), undefined, { raw: true }); download(k.name, await res.blob()) }
    catch (e) { this.app.toast(e.message) }
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
    const link = (serverBase() || location.origin) + '/?doc=' + s.cur;
    v.shareUrl = link.replace(/^https?:\/\//, '');
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

    if (v.backupList) v.backupList = s.backups.map(k => ({ name: k.name, meta: k.date + ' · ' + k.size, onRestore: () => this.restoreBackup(k), onDownload: () => this.downloadBackup(k) }));

    if (s.compile.status === 'error') {
      v.statusText = 'Feil på ' + s.compile.msg;
      v.statusColor = '#b3261e';
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
