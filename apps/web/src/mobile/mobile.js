// Mobil og nettbrett (README §12): egen layout fra «Kobling Mobil App» rundt de samme dataene som desktop.
// Skriv-, kode- og PDF-flatene, dialogene og panelene for kilder/sjekk/historikk er delene fra
// desktop-malen (dc-part); resten er mobilmalen bundet mot App sin visningsmodell.
import React from 'react';
import { renderPart, renderTree, parseTemplate } from '../dc-runtime';
import mobileSrc from './template.html?raw';
import { CropView, startCamera, stopCamera, capture, pickPhoto, finishPhoto, setTorch, isNative } from './camera.js';

const TREE = parseTemplate(mobileSrc);
const h = React.createElement;

export function detectDevice() {
  const q = new URLSearchParams(location.search).get('device');
  if (q) return q === 'desktop' ? null : q;
  const w = window.innerWidth;
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const android = native ? cap.getPlatform() === 'android' : /Android/i.test(navigator.userAgent);
  let coarse = false;
  try { coarse = window.matchMedia('(pointer: coarse)').matches } catch (e) { /* */ }
  if (w < 700) return android ? 'android' : 'ios';
  if ((native || coarse) && w < 1400) return 'tablet';
  return null;
}

const DEF = { seg: 'write', sheet: null, kb: false, cam: null, side: true, q: '', palAll: false, selEdit: false, pz: 1, page: 1 };
const ACC = 'oklch(0.55 0.17 255)';
const keep = e => e.preventDefault();
const PALETTE = [['R', 'R', 'Motstand'], ['C', 'C', 'Kondensator'], ['L', 'L', 'Spole'], ['D', 'D', 'Diode'], ['led', 'LED', 'LED'], ['V', 'V', 'DC-kilde'], ['sV', '∿', 'AC-kilde'], ['gnd', '⏚', 'Jord'], ['nand', '&', 'NAND'], ['opamp', '▷', 'Op-amp']];
const STAMP = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}` };

// Mobilutgaven av App: samme komponent, men render() velger mobilmalen når skjermen er smal
// eller appen kjører i Capacitor. Innstillinger vises med desktop-layouten.
export function withMobile(App) {
  return class MobileApp extends App {
    constructor(props) {
      super(props);
      this.state = { ...this.state, mob: { ...DEF }, device: detectDevice(), vh: window.visualViewport ? window.visualViewport.height : window.innerHeight };
      if (this.state.device && !new URLSearchParams(location.search).get('view')) this.state.view = 'projects';
    }
    componentDidMount() {
      super.componentDidMount();
      const d = this.curDoc();
      if (this.state.device && d && d.folder) this.setState({ group: d.folder });
      this._rs = () => {
        const vv = window.visualViewport;
        const vh = vv ? vv.height : window.innerHeight, device = detectDevice();
        if (vh !== this.state.vh || device !== this.state.device) this.setState({ vh, device });
        if (vv && vv.offsetTop) window.scrollTo(0, 0);
      };
      window.addEventListener('resize', this._rs);
      if (window.visualViewport) { window.visualViewport.addEventListener('resize', this._rs); window.visualViewport.addEventListener('scroll', this._rs) }
      this._ps = e => {
        if (!this.state.device || e.target !== this.pdfRef.current) return;
        const el = e.target, top = el.scrollTop + el.clientHeight / 3;
        const pages = [...el.querySelectorAll('[data-paper]')];
        let n = 1;
        pages.forEach((p, i) => { if (p.offsetTop <= top) n = i + 1 });
        if (n !== this.state.mob.page) this.mob({ page: n });
      };
      document.addEventListener('scroll', this._ps, true);
    }
    componentWillUnmount() {
      super.componentWillUnmount();
      window.removeEventListener('resize', this._rs);
      if (window.visualViewport) { window.visualViewport.removeEventListener('resize', this._rs); window.visualViewport.removeEventListener('scroll', this._rs) }
      document.removeEventListener('scroll', this._ps, true);
      stopCamera(this);
    }
    mob(p) { this.setState(s => ({ mob: { ...s.mob, ...(typeof p === 'function' ? p(s.mob) : p) } })) }
    // Kretslerretet skaleres ned på telefon; dra-avstanden regnes tilbake til skjemaets koordinater.
    onMove(e) {
      const k = this._ck || 1, d = this.drag;
      if (k !== 1 && d && !this.rs) return super.onMove({ clientX: d.sx + (e.clientX - d.sx) / k, clientY: d.sy + (e.clientY - d.sy) / k });
      return super.onMove(e);
    }
    render() {
      const dev = this.state.device;
      if (!dev || this.state.view === 'settings') return super.render();
      return renderTree(TREE, mobileVals(this, this.renderVals(), dev), 'mob');
    }
  };
}

function mobileVals(app, v, dev) {
  const s = app.state, m = s.mob, T = dev === 'tablet', A = dev === 'android', P = !T;
  const doc = app.curDoc();
  const go = p => app.mob({ sheet: null, list: null, ...p });
  const blur = () => { const a = document.activeElement; if (a && a.blur) a.blur() };
  const ib = pre => (v.insertBtns || []).find(b => b.label.startsWith(pre));
  const run = pre => () => { const b = ib(pre); if (b) b.onClick() };
  const offline = app.netOff();
  const C = s.compile || {};
  const sheet = (name, extra) => () => { blur(); app.mob({ sheet: name, kb: false, list: null, ...(extra || {}) }) };
  const part = (name, right) => () => { blur(); app.setState({ right }); app.mob({ sheet: 'part', part: name, kb: false }) };

  const o = {
    ...v,
    rootRef: v.rootRef,
    rootH: s.vh + 'px',
    isTablet: T, isPhone: P, isAndroid: A, isIOS: !A, iosPhone: dev === 'ios',
    isCamera: !!m.cam,
    isProjects: s.view === 'projects' && !m.cam,
    isDoc: s.view === 'editor' && !m.cam,
    isCircuit: s.view === 'circuit' && !m.cam,
    keep,
    kbPad: '0px',
    toastBottom: m.kb ? '72px' : '110px'
  };

  // Prosjekter
  const me = app.account();
  o.meInitials = (v.meInitials || (me.name || '?').slice(0, 2)).toUpperCase();
  o.meColor = v.meColor || '#c8553d';
  o.q = m.q;
  o.onQ = e => app.mob({ q: e.target.value });
  const groups = [...new Set(s.docs.map(d => d.folder).filter(Boolean))];
  o.groups = (v.groups && v.groups.length ? v.groups.map(g => g.label) : groups).map(g => {
    const on = s.group === g && !m.q;
    return { label: g, onClick: () => app.setState({ group: g }), bg: on ? '#1f1e1c' : '#fff', color: on ? '#fff' : '#3d3a36', border: on ? '#1f1e1c' : '#e2dfd9' };
  });
  const q = m.q.trim().toLowerCase();
  const stat = d => {
    if (d.id === s.cur && !offline) {
      if (C.status === 'ok') return ['Kompilert', '#2f7a46'];
      if (C.status === 'error') return [(C.nE || 1) + ' feil', '#b3261e'];
      if (C.status === 'running') return ['Kompilerer …', '#8a6a1a'];
    }
    return offline ? ['Lagret på enheten', '#6b6862'] : ['Synkronisert', '#2f7a46'];
  };
  o.projects = s.docs
    .filter(d => (q ? (d.title + ' ' + (d.authors || '')).toLowerCase().includes(q) : d.folder === s.group))
    .map(d => { const [st, sc] = stat(d); return { key: d.id, t: d.title, m: [d.folder && d.folder.split(' · ')[0], d.meta].filter(Boolean).join(' · '), st, sc, onClick: () => { app.openDoc(d.id); go({ seg: 'write' }) } } });
  o.noProjects = !o.projects.length;
  o.noProjectsText = q ? 'Ingen treff på «' + m.q + '».' : 'Ingen dokumenter i denne mappen ennå.';
  o.newProj = v.openNewProj;
  o.offline = offline;
  o.offlineLabel = offline ? 'Frakoblet' : s.net.syncing ? 'Synkroniserer …' : 'Synkronisert';
  o.toggleOffline = () => app.setNet({ sim: !s.net.sim });
  const qn = s.net.queue || 0;
  o.offlineLong = 'Frakoblet. Du kan fortsatt skrive og kompilere lokalt. Endringer synkroniseres når du er på nett igjen.';
  o.offlineText = 'Frakoblet · kompilerer lokalt' + (qn ? ', ' + qn + (qn === 1 ? ' endring venter' : ' endringer venter') + ' på synk' : '');
  o.openAccount = () => app.mob({ sheet: 'list', list: 'account' });

  // Dokument: topplinje
  o.goProjects = () => { blur(); app.setState({ view: 'projects', circ: null }); go({ kb: false }) };
  o.docTitle = doc.title;
  o.docSub = [doc.group || (doc.folder || '').split(' · ')[0], 'main.tex'].filter(Boolean).join(' · ');
  o.openMenu = () => app.mob({ sheet: 'list', list: 'menu' });
  o.side = T && m.side;
  o.toggleSide = () => app.mob({ side: !m.side });
  o.segOpts = (T ? [['Skriv', 'write'], ['Kode', 'code']] : [['Skriv', 'write'], ['Kode', 'code'], ['PDF', 'pdf']]).map(([l, k]) => {
    const on = m.seg === k;
    return {
      label: (on && A ? '✓ ' : '') + l,
      onClick: () => { if (k === 'pdf') blur(); app.mob({ seg: k, kb: k === 'pdf' ? false : m.kb }) },
      bg: on ? (A ? 'oklch(0.9 0.05 255)' : '#fff') : 'transparent',
      color: on ? (A ? '#13325e' : '#1f1e1c') : A ? '#49454f' : '#6b6862',
      fw: on ? 600 : 500,
      shadow: on && !A ? '0 1px 3px rgba(0,0,0,.12)' : 'none'
    };
  });
  const ok = C.status === 'ok', err = C.status === 'error', nE = C.nE || 0;
  o.pillText = offline ? 'Lokalt' : err ? (T ? nE + ' feil · stoppet' : nE + ' feil') : ok ? (T ? 'Kompilert ' + C.time + ' s' : C.time + ' s') : C.status === 'running' ? 'Kompilerer' : 'Kompiler';
  o.pillColor = offline ? '#6b4a1a' : err ? '#b3261e' : ok ? '#2f7a46' : '#6b6862';
  o.pillBg = offline ? 'oklch(0.95 0.04 80)' : err ? 'oklch(0.95 0.03 25)' : ok ? 'oklch(0.95 0.04 150)' : '#fff';
  o.openLog = () => { if (C.status !== 'ok' && C.status !== 'error' && !offline) app.compile(); sheet('log')(); app.setState({ right: 'log' }) };
  const open = (v.commentList || []).filter(c => c.opacity === 1 || c.opacity === undefined);
  o.commentCount = open.length;
  o.openComments = sheet('comments');
  o.openShare = sheet('share');

  // Sidepanel (nettbrett)
  o.sideFiles = [
    { label: 'main.tex', on: true, onClick: () => app.mob({ seg: 'write' }) },
    ...(v.figFiles || []).map(f => ({ label: f.label, onClick: f.onClick })),
    ...(v.libFiles || []).map(f => ({ label: f.label, onClick: f.onClick })),
    ...((doc.bib || []).length ? [{ label: 'refs.bib', onClick: part('bib', 'bib') }] : [])
  ].map(f => ({ ...f, bg: f.on ? '#138a36' : 'transparent', color: f.on ? '#fff' : '#3d3a36', fw: f.on ? 600 : 400 }));
  o.sideOutline = (v.outline || []).map(x => ({ label: x.label, onClick: x.onClick, pad: (x.pad + 2) + 'px', bg: x.fw === 600 ? '#f3f1ed' : 'transparent', fw: x.fw }));

  // Skriv / Kode / PDF
  o.showWrite = o.isDoc && (T ? m.seg !== 'code' : m.seg === 'write');
  o.showCode = o.isDoc && m.seg === 'code';
  o.showPdf = o.isDoc && (T || m.seg === 'pdf');
  o.writeEl = o.showWrite ? renderPart('write', v) : null;
  o.findEl = o.showWrite && v.findOpen ? renderPart('find', v) : null;
  o.codeEl = o.showCode ? renderPart('code', v) : null;
  const cw = T ? (window.innerWidth - 16 - 10 - (o.side ? 220 : 0)) / 2 : window.innerWidth - 16;
  const z = Math.max(0.3, ((cw - 24) / 440) * m.pz);
  o.pdfEl = o.showPdf ? renderPart('pdf', { ...v, pdfZoom: z, pdfView: v.pdfView ? React.cloneElement(v.pdfView, { zoom: z }) : v.pdfView }) : null;
  const nPages = Number(((v.pageInfo || '').match(/(\d+) sid/) || [])[1]) || (v.pages || []).length || 1;
  o.pdfPill = 'Side ' + Math.min(m.page, nPages) + ' av ' + nPages + ' · knip for å zoome';
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  o.pinchStart = e => { if (e.touches.length === 2) app._pinch = { d: dist(e.touches), r: 1, el: e.currentTarget.firstChild } };
  o.pinchMove = e => {
    const p = app._pinch;
    if (!p || e.touches.length !== 2) return;
    p.r = Math.max(0.5 / m.pz, Math.min(4 / m.pz, dist(e.touches) / p.d));
    if (p.el) { p.el.style.transformOrigin = '50% 0'; p.el.style.transform = 'scale(' + p.r + ')' }
  };
  o.pinchEnd = () => {
    const p = app._pinch;
    if (!p) return;
    app._pinch = null;
    if (p.el) p.el.style.transform = '';
    if (Math.abs(p.r - 1) > 0.02) app.mob({ pz: Math.max(0.5, Math.min(4, m.pz * p.r)) });
  };

  // Tastatur og verktøylinjen over det
  o.onEdFocus = e => {
    const t = e.target;
    if (P && (t.isContentEditable || /^(TEXTAREA|INPUT)$/.test(t.tagName)) && !m.kb) app.mob({ kb: true });
  };
  o.onEdBlur = e => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setTimeout(() => {
      const a = document.activeElement;
      if (!a || !a.closest || !a.closest('.k-mw,.k-mc')) app.state.mob.kb && app.mob({ kb: false });
    }, 0);
  };
  o.showAcc = P && o.isDoc && m.kb && m.seg !== 'pdf' && !m.sheet;
  o.accWrite = m.seg === 'write';
  o.accCode = m.seg === 'code';
  o.hideKb = () => { blur(); app.mob({ kb: false }) };
  const openCam = () => { blur(); app.mob({ cam: 'shoot', sheet: null, kb: false, shot: null, camErr: false }); startCamera(app) };
  o.accItems = [
    ['Ω', 'Enhet', () => app.openPicker('qty')],
    ['α', 'Symbol', () => app.openPicker('sym')],
    ['√', 'Formel', () => app.openPicker('math')],
    ['⏚', 'Krets', run('⏚')],
    ['◉', 'Kamera', openCam],
    ['▦', 'Tabell', run('▦')],
    ['∿', 'Graf', () => app.openPlot(null)],
    ['[1]', 'Kilde', part('bib', 'bib')]
  ].map(([g, l, f]) => ({ g, l, onClick: f }));
  o.codeKeys = ['\\', '{', '}', '$', '_', '^', '&', '%', '~', '[', ']'].map(k => ({ k, onClick: () => { try { document.execCommand('insertText', false, k) } catch (e) { /* */ } } }));
  o.openInsert = sheet('insert');
  o.insertItems = [
    ['Ω', 'Verdi med enhet', () => app.openPicker('qty')],
    ['α', 'Symbol', () => app.openPicker('sym')],
    ['√', 'Formel', () => app.openPicker('math')],
    ['∑', 'Likning', run('∑')],
    ['⏚', 'Kretsskjema', run('⏚')],
    ['◉', 'Ta bilde', openCam],
    ['▣', 'Fra bildebiblioteket', () => pickPhoto(app, true)],
    ['▦', 'Tabell', run('▦')],
    ['∿', 'Graf fra CSV', () => app.openPlot(null)],
    ['[1]', 'Kilde (DOI)', part('bib', 'bib')],
    ['↗', 'Kryssreferanse', () => app.mob({ sheet: 'list', list: 'refs' })],
    ['§', 'Seksjon', run('§ Seksjon')],
    ['¶', 'Avsnitt', run('¶')],
    ['{ }', 'LaTeX-blokk', run('{ }')],
    ['⌕', 'Søk og erstatt', run('⌕')]
  ].map(([g, l, f]) => ({ g, l, onClick: () => { const stay = /Kilde|Kryssreferanse/.test(l); if (!stay) app.mob({ sheet: null }); f() } }));

  // Ark
  o.hasSheet = !!m.sheet && !m.cam;
  o.closeSheet = () => app.mob({ sheet: null, list: null });
  o.sheetMax = '82%';
  o.sheetComments = m.sheet === 'comments';
  o.sheetLog = m.sheet === 'log';
  o.sheetShare = m.sheet === 'share';
  o.sheetInsert = m.sheet === 'insert';
  o.sheetList = m.sheet === 'list';
  o.sheetPart = m.sheet === 'part';

  // Kommentarer: trykk på en kommentar for å svare på den; uten valgt kommentar blir det en ny på aktiv blokk
  const all = v.commentList || [];
  const cur = all.find(c => c.isReplying);
  o.comments = all.map((c, i) => ({
    key: i, q: c.quote, onQuote: e => { e.stopPropagation(); app.mob({ sheet: null, seg: 'write' }); c.onQuote && c.onQuote() },
    c: c.color, i: c.initials, n: c.name, time: c.time, text: c.text, opacity: c.opacity == null ? 1 : c.opacity,
    resolveLabel: c.resolveLabel, onResolve: e => { e.stopPropagation(); c.onResolve() },
    border: c.isReplying ? ACC : '#e2dfd9',
    onPick: () => c.onReply && c.onReply(),
    rep: (c.replies || []).map(r => ({ c: r.color, i: r.initials, n: r.name, time: r.time, text: r.text })),
    hasRep: !!c.hasReplies
  }));
  o.noComments = !all.length;
  o.noCommentsText = 'Ingen kommentarer. Trykk i en blokk i dokumentet og skriv en kommentar under.';
  o.hasResolvedToggle = !!v.resolvedToggleLabel;
  o.reply = cur ? cur.replyText : v.newComment;
  o.replyPh = cur ? 'Svar ' + String(cur.name).split(' ')[0] + ' …' : 'Kommenter valgt blokk …';
  o.onReply = e => (cur ? cur.onReplyText(e) : v.onNewComment(e));
  o.sendReply = () => (cur ? cur.onSendReply() : v.addComment());
  o.onReplyKey = e => { if (e.key === 'Enter') { e.preventDefault(); o.sendReply() } };
  o.commentErr = cur ? '' : v.commentErr;

  // Logg
  o.recompile = () => app.compile();
  o.logItems = (v.logItems || []).map((it, i) => ({
    ...it, key: i,
    border: it.badge === 'Feil' ? '#f0cfca' : '#efdcbc',
    onGo: e => { e.stopPropagation(); go({ seg: 'code' }); it.onClick() },
    onFix: e => { it.onFix(e); app.mob({ sheet: null }) }
  }));
  o.logEmpty = !!v.logEmpty;

  // Deling
  o.people = (v.people || []).map(p => ({ i: p.initials, c: p.color, n: p.name, r: p.role, onRole: p.onRole, canChange: !p.isOwner && !!p.onRole }));
  o.linkDot = v.linkExt ? '#138a36' : '#b26a1e';
  o.copyLabel = s.copied ? 'Kopiert' : 'Kopier';

  // Listeark: dokumentmeny, konto og kryssreferanser
  const L = m.sheet === 'list' ? m.list : null;
  const li = (g, label, onClick, hint, color) => ({ g, label, onClick, hint: hint || '', color: color || '#1f1e1c' });
  if (L === 'menu') {
    o.listTitle = doc.title;
    o.listSub = o.docSub;
    o.listItems = [
      li('[1]', 'Kilder', part('bib', 'bib'), (doc.bib || []).length ? String(doc.bib.length) : ''),
      li('✓', 'Sjekk', part('check', 'check'), 'Stavekontroll'),
      li('↺', 'Versjoner', part('history', 'history')),
      li('⌕', 'Søk og erstatt', () => { app.mob({ sheet: null, seg: 'write' }); run('⌕')() }),
      li('▶', 'Kompiler nå', () => { app.mob({ sheet: null }); app.compile() }),
      li('↓', 'Last ned main.tex', () => { app.mob({ sheet: null }); v.downloadTex && v.downloadTex() }),
      li('⎙', 'Skriv ut eller lagre PDF', () => { app.mob({ sheet: null }); v.printPdf && v.printPdf() }),
      li('◐', offline ? 'Koble til igjen' : 'Frakoblet modus', () => { app.mob({ sheet: null }); app.setNet({ sim: !s.net.sim }) })
    ];
  } else if (L === 'account') {
    o.listTitle = me.name || 'Konto';
    o.listSub = me.email || '';
    o.listItems = [
      ...(v.profileItems || []).filter(x => !/Mørk/.test(x.label)).map(x => li('', x.label, () => { app.mob({ sheet: null }); x.onClick() }, x.hint)),
      ...(app._server ? [li('', 'Logg ut', () => app._server.logout(), '', '#b3261e')] : [])
    ];
  } else if (L === 'refs') {
    o.listTitle = 'Kryssreferanse';
    o.listSub = 'Settes inn der markøren stod';
    o.listItems = (v.refItems || []).map(r => li('↗', r.label, () => { app.mob({ sheet: null }); r.onClick() }, r.code));
    o.listEmpty = o.listItems.length ? '' : 'Ingen figurer, tabeller eller likninger med etikett ennå.';
  }
  o.listItems = o.listItems || [];
  o.listEmpty = o.listEmpty || '';

  // Paneler fra desktop i et ark (kilder, sjekk, historikk)
  const PT = { bib: ['Kilder', 'isBibTab'], check: ['Sjekk', 'isCheckTab'], history: ['Versjoner', 'isHistoryTab'] };
  if (o.sheetPart && PT[m.part]) {
    o.partTitle = PT[m.part][0];
    o.partH = 'min(70vh, 640px)';
    o.partEl = renderPart(m.part, { ...v, [PT[m.part][1]]: true });
  }
  o.ovEl = renderPart('ov', v);

  // Kretseditor
  if (o.isCircuit && s.circ) {
    const c = s.circ, ins = v.ins || {};
    o.circTitle = (v.circInsertLabel || '').replace('Lagre som ', '') + ' · kretsskjema';
    o.circDone = v.circInsert;
    o.circCancel = v.circCancel;
    o.tools = (v.circTools || []).map(t => ({ label: t.label, onClick: t.onClick, bg: t.bg === 'transparent' ? 'transparent' : '#fff', shadow: t.bg === 'transparent' ? 'none' : '0 1px 3px rgba(0,0,0,.12)' }));
    o.rotate = () => (c.sel && !c.sel.startsWith('w:') ? app.rotateSel() : app.toast('Velg en komponent først'));
    o.del = () => (c.sel ? v.delSel() : app.toast('Velg noe å slette først'));
    o.autoLabel = 'Rydd';
    o.auto = () => (c.auto ? app.toast('Skjemaet ryddes automatisk') : v.tidyNow());
    o.spice = v.openPaste;
    // Tilpass lerretet til skjermen: 40 px per rutenettenhet som på desktop
    const comps = c.data.comps || [];
    const mx = Math.max(6, ...comps.map(k => k.x + 3)), my = Math.max(4, ...comps.map(k => k.y + 3));
    const cwid = window.innerWidth - 16, chei = Math.max(200, s.vh - 380);
    const k = Math.max(0.4, Math.min(1, cwid / (mx * 40 + 80), chei / (my * 40 + 80)));
    app._ck = k;
    o.circSvg = h('div', { style: { position: 'absolute', left: 0, top: 0, width: 100 / k + '%', height: 100 / k + '%', transform: 'scale(' + k + ')', transformOrigin: '0 0' } }, v.circSvg);
    const pre = (v.prefixOpts || []).find(x => x.k === ins.prefix), un = (v.unitOpts || []).find(x => x.k === ins.unit);
    o.hasSel = !!(v.hasSelComp || v.hasSelWire);
    o.selBase = v.hasSelWire ? 'Ledning' : ins.name || '';
    o.selSub = v.hasSelWire ? '' : ins.sub || '';
    o.selKind = v.hasSelWire ? '' : ins.title;
    o.selVal = ins.hasVal ? (ins.num + ' ' + (pre && pre.label !== '–' ? pre.label : '') + (un ? un.label : '')).trim() : '';
    o.selEditing = m.selEdit && v.hasSelComp && (ins.hasName || ins.hasVal);
    o.editLabel = v.hasSelComp && (ins.hasName || ins.hasVal) ? (o.selEditing ? 'Ferdig' : 'Endre') : '';
    o.editSel = () => app.mob({ selEdit: !m.selEdit });
    o.circHint = c.tool === 'wire'
      ? c.pending ? 'Trykk et annet tilkoblingspunkt for å koble' : 'Trykk et tilkoblingspunkt for å starte en ledning'
      : comps.length ? 'Dra med én finger for å flytte · Ledning kobler to punkter' : 'Trykk en komponent under for å legge den til';
    const allItems = (v.palette || []).flatMap(g => g.items);
    o.palette = m.palAll
      ? allItems.map(it => ({ g: it.icon, l: it.name, onClick: it.onClick }))
      : PALETTE.map(([key, g, l]) => ({ g, l, onClick: () => app.addComp(key) }));
    o.palMore = () => app.mob({ palAll: !m.palAll });
    o.palMoreLabel = m.palAll ? 'Færre' : 'Alle';
    o.palMax = m.palAll ? '36vh' : 'none';
  }

  // Kamera
  if (m.cam) {
    o.camShoot = m.cam === 'shoot';
    o.camReview = m.cam === 'review';
    o.camModes = [['Foto', 'photo'], ['Skann dokument', 'scan']].map(([l, k]) => {
      const on = (m.camMode || 'photo') === k;
      return { label: l, onClick: () => app.mob({ camMode: k }), bg: on ? '#fff' : 'transparent', color: on ? '#111' : '#fff', fw: on ? 600 : 400 };
    });
    o.flashBg = m.torch ? '#fff' : 'rgba(255,255,255,.14)';
    o.flashColor = m.torch ? '#111' : '#fff';
    o.flashOp = app._camTorch ? 1 : 0.5;
    o.toggleFlash = () => setTorch(app, !m.torch);
    o.camVideo = app._camStream ? h('video', { ref: el => { if (el && el.srcObject !== app._camStream) { el.srcObject = app._camStream; el.play().catch(() => {}) } app._camVideo = el }, autoPlay: true, playsInline: true, muted: true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }) : null;
    o.camHint = m.camMode === 'scan' ? 'Legg arket på et mørkt underlag og hold telefonen rett over' : 'Hold telefonen rett over koblingsbrettet, tavla eller oscilloskopet';
    if (!app._camStream && !isNative()) o.camHint += m.camErr ? '. Trykk utløseren for å åpne kameraet.' : '';
    o.snap = () => capture(app);
    o.fromLibrary = () => pickPhoto(app, false);
    o.flip = () => { app.mob({ facing: m.facing === 'user' ? 'environment' : 'user' }); setTimeout(() => startCamera(app), 0) };
    o.closeCam = () => { stopCamera(app); app.mob({ cam: null, shot: null }) };
    o.retake = () => { app.mob({ cam: 'shoot', shot: null }); startCamera(app) };
    o.cropEl = m.shot ? h(CropView, { src: m.shot.src, crop: m.crop, onCrop: crop => app.mob({ crop }) }) : null;
    o.caption = m.caption == null ? 'Oppkobling på koblingsbrett.' : m.caption;
    o.onCaption = e => app.mob({ caption: e.target.value });
    const wd = m.width || '80';
    o.widths = ['50', '80', '100'].map(w => ({ label: w + ' %', onClick: () => app.mob({ width: w }), bg: wd === w ? '#fff' : 'transparent', shadow: wd === w ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }));
    const fname = (m.camMode === 'scan' ? 'skann-' : 'foto-') + (m.stamp || STAMP()) + '.jpg';
    o.saveNote = 'Lagres som bilder/' + fname + ', komprimert til maks 1600 px.';
    o.insertPhoto = () => finishPhoto(app, { name: fname, caption: o.caption, w: Number(wd) / 100 });
  }

  o.toast = v.toast;
  o.hasToast = v.hasToast;
  return o;
}
