// Opprinnelig løftet fra prototypen (tools/extract-prototype.mjs). Appens tilstand og visningsmodell.
/* eslint-disable */
import React from 'react';
import {
  ACC,
  ACCL,
  ACCB,
  HL,
  PFX,
  UNITS,
  SYMS,
  MACROS,
  V0,
  P2,
  P1,
  CT,
  PAL,
  PINLBL,
  PINPH,
  pinTex,
  iconVB,
  USERS,
  KIND,
  GROUPS,
  TPLS,
  uid,
  clone,
  clean,
  now,
  t,
  u,
  sy,
  rf,
  citeSeg,
  MATH,
  SPELL_NB,
  SPELL_EN,
  parseCSV,
  parseGrid,
  plotLines,
  citeNums,
  bibTxt,
  bibList,
  bibKey,
  parseBibtex,
  toBibtex,
  wdiff,
  blockTxt,
  textFields,
  SP_LINE,
  isSpice,
  SPU,
  SPP,
  spiceVal,
  spiceToTikz,
  pf,
  un,
  fmtNum,
  qtyText,
  qtyCode,
  esc,
  symCode,
  segTex,
  norm,
  slug,
  terms,
  gname,
  ext,
  cbox,
  circLines,
  tok,
  preamble,
  docCode,
  numberDoc,
  plain,
  paginate,
  diode,
  gamepad,
  skeleton,
  makeDocs,
  DEF_SET,
  DEF_DUCK,
  DEF_SMB,
  DEF_DEP,
  DUCK_RE,
  TOKEN_RE,
  tokSh,
  tokSh0,
  unesc,
  parseInline,
  parseBlock,
  qtyBack,
  cellBack,
  wsn,
  parseDoc,
  mergePre,
  escH,
  texLabels,
  texMacros,
  readGroup,
  readOpt,
  findEnd,
  tx_splitTop,
  SI_UNIT,
  DROP,
  texRender,
  rawHtml,
  ENV_BUILTIN,
  ENV_PKG,
  MATH_ENV,
  AMP_ENV,
  lintTex,
  ACCOUNTS,
  ADMIN_TABS,
  DEF_UPD,
  RELEASES,
  vcmp,
  DEF_SMTP,
  PROTON_FREE,
  SMTP_PRESETS,
  smtpFrom,
  EMAIL_RE,
  UNIT_RE,
  cellTex,
  listItem,
  TZ2,
  TZN,
  splitTop,
  stripB,
  qtyFrom,
  texName,
  parseCircuit,
  autoLayout
} from '@kobling/core';
import { symEls, drawCircuit, plotSvg } from '@kobling/ui';
import { DCLogic } from './dc-runtime';
import { openChannel } from './sync';
import * as GEN from '../../../deploy/generators.js';
const LSK = 'kobling-demo-v1';
const SAVED = (() => {
  try {
    return JSON.parse(localStorage.getItem(LSK) || 'null');
  } catch (e) {
    return null;
  }
})();
function download(name, text, type) {
  try {
    const b = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 800);
    return true;
  } catch (e) {
    return false;
  }
}
function readImg(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const k = Math.min(1, 1600 / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        const png = f.type === 'image/png' && c.width * c.height < 900000;
        const base = slug(f.name.replace(/\.[^.]+$/, '')) || 'bilde';
        res({
          src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85),
          file: base + (png ? '.png' : '.jpg'),
          cap: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        });
      };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  });
}
const dataToBlob = u => {
  const [m, b] = u.split(',');
  const bin = atob(b),
    a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: m.split(':')[1].split(';')[0] });
};
export default class Component extends DCLogic {
  state = {
    platform: this.props.platform ?? 'mac',
    view: this.props.startView ?? 'editor',
    docs: (SAVED && SAVED.docs) || makeDocs(),
    cur: 'd4',
    mode: 'visual',
    right: 'pdf',
    active: null,
    picker: null,
    refMenu: false,
    share: false,
    people: (SAVED && SAVED.people) || [
      { id: 'SK', name: 'Sebastian Kristoffersen (deg)', initials: 'SK', color: USERS.SK.color, role: 'Eier' },
      { id: 'MH', name: 'Mia Hansen', initials: 'MH', color: USERS.MH.color, role: 'Kan redigere' },
      { id: 'EL', name: 'Emil Larsen', initials: 'EL', color: USERS.EL.color, role: 'Kan redigere' },
      { id: 'LA', name: 'Læringsassistent', initials: 'LA', color: 'var(--kbdb7ae,#bdb7ae)', role: 'Kan kommentere' }
    ],
    invite: '',
    inviteErr: '',
    linkRole: 'Kan lese',
    copied: false,
    codeCopied: false,
    settings:
      SAVED && SAVED.settings
        ? { ...DEF_SET, ...SAVED.settings }
        : {
            size: '11pt',
            cols: 2,
            dec: ',',
            imag: 'j',
            style: 'european',
            indent: false,
            warn: true,
            maxPages: 5,
            engine: 'pdfLaTeX',
            auto: true,
            server: 'https://kobling.app',
            sync: true
          },
    setTab: 'mal',
    compile: { status: 'dirty', time: '0,7' },
    pdfSnap: null,
    circ: null,
    palQ: '',
    comments: (SAVED && SAVED.comments) || [
      {
        id: 'c1',
        doc: 'd4',
        by: 'SK',
        text: 'Kan vi ta med målt verdi på motstanden også? Da blir avviket begrunnet.',
        bid: 'b-disk',
        time: '12 min',
        resolved: false
      },
      {
        id: 'c2',
        doc: 'd4',
        by: 'EL',
        text: 'Utdraget av kretsskjemaet er ikke referert i teksten ennå.',
        bid: 'b-fig2',
        time: '1 t',
        resolved: false
      }
    ],
    showResolved: false,
    newComment: '',
    commentErr: '',
    history: [
      {
        id: 'h1',
        who: 'Mia Hansen',
        initials: 'MH',
        color: USERS.MH.color,
        what: 'Redigerte Diskusjon',
        time: '14:20',
        snap: null
      },
      {
        id: 'h2',
        who: 'Sebastian Kristoffersen',
        initials: 'SK',
        color: USERS.SK.color,
        what: 'Oppdaterte kretsskjema',
        time: '14:02',
        snap: null
      },
      {
        id: 'h3',
        who: 'Emil Larsen',
        initials: 'EL',
        color: USERS.EL.color,
        what: 'La til utstyrsliste',
        time: 'i går',
        snap: null
      }
    ],
    presence: { MH: 'b-disk', EL: 'b-fig2' },
    newProj: null,
    group: GROUPS[0],
    toast: null,
    duck: { ...DEF_DUCK, ...((SAVED && SAVED.duck) || {}) },
    duckUi: { log: [], ip: '', last: '', ...((SAVED && SAVED.duckUi) || {}), busy: false, showToken: false },
    smb: { ...DEF_SMB, ...((SAVED && SAVED.smb) || {}) },
    smbUi: { showPass: false, test: null, run: null, testing: false },
    deploy: { ...DEF_DEP, ...((SAVED && SAVED.deploy) || {}) },
    backups: (SAVED && SAVED.backups) || [],
    codeEdit: null,
    rightW: (SAVED && SAVED.rightW) || 500,
    sideHidden: !!(SAVED && SAVED.sideHidden),
    recent: (SAVED && SAVED.recent) || ['d4', 'd3', 'd2'],
    fileMenu: false,
    hover: null,
    dropAt: null,
    paste: null,
    me: (SAVED && SAVED.me) || 'SK',
    shareTab: 'invite',
    inviteRole: 'Kan redigere',
    inviteMail: true,
    inviteMsg: '',
    mails: (SAVED && SAVED.mails) || [],
    mailPreview: null,
    sendTo: '',
    sendSubj: '',
    sendMsg: '',
    sendErr: '',
    att: { pdf: true, tex: false, img: false },
    upd: { ...DEF_UPD, ...((SAVED && SAVED.upd) || {}) },
    updUi: { checking: false, found: null, run: null },
    smtp: { ...DEF_SMTP, ...((SAVED && SAVED.smtp) || {}) },
    smtpUi: { showPass: false, test: null, testing: false },
    net: { on: typeof navigator === 'undefined' || navigator.onLine !== false, sim: false, queue: 0, syncing: false },
    find: null,
    plot: null,
    xls: null,
    bibUi: { doi: '', msg: '', err: false, busy: false, showBib: false, bibtex: '' },
    diffH: null,
    reply: null,
    ignored: []
  };
  edRef = React.createRef();
  pdfRef = React.createRef();
  rootRef = React.createRef();
  fileRef = React.createRef();
  componentDidMount() {
    try {
      this._mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._mqf = () => this.forceUpdate();
      this._mq.addEventListener('change', this._mqf);
    } catch (e) {}
    this._sel = () => this.onSel();
    document.addEventListener('selectionchange', this._sel);
    this._pst = e => this.onDocPaste(e);
    document.addEventListener('paste', this._pst);
    this._key = e => this.onKey(e);
    window.addEventListener('keydown', this._key);
    this._on = () => this.setNet({ on: true });
    this._off = () => this.setNet({ on: false });
    window.addEventListener('online', this._on);
    window.addEventListener('offline', this._off);
    this._mv = e => this.onMove(e);
    this._up = () => {
      this.drag = null;
      if (this.rs) {
        this.rs = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('pointermove', this._mv);
    window.addEventListener('pointerup', this._up);
    if (!window.katex)
      this._kt = setInterval(() => {
        if (window.katex) {
          clearInterval(this._kt);
          this.forceUpdate();
        }
      }, 200);
    this._pr = setInterval(() => this.tickPresence(), 4500);
    const snap = clone(this.curDoc().blocks);
    this.setState(s => ({ history: s.history.map(x => ({ ...x, snap })) }));
    this.compile();
    Promise.resolve(GEN)
      .then(m => {
        this.gen = m;
        this.forceUpdate();
      })
      .catch(() => {
        this.genErr = true;
        this.forceUpdate();
      });
    if (this._server) return this._server.mount();
    try {
      this.bc = openChannel('workspace');
      this.bc.onmessage = e => {
        const m = e.data;
        if (!m || !m.docs) return;
        this._remote = true;
        this.setState(
          s => ({
            docs: m.docs,
            comments: m.comments || s.comments,
            cur: m.docs.some(d => d.id === s.cur) ? s.cur : m.docs[0].id
          }),
          () => this.schedule()
        );
        if (!this._peer) {
          this._peer = 1;
          this.toast('Endringer mottatt fra en annen fane');
        }
      };
    } catch (e) {}
  }
  componentWillUnmount() {
    window.removeEventListener('online', this._on);
    window.removeEventListener('offline', this._off);
    clearTimeout(this._syt);
    document.removeEventListener('selectionchange', this._sel);
    document.removeEventListener('paste', this._pst);
    window.removeEventListener('keydown', this._key);
    window.removeEventListener('pointermove', this._mv);
    window.removeEventListener('pointerup', this._up);
    clearInterval(this._kt);
    clearInterval(this._pr);
    clearTimeout(this.ct);
    clearTimeout(this.ct2);
    clearTimeout(this._tt);
    clearInterval(this._bk);
    try {
      this.bc && this.bc.close();
    } catch (e) {}
    this._server && this._server.unmount();
  }
  componentDidUpdate(pp, ps) {
    const K = this._server ? this._server.persistKeys : [
      'docs',
      'settings',
      'comments',
      'people',
      'backups',
      'duck',
      'duckUi',
      'smb',
      'deploy',
      'rightW',
      'recent',
      'mails',
      'smtp',
      'me',
      'sideHidden',
      'upd'
    ];
    if (K.some(k => ps[k] !== this.state[k])) {
      clearTimeout(this._sv);
      this._sv = setTimeout(() => {
        try {
          const o = {};
          K.forEach(k => (o[k] = this.state[k]));
          localStorage.setItem(this._server ? this._server.lsKey : LSK, JSON.stringify(o));
        } catch (e) {}
      }, 400);
    }
    if (ps.docs !== this.state.docs && !this._remote && this.netOff()) {
      const tq = Date.now();
      if (tq - (this._qt || 0) > 1500) {
        this._qt = tq;
        this.setState(s => ({ net: { ...s.net, queue: s.net.queue + 1 } }));
      }
    }
    if (
      (ps.docs !== this.state.docs || ps.comments !== this.state.comments) &&
      !this._remote &&
      this.bc &&
      !this.netOff()
    ) {
      try {
        this.bc.postMessage({ docs: this.state.docs, comments: this.state.comments });
      } catch (e) {}
    }
    this._remote = false;
    if (this._server) this._server.update(ps);
    const title = this.curDoc().title + ' – Kobling';
    if (document.title !== title) document.title = title;
    if (this.state.codeEdit && ps.active !== this.state.active && this.state.codeEdit.bid !== this.state.active)
      this.setState({ codeEdit: null });
    if (this.pendingFocus) {
      const pf = this.pendingFocus,
        el = document.querySelector(pf.sel);
      if (el) {
        this.pendingFocus = null;
        el.focus();
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(!pf.end);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    }
    if (ps.active !== this.state.active && this.state.active) {
      const src = this.activeSrc;
      this.activeSrc = null;
      if (src !== 'pdf') this.scrollIn(this.pdfRef.current, `[data-pblk="${this.state.active}"]`);
      if (src && src !== 'editor') this.scrollIn(this.edRef.current, `[data-blk="${this.state.active}"]`);
    }
  }
  scrollIn(box, sel) {
    if (!box) return;
    const el = box.querySelector(sel);
    if (!el) return;
    const br = box.getBoundingClientRect(),
      er = el.getBoundingClientRect();
    if (er.top < br.top + 20 || er.bottom > br.bottom - 20)
      box.scrollTo({ top: er.top - br.top + box.scrollTop - 80, behavior: 'smooth' });
  }
  onSel() {
    const s = window.getSelection();
    if (!s || !s.rangeCount || !s.anchorNode) return;
    const n = s.anchorNode,
      el = n.nodeType === 3 ? n.parentElement : n;
    const seg = el && el.closest && el.closest('[data-seg]');
    if (!seg) return;
    const [bid, si] = seg.dataset.seg.split(':');
    try {
      const r = document.createRange();
      r.selectNodeContents(seg);
      r.setEnd(s.anchorNode, s.anchorOffset);
      this.caret = { bid, si: +si, off: r.toString().replace(/\u200B/g, '').length };
    } catch (e) {}
  }
  onKey(e) {
    const m = e.metaKey || e.ctrlKey,
      k = (e.key || '').toLowerCase(),
      tg = (e.target.tagName || '').toLowerCase(),
      typing = tg === 'input' || tg === 'textarea' || tg === 'select' || e.target.isContentEditable,
      s = this.state;
    if (m && k === 's') {
      e.preventDefault();
      this.compile();
      return;
    }
    if (m && (k === 'z' || k === 'y') && !typing) {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (m && e.key === '\\') {
      e.preventDefault();
      this.setState(x => ({ sideHidden: !x.sideHidden, hover: null }));
      return;
    }
    if (m && k === 'e' && s.view === 'editor') {
      e.preventDefault();
      this.openPicker('qty');
      return;
    }
    if (m && k === 'f' && !e.shiftKey && s.view === 'editor') {
      e.preventDefault();
      this.setState(x => ({ find: x.find ? null : { q: '', r: '', all: false, cs: false } }));
      return;
    }
    if (m && k === 'n') {
      e.preventDefault();
      this.setState({ newProj: { title: '', tpl: 'rapport', err: '' }, fileMenu: false });
      return;
    }
    if (m && k === 'o') {
      e.preventDefault();
      this.setState(x => ({ fileMenu: !x.fileMenu }));
      return;
    }
    if (m && k === 'p' && s.view === 'editor') {
      e.preventDefault();
      this.printPdf();
      return;
    }
    if (m && e.key === ',') {
      e.preventDefault();
      this.setState({ view: 'settings', profileOpen: false });
      return;
    }
    if (m && e.altKey && k === 'l') {
      e.preventDefault();
      this.setState(x => ({ mode: x.mode === 'visual' ? 'split' : 'visual' }));
      return;
    }
    if (e.key === 'Escape') {
      if (s.restore) return this.setState({ restore: null });
      if (s.plot) return this.setState({ plot: null });
      if (s.xls) return this.setState({ xls: null });
      if (s.find && !s.picker) return this.setState({ find: null });
      if (s.profileOpen) return this.setState({ profileOpen: false });
      if (s.fileMenu) return this.setState({ fileMenu: false });
      if (s.picker) return this.setState({ picker: null });
      if (s.share) return this.setState({ share: false });
      if (s.newProj) return this.setState({ newProj: null });
      if (s.refMenu) return this.setState({ refMenu: false });
      if (s.circ) return this.circSet({ pending: null, sel: null, tool: 'select' });
    }
    if (s.view === 'circuit' && s.circ && !typing && !m) {
      if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        this.delSel();
      } else if (k === 'r') this.rotateSel();
      else if (k === 'w') this.circSet({ tool: 'wire' });
      else if (k === 'v') this.circSet({ tool: 'select', pending: null });
    }
  }
  netOff() {
    const n = this.state.net;
    return !n.on || n.sim;
  }
  setNet(p) {
    const was = this.netOff();
    this.setState(
      s => ({ net: { ...s.net, ...p } }),
      () => {
        const off = this.netOff();
        if (was && !off) {
          const q = this.state.net.queue;
          this.setState(s => ({ net: { ...s.net, syncing: true } }));
          clearTimeout(this._syt);
          this._syt = setTimeout(() => {
            this.setState(s => ({ net: { ...s.net, syncing: false, queue: 0 } }));
            this.toast(
              q ? 'Synkronisert · ' + q + (q === 1 ? ' endring' : ' endringer') + ' lastet opp' : 'Tilkoblet igjen'
            );
          }, 1400);
        } else if (!was && off) this.toast('Frakoblet. Endringer lagres lokalt og synkroniseres senere.');
      }
    );
  }
  csvRef = React.createRef();
  openPlot(b) {
    this.setState({
      plot: b
        ? {
            bid: b.id,
            csv: b.csv || '',
            kind: b.kind || 'line',
            xlabel: b.xlabel || '',
            ylabel: b.ylabel || '',
            caption: b.caption || '',
            err: ''
          }
        : { bid: null, after: this.state.active, csv: '', kind: 'line', xlabel: '', ylabel: '', caption: '', err: '' }
    });
  }
  plotSet(p) {
    this.setState(s => ({ plot: { ...s.plot, ...p, err: '' } }));
  }
  plotSample(kind) {
    if (kind === 'bode') {
      const fc = 1591.5,
        L = ['f [Hz];|H| [dB];Fase [°]'];
      for (let e = 1; e <= 5.001; e += 0.125) {
        const f = Math.pow(10, e),
          r = f / fc;
        L.push(
          (f < 100 ? f.toFixed(1) : f.toFixed(0)) +
            ';' +
            (-10 * Math.log10(1 + r * r)).toFixed(2) +
            ';' +
            ((-Math.atan(r) * 180) / Math.PI).toFixed(1)
        );
      }
      return {
        csv: L.join('\n'),
        xlabel: 'Frekvens $f$ [Hz]',
        ylabel: '$|H|$ [dB]',
        caption: 'Bode-diagram for RC-lavpassfilteret.'
      };
    }
    const L = ['t [ms];v_C [V]'];
    for (let i = 0; i <= 40; i++) {
      const tm = i * 0.25;
      L.push(tm.toFixed(2) + ';' + (5 * (1 - Math.exp(-tm / 2.2))).toFixed(3));
    }
    return { csv: L.join('\n'), xlabel: 'Tid $t$ [ms]', ylabel: '$v_C$ [V]', caption: 'Opplading av kondensatoren.' };
  }
  submitPlot() {
    const p = this.state.plot,
      d = parseCSV(p.csv);
    if (d.rows.length < 2) return this.plotSet({ err: 'Trenger minst to rader med tall.' });
    if (p.kind === 'bode' && d.rows.some(r => r[0] <= 0))
      return this.setState(s => ({ plot: { ...s.plot, err: 'Bode-diagram krever frekvenser over 0.' } }));
    const data = { csv: p.csv, kind: p.kind, xlabel: p.xlabel, ylabel: p.ylabel, caption: p.caption || 'Graf.' };
    this.setState({ plot: null });
    if (p.bid) this.updBlock(p.bid, data, 'Oppdaterte graf');
    else
      this.addBlockAfter(
        p.after,
        { type: 'plot', ...data, label: 'fig:graf-' + uid().slice(0, 4) },
        'La til graf',
        false
      );
  }
  applyGrid(bid, rows) {
    this.updBlock(bid, { rows }, 'Limte inn tabell');
    this.toast('Limte inn ' + rows.length + ' rader × ' + rows[0].length + ' kolonner');
  }
  insertMath(tex) {
    this.setState({ picker: null });
    const a = this.findBlock(this.state.active);
    if (a && a.type === 'eq') this.updBlock(a.id, { src: ((a.src || '') + ' ' + tex).trim() }, 'Satt inn ' + tex);
    else
      this.addBlockAfter(
        this.state.active,
        { type: 'eq', src: tex, label: 'eq:' + uid().slice(0, 4) },
        'La til likning',
        false
      );
  }
  gotoHit(did, bid) {
    if (did !== this.state.cur) {
      this.openDoc(did);
      setTimeout(() => this.focusBlock(bid, 'search'), 60);
    } else this.focusBlock(bid, 'search');
  }
  bibSet(p) {
    this.setState(s => ({ bibUi: { ...s.bibUi, ...p } }));
  }
  addBib(entries) {
    const doc = this.curDoc(),
      have = new Set((doc.bib || []).map(e => e.key));
    const add = entries.map(e => {
      let k = e.key || bibKey(e);
      const k0 = k;
      let i = 1;
      while (have.has(k)) k = k0 + String.fromCharCode(96 + i++);
      have.add(k);
      return { ...e, key: k };
    });
    this.setDoc(
      d => ({ ...d, bib: [...(d.bib || []), ...add] }),
      'La til ' + add.length + (add.length === 1 ? ' kilde' : ' kilder')
    );
    return add;
  }
  lookupDoi = () => {
    const raw = (this.state.bibUi.doi || '').trim(),
      m = raw.match(/10\.\d{4,9}\/[^\s]+/);
    if (!m) return this.bibSet({ msg: 'Fant ingen DOI i teksten.', err: true });
    if (this.netOff()) return this.bibSet({ msg: 'Frakoblet. DOI-oppslag krever nett.', err: true });
    const doi = m[0].replace(/[.,;]$/, '');
    this.bibSet({ busy: true, msg: 'Slår opp …', err: false });
    fetch('https://api.crossref.org/works/' + encodeURIComponent(doi))
      .then(r => {
        if (!r.ok) throw 0;
        return r.json();
      })
      .then(j => {
        const x = j.message || {},
          au = (x.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ') || a.name).filter(Boolean);
        const e = {
          type: x.type === 'journal-article' ? 'article' : x.type === 'book' ? 'book' : 'misc',
          author: au.length > 3 ? au[0] + ' mfl.' : au.join(' og '),
          title: (x.title || [])[0] || '',
          journal: (x['container-title'] || [])[0] || x.publisher || '',
          year: String((((x.issued || {})['date-parts'] || [[]])[0] || [])[0] || ''),
          doi
        };
        const a = this.addBib([e])[0];
        this.bibSet({ busy: false, doi: '', msg: 'La til ' + a.key, err: false });
      })
      .catch(() => this.bibSet({ busy: false, msg: 'Fant ikke DOI-en hos Crossref.', err: true }));
  };
  toast(msg) {
    clearTimeout(this._tt);
    this.setState({ toast: msg });
    this._tt = setTimeout(() => this.setState({ toast: null }), 2200);
  }
  curDoc() {
    return this.state.docs.find(d => d.id === this.state.cur);
  }
  tickPresence() {
    if (this.props.simulateCollab === false || this.state.cur !== 'd4') return;
    const ps = this.curDoc().blocks.filter(b => b.type === 'p' || b.type === 'fig');
    if (ps.length < 2) return;
    const a = ps[Math.floor(Math.random() * ps.length)];
    let b = ps[Math.floor(Math.random() * ps.length)];
    if (b === a) b = ps[(ps.indexOf(a) + 1) % ps.length];
    this.setState({ presence: { MH: a.id, EL: b.id } });
  }
  schedule() {
    clearTimeout(this.ct);
    if (this.state.compile.status !== 'dirty') this.setState(s => ({ compile: { ...s.compile, status: 'dirty' } }));
    if (this.state.settings.auto) this.ct = setTimeout(() => this.compile(), 1100);
  }
  compile = () => {
    clearTimeout(this.ct);
    clearTimeout(this.ct2);
    this.setState(s => ({ compile: { ...s.compile, status: 'running' } }));
    this.ct2 = setTimeout(() => {
      const doc = this.curDoc(),
        text = this.codeTextNow(),
        lines = text.split('\n'),
        log = lintTex(text, this.fileSet(doc)).map(d => ({ ...d, code: (lines[d.line - 1] || '').trim() }));
      const nE = log.filter(d => d.sev === 'error').length,
        nW = log.length - nE,
        time = (0.5 + Math.random() * 0.5).toFixed(1).replace('.', ',');
      if (nE) this.setState({ compile: { status: 'error', time, log, nE, nW } });
      else this.setState({ compile: { status: 'ok', time, log, nE, nW }, pdfSnap: clone(doc) });
    }, 650);
  };
  applyFix(d) {
    const f = d.fix;
    if (!f) return;
    if (f.upload) {
      this.pickImage({ library: true, name: f.upload });
      return;
    }
    const ls = this.codeTextNow().split('\n');
    if (f.line > ls.length) return;
    ls[f.line - 1] = ls[f.line - 1].replace(/\s*$/, '') + f.append;
    const text = ls.join('\n');
    this._cdDirty = false;
    this.setState({ codeDraft: text, codeDraftFor: this.state.cur }, () => {
      this.applyDraft(true);
      this.toast(f.label.replace('Legg til', 'La til'));
      setTimeout(() => this.compile(), 50);
    });
  }
  codeTextNow() {
    const s = this.state;
    return s.codeDraft != null && s.codeDraftFor === s.cur
      ? s.codeDraft
      : docCode(this.curDoc(), s.settings)
          .map(l => l.s)
          .join('\n');
  }
  fileSet(doc) {
    return new Set([
      ...(doc.files || []).map(f => f.file),
      ...doc.blocks.filter(b => b.type === 'img').map(b => b.file)
    ]);
  }
  codeRef = React.createRef();
  goToLine(n) {
    this.setState(
      x => ({ mode: x.mode === 'visual' ? 'split' : x.mode, view: 'editor' }),
      () =>
        setTimeout(() => {
          const el = this.codeRef.current;
          if (!el) return;
          el.scrollTop = Math.max(0, (n - 1) * 21.25 - el.clientHeight / 3);
          const ta = el.querySelector('textarea');
          if (ta) {
            const ls = ta.value.split('\n');
            let p = 0;
            for (let k = 0; k < n - 1 && k < ls.length; k++) p += ls[k].length + 1;
            ta.focus({ preventScroll: true });
            ta.setSelectionRange(p, p + (ls[n - 1] || '').length);
          }
        }, 30)
    );
  }
  snapDoc(d) {
    return clone({
      title: d.title,
      authors: d.authors,
      group: d.group,
      pre: d.pre || [],
      blocks: d.blocks,
      files: d.files || []
    });
  }
  urStack(kind) {
    if (kind === 'circ') return this._uc || (this._uc = { past: [], future: [], t: 0 });
    const m = this._ud || (this._ud = {});
    return m[this.state.cur] || (m[this.state.cur] = { past: [], future: [], t: 0 });
  }
  pushUndo(kind, snap, force) {
    const st = this.urStack(kind),
      t = Date.now();
    if (!force && st.past.length && t - st.t < 450) {
      st.t = t;
      return;
    }
    st.past.push(snap);
    if (st.past.length > 200) st.past.shift();
    st.future = [];
    st.t = t;
    this.setState({ urTick: t });
  }
  urKind() {
    return this.state.view === 'circuit' && this.state.circ ? 'circ' : 'doc';
  }
  undo = () => this.stepUR(true);
  redo = () => this.stepUR(false);
  stepUR(back) {
    const kind = this.urKind(),
      st = this.urStack(kind),
      from = back ? st.past : st.future,
      to = back ? st.future : st.past;
    if (!from.length) return this.toast(back ? 'Ingenting å angre' : 'Ingenting å gjøre om');
    const snap = from.pop();
    st.t = 0;
    if (kind === 'circ') {
      to.push(clone(this.state.circ.data));
      this.setState(s => ({ circ: { ...s.circ, data: snap, sel: null, pending: null }, urTick: Date.now() }));
    } else {
      to.push(this.snapDoc(this.curDoc()));
      this.setState(
        s => ({
          docs: s.docs.map(d => (d.id === s.cur ? { ...d, ...snap } : d)),
          codeDraft: null,
          codeErr: null,
          urTick: Date.now()
        }),
        () => this.schedule()
      );
    }
    this.toast(back ? 'Angret' : 'Gjort om');
  }
  setDoc(fn, hist) {
    this.pushUndo('doc', this.snapDoc(this.curDoc()), !!hist);
    this.setState(
      s => {
        const old = s.docs.find(d => d.id === s.cur);
        const st = { docs: s.docs.map(d => (d.id === s.cur ? fn(d) : d)) };
        if (hist)
          st.history = [
            {
              id: uid(),
              who: this.account().name,
              initials: this.account().initials || this.account().id,
              color: this.account().color || USERS[this.account().id].color,
              what: hist,
              time: now(),
              snap: clone(old.blocks)
            },
            ...s.history
          ];
        return st;
      },
      () => this.schedule()
    );
  }
  setBlocks(fn, hist) {
    this.setDoc(d => ({ ...d, blocks: fn(d.blocks) }), hist);
  }
  updBlock(id, patch, hist) {
    this.setBlocks(
      bs => bs.map(b => (b.id === id ? { ...b, ...(typeof patch === 'function' ? patch(b) : patch) } : b)),
      hist
    );
  }
  findBlock(id) {
    return this.curDoc().blocks.find(b => b.id === id);
  }
  saveField(id, k, v) {
    v = clean(v);
    const b = this.findBlock(id);
    if (!b || b[k] === v) return;
    this.updBlock(id, { [k]: v });
  }
  saveSeg(id, si, v) {
    v = clean(v);
    const b = this.findBlock(id);
    if (!b || !b.segs[si] || b.segs[si].v === v) return;
    this.updBlock(id, x => ({ segs: x.segs.map((s, i) => (i === si ? { ...s, v } : s)) }));
  }
  saveCell(id, ri, ci, v) {
    v = clean(v);
    const b = this.findBlock(id);
    if (!b || b.rows[ri][ci] === v) return;
    this.updBlock(id, x => ({ rows: x.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)) }));
  }
  addBlockAfter(afterId, partial, hist, focus) {
    const blk = { id: uid(), ...partial };
    this.setBlocks(bs => {
      const i = bs.findIndex(b => b.id === afterId);
      const at = i < 0 ? bs.length : i + 1;
      return [...bs.slice(0, at), blk, ...bs.slice(at)];
    }, hist);
    this.activeSrc = 'editor-new';
    this.setState({ active: blk.id });
    if (focus !== false && (blk.type === 'p' || blk.type === 'h1' || blk.type === 'h2'))
      this.pendingFocus = { sel: `[data-seg="${blk.id}:0"]`, end: true };
    return blk;
  }
  deleteBlock(id, focusPrev) {
    const bs = this.curDoc().blocks,
      i = bs.findIndex(b => b.id === id),
      prev = bs[i - 1];
    this.setBlocks(x => x.filter(b => b.id !== id), focusPrev ? null : 'Slettet blokk');
    this.setState({ active: prev ? prev.id : null });
    if (focusPrev && prev && (prev.type === 'p' || prev.type === 'h1' || prev.type === 'h2'))
      this.pendingFocus = { sel: `[data-seg="${prev.id}:${prev.type === 'p' ? prev.segs.length - 1 : 0}"]`, end: true };
  }
  paraKey(e, b, i) {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const el = e.currentTarget,
        sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const atEnd = (() => {
        const t = document.createRange();
        t.selectNodeContents(el);
        t.setStart(r.endContainer, r.endOffset);
        return !t.toString().length;
      })();
      const tn = document.createTextNode(atEnd && !/\n$/.test(el.innerText) ? '\n\u200B' : '\n');
      r.insertNode(tn);
      const nr = document.createRange();
      nr.setStart(tn, 1);
      nr.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nr);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveSeg(b.id, i, e.currentTarget.innerText);
      this.addBlockAfter(b.id, { type: 'p', segs: [t('')] });
    } else if (e.key === 'Backspace') {
      const tx = clean(e.currentTarget.innerText);
      if (b.segs.length === 1 && !tx) {
        e.preventDefault();
        this.deleteBlock(b.id, true);
      }
    }
  }
  insertSeg(seg, hist) {
    const c = this.caret,
      doc = this.curDoc();
    let b = c && doc.blocks.find(x => x.id === c.bid);
    if (!b || b.type !== 'p') {
      const a = doc.blocks.find(x => x.id === this.state.active);
      b = a && a.type === 'p' ? a : null;
    }
    if (!b) {
      this.addBlockAfter(this.state.active, { type: 'p', segs: [t(''), seg, t('')] }, hist, false);
      return;
    }
    let si = c && c.bid === b.id ? c.si : -1;
    if (si < 0 || !b.segs[si] || b.segs[si].t !== 'text') si = b.segs.length - 1;
    const el = document.querySelector(`[data-seg="${b.id}:${si}"]`),
      tx = el ? clean(el.innerText) : b.segs[si].v,
      off = c && c.bid === b.id && c.si === si ? Math.min(c.off, tx.length) : tx.length;
    const segs = [...b.segs];
    segs.splice(si, 1, t(tx.slice(0, off)), seg, t(tx.slice(off)));
    this.caret = { bid: b.id, si: si + 2, off: 0 };
    this.setBlocks(bs => bs.map(x => (x.id === b.id ? { ...x, segs } : x)), hist);
    this.setState({ active: b.id });
    this.pendingFocus = { sel: `[data-seg="${b.id}:${si + 2}"]`, end: false };
  }
  removeSeg(id, si) {
    this.updBlock(id, b => ({ segs: norm(b.segs.filter((_, i) => i !== si)) }), 'Fjernet element');
  }
  focusBlock(id, src) {
    this.activeSrc = src;
    if (this.state.active === id) {
      if (src !== 'editor') this.scrollIn(this.edRef.current, `[data-blk="${id}"]`);
      if (src !== 'pdf') this.scrollIn(this.pdfRef.current, `[data-pblk="${id}"]`);
    }
    this.setState({ active: id, view: 'editor' });
  }
  openPicker(tab, edit) {
    let p = {
      tab,
      num: '220',
      prefix: '',
      unit: 'ohm',
      base: 'v',
      sub: '',
      tex: 'v',
      q: '',
      err: '',
      edit: edit || null
    };
    if (edit) {
      const sg = this.findBlock(edit.bid).segs[edit.si];
      if (sg.t === 'unit') p = { ...p, tab: 'qty', num: sg.num, prefix: sg.prefix, unit: sg.unit };
      else p = { ...p, tab: 'sym', base: sg.base, sub: sg.sub || '', tex: sg.tex };
    }
    this.setState({ picker: p, refMenu: false });
  }
  pk(patch) {
    this.setState(s => ({ picker: { ...s.picker, ...patch } }));
  }
  pickerSubmit = () => {
    const p = this.state.picker,
      dec = this.state.settings.dec;
    if (p.tab === 'math') {
      const q = p.q.trim().toLowerCase(),
        mm = MATH.find(x => !q || (x.n + ' ' + x.s + ' ' + x.tex).toLowerCase().includes(q));
      if (mm) this.insertMath(mm.tex);
      return;
    }
    let seg, label;
    if (p.tab === 'qty') {
      const n = p.num.trim();
      if (!/^-?\d+([.,]\d+)?$/.test(n)) return this.pk({ err: 'Skriv et tall, for eksempel 4,7' });
      seg = { t: 'unit', num: n.replace('.', ','), prefix: p.prefix, unit: p.unit };
      label = qtyText(seg, dec);
    } else {
      seg = { t: 'sym', base: p.base, sub: p.sub.trim(), tex: p.tex };
      label = p.base + (seg.sub ? '_' + seg.sub : '');
    }
    this.setState({ picker: null });
    if (p.edit)
      this.updBlock(p.edit.bid, b => ({ segs: b.segs.map((x, i) => (i === p.edit.si ? seg : x)) }), 'Endret ' + label);
    else this.insertSeg(seg, 'Satt inn ' + label);
  };
  openCircuit(id, partial) {
    this._uc = { past: [], future: [], t: 0 };
    const b = partial || this.findBlock(id);
    this.setState({
      view: 'circuit',
      share: false,
      circ: {
        bid: id,
        data: clone(b.circuit),
        sel: null,
        tool: 'select',
        pending: null,
        err: '',
        auto: !b.circuit.manual
      }
    });
  }
  circSet(p) {
    const c = this.state.circ;
    if (!c) return;
    const res = typeof p === 'function' ? p(c) : p;
    if (res && res.data && res.data !== c.data) this.pushUndo('circ', clone(c.data));
    this.setState(s => ({ circ: { ...s.circ, ...res } }));
  }
  updData(fn) {
    this.circSet(c => ({ data: fn(c.data) }));
  }
  lay(c, d) {
    return c.auto ? autoLayout(d) : d;
  }
  setAuto(on) {
    this.circSet(c => ({ auto: on, data: on ? autoLayout(c.data) : c.data }));
    this.toast(on ? 'Automatisk plassering er på' : 'Manuell plassering. Dra komponentene dit du vil.');
  }
  tidyNow = () => {
    this.circSet(c => ({ data: autoLayout(c.data) }));
    this.toast('Skjemaet er ryddet');
  };
  onComp = (e, id) => {
    const c = this.state.circ;
    if (!c) return;
    e.stopPropagation();
    if (c.tool === 'wire') return;
    const comp = c.data.comps.find(x => x.id === id);
    this.drag = { id, sx: e.clientX, sy: e.clientY, ox: comp.x, oy: comp.y };
    this.circSet({ sel: id });
  };
  onMove(e) {
    if (this.rs) {
      const w = Math.round(
        Math.max(320, Math.min(window.innerWidth - 236 - 380, this.rs.w - (e.clientX - this.rs.sx)))
      );
      if (w !== this.state.rightW) this.setState({ rightW: w });
      return;
    }
    const d = this.drag,
      c = this.state.circ;
    if (!d || !c) return;
    const nx = Math.max(0, d.ox + Math.round((e.clientX - d.sx) / 20) / 2),
      ny = Math.max(0, d.oy + Math.round((e.clientY - d.sy) / 20) / 2);
    const comp = c.data.comps.find(x => x.id === d.id);
    if (!comp || (comp.x === nx && comp.y === ny)) return;
    if (c.auto) {
      this.circSet({ auto: false });
      this.toast('Manuell plassering. Trykk Auto for å rydde igjen.');
    }
    this.updData(dt => ({ ...dt, comps: dt.comps.map(x => (x.id === d.id ? { ...x, x: nx, y: ny } : x)) }));
  }
  onTerm = (id, tm) => {
    const c = this.state.circ;
    if (c.pending && !(c.pending.c === id && c.pending.t === tm)) {
      const w = { id: uid(), a: c.pending, b: { c: id, t: tm } };
      this.circSet(x => ({
        data: this.lay(x, { ...x.data, wires: [...x.data.wires, w] }),
        pending: null,
        sel: 'w:' + w.id
      }));
    } else this.circSet({ tool: 'wire', pending: { c: id, t: tm } });
  };
  onWire = id => this.circSet({ sel: 'w:' + id, pending: null });
  onBg = () => this.circSet({ sel: null, pending: null });
  addComp(type) {
    const T = CT[type],
      c = this.state.circ,
      same = c.data.comps.filter(x => T.p && (CT[x.type] || {}).p === T.p).length,
      n = c.data.comps.length;
    const comp = {
      id: uid(),
      type,
      x: 10 + (n % 3),
      y: 1.5 + (n % 4) * 1.5,
      rot: ['V', 'sV', 'I', 'bat'].includes(type) ? 1 : 0,
      name: type === 'net' ? 'a' : T.p || '',
      sub: T.p ? String(same + 1) : '',
      val: T.val ? clone(T.val) : null,
      pinl: T.io ? {} : undefined
    };
    if (type === 'V') comp.sub = same ? String(same + 1) : 's';
    this.circSet(x => ({
      data: this.lay(x, { ...x.data, comps: [...x.data.comps, comp] }),
      sel: comp.id,
      tool: 'select',
      pending: null
    }));
  }
  delSel = () => {
    const c = this.state.circ;
    if (!c || !c.sel) return;
    if (c.sel.startsWith('w:')) {
      const id = c.sel.slice(2);
      this.circSet(x => ({
        data: this.lay(x, { ...x.data, wires: x.data.wires.filter(w => w.id !== id) }),
        sel: null
      }));
    } else {
      const id = c.sel;
      this.circSet(x => ({
        data: this.lay(x, {
          ...x.data,
          comps: x.data.comps.filter(k => k.id !== id),
          wires: x.data.wires.filter(w => w.a.c !== id && w.b.c !== id)
        }),
        sel: null
      }));
    }
  };
  rotateSel() {
    const c = this.state.circ;
    if (!c || !c.sel || c.sel.startsWith('w:')) return;
    if (c.auto) {
      this.circSet({ auto: false });
      this.toast('Manuell plassering, siden du roterte selv');
    }
    this.updData(d => ({
      ...d,
      comps: d.comps.map(k => (k.id === c.sel && CT[k.type].two ? { ...k, rot: k.rot ? 0 : 1 } : k))
    }));
  }
  updComp(patch) {
    const c = this.state.circ;
    this.updData(d => ({ ...d, comps: d.comps.map(k => (k.id === c.sel ? { ...k, ...patch(k) } : k)) }));
  }
  setS(k, v) {
    this.setState(
      s => ({ settings: { ...s.settings, [k]: v } }),
      () => this.schedule()
    );
  }
  openDoc(id) {
    this.caret = null;
    this.setState(s => ({ recent: [id, ...s.recent.filter(x => x !== id)].slice(0, 8) }));
    this.setState(
      { fileMenu: false, cur: id, view: 'editor', active: null, pdfSnap: null, share: false, circ: null },
      () => this.compile()
    );
  }

  dk(p) {
    this.setState(s => ({ duck: { ...s.duck, ...p } }));
  }
  dku(p) {
    this.setState(s => ({ duckUi: { ...s.duckUi, ...(typeof p === 'function' ? p(s.duckUi) : p) } }));
  }
  sb(p) {
    this.setState(s => ({ smb: { ...s.smb, ...p }, smbUi: { ...s.smbUi, test: null } }));
  }
  sbu(p) {
    this.setState(s => ({ smbUi: { ...s.smbUi, ...p } }));
  }
  dp(p) {
    this.setState(s => ({ deploy: { ...s.deploy, ...p } }));
  }
  copyText(x) {
    try {
      navigator.clipboard.writeText(x);
    } catch (e) {}
    this.toast('Kopiert til utklippstavlen');
  }
  duckUpdate = () => {
    const d = this.state.duck,
      ok = DUCK_RE.test(d.domain) && TOKEN_RE.test(d.token);
    this.dku({ busy: true });
    setTimeout(() => {
      const ip =
        this.state.duckUi.ip ||
        '84.212.' + (20 + Math.floor(Math.random() * 200)) + '.' + (2 + Math.floor(Math.random() * 250));
      const url =
        'update?domains=' +
        (d.domain || '?') +
        '&token=' +
        (d.token ? d.token.slice(0, 4) + '…' : '?') +
        '&ip=' +
        (d.ipv6 ? '&ipv6=' : '') +
        '&verbose=true';
      this.dku(x => ({
        busy: false,
        ip: ok ? ip : x.ip,
        last: ok ? now() : x.last,
        log: [
          {
            t: now(),
            ok,
            txt: ok ? url + '  →  OK  ' + ip + (d.ipv6 ? '  2a01:79c:cebf::1' : '') + '  UPDATED' : url + '  →  KO'
          },
          ...x.log
        ].slice(0, 8)
      }));
      this.toast(ok ? d.domain + '.duckdns.org peker nå på ' + ip : 'DuckDNS svarte KO. Sjekk subdomene og token.');
    }, 750);
  };
  smbFsDefault() {
    return {
      backup: { kobling: {}, proxmox: { dump: {} }, unraid: {} },
      appdata: { kobling: { data: {} }, plex: {}, nextcloud: {} },
      Public: { Dokumenter: {}, Skole: { ELI1300: {} } },
      isos: {}
    };
  }
  smbConnect = () => {
    const b = this.state.smb,
      u = this.state.smbUi;
    if (u.conn && u.conn.ok) {
      return this.sbu({ conn: null, cwd: [], newDir: '' });
    }
    const host = b.host.trim();
    if (!host) return this.sbu({ conn: { err: 'Skriv inn IP-adressen eller vertsnavnet til serveren.' } });
    const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ip && ip.slice(1).some(n => +n > 255)) return this.sbu({ conn: { err: 'Ugyldig IP-adresse.' } });
    if (!ip && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)*$/i.test(host))
      return this.sbu({ conn: { err: 'Ugyldig vertsnavn.' } });
    if (!b.user.trim()) return this.sbu({ conn: { err: 'Fyll inn brukernavn.' } });
    this.sbu({ conn: { busy: true } });
    setTimeout(() => {
      if (
        ip &&
        !(
          +ip[1] === 10 ||
          (+ip[1] === 192 && +ip[2] === 168) ||
          (+ip[1] === 172 && +ip[2] >= 16 && +ip[2] <= 31) ||
          +ip[1] === 127
        )
      )
        return this.sbu({
          conn: { err: 'Fikk ikke kontakt med ' + host + ' på port 445. Er serveren på samme nettverk?' }
        });
      if (!b.pass) return this.sbu({ conn: { err: 'Feil brukernavn eller passord (NT_STATUS_LOGON_FAILURE).' } });
      const fs = (this.state.smbFs || {})[host] || this.smbFsDefault();
      const cwd =
        b.share && fs[b.share]
          ? [
              b.share,
              ...(b.path || '')
                .split('/')
                .filter(Boolean)
                .filter((x, i, a) => {
                  let n = fs[b.share];
                  for (let k = 0; k <= i; k++) {
                    n = n && n[a[k]];
                  }
                  return !!n;
                })
            ]
          : [];
      this.setState(s => ({
        smbFs: { ...(s.smbFs || {}), [host]: fs },
        smbUi: { ...s.smbUi, conn: { ok: true, host }, cwd, newDir: '' }
      }));
    }, 700);
  };
  smbNode(cwd) {
    const u = this.state.smbUi,
      fs = (this.state.smbFs || {})[u.conn && u.conn.host];
    let n = fs;
    for (const p of cwd) {
      n = n && n[p];
    }
    return n;
  }
  smbMkdir = () => {
    const u = this.state.smbUi,
      name = (u.newDir || '').trim();
    if (!name || !u.cwd.length) return;
    if (/[\\/:*?"<>|]/.test(name)) return this.toast('Ugyldige tegn i mappenavnet');
    const host = u.conn.host;
    this.setState(s => {
      const fs = clone(s.smbFs[host]);
      let n = fs;
      for (const p of s.smbUi.cwd) n = n[p];
      if (n[name]) return null;
      n[name] = {};
      return { smbFs: { ...s.smbFs, [host]: fs }, smbUi: { ...s.smbUi, newDir: '', cwd: [...s.smbUi.cwd, name] } };
    });
    this.toast('Opprettet mappen ' + name);
  };
  smbRow(bk, bu) {
    const c = bu.conn || {},
      ok = !!c.ok,
      cwd = bu.cwd || [],
      node = ok ? this.smbNode(cwd) : null,
      host = bk.host.trim();
    const sv = p => this.sb(p),
      ACCX = 'oklch(0.55 0.17 255)',
      GR = 'var(--acc-g,#138a36)';
    const FOLDER = 'M2.5 5.5v8.25h13V6.75H8.5L7 5.25H2.5z',
      SHARE = 'M3 4.5h12v4H3zM3 9.5h12v4H3zM5.5 6.5h.01M5.5 11.5h.01';
    const entries =
      ok && node
        ? Object.keys(node)
            .sort((a, b) => a.localeCompare(b, 'nb'))
            .map(k => ({
              name: k,
              meta: cwd.length ? (Object.keys(node[k]).length ? Object.keys(node[k]).length + ' mapper' : '') : 'share',
              icon: cwd.length ? FOLDER : SHARE,
              iconColor: cwd.length ? 'oklch(0.7 0.13 75)' : ACCX,
              onOpen: () => this.sbu({ cwd: [...cwd, k], newDir: '' })
            }))
        : [];
    const path = '//' + (c.host || host) + (cwd.length ? '/' + cwd.join('/') : '');
    const target =
      bk.host && bk.share ? '//' + bk.host + '/' + bk.share + (bk.path ? '/' + bk.path : '') : 'Ikke valgt ennå';
    const sameAsSaved =
      cwd.length && bk.host === c.host && bk.share === cwd[0] && (bk.path || '') === cwd.slice(1).join('/');
    return {
      isSmb: true,
      host: bk.host,
      user: bk.user,
      pass: bk.pass,
      domain: bk.domain,
      passType: bu.showPass ? 'text' : 'password',
      eyeLabel: bu.showPass ? 'Skjul' : 'Vis',
      onEye: () => this.sbu({ showPass: !bu.showPass }),
      onHost: e => {
        sv({ host: e.target.value.trim() });
        if (ok) this.sbu({ conn: null, cwd: [] });
      },
      onUser: e => sv({ user: e.target.value }),
      onPass: e => sv({ pass: e.target.value }),
      onDomain: e => sv({ domain: e.target.value }),
      onEnter: e => {
        if (e.key === 'Enter') this.smbConnect();
      },
      adv: !!bu.adv,
      advLabel: bu.adv ? 'Skjul avansert' : 'Avansert',
      toggleAdv: () => this.sbu({ adv: !bu.adv }),
      vers: [
        ['2.1', '2.1'],
        ['3.0', '3.0'],
        ['3.1.1', '3.1.1']
      ].map(([l, v]) => ({
        label: l,
        onClick: () => sv({ ver: v }),
        bg: bk.ver === v ? 'var(--kfff,#fff)' : 'transparent',
        shadow: bk.ver === v ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
      })),
      onConnect: this.smbConnect,
      connLabel: c.busy ? 'Kobler til …' : ok ? 'Koble fra' : 'Koble til',
      connOpacity: c.busy ? 0.6 : 1,
      err: c.err || '',
      status: ok ? 'Tilkoblet ' + c.host + ' · SMB ' + bk.ver : '',
      statusColor: 'var(--acc-g-ink,#0f6e2b)',
      s1Bg: ok ? GR : ACCX,
      s1Mark: ok ? '✓' : '1',
      s2Bg: ok ? ACCX : 'var(--kbdb7ae,#bdb7ae)',
      s2Opacity: ok ? 1 : 0.55,
      connected: ok,
      notConnected: !ok,
      crumbs: [
        { label: '//' + (c.host || host), sep: '', fw: cwd.length ? 400 : 600, onClick: () => this.sbu({ cwd: [] }) },
        ...cwd.map((p, i) => ({
          label: p,
          sep: '/',
          fw: i === cwd.length - 1 ? 600 : 400,
          onClick: () => this.sbu({ cwd: cwd.slice(0, i + 1) })
        }))
      ],
      goUp: () => cwd.length && this.sbu({ cwd: cwd.slice(0, -1) }),
      upOpacity: cwd.length ? 1 : 0.35,
      entries,
      empty: ok && !entries.length,
      emptyText: cwd.length ? 'Mappen er tom. Opprett en undermappe, eller bruk denne mappen.' : 'Fant ingen sharer.',
      canMkdir: ok && cwd.length > 0,
      newDir: bu.newDir || '',
      onNewDir: e => this.sbu({ newDir: e.target.value }),
      onNewDirKey: e => {
        if (e.key === 'Enter') this.smbMkdir();
      },
      mkdir: this.smbMkdir,
      pickHint: cwd.length ? 'Gjeldende mappe' : 'Velg en share for å fortsette',
      cwdPath: path,
      useLabel: sameAsSaved ? '✓ Valgt' : 'Bruk denne mappen',
      useOpacity: cwd.length && !sameAsSaved ? 1 : 0.45,
      onUse: () => {
        if (!cwd.length || sameAsSaved) return;
        sv({ host: c.host, share: cwd[0], path: cwd.slice(1).join('/') });
        this.toast('Backup lagres i ' + path);
      },
      target,
      targetColor: bk.host && bk.share ? 'var(--k1f1e1c,#1f1e1c)' : 'var(--k8d8982,#8d8982)'
    };
  }
  publicBase() {
    const d = this.state.duck,
      dep = this.state.deploy;
    if (d.on && d.links !== false && d.domain && DUCK_RE.test(d.domain))
      return {
        url: d.tls ? 'https://' + d.domain + '.duckdns.org' : 'http://' + d.domain + '.duckdns.org:' + dep.port,
        ext: true
      };
    const sv = (this.state.settings.server || 'https://kobling.app').trim();
    return { url: /^https?:\/\//.test(sv) ? sv.replace(/\/$/, '') : 'https://' + sv, ext: false };
  }
  up(p) {
    this.setState(s => ({ upd: { ...s.upd, ...p } }));
  }
  uu(p) {
    this.setState(s => ({ updUi: { ...s.updUi, ...p } }));
  }
  checkUpdate = () => {
    this.uu({ checking: true, found: null });
    setTimeout(() => {
      const u = this.state.upd,
        r = RELEASES[u.channel];
      const d = new Date();
      this.up({ lastCheck: d.toLocaleDateString('nb-NO') + ' kl. ' + now() });
      this.uu({ checking: false, found: vcmp(r.ver, u.ver) > 0 ? r : 'none' });
    }, 900);
  };
  runUpdate = (target, isRollback) => {
    const u = this.state.upd,
      b = this.state.smb,
      hasBk = u.backup && b.host && b.share && !isRollback;
    const to = target || this.state.updUi.found;
    if (!to || to === 'none') return;
    const steps = [
      ...(u.notify ? ['Varsler innloggede brukere …'] : []),
      'Laster ned kobling-server:' + to.ver + ' (' + (to.size || '') + ') …',
      ...(hasBk ? ['Tar backup til //' + b.host + '/' + b.share + '/' + b.path + ' …'] : []),
      'Stopper tjenesten (aktive økter lagres) …',
      'Migrerer database …',
      'Starter kobling-server ' + to.ver + ' …',
      'Helsesjekk: /api/health …'
    ];
    let i = 0,
      pct = 0;
    const log = [];
    this.uu({ run: { pct: 0, step: steps[0], log: [] } });
    clearInterval(this._ut);
    this._ut = setInterval(() => {
      pct += 4 + Math.random() * 7;
      const si = Math.min(steps.length - 1, Math.floor((pct / 100) * steps.length));
      while (i < si) {
        log.push('✓ ' + steps[i].replace(' …', ''));
        i++;
      }
      if (pct >= 100) {
        clearInterval(this._ut);
        log.push('✓ ' + steps[steps.length - 1].replace(' …', ''));
        const prev = u.ver;
        if (hasBk) {
          this.setState(s => ({ backups: [this.snapshotBackup('_for-oppdatering-' + to.ver), ...s.backups] }));
        }
        this.up({ ver: to.ver, built: to.date || u.built, prev: isRollback ? null : prev });
        this.uu({
          run: { pct: 100, done: true, step: 'Ferdig', log, to: to.ver, rollback: !!isRollback },
          found: null
        });
        this.toast(isRollback ? 'Tilbake på ' + to.ver : 'Serveren er oppdatert til ' + to.ver);
        return;
      }
      this.uu({ run: { pct, step: steps[si], log: [...log] } });
    }, 200);
  };
  smbErr() {
    const b = this.state.smb;
    if (!b.host) return 'Fyll inn server (vertsnavn eller IP).';
    if (!b.share || /[\\/]/.test(b.share)) return 'Fyll inn navnet på sharen.';
    if (!b.user) return 'Fyll inn brukernavn.';
    return '';
  }
  testSmb = () => {
    const e = this.smbErr();
    if (e) return this.sbu({ test: { ok: false, msg: e } });
    this.sbu({ testing: true, test: null });
    const b = this.state.smb;
    setTimeout(
      () =>
        this.sbu({
          testing: false,
          test: {
            ok: true,
            msg: 'Tilkoblet //' + b.host + '/' + b.share + ' med SMB ' + b.ver + '. Skrivetilgang OK, 1,82 TB ledig.'
          }
        }),
      800
    );
  };
  runBackup = () => {
    const e = this.smbErr();
    if (e) return this.sbu({ test: { ok: false, msg: e } });
    const b = this.state.smb;
    const steps = [
      'Pakker dokumenter og figurer …',
      'Komprimerer med zstd …',
      'Kopierer til //' + b.host + '/' + b.share + '/' + b.path + ' …',
      'Fjerner backuper utover de ' + b.keep + ' nyeste …'
    ];
    let pct = 0;
    this.sbu({ run: { pct: 0, step: steps[0] }, test: null });
    clearInterval(this._bk);
    this._bk = setInterval(() => {
      pct += 7 + Math.random() * 9;
      if (pct >= 100) {
        clearInterval(this._bk);
        const d = new Date(),
          stamp = d.toISOString().slice(0, 10) + '_' + now().replace(':', ''),
          docs = clone(this.state.docs);
        this.setState(s => ({
          smbUi: { ...s.smbUi, run: null },
          backups: [
            {
              id: uid(),
              name: 'kobling-' + stamp + '.tar.zst',
              time: now(),
              date: d.toLocaleDateString('nb-NO'),
              size: Math.round((JSON.stringify(docs).length / 1024) * 2.6 + 160) + ' kB',
              files: docs.reduce((n, x) => n + 1 + x.blocks.filter(k => k.type === 'fig').length, 0),
              docs
            },
            ...s.backups
          ].slice(0, s.smb.keep)
        }));
        this.toast('Backup fullført');
      } else this.sbu({ run: { pct, step: steps[Math.min(3, Math.floor(pct / 25))] } });
    }, 170);
  };
  bkFileRef = React.createRef();
  snapshotBackup(suffix) {
    const d = new Date(),
      docs = clone(this.state.docs);
    return {
      id: uid(),
      name: 'kobling-' + d.toISOString().slice(0, 10) + '_' + now().replace(':', '') + (suffix || '') + '.tar.zst',
      time: now(),
      date: d.toLocaleDateString('nb-NO'),
      size: Math.round((JSON.stringify(docs).length / 1024) * 0.32) + ' kB',
      files: docs.length,
      docs
    };
  }
  openRestore(k) {
    this.setState({
      restore: { id: k.id, mode: 'merge', sel: Object.fromEntries(k.docs.map(d => [d.id, true])), safety: true }
    });
  }
  doRestore() {
    const r = this.state.restore,
      k = this.state.backups.find(x => x.id === r.id);
    if (!k) return;
    const pick = k.docs.filter(d => r.sel[d.id]);
    if (!pick.length) return;
    const safe = r.safety ? [this.snapshotBackup('_for-gjenoppretting')] : [];
    this.setState(
      s => {
        let docs;
        if (r.mode === 'replace') docs = clone(pick);
        else {
          docs = s.docs.map(d => {
            const b = pick.find(x => x.id === d.id);
            return b ? clone(b) : d;
          });
          pick.forEach(b => {
            if (!docs.some(d => d.id === b.id)) docs.push(clone(b));
          });
        }
        const cur = docs.some(d => d.id === s.cur) ? s.cur : docs[0].id;
        const old = s.docs.find(d => d.id === s.cur);
        return {
          restore: null,
          backups: [...safe, ...s.backups],
          docs,
          pdfSnap: null,
          active: null,
          codeDraft: null,
          cur,
          history: [
            {
              id: uid(),
              who: 'Sebastian Kristoffersen',
              initials: 'SK',
              color: USERS.SK.color,
              what: 'Gjenopprettet ' + pick.length + ' dok. fra ' + k.name,
              time: now(),
              snap: old ? clone(old.blocks) : null
            },
            ...s.history
          ]
        };
      },
      () => this.compile()
    );
    this.toast(
      (r.mode === 'replace'
        ? 'Erstattet alt med '
        : 'Gjenopprettet ' + pick.length + ' dokument' + (pick.length > 1 ? 'er' : '') + ' fra ') + k.name
    );
  }
  fetchBackups = () => {
    const b = this.state.smb;
    if (!b.host || !b.share) return this.toast('Fyll inn server og share først');
    this.setState({ fetchingBk: true });
    setTimeout(() => {
      const ds = [1, 2, 7, 14].map(n => {
        const d = new Date(Date.now() - n * 864e5);
        const docs = clone(this.state.docs).map(x => ({
          ...x,
          blocks: x.blocks.slice(0, Math.max(1, x.blocks.length - n))
        }));
        return {
          id: 'r' + n + '-' + d.toISOString().slice(0, 10),
          remote: true,
          name: 'kobling-' + d.toISOString().slice(0, 10) + '_0300.tar.zst',
          time: '03:00',
          date: d.toLocaleDateString('nb-NO'),
          size: Math.round((JSON.stringify(docs).length / 1024) * 0.32) + ' kB',
          files: docs.length,
          docs
        };
      });
      this.setState(s => ({
        fetchingBk: false,
        backups: [...s.backups.filter(x => !x.remote), ...ds.filter(x => !s.backups.some(y => y.id === x.id))].sort(
          (a, c) => c.name.localeCompare(a.name)
        )
      }));
      this.toast('Fant ' + ds.length + ' backuper på //' + b.host + '/' + b.share);
    }, 900);
  };
  onBackupFile = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        let docs = JSON.parse(rd.result);
        if (docs && docs.docs) docs = docs.docs;
        if (!Array.isArray(docs) || !docs.every(d => d && d.id && Array.isArray(d.blocks))) throw 0;
        const k = {
          id: uid(),
          name: f.name,
          time: now(),
          date: new Date().toLocaleDateString('nb-NO'),
          size: Math.round(f.size / 1024) + ' kB',
          files: docs.length,
          docs,
          fromFile: true
        };
        this.setState(
          s => ({ backups: [k, ...s.backups] }),
          () => this.openRestore(k)
        );
      } catch (err) {
        this.toast('Filen er ikke en gyldig Kobling-backup');
      }
    };
    rd.readAsText(f);
  };
  restoreBackup(k) {
    this.setState(
      s => ({
        docs: clone(k.docs),
        pdfSnap: null,
        active: null,
        cur: k.docs.some(d => d.id === s.cur) ? s.cur : k.docs[0].id,
        history: [
          {
            id: uid(),
            who: 'Sebastian Kristoffersen',
            initials: 'SK',
            color: USERS.SK.color,
            what: 'Gjenopprettet ' + k.name,
            time: now(),
            snap: clone(s.docs.find(d => d.id === s.cur).blocks)
          },
          ...s.history
        ]
      }),
      () => this.compile()
    );
    this.toast('Gjenopprettet fra ' + k.name);
  }
  openCodeEdit = () => {
    const b = this.findBlock(this.state.active);
    if (!b) return;
    const lines = docCode(this.curDoc(), this.state.settings)
      .filter(l => l.bid === b.id)
      .map(l => l.s);
    this.setState({ codeEdit: { bid: b.id, text: lines.join('\n'), err: '' } });
  };
  onCodeInput = e => {
    const text = e.target.value;
    this._cdDirty = true;
    this.setState({ codeDraft: text, codeDraftFor: this.state.cur });
    clearTimeout(this._cdt);
    this._cdt = setTimeout(() => this.applyDraft(false), 600);
  };
  applyDraft(final) {
    const s = this.state,
      text = s.codeDraft;
    if (text == null || s.codeDraftFor !== s.cur) return;
    let r;
    try {
      r = parseDoc(text, this.curDoc(), s.settings);
    } catch (e) {
      this.setState({ codeErr: { line: e.line || 0, msg: e.msg || e.message || String(e) } }, () => this.schedule());
      return;
    }
    this.setDoc(
      d => ({ ...d, title: r.title, authors: r.authors, group: r.group, pre: r.pre, blocks: r.blocks }),
      final ? 'Redigerte LaTeX-koden' : null
    );
    const chg = Object.keys(r.settings).some(k => r.settings[k] !== s.settings[k]);
    this.setState(
      x => ({
        codeErr: null,
        settings: chg ? { ...x.settings, ...r.settings } : x.settings,
        ...(final ? { codeDraft: null } : {})
      }),
      () => this.schedule()
    );
  }
  onCodeBlur = () => {
    clearTimeout(this._cdt);
    if (this._cdDirty) {
      this._cdDirty = false;
      this.applyDraft(true);
    } else if (!this.state.codeErr) this.setState({ codeDraft: null });
  };
  onCodeKey = e => {
    const ta = e.target;
    if (e.key === 'Tab') {
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      this.onCodeInput({ target: ta });
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      clearTimeout(this._cdt);
      this.applyDraft(false);
    }
  };
  onCodeCaret = e => {
    if (this.state.codeDraft != null) return;
    const ta = e.target,
      ln = ta.value.slice(0, ta.selectionStart).split('\n').length - 1,
      l = docCode(this.curDoc(), this.state.settings)[ln];
    if (l && l.bid && l.bid !== this.state.active) this.focusBlock(l.bid, 'code');
  };
  applyCodeEdit = () => {
    const ce = this.state.codeEdit,
      b = ce && this.findBlock(ce.bid);
    if (!b) return this.setState({ codeEdit: null });
    try {
      const patch = parseBlock(b, ce.text);
      this.updBlock(b.id, patch, 'Redigerte LaTeX');
      this.setState({ codeEdit: null });
      this.toast('Koden er brukt i dokumentet');
    } catch (e) {
      this.setState({ codeEdit: { ...ce, err: e.message } });
    }
  };
  printPdf = () => {
    const el = this.pdfRef.current,
      doc = this.curDoc();
    if (!el) return this.toast('Åpne PDF-fanen først');
    let w;
    try {
      w = window.open('', '_blank');
    } catch (e) {}
    if (!w) return this.toast('Nettleseren blokkerte utskriftsvinduet');
    const pages = [...el.children].map(p => '<div class="pg">' + p.outerHTML + '</div>').join('');
    w.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>' +
        doc.title +
        '</title><link href="https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><style>@page{size:A4;margin:0}body{margin:0}.pg{zoom:1.804;break-after:page}.pg>div{zoom:1!important}.pg>div{box-shadow:none!important}[data-pblk]{background:transparent!important}</style></head><body>' +
        pages +
        '</body></html>'
    );
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (e) {}
    }, 900);
  };
  deleteDoc(id) {
    const s = this.state;
    if (s.docs.length < 2) return this.toast('Du må ha minst ett dokument');
    const d = s.docs.find(x => x.id === id);
    if (!window.confirm('Slette «' + d.title + '»? Det kan gjenopprettes fra backup.')) return;
    const rest = s.docs.filter(x => x.id !== id);
    this.setState({ docs: rest, cur: s.cur === id ? rest[0].id : s.cur, pdfSnap: null });
    this.toast('«' + d.title + '» er slettet');
  }
  async insertImages(files, afterId) {
    const imgs = [];
    for (const f of files) {
      try {
        imgs.push(await readImg(f));
      } catch (e) {
        this.toast('Kunne ikke lese ' + f.name);
      }
    }
    if (!imgs.length) return;
    const blocks = imgs.map(m => ({
      id: uid(),
      type: 'img',
      src: m.src,
      file: m.file,
      w: 0.8,
      span: false,
      caption: m.cap.charAt(0).toUpperCase() + m.cap.slice(1) + '.',
      label: 'fig:' + m.file.replace(/\.[^.]+$/, '') + '-' + uid().slice(0, 3)
    }));
    const bs0 = this.curDoc().blocks;
    if (afterId == null) afterId = this.state.active || (bs0.length ? bs0[bs0.length - 1].id : '__start');
    this.setBlocks(
      bs => {
        let at;
        if (afterId === '__start') at = 0;
        else {
          const i = bs.findIndex(x => x.id === afterId);
          at = i < 0 ? bs.length : i + 1;
        }
        return [...bs.slice(0, at), ...blocks, ...bs.slice(at)];
      },
      imgs.length > 1 ? 'La til ' + imgs.length + ' bilder' : 'La til bilde ' + blocks[0].file
    );
    this.activeSrc = 'editor-new';
    this.setState({ active: blocks[blocks.length - 1].id });
    this.toast(imgs.length > 1 ? imgs.length + ' bilder satt inn' : 'Bildet er satt inn som figur');
  }
  async replaceImage(bid, f) {
    try {
      const m = await readImg(f);
      this.updBlock(bid, { src: m.src, file: m.file }, 'Byttet bilde');
    } catch (e) {
      this.toast('Kunne ikke lese bildet');
    }
  }
  moveBlock(id, afterId) {
    if (id === afterId) return;
    this.setBlocks(bs => {
      const b = bs.find(x => x.id === id);
      if (!b) return bs;
      const rest = bs.filter(x => x.id !== id);
      const at = afterId === '__start' ? 0 : rest.findIndex(x => x.id === afterId) + 1;
      return [...rest.slice(0, at), b, ...rest.slice(at)];
    }, 'Flyttet blokk');
    this.activeSrc = 'editor-new';
    this.setState({ active: id });
  }
  async addToLib(files, forceName) {
    const recs = [];
    for (const f of files) {
      try {
        recs.push(await readImg(f));
      } catch (e) {
        this.toast('Kunne ikke lese ' + f.name);
      }
    }
    if (!recs.length) return;
    this.setDoc(
      d => {
        const used = new Set([
          ...(d.files || []).map(x => x.file),
          ...d.blocks.filter(b => b.type === 'img').map(b => b.file)
        ]);
        const add = recs.map((m, ri) => {
          if (forceName && ri === 0) {
            used.add(forceName);
            return { id: uid(), file: forceName, src: m.src, cap: m.cap };
          }
          let n = m.file,
            k = 2;
          while (used.has(n)) {
            n = m.file.replace(/(\.[^.]+)?$/, '-' + k + '$1');
            k++;
          }
          used.add(n);
          return { id: uid(), file: n, src: m.src, cap: m.cap };
        });
        return { ...d, files: [...(d.files || []), ...add] };
      },
      recs.length > 1 ? 'Lastet opp ' + recs.length + ' bilder' : 'Lastet opp bilder/' + recs[0].file
    );
    this.toast(
      forceName
        ? 'Lastet opp som bilder/' + forceName
        : recs.length > 1
          ? recs.length + ' bilder lastet opp til bilder/'
          : 'Lastet opp til bilder/ · dra det inn i dokumentet'
    );
    if (forceName) setTimeout(() => this.compile(), 80);
  }
  insertLib(fid, afterId) {
    const d = this.curDoc(),
      f = (d.files || []).find(x => x.id === fid);
    if (!f) return;
    const bs0 = d.blocks;
    if (afterId == null) afterId = this.state.active || (bs0.length ? bs0[bs0.length - 1].id : '__start');
    const cap = (f.cap || f.file.replace(/\.[^.]+$/, '')).replace(/[-_]+/g, ' ');
    const blk = {
      id: uid(),
      type: 'img',
      src: f.src,
      file: f.file,
      w: 0.8,
      span: false,
      caption: cap.charAt(0).toUpperCase() + cap.slice(1) + '.',
      label: 'fig:' + slug(f.file.replace(/\.[^.]+$/, ''))
    };
    this.setBlocks(bs => {
      let at;
      if (afterId === '__start') at = 0;
      else {
        const i = bs.findIndex(x => x.id === afterId);
        at = i < 0 ? bs.length : i + 1;
      }
      return [...bs.slice(0, at), blk, ...bs.slice(at)];
    }, 'Satte inn bilder/' + f.file);
    this.activeSrc = 'editor-new';
    this.setState({ active: blk.id });
  }
  sideDragOver = e => {
    const ty = [...(e.dataTransfer.types || [])];
    if (!ty.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!this.state.sideDrop) this.setState({ sideDrop: true });
  };
  sideDragLeave = e => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    this.setState({ sideDrop: false });
  };
  sideDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ sideDrop: false });
    const all = [...(e.dataTransfer.files || [])],
      files = all.filter(f => f.type.startsWith('image/'));
    if (!files.length) return this.toast(all.length ? 'Bare bildefiler kan lastes opp her' : 'Ingen filer');
    if (files.length < all.length) this.toast('Hoppet over filer som ikke er bilder');
    this.addToLib(files);
  };
  startBlkDrag(e, id) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const box = this.edRef.current;
    let moved = false,
      sx = e.clientX,
      sy = e.clientY,
      raf = null,
      lastY = sy;
    const scroll = () => {
      if (!box) return;
      const r = box.getBoundingClientRect();
      const d = lastY < r.top + 50 ? -14 : lastY > r.bottom - 50 ? 14 : 0;
      if (d) {
        box.scrollTop += d;
        raf = requestAnimationFrame(scroll);
      } else raf = null;
    };
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      if (!moved) {
        moved = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        this.setState({ dragging: id });
      }
      lastY = ev.clientY;
      if (!raf) raf = requestAnimationFrame(scroll);
      const el = document.elementFromPoint(ev.clientX, ev.clientY),
        bk = el && el.closest && el.closest('[data-blk]');
      let at = null;
      if (bk && bk.dataset.blk !== id) {
        const r = bk.getBoundingClientRect();
        at = { bid: bk.dataset.blk, after: ev.clientY > r.top + r.height / 2 };
      } else if (!bk && box && box.contains(el)) {
        const bs = this.curDoc().blocks,
          l = bs[bs.length - 1];
        if (l && l.id !== id) {
          const le = box.querySelector('[data-blk="' + l.id + '"]');
          if (le && ev.clientY > le.getBoundingClientRect().bottom) at = { bid: l.id, after: true };
        }
      }
      const c = this.state.dropAt;
      if (!c !== !at || (c && (c.bid !== at.bid || c.after !== at.after))) this.setState({ dropAt: at });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (raf) cancelAnimationFrame(raf);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const at = this.state.dropAt;
      this.setState({ dropAt: null, dragging: null });
      if (!moved || !at) return;
      const bs = this.curDoc().blocks,
        i = bs.findIndex(b => b.id === at.bid);
      let after = at.after ? at.bid : i > 0 ? bs[i - 1].id : '__start';
      if (after === id) return;
      if (!at.after && i > 0 && bs[i - 1].id === id) return;
      this.moveBlock(id, after);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  startRename(kind, id, cur) {
    this.unhover();
    this.setState({ renaming: { kind, id, val: cur, err: '' } });
  }
  commitRename() {
    const r = this.state.renaming;
    if (!r) return;
    let v = (r.val || '').trim();
    const doc = this.curDoc();
    const fail = err => this.setState(s => ({ renaming: { ...s.renaming, err } }));
    if (!v) return this.setState({ renaming: null });
    if (/[\\/:*?"<>|]/.test(v)) return fail('Ugyldige tegn: \\ / : * ? " < > |');
    const reLit = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (r.kind === 'fig') {
      const b = doc.blocks.find(x => x.id === r.id);
      if (!b) return this.setState({ renaming: null });
      const base = slug(v.replace(/\.kob$/i, ''));
      if (!base) return fail('Navnet må ha bokstaver eller tall.');
      const nl = 'fig:' + base;
      if (nl === b.label) return this.setState({ renaming: null });
      if (doc.blocks.some(x => x.label === nl)) return fail('Navnet er allerede i bruk.');
      const ol = b.label,
        rx = new RegExp('(\\\\(?:c|C)?ref\\{[^}]*?)' + reLit(ol) + '(?=[,}])', 'g');
      this.setBlocks(
        bs =>
          bs.map(x =>
            x.id === b.id
              ? { ...x, label: nl }
              : x.type === 'p'
                ? { ...x, segs: x.segs.map(sg => (sg.t === 'ref' && sg.target === ol ? { ...sg, target: nl } : sg)) }
                : x.type === 'raw'
                  ? { ...x, src: (x.src || '').replace(rx, '$1' + nl) }
                  : x
          ),
        'Ga nytt navn: figurer/' + base + '.kob'
      );
      this.setState({ renaming: null, codeDraft: null });
      return this.toast('Omdøpt til figurer/' + base + '.kob · referanser er oppdatert');
    }
    const old =
      r.kind === 'img'
        ? (doc.blocks.find(x => x.id === r.id) || {}).file
        : ((doc.files || []).find(x => x.id === r.id) || {}).file;
    if (!old) return this.setState({ renaming: null });
    const ext = (old.match(/\.[a-z0-9]+$/i) || [''])[0];
    if (!/\.[a-z0-9]+$/i.test(v)) v += ext;
    if (v === old) return this.setState({ renaming: null });
    const taken = new Set(
      [...(doc.files || []).map(x => x.file), ...doc.blocks.filter(x => x.type === 'img').map(x => x.file)].filter(
        x => x !== old
      )
    );
    if (taken.has(v)) return fail('Det finnes allerede en fil som heter ' + v + '.');
    const rx = new RegExp('(\\\\includegraphics(?:\\[[^\\]]*\\])?\\{(?:bilder/)?)' + reLit(old) + '\\}', 'g');
    this.setDoc(
      d => ({
        ...d,
        files: (d.files || []).map(x => (x.file === old ? { ...x, file: v } : x)),
        blocks: d.blocks.map(x =>
          x.type === 'img' && x.file === old
            ? { ...x, file: v }
            : x.type === 'raw'
              ? { ...x, src: (x.src || '').replace(rx, '$1' + v + '}') }
              : x
        )
      }),
      'Ga nytt navn: bilder/' + v
    );
    this.setState({ renaming: null, codeDraft: null });
    this.toast('Omdøpt til bilder/' + v);
  }
  pickImage(target) {
    this.fileTarget = target;
    const el = this.fileRef.current;
    if (el) {
      el.value = '';
      el.click();
    }
  }
  onFilePick = e => {
    const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/'));
    const tg = this.fileTarget || {};
    this.fileTarget = null;
    if (!files.length) return;
    if (tg.library) return this.addToLib(files, tg.name);
    if (tg.replace) this.replaceImage(tg.replace, files[0]);
    else this.insertImages(files, tg.after);
  };
  edDragOver = e => {
    const ty = [...(e.dataTransfer.types || [])];
    const isF = ty.includes('Files'),
      isB = ty.includes('application/x-kobling-blk') || ty.includes('application/x-kobling-file');
    if (!isF && !isB) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isF ? 'copy' : 'move';
    const el = e.target.closest && e.target.closest('[data-blk]');
    let at = null;
    if (el) {
      const r = el.getBoundingClientRect();
      at = { bid: el.dataset.blk, after: e.clientY > r.top + r.height / 2 };
    } else {
      const bs = this.curDoc().blocks;
      if (bs.length) at = { bid: bs[bs.length - 1].id, after: true };
    }
    const c = this.state.dropAt;
    if (!c || !at || c.bid !== at.bid || c.after !== at.after) this.setState({ dropAt: at });
  };
  edDragLeave = e => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (this.state.dropAt) this.setState({ dropAt: null });
  };
  edDrop = e => {
    e.preventDefault();
    const at = this.state.dropAt;
    this.setState({ dropAt: null });
    const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
    const bs = this.curDoc().blocks;
    let afterId = null;
    if (at) {
      const i = bs.findIndex(b => b.id === at.bid);
      afterId = at.after ? at.bid : i > 0 ? bs[i - 1].id : '__start';
    }
    const lf = e.dataTransfer.getData('application/x-kobling-file');
    if (lf) return this.insertLib(lf, afterId);
    if (files.length) return this.insertImages(files, afterId);
    if ([...(e.dataTransfer.files || [])].length) return this.toast('Bare bildefiler kan slippes her');
    const mv = e.dataTransfer.getData('application/x-kobling-blk');
    if (mv && at && mv !== at.bid) this.moveBlock(mv, afterId);
  };
  edPaste = e => {
    const tx = e.clipboardData && e.clipboardData.getData('text/plain');
    if (tx && isSpice(tx)) {
      e.preventDefault();
      this.openPaste(tx, 'editor');
      return;
    }
    if (tx && tx.includes('\t')) {
      const a = this.findBlock(this.state.active),
        rows = parseGrid(tx);
      if (rows.length && rows[0].length >= 2 && (rows.length >= 2 || (a && a.type === 'table'))) {
        e.preventDefault();
        if (a && a.type === 'table') this.applyGrid(a.id, rows);
        else {
          this.addBlockAfter(
            this.state.active,
            { type: 'table', style: 'grid', caption: 'Tabell.', label: 'tab:' + uid().slice(0, 4), rows },
            'Limte inn tabell fra regneark',
            false
          );
          this.toast('Lagde tabell fra regnearket');
        }
        return;
      }
    }
    if (tx && /\\begin\{circuitikz\}|\\draw[\s\S]*to\s*\[/.test(tx) && !/\\begin\{(document|figure)/.test(tx)) {
      e.preventDefault();
      this.openPaste(tx, 'editor');
      return;
    }
    const tg = (e.target.tagName || '').toLowerCase();
    if (tx && tg !== 'textarea' && tg !== 'input' && this.pasteLatex(tx, e)) return;
    const items = [...((e.clipboardData && e.clipboardData.items) || [])].filter(
      i => i.kind === 'file' && i.type.startsWith('image/')
    );
    if (!items.length) return;
    e.preventDefault();
    this.insertImages(items.map(i => i.getAsFile()).filter(Boolean), this.state.active);
  };
  // Innlimt LaTeX: et helt dokument eller flere blokker blir til blokker etter aktiv blokk;
  // en enkel linje inne i et avsnitt limes inn som tekst med enheter/symboler/referanser.
  pasteLatex(tx, e) {
    const blocky = /\\(begin\{|(sub)*section\*?\{|item\b|documentclass)|\n\s*\n/.test(tx);
    const inline = /\\(qty|SI|cref)\{|\$[^$]+\$/.test(tx);
    if (!blocky && !inline) return false;
    if (!blocky) {
      if (!(e.target && e.target.closest && e.target.closest('[data-seg]'))) return false;
      let segs;
      try {
        segs = parseInline(tx.trim());
      } catch (err) {
        return false;
      }
      e.preventDefault();
      segs.filter(sg => sg.t !== 'text' || sg.v).forEach(sg => this.insertSeg(sg, 'Limte inn LaTeX'));
      return true;
    }
    let r;
    try {
      // parseDoc leser et helt dokument; et utdrag pakkes inn i \begin{document} … \end{document}.
      const full = /\\begin\{document\}/.test(tx) ? tx : '\\begin{document}\n' + tx + '\n\\end{document}';
      r = parseDoc(full, { title: '', authors: '', group: '', blocks: [] }, this.state.settings);
    } catch (err) {
      e.preventDefault();
      this.toast(err.line ? 'Linje ' + err.line + ': ' + err.msg : err.msg || err.message);
      return true;
    }
    if (!r.blocks.length) return false;
    e.preventDefault();
    const after = this.state.active;
    this.setDoc(d => {
      const i = d.blocks.findIndex(b => b.id === after),
        at = i < 0 ? d.blocks.length : i + 1;
      return {
        ...d,
        pre: mergePre(d.pre, r.pre),
        blocks: [...d.blocks.slice(0, at), ...r.blocks, ...d.blocks.slice(at)]
      };
    }, 'Limte inn LaTeX');
    const raw = r.blocks.filter(b => b.type === 'raw').length;
    this.toast(
      'La inn ' + r.blocks.length + (r.blocks.length === 1 ? ' blokk' : ' blokker') + ' fra LaTeX' +
        (raw ? ' (' + raw + ' som LaTeX-kode)' : '')
    );
    return true;
  }
  openPaste(text, target) {
    this.setState({ paste: { text: text || '', mode: 'replace', err: '', warn: [], target: target || 'circuit' } });
  }
  applyPaste = () => {
    const p = this.state.paste;
    const r = parseCircuit(isSpice(p.text) ? spiceToTikz(p.text) : p.text);
    if (!r.data) return this.setState({ paste: { ...p, err: r.warn.join(' '), warn: [] } });
    if (p.target === 'editor') {
      const blk = this.addBlockAfter(
        this.state.active,
        { type: 'fig', caption: 'Kretsskjema.', label: 'fig:krets-' + uid().slice(0, 4), circuit: r.data },
        'Limte inn kretsskjema',
        false
      );
      this.setState({ paste: null });
      this.toast(
        'Kretsen er importert (' +
          r.count +
          ' komponenter)' +
          (r.warn.length ? ' · ' + r.warn.length + ' advarsler' : '')
      );
      return;
    }
    const c = this.state.circ;
    let data = r.data;
    if (p.mode === 'add' && c.data.comps.length) {
      const b = cbox(c.data);
      const dx = Math.ceil(b.x1) + 1;
      data = { comps: data.comps.map(k => ({ ...k, x: k.x + dx })), wires: data.wires };
      data = { comps: [...c.data.comps, ...data.comps], wires: [...c.data.wires, ...data.wires] };
    }
    this.circSet(x => ({ data: this.lay(x, data), sel: null, pending: null }));
    if (r.style && /american|european/.test(r.style) && r.style.trim() !== this.state.settings.style)
      this.toast('Importert · koden brukte ' + r.style.trim() + ' stil');
    else
      this.toast('Importert ' + r.count + ' komponenter' + (r.warn.length ? ' · ' + r.warn.length + ' advarsler' : ''));
    this.setState({ paste: r.warn.length ? { ...p, done: true, warn: r.warn, err: '' } : null });
  };
  onDocPaste = e => {
    const s = this.state;
    if (s.view !== 'circuit' || s.paste) return;
    const tg = (e.target.tagName || '').toLowerCase();
    if (tg === 'input' || tg === 'textarea' || e.target.isContentEditable) return;
    const tx = e.clipboardData && e.clipboardData.getData('text/plain');
    if (tx && (/\\(draw|node|begin\{circuitikz\})/.test(tx) || isSpice(tx))) {
      e.preventDefault();
      this.openPaste(tx);
    }
  };
  smtpOk() {
    const m = this.state.smtp;
    if (m.provider === 'proton') return !!(EMAIL_RE.test(m.user) && !PROTON_FREE.test(m.user) && m.pass);
    return !!(m.host && m.port && smtpFrom(m));
  }
  addMail(m) {
    const mail = {
      id: uid(),
      time: now(),
      date: new Date().toLocaleDateString('nb-NO'),
      status: this.smtpOk() ? 'Sendt' : 'I utboks',
      ...m
    };
    this.setState(s => ({ mails: [mail, ...s.mails].slice(0, 30) }));
    return mail;
  }
  sendDocMail = () => {
    const s = this.state,
      doc = this.curDoc(),
      to = s.sendTo.split(/[,;\s]+/).filter(Boolean);
    if (!to.length) return this.setState({ sendErr: 'Skriv inn minst én mottaker.' });
    const bad = to.find(x => !EMAIL_RE.test(x));
    if (bad) return this.setState({ sendErr: 'Ugyldig e-postadresse: ' + bad });
    const att = [];
    if (s.att.pdf) att.push(slug(doc.title) + '.pdf');
    if (s.att.tex) att.push(slug(doc.title) + '.tex');
    if (s.att.img) doc.blocks.filter(b => b.type === 'img').forEach(b => att.push(b.file));
    const m = this.addMail({
      kind: 'doc',
      to: to.join(', '),
      subject: s.sendSubj || doc.title,
      body: s.sendMsg,
      att,
      docTitle: doc.title
    });
    this.setState({ sendErr: '', sendMsg: '' });
    this.toast(m.status === 'Sendt' ? 'E-posten er sendt til ' + m.to : 'Lagt i utboksen. Sett opp SMTP for å sende.');
  };
  mailtoDoc = () => {
    const s = this.state,
      doc = this.curDoc();
    const url = this.publicBase().url + '/d/' + slug(doc.title);
    const body =
      (s.sendMsg ? s.sendMsg + '\n\n' : '') +
      'Dokumentet: ' +
      url +
      '\n\n(Legg ved ' +
      slug(doc.title) +
      '.pdf fra Fil › Skriv ut / lagre som PDF.)';
    try {
      window.open(
        'mailto:' +
          encodeURIComponent(s.sendTo) +
          '?subject=' +
          encodeURIComponent(s.sendSubj || doc.title) +
          '&body=' +
          encodeURIComponent(body),
        '_blank'
      );
    } catch (e) {}
  };
  testSmtp = () => {
    const m = this.state.smtp,
      fail = msg => this.setState(s => ({ smtpUi: { ...s.smtpUi, test: { ok: false, msg } } }));
    if (m.provider === 'proton') {
      if (!EMAIL_RE.test(m.user)) return fail('Skriv inn SMTP-brukernavnet fra Proton (adressen din).');
      if (PROTON_FREE.test(m.user))
        return fail(
          'Proton gir bare SMTP-token for adresser på eget domene. Bruk en adresse som …@kristo.no, eller velg Proton Bridge.'
        );
      if (!m.pass) return fail('Lim inn SMTP-tokenet fra Proton.');
    } else {
      if (!m.host) return fail('Fyll inn SMTP-server.');
      const f = smtpFrom(m);
      if (!EMAIL_RE.test((f.match(/<([^>]+)>/) || [])[1] || f)) return fail('Avsender må være en e-postadresse.');
    }
    this.setState(s => ({ smtpUi: { ...s.smtpUi, testing: true, test: null } }));
    setTimeout(() => {
      const to = m.user || smtpFrom(m);
      this.setState(s => ({
        smtpUi: {
          ...s.smtpUi,
          testing: false,
          test: {
            ok: true,
            msg:
              'Koblet til ' +
              m.host +
              ':' +
              m.port +
              ' med ' +
              m.sec.toUpperCase() +
              ' som ' +
              (m.user || '(ingen bruker)') +
              '. Test-e-post sendt til ' +
              to +
              '.'
          }
        }
      }));
    }, 900);
  };
  onResizeDown = e => {
    e.preventDefault();
    this.rs = { sx: e.clientX, w: this.state.rightW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  hoverFile(e, o) {
    const r = e.currentTarget.getBoundingClientRect(),
      root = this.rootRef.current ? this.rootRef.current.getBoundingClientRect() : { top: 0, height: 900 };
    this.setState({ hover: { ...o, top: Math.max(8, Math.min(r.top - root.top - 24, root.height - 360)) } });
  }
  unhover = () => {
    if (this.state.hover) this.setState({ hover: null });
  };
  duplicateDoc() {
    const d = this.curDoc();
    const n = { ...clone(d), id: uid(), title: d.title + ' (kopi)', meta: 'Kopi · opprettet nå' };
    this.setState(
      s => ({ docs: [...s.docs, n] }),
      () => this.openDoc(n.id)
    );
    this.toast('Dokumentet er duplisert');
  }
  resetDemo = () => {
    if (!window.confirm('Tilbakestille all demodata i denne nettleseren?')) return;
    try {
      localStorage.removeItem(LSK);
    } catch (e) {}
    location.reload();
  };
  renderVals() {
    const s = this.state,
      S = s.settings,
      doc = this.curDoc(),
      h = React.createElement,
      dec = S.dec;
    const themeAttr = S.theme === 'dark' || (S.theme !== 'light' && this._mq && this._mq.matches) ? 'dark' : 'light';
    const isWeb = s.platform === 'web',
      isWin = s.platform === 'win',
      MOD = s.platform === 'mac' || (isWeb && /Mac/.test(navigator.platform)) ? '⌘' : 'Ctrl+';
    const v = {
      isWeb,
      isWin,
      showBrand: isWeb || isWin,
      isMac: s.platform === 'mac',
      isProjects: s.view === 'projects',
      isEditor: s.view === 'editor',
      isCircuit: s.view === 'circuit',
      isSettings: s.view === 'settings',
      keep: e => e.preventDefault(),
      stop: e => e.stopPropagation()
    };
    v.themeAttr = themeAttr;
    {
      const st = this.urStack(this.urKind());
      v.showUR = s.view === 'editor' || s.view === 'circuit';
      v.undo = this.undo;
      v.redo = this.redo;
      v.undoOp = st.past.length ? 1 : 0.35;
      v.redoOp = st.future.length ? 1 : 0.35;
      v.undoTitle = 'Angre (' + MOD + 'Z)';
      v.redoTitle = 'Gjør om (' + (s.platform === 'mac' ? '⇧⌘Z' : 'Ctrl+Y') + ')';
    }
    v.showSide = !s.sideHidden;
    v.toggleSide = () => this.setState(x => ({ sideHidden: !x.sideHidden, hover: null }));
    v.sideTitle = (s.sideHidden ? 'Vis' : 'Skjul') + ' sidepanel (' + MOD + '\\)';
    v.sideBtnColor = s.sideHidden ? 'var(--k8d8982,#8d8982)' : 'var(--k3d3a36,#3d3a36)';
    v.sideBtnBg = 'transparent';
    v.sideFill = s.sideHidden ? '' : 'M3.5 4.25h2.75v9.5H3.5z';
    v.showDocCrumb = s.view !== 'projects';
    v.crumbRoot = doc.folder.split(' · ')[0] + ' / ' + (doc.folder.split(' · ')[1] || '');
    v.url =
      'kobling.app/' +
      (s.view === 'projects'
        ? 'prosjekter'
        : s.view === 'settings'
          ? 'innstillinger'
          : 'd/' + slug(doc.title) + (s.view === 'circuit' ? '/krets' : ''));
    v.goProjects = () => this.setState({ view: 'projects', share: false, circ: null });
    v.goSettings = () => this.setState({ view: 'settings', share: false });
    {
      const me = this.account(),
        go = tab => () => this.setState({ view: 'settings', setTab: tab, share: false, profileOpen: false });
      v.meInitials = me.name
        .split(' ')
        .map(x => x[0])
        .slice(0, 2)
        .join('');
      v.meColor = me.color || (USERS[me.id] || {}).color || ACC;
      v.meName = me.name + (me.admin ? ' · admin' : '');
      v.meEmail = me.email;
      v.meTitle = me.name + ' · Innstillinger';
      v.profileOpen = !!s.profileOpen;
      v.meRing = s.profileOpen ? '0 0 0 3px var(--koklch086006250,oklch(0.86 0.06 250))' : 'none';
      v.toggleProfile = () => this.setState(x => ({ profileOpen: !x.profileOpen }));
      v.closeProfile = () => this.setState({ profileOpen: false });
      const dk = v.themeAttr === 'dark';
      v.profileItems = [
        {
          label: 'Mørk modus',
          hint: dk ? 'På' : 'Av',
          onClick: () => {
            this.setS('theme', dk ? 'light' : 'dark');
            this.setState({ profileOpen: false });
          }
        },
        {
          label: 'Frakoblet modus',
          hint: s.net.sim ? 'På' : 'Av',
          onClick: () => {
            this.setNet({ sim: !s.net.sim });
            this.setState({ profileOpen: false });
          }
        },
        { label: 'Innstillinger', hint: MOD + ',', onClick: go(s.setTab || 'mal') },
        { label: 'Konto', hint: '', onClick: go('konto') },
        ...(me.admin ? [{ label: 'Server og backup', hint: 'Admin', onClick: go('server') }] : [])
      ];
    }
    v.goEditor = () => this.setState({ view: 'editor', circ: null });
    v.docTitle = doc.title;
    v.docAuthors = doc.group ? doc.authors + ' · ' + doc.group : doc.authors;
    v.folder = doc.folder;
    v.group = s.group;
    v.titleKey = 't' + doc.id + doc.title;
    v.authorsKey = 'a' + doc.id + doc.authors;
    v.onTitleBlur = e => {
      const x = clean(e.currentTarget.innerText);
      if (x && x !== doc.title) this.setDoc(d => ({ ...d, title: x }), 'Endret tittel');
    };
    v.onAuthorsBlur = e => {
      const x = clean(e.currentTarget.innerText).split(' · ')[0];
      if (x && x !== doc.authors) this.setDoc(d => ({ ...d, authors: x }));
    };
    v.platformOpts = [
      ['Mac', 'mac'],
      ['Windows', 'win'],
      ['Nettleser', 'web']
    ].map(([l, k]) => ({
      label: l,
      onClick: () => this.setState({ platform: k }),
      bg: s.platform === k ? 'var(--kfff,#fff)' : 'transparent',
      color: s.platform === k ? 'var(--k1f1e1c,#1f1e1c)' : 'var(--kd9d5ce,#d9d5ce)'
    }));
    const st = s.compile.status;
    const cw = s.compile.nW || 0,
      cE = s.compile.nE || 0;
    v.statusText =
      st === 'ok'
        ? `Kompilert ${s.compile.time} s` + (cw ? ' · ' + cw + (cw === 1 ? ' advarsel' : ' advarsler') : '')
        : st === 'running'
          ? 'Kompilerer …'
          : st === 'error'
            ? cE + ' feil · kompilering stoppet'
            : 'Ikke kompilert · ' + MOD + 'S';
    v.statusColor =
      st === 'ok'
        ? cw
          ? 'var(--kb26a1e,#b26a1e)'
          : 'var(--k4d8a5a,#4d8a5a)'
        : st === 'running'
          ? 'var(--koklch05501275,oklch(0.55 0.12 75))'
          : st === 'error'
            ? 'var(--kb3261e,#b3261e)'
            : 'var(--k8d8982,#8d8982)';
    v.statusBg =
      st === 'ok'
        ? cw
          ? 'var(--koklch096003075,oklch(0.96 0.03 75))'
          : 'var(--koklch096003150,oklch(0.96 0.03 150))'
        : st === 'error'
          ? 'var(--koklch09600325,oklch(0.96 0.03 25))'
          : 'var(--card,#fff)';
    v.compile = () => {
      if (st === 'error' || cw) this.setState({ right: 'log', view: 'editor' });
      this.compile();
    };
    v.avatars = s.people
      .filter(p => p.id !== 'LA')
      .slice(0, 4)
      .map(p => ({ initials: p.initials, color: p.color, name: p.name }));
    v.toggleShare = () => this.setState(x => ({ share: !x.share }));
    v.closeShare = () => this.setState({ share: false });
    v.modes = [
      ['Visuell', 'visual'],
      ['Kode', 'code'],
      ['Delt', 'split']
    ].map(([l, k]) => ({
      label: l,
      onClick: () => this.setState({ mode: k }),
      bg: s.mode === k ? 'var(--acc-g,#138a36)' : 'transparent',
      color: s.mode === k ? '#fff' : 'var(--k6b6862,#6b6862)',
      shadow: 'none'
    }));
    v.showVisual = s.mode !== 'code';
    v.showCode = s.mode !== 'visual';
    v.showDrawer = true;
    v.showSplit = () => this.setState(x => ({ mode: x.mode === 'visual' ? 'split' : 'visual' }));
    v.splitLabel = s.mode === 'visual' ? 'Vis kode ⌥⌘L' : 'Skjul kode ⌥⌘L';
    v.toast = s.toast;
    v.hasToast = !!s.toast;
    {
      const r = s.restore,
        k = r && s.backups.find(x => x.id === r.id);
      v.restoreOpen = !!k;
      v.stopClick = e => e.stopPropagation();
      v.closeRestore = () => this.setState({ restore: null });
      if (k) {
        const set = p => this.setState(x => ({ restore: { ...x.restore, ...p } })),
          n = k.docs.filter(d => r.sel[d.id]).length,
          all = n === k.docs.length,
          on = 'oklch(0.55 0.17 255)';
        v.rs = {
          name: k.name,
          meta:
            k.date +
            ' ' +
            k.time +
            ' · ' +
            k.size +
            ' · ' +
            k.files +
            ' dokumenter' +
            (k.remote ? ' · fra sharen' : k.fromFile ? ' · fra fil' : ''),
          modes: [
            ['Slå sammen', 'merge'],
            ['Erstatt alt', 'replace']
          ].map(([l, m]) => ({
            label: l,
            onClick: () => set({ mode: m }),
            bg: r.mode === m ? 'var(--kfff,#fff)' : 'transparent',
            shadow: r.mode === m ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
          })),
          modeNote:
            r.mode === 'merge'
              ? 'Valgte dokumenter erstattes med versjonen i backupen. Dokumenter som ikke finnes lenger, legges tilbake. Resten beholdes.'
              : 'Alle dokumenter på serveren erstattes med de valgte fra backupen. Dokumenter som ikke er valgt, forsvinner.',
          allLabel: all ? 'Velg ingen' : 'Velg alle',
          toggleAll: () => set({ sel: Object.fromEntries(k.docs.map(d => [d.id, !all])) }),
          docs: k.docs.map(d => {
            const ex = s.docs.find(x => x.id === d.id),
              c = !!r.sel[d.id];
            return {
              title: d.title,
              meta: (d.folder || '') + ' · ' + d.blocks.length + ' blokker',
              check: c ? '✓' : '',
              boxBg: c ? on : 'transparent',
              boxBorder: c ? on : 'var(--kcfcac2,#cfcac2)',
              tag: ex ? 'Finnes' : 'Slettet',
              tagBg: ex ? 'var(--kf3f1ed,#f3f1ed)' : 'var(--koklch096003075,oklch(0.96 0.03 75))',
              tagColor: ex ? 'var(--k6b6862,#6b6862)' : 'var(--k8a5310,#8a5310)',
              onToggle: () => set({ sel: { ...r.sel, [d.id]: !c } })
            };
          }),
          safeCheck: r.safety ? '✓' : '',
          safeBg: r.safety ? on : 'transparent',
          safeBorder: r.safety ? on : 'var(--kcfcac2,#cfcac2)',
          toggleSafety: () => set({ safety: !r.safety }),
          warn: !n
            ? 'Velg minst ett dokument.'
            : r.mode === 'replace' && !r.safety
              ? 'Nåværende dokumenter kan ikke hentes tilbake.'
              : '',
          btnLabel: r.mode === 'replace' ? 'Erstatt alt' : 'Gjenopprett ' + n,
          btnBg: n ? (r.mode === 'replace' ? 'var(--kb3261e,#b3261e)' : on) : 'var(--kcfcac2,#cfcac2)',
          btnCursor: n ? 'pointer' : 'default',
          onConfirm: () => {
            if (n) this.doRestore();
          }
        };
      } else v.rs = { modes: [], docs: [] };
    }

    const nb = numberDoc(doc.blocks);
    const cn = citeNums(doc);
    const pres = {};
    if (this._server)
      (s.remotePresence || []).forEach(p => (pres[p.bid] = pres[p.bid] || []).push({ name: p.name, color: p.color }));
    else if (this.props.simulateCollab !== false && doc.id === 'd4')
      Object.entries(s.presence).forEach(([k, bid]) => {
        if (bid) (pres[bid] = pres[bid] || []).push({ name: USERS[k].name, color: USERS[k].color });
      });
    const cm = {};
    s.comments.filter(c => c.doc === doc.id && !c.resolved).forEach(c => (cm[c.bid] = (cm[c.bid] || 0) + 1));
    const summary = b =>
      !b
        ? ''
        : b.type === 'h1' || b.type === 'h2'
          ? `${nb.num[b.id]} ${b.text}`
          : b.type === 'p'
            ? plain(b, dec).slice(0, 54) + (plain(b, dec).length > 54 ? ' …' : '')
            : b.type === 'fig' || b.type === 'img' || b.type === 'plot'
              ? `Figur ${nb.num[b.id]}: ${b.caption}`
              : b.type === 'table'
                ? `Tabell ${nb.num[b.id]}: ${b.caption}`
                : b.type === 'eq'
                  ? `Likning (${nb.num[b.id]})`
                  : 'Sammendrag';
    const texCtx0 = () => {
      const files = {};
      (doc.files || []).forEach(f => (files[f.file] = f.src));
      doc.blocks.forEach(x => {
        if (x.type === 'img') files[x.file] = x.src;
      });
      return {
        labels: texLabels(
          docCode(doc, S)
            .map(l => l.s)
            .join('\n')
        ),
        macros: texMacros(doc.pre),
        files,
        dec: S.dec,
        fig: this._server ? this._server.figCtx(doc, S) : null
      };
    };
    const edCtx = texCtx0();
    v.blocks = doc.blocks.map(b => {
      const act = s.active === b.id;
      if (b.type === 'h1') {
        edCtx.sec = parseInt(nb.num[b.id]) || edCtx.sec;
        edCtx.sub = 0;
      }
      if (b.type === 'h2') {
        edCtx.sub = parseInt(String(nb.num[b.id]).split('.')[1]) || edCtx.sub;
      }
      const vm = {
        id: b.id,
        kind: KIND[b.type],
        isActive: act,
        ring: act ? ACCB : 'transparent',
        bgc: act ? 'var(--kfff,#fff)' : 'transparent',
        num: nb.num[b.id],
        isAbstract: b.type === 'abstract',
        isH1: b.type === 'h1',
        isH2: b.type === 'h2',
        isP: b.type === 'p',
        isEq: b.type === 'eq',
        isFig: b.type === 'fig',
        isTable: b.type === 'table',
        isRaw: b.type === 'raw',
        onClick: () => {
          if (this.state.active !== b.id) {
            this.activeSrc = 'editor';
            this.setState({ active: b.id, refMenu: false });
          }
        },
        onFocus: () => {
          if (this.state.active !== b.id) {
            this.activeSrc = 'editor';
            this.setState({ active: b.id });
          }
        },
        onDelete: e => {
          e.stopPropagation();
          this.deleteBlock(b.id);
        },
        presence: pres[b.id] || [],
        hasPresence: !!pres[b.id],
        presColor: pres[b.id] ? pres[b.id][0].color : 'transparent',
        hasComments: !!cm[b.id],
        commentCount: cm[b.id] || 0,
        onComments: e => {
          e.stopPropagation();
          this.setState({ right: 'comments', active: b.id });
        }
      };
      if (b.type === 'h1' || b.type === 'h2' || b.type === 'abstract') {
        vm.text = b.text || '\u200B';
        vm.rk = b.id + ':' + b.text;
        vm.segKey = b.id + ':0';
        vm.showPh = !b.text && !act;
        vm.onTextBlur = e => this.saveField(b.id, 'text', e.currentTarget.innerText);
        vm.onTextKey = e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.saveField(b.id, 'text', e.currentTarget.innerText);
            this.addBlockAfter(b.id, { type: 'p', segs: [t('')] });
          }
        };
      }
      if (b.type === 'p') {
        vm.segs = b.segs.map((sg, i) => {
          const key = b.id + ':' + i;
          if (sg.t === 'text')
            return {
              isText: true,
              key,
              rk: key + ':' + sg.v,
              v: sg.v || '\u200B',
              onBlur: e => this.saveSeg(b.id, i, e.currentTarget.innerText),
              onKey: e => this.paraKey(e, b, i)
            };
          if (sg.t === 'unit')
            return {
              isUnit: true,
              key,
              label: qtyText(sg, dec),
              code: qtyCode(sg) + ' · klikk for å endre',
              onClick: e => {
                e.stopPropagation();
                this.openPicker('qty', { bid: b.id, si: i });
              }
            };
          if (sg.t === 'sym')
            return {
              isSym: true,
              key,
              base: sg.base,
              sub: sg.sub,
              code: symCode(sg) + ' · klikk for å endre',
              onClick: e => {
                e.stopPropagation();
                this.openPicker('sym', { bid: b.id, si: i });
              }
            };
          if (sg.t === 'cite') {
            const n = cn[sg.key];
            return {
              isRef: true,
              key,
              label: n ? '[' + n + ']' : '[?]',
              code: '\\cite{' + sg.key + '} · klikk for kilder',
              color: n ? 'var(--k3d3a36,#3d3a36)' : 'var(--kb3261e,#b3261e)',
              onClick: e => {
                e.stopPropagation();
                this.setState({ right: 'bib' });
              }
            };
          }
          const L = nb.labels[sg.target];
          return {
            isRef: true,
            key,
            label: nb.refText(sg.target),
            code: `\\cref{${sg.target}} · klikk for å gå dit`,
            color: L ? 'var(--k3d3a36,#3d3a36)' : 'var(--kb3261e,#b3261e)',
            onClick: e => {
              e.stopPropagation();
              if (L) this.focusBlock(L.id, 'ref');
            }
          };
        });
        vm.showPh = b.segs.every(x => x.t === 'text' && !x.v) && !act;
      }
      if (b.type === 'raw') {
        vm.isRaw = true;
        const em = (b.src || '').match(/^\s*\\begin\{([^}]+)\}/);
        vm.rawEnv = em ? em[1] : 'LaTeX';
        vm.rawEl = React.createElement('div', { dangerouslySetInnerHTML: { __html: rawHtml(b.src, edCtx) } });
        vm.rawSrc = b.src;
        vm.rawRows = Math.min(16, (b.src || '').split('\n').length + 1);
        vm.onRaw = e => this.updBlock(b.id, { src: e.target.value });
      }
      if (b.type === 'eq') {
        vm.eqEl = this.texEl(b.src, true);
        vm.src = b.src;
        vm.label = b.label;
        vm.onSrc = e => this.updBlock(b.id, { src: e.target.value });
      }
      if (b.type === 'fig') {
        vm.hasCircuit = b.circuit.comps.length > 0;
        vm.noCircuit = !vm.hasCircuit;
        vm.svg = vm.hasCircuit ? drawCircuit(b.circuit, { style: S.style, dec, k: 1, maxH: 300 }) : null;
        vm.label = b.label;
        vm.onEditCircuit = e => {
          e.stopPropagation();
          this.openCircuit(b.id);
        };
      }
      vm.dropTop = !!s.dropAt && s.dropAt.bid === b.id && !s.dropAt.after;
      vm.dropBottom = !!s.dropAt && s.dropAt.bid === b.id && s.dropAt.after;
      vm.onDragStart = e => {
        e.dataTransfer.setData('application/x-kobling-blk', b.id);
        e.dataTransfer.effectAllowed = 'move';
      };
      vm.onHandleDown = e => this.startBlkDrag(e, b.id);
      vm.op = s.dragging === b.id ? 0.4 : 1;
      if (b.type === 'fig' || b.type === 'img') {
        vm.canSpan = S.cols === 2;
        vm.spanLabel = b.span ? '✓ Over begge spalter' : 'Over begge spalter';
        vm.spanBg = b.span ? ACCL : 'var(--kf3f1ed,#f3f1ed)';
        vm.spanColor = b.span ? 'var(--koklch042015250,oklch(0.42 0.15 250))' : 'var(--k3d3a36,#3d3a36)';
        vm.onSpan = e => {
          e.stopPropagation();
          this.updBlock(b.id, { span: !b.span }, b.span ? 'Figur i én spalte' : 'Figur over begge spalter');
        };
      }
      if (b.type === 'img') {
        vm.isImg = true;
        vm.src = b.src;
        vm.file = 'bilder/' + b.file;
        vm.label = b.label;
        vm.wPct = Math.round((b.w || 0.8) * 100) + '%';
        vm.widths = [0.25, 0.5, 0.75, 1].map(w => ({
          label: Math.round(w * 100) + ' %',
          onClick: e => {
            e.stopPropagation();
            this.updBlock(b.id, { w }, 'Endret bildebredde');
          },
          bg: (b.w || 0.8) === w ? 'var(--kfff,#fff)' : 'transparent',
          shadow: (b.w || 0.8) === w ? '0 1px 2px rgba(0,0,0,.12)' : 'none'
        }));
        vm.onReplace = e => {
          e.stopPropagation();
          this.pickImage({ replace: b.id });
        };
      }
      if (b.type === 'fig' || b.type === 'table' || b.type === 'img' || b.type === 'plot') {
        vm.caption = b.caption || '\u200B';
        vm.rk = b.id + ':c:' + b.caption;
        vm.onCapBlur = e => this.saveField(b.id, 'caption', e.currentTarget.innerText);
      }
      if (b.type === 'table') {
        vm.rows = b.rows.map((r, ri) => ({
          bg: ri === 0 ? 'var(--kf6f4f0,#f6f4f0)' : 'var(--kfff,#fff)',
          fw: ri === 0 ? 600 : 400,
          cells: r.map((c, ci) => ({
            v: c || '\u200B',
            rk: `${b.id}:${ri}:${ci}:${c}`,
            onBlur: e => this.saveCell(b.id, ri, ci, e.currentTarget.innerText)
          }))
        }));
        vm.onAddRow = e => {
          e.stopPropagation();
          this.updBlock(b.id, x => ({ rows: [...x.rows, x.rows[0].map(() => '')] }), 'La til tabellrad');
        };
        const nc = Math.max(1, ...b.rows.map(r => r.length));
        vm.gridCols = 'repeat(' + nc + ',minmax(0,1fr))';
        vm.onAddCol = e => {
          e.stopPropagation();
          this.updBlock(
            b.id,
            x => ({ rows: x.rows.map((r, i) => [...r, i === 0 ? 'Kolonne ' + (r.length + 1) : '']) }),
            'La til kolonne'
          );
        };
        vm.onDelCol = e => {
          e.stopPropagation();
          if (nc < 2) return;
          this.updBlock(b.id, x => ({ rows: x.rows.map(r => r.slice(0, nc - 1)) }), 'Fjernet kolonne');
        };
        vm.onPasteXls = e => {
          e.stopPropagation();
          this.setState({ xls: { bid: b.id, text: '', err: '' } });
        };
      }
      if (b.type === 'table') {
        const st = b.style || 'grid';
        vm.isListStyle = st === 'list';
        vm.notList = st !== 'list';
        vm.styleOpts = [
          ['Rutenett', 'grid'],
          ['Booktabs', 'booktabs'],
          ['Enkel', 'plain'],
          ['Punktliste', 'list']
        ].map(([l, k]) => ({
          label: l,
          onClick: e => {
            e.stopPropagation();
            this.updBlock(b.id, { style: k }, 'Tabellstil: ' + l);
          },
          bg: st === k ? 'var(--kfff,#fff)' : 'transparent',
          shadow: st === k ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
          fw: st === k ? 600 : 400
        }));
        vm.listRows = b.rows.slice(1).map((r, ri0) => {
          const ri = ri0 + 1,
            cell = ci => ({
              v: r[ci] || '',
              rk: b.id + ':' + ri + ':' + ci + ':' + r[ci],
              onBlur: e => this.saveCell(b.id, ri, ci, e.currentTarget.innerText)
            });
          return {
            a: cell(0),
            b: cell(1),
            c: cell(2),
            hasC: !!(r[2] || '').trim() || s.active === b.id,
            onDel: e => {
              e.stopPropagation();
              this.updBlock(b.id, x => ({ rows: x.rows.filter((_, i) => i !== ri) }), 'Fjernet punkt');
            }
          };
        });
        vm.addLabel = st === 'list' ? '+ punkt' : '+ rad';
      }
      if (b.type === 'plot') {
        vm.isPlot = true;
        vm.svg = plotSvg(b, { w: 520, h: b.kind === 'bode' ? 190 : 260, max: 560 });
        vm.label = b.label;
        vm.onEditPlot = e => {
          e.stopPropagation();
          this.openPlot(b);
        };
      }
      return vm;
    });
    const last = doc.blocks[doc.blocks.length - 1];
    v.addParaEnd = () => {
      if (last && last.type === 'p' && last.segs.every(x => x.t === 'text' && !x.v)) {
        this.pendingFocus = { sel: `[data-seg="${last.id}:0"]`, end: true };
        this.setState({ active: last.id });
        return;
      }
      this.addBlockAfter(last ? last.id : null, { type: 'p', segs: [t('')] });
    };
    const after = s.active || (last && last.id);
    v.insertBtns = [
      {
        label: '§ Seksjon',
        title: 'Ny seksjon (\\section)',
        onClick: () => this.addBlockAfter(after, { type: 'h1', text: '' }, 'La til overskrift')
      },
      {
        label: '§ Underseksjon',
        title: 'Ny underseksjon',
        onClick: () => this.addBlockAfter(after, { type: 'h2', text: '' }, 'La til underoverskrift')
      },
      {
        label: '¶ Avsnitt',
        title: 'Nytt avsnitt',
        onClick: () => this.addBlockAfter(after, { type: 'p', segs: [t('')] })
      },
      { label: 'Ω Enhet', sep: 1, title: 'Verdi med enhet (⌘E)', onClick: () => this.openPicker('qty'), accent: 1 },
      { label: 'α Symbol', title: 'Størrelse eller gresk bokstav', onClick: () => this.openPicker('sym') },
      {
        label: '∑ Likning',
        title: 'Nummerert likning',
        onClick: () =>
          this.addBlockAfter(
            after,
            { type: 'eq', src: 'v = R \\cdot i', label: 'eq:' + uid().slice(0, 4) },
            'La til likning',
            false
          )
      },
      { label: '√ Formel', title: 'Formelpalett med søk', onClick: () => this.openPicker('math') },
      {
        label: '⏚ Krets',
        sep: 1,
        title: 'Nytt kretsskjema',
        onClick: () => {
          const blk = this.addBlockAfter(
            after,
            {
              type: 'fig',
              caption: 'Kretsskjema.',
              label: 'fig:krets-' + uid().slice(0, 4),
              circuit: { comps: [], wires: [] }
            },
            'La til kretsskjema',
            false
          );
          this.openCircuit(blk.id, blk);
        }
      },
      {
        label: '▣ Bilde',
        title: 'Sett inn bilde (eller dra en bildefil inn i dokumentet)',
        onClick: () => this.pickImage({ after })
      },
      {
        label: '▦ Tabell',
        title: 'Tabell eller punktliste',
        onClick: () =>
          this.addBlockAfter(
            after,
            {
              type: 'table',
              style: S.tableStyle || 'grid',
              caption: 'Tabell.',
              label: 'tab:' + uid().slice(0, 4),
              rows: [
                ['Kolonne 1', 'Kolonne 2', 'Kolonne 3'],
                ['', '', '']
              ]
            },
            'La til tabell',
            false
          )
      },
      { label: '∿ Graf', title: 'Graf eller Bode-diagram fra CSV', onClick: () => this.openPlot(null) },
      {
        label: '{ } LaTeX',
        title: 'Fri LaTeX-kode (skrives ut uendret)',
        onClick: () => this.addBlockAfter(after, { type: 'raw', src: '' }, 'La til LaTeX-blokk', false)
      },
      {
        label: '↗ Referanse ▾',
        sep: 1,
        title: 'Kryssreferanse (\\cref)',
        onClick: () => this.setState(x => ({ refMenu: !x.refMenu }))
      },
      { label: '[1] Kilde', title: 'Kildehenvisning (\\cite)', onClick: () => this.setState({ right: 'bib' }) },
      {
        label: '⌕ Søk',
        sep: 1,
        title: 'Søk og erstatt (⌘F)',
        onClick: () => this.setState(x => ({ find: x.find ? null : { q: '', r: '', all: false, cs: false } }))
      }
    ].map(x => ({
      ...x,
      sep: !!x.sep,
      bg: x.accent ? ACCL : 'var(--kfff,#fff)',
      border: x.accent ? ACCB : 'var(--ke2dfd9,#e2dfd9)',
      color: x.accent ? 'var(--koklch042015250,oklch(0.42 0.15 250))' : 'var(--k2f2d2a,#2f2d2a)',
      fw: x.accent ? 600 : 500
    }));
    v.refMenuOpen = s.refMenu;
    v.closeRefMenu = () => {
      if (this.state.refMenu) this.setState({ refMenu: false });
    };
    v.refItems = Object.entries(nb.labels).map(([lab, x]) => ({
      label: x.k === 'likning' ? `Likning (${x.n})` : `${x.k[0].toUpperCase() + x.k.slice(1)} ${x.n}`,
      code: lab,
      onClick: () => {
        this.setState({ refMenu: false });
        this.insertSeg(rf(lab), 'Satt inn referanse');
      }
    }));
    v.noRefs = !v.refItems.length;

    const code = docCode(doc, S);
    const draft = s.codeDraft != null && s.codeDraftFor === s.cur ? s.codeDraft : null,
      cErr = draft != null ? s.codeErr : null;
    const srcText = draft != null ? draft : code.map(l => l.s).join('\n');
    if (this._lk !== srcText) {
      this._lk = srcText;
      this._lint = lintTex(srcText, this.fileSet(doc));
    }
    const dm = {};
    this._lint.forEach(d => {
      if (!dm[d.line] || (d.sev === 'error' && dm[d.line].sev !== 'error')) dm[d.line] = d;
    });
    v.codeLines = (draft != null ? draft.split('\n').map(x => ({ s: x, bid: null })) : code).map((l, i) => {
      const d = dm[i + 1],
        er = d && d.sev === 'error';
      return {
        n: i + 1,
        parts: tok(l.s),
        numColor: d ? (er ? 'var(--kb3261e,#b3261e)' : 'var(--kb26a1e,#b26a1e)') : 'var(--kb5b0a8,#b5b0a8)',
        numW: d ? 700 : 400,
        hasMsg: !!d,
        msg: d ? (er ? '✕ ' : '▲ ') + d.msg : '',
        msgColor: er ? 'var(--kb3261e,#b3261e)' : 'var(--k9a5f14,#9a5f14)',
        bg:
          cErr && cErr.line === i + 1
            ? 'var(--koklch09500425,oklch(0.95 0.04 25))'
            : d
              ? er
                ? 'var(--koklch097002525,oklch(0.97 0.025 25))'
                : 'var(--koklch097500380,oklch(0.975 0.03 80))'
              : l.bid && l.bid === s.active
                ? HL
                : 'transparent'
      };
    });
    {
      const nE = this._lint.filter(d => d.sev === 'error').length,
        nW = this._lint.length - nE;
      v.lintSummary =
        nE || nW
          ? [nE ? nE + ' feil' : '', nW ? nW + (nW === 1 ? ' advarsel' : ' advarsler') : ''].filter(Boolean).join(' · ')
          : '';
      v.lintColor = nE ? 'var(--kb3261e,#b3261e)' : 'var(--kb26a1e,#b26a1e)';
      v.openLogFromCode = () => this.setState({ right: 'log' });
    }
    v.codeRef = this.codeRef;
    v.codeText = draft != null ? draft : code.map(l => l.s).join('\n');
    v.onCodeInput = this.onCodeInput;
    v.onCodeBlur = this.onCodeBlur;
    v.onCodeKey = this.onCodeKey;
    v.onCodeCaret = this.onCodeCaret;
    v.hasCodeErr = !!cErr;
    v.codeErrText = cErr
      ? 'Linje ' + cErr.line + ': ' + cErr.msg + ' Visuell editor og PDF viser siste gyldige versjon.'
      : '';
    v.codeStatus = draft == null ? '' : cErr ? 'Ikke synkronisert' : 'Synkronisert';
    v.codeStatusColor = cErr ? 'var(--kb3261e,#b3261e)' : 'var(--koklch05013150,oklch(0.5 0.13 150))';
    v.copyCode = () => {
      try {
        navigator.clipboard.writeText(v.codeText);
      } catch (e) {}
      this.setState({ codeCopied: true });
      setTimeout(() => this.setState({ codeCopied: false }), 1500);
    };
    v.copyCodeLabel = s.codeCopied ? 'Kopiert' : 'Kopier alt';
    const ab = doc.blocks.find(b => b.id === s.active);
    const al = ab
      ? code
          .filter(l => l.bid === ab.id)
          .map(l => l.s.trim())
          .filter(Boolean)
          .join('  ')
      : 'Velg en blokk for å se LaTeX-koden bak den.';
    v.drawerParts = tok(al.length > 220 ? al.slice(0, 220) + ' …' : al);
    const ce = s.codeEdit;
    v.canEditCode = !!ab && !ce;
    v.openCodeEdit = this.openCodeEdit;
    v.codeEditOpen = !!ce;
    v.codeEditText = ce ? ce.text : '';
    v.codeEditRows = ce ? Math.min(14, ce.text.split('\n').length + 1) : 3;
    v.onCodeEdit = e => this.setState({ codeEdit: { ...this.state.codeEdit, text: e.target.value, err: '' } });
    v.cancelCodeEdit = () => this.setState({ codeEdit: null });
    v.applyCodeEdit = this.applyCodeEdit;
    const ceB = ce && doc.blocks.find(x => x.id === ce.bid);
    v.codeEditMsg =
      ce && ce.err
        ? ce.err
        : ceB && ceB.type === 'fig'
          ? 'Caption og label kan endres her. Selve kretsen endres i kretseditoren.'
          : 'Endringene tolkes tilbake til den visuelle editoren.';
    v.codeEditMsgColor = ce && ce.err ? 'var(--kb3261e,#b3261e)' : 'var(--k6b6862,#6b6862)';

    v.outline = doc.blocks
      .filter(b => b.type === 'h1' || b.type === 'h2' || b.type === 'abstract')
      .map(b => ({
        label: b.type === 'abstract' ? 'Sammendrag' : `${nb.num[b.id]} ${b.text || 'Uten tittel'}`,
        pad: b.type === 'h2' ? 24 : 8,
        bg: s.active === b.id ? 'var(--acc-g-tint,#e2f3e7)' : 'transparent',
        color:
          s.active === b.id
            ? 'var(--acc-g-ink,#0f6e2b)'
            : b.type === 'h2'
              ? 'var(--k7a766f,#7a766f)'
              : 'var(--k4a4742,#4a4742)',
        fw: s.active === b.id ? 600 : 400,
        onClick: () => this.focusBlock(b.id, 'outline')
      }));
    const rn = s.renaming,
      rnVm = (kind, id, dir, cur) => {
        const ed = !!rn && rn.kind === kind && rn.id === id;
        return {
          isEditing: ed,
          notEditing: !ed,
          dir,
          val: ed ? rn.val : cur,
          err: ed ? rn.err : '',
          hasErr: ed && !!rn.err,
          stop: e => e.stopPropagation(),
          onRename: e => {
            if (e) {
              e.stopPropagation();
              e.preventDefault();
            }
            this.startRename(kind, id, cur);
          },
          onVal: e => this.setState(x => ({ renaming: { ...x.renaming, val: e.target.value, err: '' } })),
          onKey: e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              this.commitRename();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              this.setState({ renaming: null });
            }
          },
          onCommit: () => this.commitRename(),
          onSelectBase: e => {
            const el = e.target,
              dot = el.value.lastIndexOf('.');
            try {
              el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
            } catch (x) {}
          }
        };
      };
    v.figFiles = doc.blocks
      .filter(b => b.type === 'fig')
      .map(b => ({
        ...rnVm('fig', b.id, 'figurer/', b.label.replace('fig:', '') + '.kob'),
        label: 'figurer/' + b.label.replace('fig:', '') + '.kob',
        onClick: () => {
          this.unhover();
          this.openCircuit(b.id);
        },
        onEnter: e => this.hoverFile(e, { kind: 'fig', bid: b.id }),
        onLeave: this.unhover
      }));
    v.figFiles = v.figFiles.concat(
      doc.blocks
        .filter(b => b.type === 'img')
        .map(b => ({
          ...rnVm('img', b.id, 'bilder/', b.file),
          label: 'bilder/' + b.file,
          onClick: () => {
            this.unhover();
            this.focusBlock(b.id, 'outline');
          },
          onEnter: e => this.hoverFile(e, { kind: 'img', bid: b.id }),
          onLeave: this.unhover
        }))
    );
    const usedImg = new Set(doc.blocks.filter(b => b.type === 'img').map(b => b.file)),
      usedRaw = new Set();
    // Bilder brukt med \includegraphics{bilder/…} i LaTeX-blokker står i listen uten «ikke i bruk».
    doc.blocks
      .filter(b => b.type === 'raw')
      .forEach(b => (b.src || '').replace(/\\includegraphics(?:\[[^\]]*\])?\{bilder\/([^}]+)\}/g, (_, f) => usedRaw.add(f)));
    v.libFiles = (doc.files || [])
      .filter(f => !usedImg.has(f.file))
      .map(f => ({
        unused: !usedRaw.has(f.file),
        ...rnVm('lib', f.id, 'bilder/', f.file),
        label: 'bilder/' + f.file,
        onClick: () => {
          this.unhover();
          this.insertLib(f.id);
        },
        onDragStart: e => {
          this.unhover();
          e.dataTransfer.setData('application/x-kobling-file', f.id);
          e.dataTransfer.effectAllowed = 'copy';
        },
        onEnter: e => this.hoverFile(e, { kind: 'lib', fid: f.id }),
        onLeave: this.unhover
      }));
    v.sideOutline = s.sideDrop ? '2px dashed ' + ACC : 'none';
    v.sideBg = s.sideDrop ? ACCL : 'transparent';
    v.sideDash = s.sideDrop ? ACC : 'var(--kcfcac2,#cfcac2)';
    v.sideHintColor = s.sideDrop ? 'var(--koklch042015250,oklch(0.42 0.15 250))' : 'var(--k8d8982,#8d8982)';
    v.sideHint = s.sideDrop ? 'Slipp for å laste opp til bilder/' : 'Slipp bilder her, eller klikk for å laste opp';
    v.sideDragOver = this.sideDragOver;
    v.sideDragLeave = this.sideDragLeave;
    v.sideDrop = this.sideDrop;
    v.uploadToLib = () => this.pickImage({ library: true });
    v.mainEnter = e => this.hoverFile(e, { kind: 'tex' });
    v.mainLeave = this.unhover;

    const pdoc = s.pdfSnap && s.pdfSnap.id === doc.id ? s.pdfSnap : doc;
    const pn = numberDoc(pdoc.blocks);
    const pages = paginate(pdoc.blocks, S.cols, dec);
    const refs = new Set();
    doc.blocks.forEach(b => b.type === 'p' && b.segs.forEach(x => x.t === 'ref' && refs.add(x.target)));
    const unref = doc.blocks.filter(
      b => (b.type === 'fig' || b.type === 'img' || b.type === 'table' || b.type === 'plot') && !refs.has(b.label)
    );
    const badRe = /(^|[\s(])\d+(?:[.,]\d+)?\s?[kmMµnpG]?(?:V|A|Ω|F|H|W|Hz)(?=$|[\s.,;:)])|(^|\s)U(?=$|[\s.,=])/;
    const badP = doc.blocks.filter(b => b.type === 'p' && b.segs.some(x => x.t === 'text' && badRe.test(x.v)));
    v.checks = [
      { label: 'Tospalte', ok: S.cols === 2, val: S.cols === 2 ? 'OK' : 'Én spalte' },
      { label: 'Sider', ok: pages.length <= S.maxPages, val: `${pages.length} av ${S.maxPages}` },
      {
        label: 'Figurer og tabeller referert',
        ok: !unref.length,
        val: unref.length ? `${unref.length} mangler` : 'OK',
        go: unref[0]
      },
      ...(S.warn
        ? [
            {
              label: 'Notasjon (\\qty, v)',
              ok: !badP.length,
              val: badP.length ? `${badP.length} avvik` : 'OK',
              go: badP[0]
            }
          ]
        : [])
    ].map(c => ({
      ...c,
      color: c.ok ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--kb26a1e,#b26a1e)',
      cursor: c.go ? 'pointer' : 'default',
      onClick: () => c.go && this.focusBlock(c.go.id, 'outline')
    }));
    v.pagePct = Math.min(100, Math.round((pages.length / Math.max(1, S.maxPages)) * 100)) + '%';
    v.pageBarColor = pages.length > S.maxPages ? 'var(--kb3261e,#b3261e)' : 'oklch(0.62 0.14 150)';
    v.indent = S.indent ? '1.2em' : '0';
    const pcn = citeNums(pdoc);
    const pdCtx = texCtx0();
    v.pages = pages.map((pg, pi) => ({
      outerH: pg.over ? 'auto' : '622px',
      hCss: pg.over ? 'auto' : (pi === 0 ? 470 : 548) + 'px',
      n: pi + 1,
      isFirst: pi === 0,
      title: pdoc.title,
      authors: pdoc.authors,
      group: pdoc.group,
      cols: S.cols,
      h: pi === 0 ? 470 : 548,
      blocks: pg.map(b => {
        const vm = {
          id: b.id,
          num: pn.num[b.id],
          isAbstract: b.type === 'abstract',
          isH1: b.type === 'h1',
          isH2: b.type === 'h2',
          isP: b.type === 'p',
          isEq: b.type === 'eq',
          isFig: b.type === 'fig',
          isTable: b.type === 'table',
          text: b.text,
          caption: b.caption,
          isImg: b.type === 'img',
          src: b.src,
          wPct: Math.round((b.w || 0.8) * 100) + '%',
          span: b.span && S.cols === 2 ? 'all' : 'none',
          bg: s.active === b.id ? HL : 'transparent',
          onClick: () => this.focusBlock(b.id, 'pdf')
        };
        if (b.type === 'p')
          vm.segs = b.segs.map(x =>
            x.t === 'text'
              ? { isText: true, v: x.v }
              : x.t === 'unit'
                ? { isUnit: true, label: qtyText(x, dec) }
                : x.t === 'sym'
                  ? { isSym: true, base: x.base, sub: x.sub }
                  : x.t === 'cite'
                    ? { isRef: true, label: '[' + (pcn[x.key] || '?') + ']' }
                    : { isRef: true, label: pn.refText(x.target) }
          );
        if (b.type === 'eq') vm.eqEl = this.texEl(b.src, false);
        if (b.type === 'raw') {
          vm.isRaw = true;
          vm.rawEl = React.createElement('div', { dangerouslySetInnerHTML: { __html: rawHtml(b.src, pdCtx) } });
        }
        if (b.type === 'h1') {
          pdCtx.sec = parseInt(pn.num[b.id]) || pdCtx.sec;
          pdCtx.sub = 0;
        }
        if (b.type === 'h2') {
          pdCtx.sub = parseInt(String(pn.num[b.id]).split('.')[1]) || pdCtx.sub;
        }
        if (b.type === 'fig')
          vm.svg = b.circuit.comps.length ? drawCircuit(b.circuit, { style: S.style, dec, k: 0.42, maxH: 110 }) : null;
        if (b.type === 'plot') {
          vm.isFig = true;
          vm.svg = plotSvg(b, { w: 420, h: b.kind === 'bode' ? 170 : 230, max: S.cols === 2 ? 200 : 340 });
        }
        if (b.type === 'table') {
          const st = b.style || 'grid';
          vm.isTable = st !== 'list';
          vm.isTList = st === 'list';
          vm.items = b.rows
            .slice(1)
            .map(r => ({ t: listItem(r, false) }))
            .filter(x => x.t);
          vm.tOuter = st === 'grid' ? '0.6px solid var(--k111,#111)' : 'none';
          vm.tTop = st === 'booktabs' ? '1px solid var(--k111,#111)' : vm.tOuter;
          vm.tBot = vm.tTop;
          vm.tCell = st === 'grid' ? '0.6px solid var(--k111,#111)' : 'none';
          vm.rows = b.rows.map((r, ri) => ({
            rule:
              st === 'grid'
                ? ri === 0
                  ? '1.2px double var(--k111,#111)'
                  : '0.6px solid var(--k111,#111)'
                : st === 'booktabs' && ri === 0
                  ? '0.5px solid var(--k111,#111)'
                  : 'none',
            fw: ri === 0 && st !== 'grid' ? 600 : 400,
            cells: r.map(c => ({ v: c }))
          }));
          vm.gridCols = 'repeat(' + Math.max(1, ...b.rows.map(r => r.length)) + ',minmax(0,1fr))';
        }
        return vm;
      })
    }));
    {
      const bl = bibList(pdoc);
      if (bl.length && v.pages.length)
        v.pages[v.pages.length - 1].blocks.push(
          { id: 'bib-h', isH1: true, num: '', text: 'Referanser' },
          { id: 'bib-l', isTList: true, items: bl.map(x => ({ t: '[' + x.n + '] ' + x.txt })) }
        );
    }
    v.pageInfo = `main.pdf · ${pages.length} ${pages.length === 1 ? 'side' : 'sider'}`;
    v.downloadTex = () => {
      download(slug(doc.title) + '.tex', code.map(l => l.s).join('\n'), 'application/x-tex');
      this.toast(slug(doc.title) + '.tex lastet ned');
    };
    v.printPdf = this.printPdf;

    const openC = s.comments.filter(c => c.doc === doc.id && !c.resolved).length,
      resC = s.comments.filter(c => c.doc === doc.id && c.resolved).length;
    const meA = this.account().admin,
      histOk = meA || S.histOthers !== false,
      RT = !histOk && s.right === 'history' ? 'pdf' : s.right;
    v.rightTabs = [
      ['PDF', 'pdf'],
      [`Kommentarer ${openC || ''}`, 'comments'],
      ...(histOk ? [['Historikk', 'history']] : []),
      ['Kilder', 'bib'],
      ['Sjekk', 'check'],
      [`Logg ${s.compile.nE || ''}`, 'log']
    ].map(([l, k]) => ({
      label: l.trim(),
      k,
      onClick: () => this.setState({ right: k }),
      bg: RT === k ? 'var(--kfff,#fff)' : 'transparent',
      fw: RT === k ? 600 : 400,
      color: RT === k ? 'var(--k1f1e1c,#1f1e1c)' : 'var(--k6b6862,#6b6862)'
    }));
    v.isPdfTab = RT === 'pdf';
    v.isCommentsTab = RT === 'comments';
    v.isHistoryTab = RT === 'history';
    v.isLogTab = RT === 'log';
    v.isBibTab = RT === 'bib';
    v.isCheckTab = RT === 'check';
    {
      const C = s.compile,
        lg = C.log || [];
      v.logHead =
        C.status === 'error'
          ? 'Kompileringen stoppet · ' + C.nE + ' feil'
          : C.status === 'running'
            ? 'Kompilerer …'
            : C.log
              ? 'Kompilert uten feil'
              : 'Ikke kompilert ennå';
      v.logHeadColor =
        C.status === 'error'
          ? 'var(--kb3261e,#b3261e)'
          : C.log && C.status !== 'running'
            ? 'var(--k4d8a5a,#4d8a5a)'
            : 'var(--k3d3a36,#3d3a36)';
      v.logSub = C.log
        ? C.status === 'error'
          ? 'PDF-en viser forrige vellykkede versjon. Rett feilene og kompiler på nytt.'
          : C.nW
            ? C.nW + (C.nW === 1 ? ' advarsel' : ' advarsler') + ' · PDF-en er oppdatert'
            : 'main.tex · ' + S.engine + ' · ' + C.time + ' s'
        : 'Trykk ' + MOD + 'S for å kompilere.';
      v.logItems = lg.map(d => ({
        line: d.line,
        msg: d.msg,
        hint: d.hint,
        hasHint: !!d.hint,
        code: 'l.' + d.line + '  ' + (d.code || ''),
        badge: d.sev === 'error' ? 'Feil' : 'Advarsel',
        badgeBg:
          d.sev === 'error' ? 'var(--koklch09300525,oklch(0.93 0.05 25))' : 'var(--koklch09400675,oklch(0.94 0.06 75))',
        badgeColor: d.sev === 'error' ? 'var(--kb3261e,#b3261e)' : 'var(--k8a5310,#8a5310)',
        onClick: () => this.goToLine(d.line),
        hasFix: !!d.fix,
        fixLabel: d.fix ? d.fix.label : '',
        onFix: e => {
          e.stopPropagation();
          this.applyFix(d);
        }
      }));
      v.logEmpty = !!C.log && !lg.length && C.status !== 'running';
      v.logRecompile = this.compile;
      v.pdfFailed = C.status === 'error';
      v.pdfFailText = 'Kompileringen stoppet på ' + C.nE + ' feil. Viser forrige vellykkede versjon.';
      v.openLog = () => this.setState({ right: 'log' });
    }
    v.commentList = s.comments
      .filter(c => c.doc === doc.id && (s.showResolved || !c.resolved))
      .map(c => {
        const us = USERS[c.by] || { color: c.color || '#8d8982', full: c.byName || c.by };
        const b = doc.blocks.find(x => x.id === c.bid);
        return {
          initials: c.by,
          color: us.color,
          name: us.full,
          time: c.time,
          text: c.text,
          quote: b ? summary(b) : '(blokken er slettet)',
          onQuote: () => b && this.focusBlock(b.id, 'comment'),
          onResolve: () =>
            this.setState(x => ({
              comments: x.comments.map(k => (k.id === c.id ? { ...k, resolved: !k.resolved } : k))
            })),
          resolveLabel: c.resolved ? 'Gjenåpne' : 'Løs',
          opacity: c.resolved ? 0.6 : 1,
          border: c.bid === s.active ? ACCB : 'var(--ke2dfd9,#e2dfd9)',
          replies: (c.replies || []).map(r => {
            const ru = USERS[r.by] || us;
            return { initials: r.by, color: ru.color, name: ru.full, text: r.text, time: r.time };
          }),
          hasReplies: !!(c.replies && c.replies.length),
          isReplying: !!(s.reply && s.reply.id === c.id),
          replyText: s.reply && s.reply.id === c.id ? s.reply.text : '',
          onReply: () =>
            this.setState(z => ({ reply: z.reply && z.reply.id === c.id ? null : { id: c.id, text: '' } })),
          onReplyText: e => this.setState({ reply: { id: c.id, text: e.target.value } }),
          onSendReply: () => {
            const tx = ((this.state.reply || {}).text || '').trim();
            if (!tx) return;
            const by = USERS[s.me] ? s.me : 'SK';
            this.setState(z => ({
              reply: null,
              comments: z.comments.map(k =>
                k.id === c.id ? { ...k, replies: [...(k.replies || []), { by, text: tx, time: 'nå' }] } : k
              )
            }));
          }
        };
      });
    v.noComments = !v.commentList.length;
    v.resolvedToggleLabel = resC ? (s.showResolved ? 'Skjul løste' : `Vis løste (${resC})`) : '';
    v.toggleResolved = () => this.setState(x => ({ showResolved: !x.showResolved }));
    v.commentTarget = ab ? 'Kommentar på: ' + summary(ab) : 'Velg en blokk i dokumentet for å kommentere den.';
    v.newComment = s.newComment;
    v.commentErr = s.commentErr;
    v.onNewComment = e => this.setState({ newComment: e.target.value, commentErr: '' });
    v.addComment = () => {
      const tx = s.newComment.trim();
      if (!s.active) return this.setState({ commentErr: 'Velg en blokk først.' });
      if (!tx) return this.setState({ commentErr: 'Kommentaren er tom.' });
      this.setState(x => ({
        comments: [
          ...x.comments,
          {
            id: uid(),
            doc: doc.id,
            by: this.account().initials || this.account().id,
            byName: this.account().name,
            color: this.account().color,
            text: tx,
            bid: x.active,
            time: now(),
            ts: Date.now(),
            resolved: false
          }
        ],
        newComment: '',
        commentErr: ''
      }));
    };
    v.historyList = s.history.map(x => ({
      ...x,
      onRestore: () => {
        if (!x.snap) return;
        this.setBlocks(() => clone(x.snap), `Gjenopprettet «${x.what}»`);
        this.toast('Versjon gjenopprettet');
      },
      diffLabel: s.diffH === x.id ? 'Skjul' : 'Sammenlign',
      onDiff: () => this.setState(z => ({ diffH: z.diffH === x.id ? null : x.id }))
    }));
    {
      const h = s.history.find(x => x.id === s.diffH);
      v.diffOpen = !!(h && h.snap);
      v.df = { rows: [] };
      if (v.diffOpen) {
        const old = h.snap,
          om = {},
          cm = new Set(doc.blocks.map(b => b.id)),
          rows = [];
        old.forEach(b => (om[b.id] = b));
        const squash = ps =>
          ps.map((p, i) => {
            if (p.k !== 'eq') return p;
            const w = p.t.split(/(\s+)/);
            if (w.length <= 30) return p;
            return {
              ...p,
              t: (i === 0 ? '' : w.slice(0, 12).join('')) + ' … ' + (i === ps.length - 1 ? '' : w.slice(-12).join(''))
            };
          });
        const sty = k =>
          k === 'add'
            ? { bg: 'oklch(0.93 0.07 150)', color: '#17532c', td: 'none' }
            : k === 'del'
              ? { bg: 'oklch(0.94 0.04 25)', color: '#8f1d17', td: 'line-through' }
              : { bg: 'transparent', color: 'inherit', td: 'none' };
        doc.blocks.forEach(b => {
          const o = om[b.id],
            tn = blockTxt(b, dec);
          if (!o) rows.push({ tag: 'Ny', tk: 'add', b, parts: [{ t: tn || '(tom blokk)', k: 'add' }] });
          else {
            const to = blockTxt(o, dec);
            if (to !== tn) rows.push({ tag: 'Endret', tk: 'chg', b, parts: squash(wdiff(to, tn)) });
          }
        });
        old.forEach(o => {
          if (!cm.has(o.id))
            rows.push({ tag: 'Slettet', tk: 'del', o, parts: [{ t: blockTxt(o, dec) || '(tom blokk)', k: 'del' }] });
        });
        v.df = {
          title: 'Endringer siden «' + h.what + '»',
          sub: h.who + ' · ' + h.time + ' · ' + rows.length + (rows.length === 1 ? ' blokk' : ' blokker'),
          none: !rows.length,
          onClose: () => this.setState({ diffH: null }),
          onRestore: () => {
            this.setBlocks(() => clone(old), `Gjenopprettet «${h.what}»`);
            this.setState({ diffH: null });
            this.toast('Versjon gjenopprettet');
          },
          rows: rows.map(r => ({
            tag: r.tag,
            where: (summary(r.b || r.o) || KIND[(r.b || r.o).type] || '').slice(0, 60),
            tagBg:
              r.tk === 'add' ? 'oklch(0.93 0.07 150)' : r.tk === 'del' ? 'oklch(0.94 0.04 25)' : 'oklch(0.94 0.05 85)',
            tagColor: r.tk === 'add' ? '#17532c' : r.tk === 'del' ? '#8f1d17' : '#5a4210',
            onClick: () => r.b && this.focusBlock(r.b.id, 'history'),
            parts: r.parts.map(p => ({ t: p.t, ...sty(p.k) }))
          }))
        };
      }
    }
    {
      const bu = s.bibUi,
        uses = {};
      doc.blocks.forEach(
        b =>
          b.type === 'p' &&
          b.segs.forEach(x => {
            if (x.t === 'cite') uses[x.key] = (uses[x.key] || 0) + 1;
          })
      );
      v.bb = {
        doi: bu.doi,
        onDoi: e => this.bibSet({ doi: e.target.value, msg: '' }),
        onDoiKey: e => {
          if (e.key === 'Enter') this.lookupDoi();
        },
        onLookup: this.lookupDoi,
        lookLabel: bu.busy ? 'Henter …' : 'Hent',
        msg: bu.msg || '',
        msgColor: bu.err ? 'var(--kb3261e,#b3261e)' : 'var(--k4d8a5a,#4d8a5a)',
        showBibtex: !!bu.showBib,
        bibtexLabel: bu.showBib ? 'Skjul BibTeX' : 'Lim inn BibTeX',
        toggleBibtex: () => this.bibSet({ showBib: !bu.showBib }),
        bibtex: bu.bibtex,
        onBibtex: e => this.bibSet({ bibtex: e.target.value }),
        onImport: () => {
          const es = parseBibtex(bu.bibtex);
          if (!es.length) return this.bibSet({ msg: 'Fant ingen @-oppføringer.', err: true });
          this.addBib(es);
          this.bibSet({ bibtex: '', showBib: false, msg: 'Importerte ' + es.length, err: false });
        },
        onExport: () => {
          if (!(doc.bib || []).length) return this.toast('Ingen kilder å eksportere');
          download('refs.bib', toBibtex(doc.bib), 'application/x-bibtex');
          this.toast('refs.bib lastet ned');
        },
        items: bibList(doc).map(e => ({
          n: e.n,
          txt: e.txt,
          key: e.key,
          uses: uses[e.key] ? 'sitert ' + uses[e.key] + '×' : 'ikke sitert ennå',
          onCite: () => this.insertSeg(citeSeg(e.key), 'Satt inn kilde [' + e.n + ']'),
          onDel: () =>
            this.setDoc(
              d => ({
                ...d,
                bib: (d.bib || []).filter(x => x.key !== e.key),
                blocks: d.blocks.map(b =>
                  b.type === 'p' && b.segs.some(x => x.t === 'cite' && x.key === e.key)
                    ? { ...b, segs: norm(b.segs.filter(x => !(x.t === 'cite' && x.key === e.key))) }
                    : b
                )
              }),
              'Fjernet kilde ' + e.key
            )
        }))
      };
      v.bb.empty = !v.bb.items.length;
    }
    {
      const lang = S.lang || 'nb',
        D = lang === 'en' ? SPELL_EN : SPELL_NB,
        ign = new Set(s.ignored || []),
        items = [];
      doc.blocks.forEach(b =>
        textFields(b).forEach(f => {
          if (f.k === 'src') return;
          const v0 = f.v;
          let m;
          const wre = /[A-Za-zÆØÅæøåéü]+/g;
          while ((m = wre.exec(v0))) {
            const w = m[0],
              fix = this._server ? this._server.spellFix(w, lang) : D[w.toLowerCase()];
            if (fix) {
              const rep = w[0] !== w[0].toLowerCase() ? fix[0].toUpperCase() + fix.slice(1) : fix;
              items.push({
                kind: 'Stavefeil',
                b,
                f,
                at: m.index,
                len: w.length,
                rep,
                fixLabel: 'Bytt til «' + rep + '»'
              });
            }
          }
          const dre = /(^|[^A-Za-zÆØÅæøå])([A-Za-zÆØÅæøå]{2,})\s+\2(?![A-Za-zÆØÅæøå])/gi;
          while ((m = dre.exec(v0))) {
            const at = m.index + m[1].length;
            items.push({
              kind: 'Dobbelt ord',
              b,
              f,
              at,
              len: m[0].length - m[1].length,
              rep: m[2],
              fixLabel: 'Fjern det ene «' + m[2] + '»'
            });
          }
          if (b.type === 'p' && f.k[0] === 's') {
            const ure = /(\d+(?:[.,]\d+)?)\s?([kMmµunpG]?)(Ω|ohm|Hz|V|A|F|H|W)(?=$|[\s.,;:)])/g;
            while ((m = ure.exec(v0))) {
              const pre = m[2] === 'µ' ? 'u' : m[2];
              if (!PFX.some(x => x.k === pre)) continue;
              items.push({
                kind: 'Enhet',
                b,
                f,
                at: m.index,
                len: m[0].length,
                si: +f.k.slice(1),
                unit: { num: m[1].replace('.', ','), prefix: pre, unit: m[3] === 'Ω' || m[3] === 'ohm' ? 'ohm' : m[3] },
                fixLabel: 'Gjør om til \\qty'
              });
            }
          }
        })
      );
      const key = it => it.kind + '|' + it.b.id + '|' + it.f.k + '|' + it.at,
        list = items.filter(it => !ign.has(key(it)));
      const fixOne = it => {
        if (it.unit)
          this.updBlock(
            it.b.id,
            x => {
              const sg = x.segs[it.si];
              if (!sg || sg.t !== 'text') return {};
              const segs = [...x.segs];
              segs.splice(
                it.si,
                1,
                { t: 'text', v: sg.v.slice(0, it.at) },
                { t: 'unit', ...it.unit },
                { t: 'text', v: sg.v.slice(it.at + it.len) }
              );
              return { segs: norm(segs) };
            },
            'Gjorde om til \\qty'
          );
        else
          this.setBlocks(
            bs =>
              bs.map(x => {
                if (x.id !== it.b.id) return x;
                const F = textFields(x).find(q => q.k === it.f.k);
                return F ? F.set(x, F.v.slice(0, it.at) + it.rep + F.v.slice(it.at + it.len)) : x;
              }),
            'Rettet «' + it.rep + '»'
          );
      };
      const fixAll = () => {
        const sp = list.filter(it => !it.unit);
        if (!sp.length) return;
        this.setBlocks(
          bs =>
            bs.map(x => {
              const mine = sp.filter(it => it.b.id === x.id);
              if (!mine.length) return x;
              let y = x;
              const byF = {};
              mine.forEach(it => (byF[it.f.k] = byF[it.f.k] || []).push(it));
              Object.keys(byF).forEach(k => {
                const F = textFields(y).find(q => q.k === k);
                if (!F) return;
                let val = F.v;
                byF[k]
                  .sort((a, c) => c.at - a.at)
                  .forEach(it => {
                    val = val.slice(0, it.at) + it.rep + val.slice(it.at + it.len);
                  });
                y = F.set(y, val);
              });
              return y;
            }),
          'Rettet ' + sp.length + ' funn'
        );
        this.toast('Rettet ' + sp.length + ' funn');
      };
      const CC = {
        Stavefeil: ['oklch(0.94 0.04 25)', '#8f1d17'],
        'Dobbelt ord': ['oklch(0.94 0.05 85)', '#5a4210'],
        Enhet: ['oklch(0.94 0.03 250)', '#24457a']
      };
      v.ck = {
        head: list.length ? list.length + ' funn i dokumentet' : 'Alt ser bra ut',
        empty: !list.length,
        canFixAll: list.some(it => !it.unit),
        onFixAll: fixAll,
        langs: [
          ['Bokmål', 'nb'],
          ['English', 'en']
        ].map(([l, k]) => ({
          label: l,
          onClick: () => this.setS('lang', k),
          bg: lang === k ? 'var(--kfff,#fff)' : 'transparent',
          shadow: lang === k ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
        })),
        items: list.slice(0, 80).map(it => {
          const v0 = it.f.v;
          return {
            kind: it.kind,
            badgeBg: CC[it.kind][0],
            badgeColor: CC[it.kind][1],
            where: (summary(it.b) || '').slice(0, 50),
            onGo: () => this.focusBlock(it.b.id, 'outline'),
            before: (it.at > 40 ? '… ' : '') + v0.slice(Math.max(0, it.at - 40), it.at),
            hit: v0.substr(it.at, it.len),
            after: v0.slice(it.at + it.len, it.at + it.len + 40) + (v0.length > it.at + it.len + 40 ? ' …' : ''),
            fixLabel: it.fixLabel,
            onFix: () => fixOne(it),
            onIgnore: () => this.setState(z => ({ ignored: [...(z.ignored || []), key(it)] }))
          };
        })
      };
      v.spellLang = lang === 'en' ? 'en' : 'nb';
      v.rightTabs.forEach(tb => {
        if (tb.k === 'check' && list.length) tb.label = 'Sjekk ' + list.length;
        if (tb.k === 'bib' && (doc.bib || []).length) tb.label = 'Kilder ' + doc.bib.length;
      });
    }
    {
      const F = s.find;
      v.findOpen = !!F && s.view === 'editor';
      v.fd = { results: [], scopes: [] };
      if (F) {
        const q = F.q;
        let re = null;
        try {
          re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + (F.cs ? '' : 'i')) : null;
        } catch (e) {}
        const scope = F.all ? s.docs : [doc],
          res = [];
        let total = 0;
        if (re)
          scope.forEach(d =>
            d.blocks.forEach(b =>
              textFields(b).forEach(f => {
                re.lastIndex = 0;
                let m,
                  first = null,
                  n = 0;
                while ((m = re.exec(f.v))) {
                  n++;
                  if (!first) first = m;
                }
                if (n) {
                  total += n;
                  const a = first.index;
                  res.push({
                    d,
                    b,
                    n,
                    before: (a > 30 ? '…' : '') + f.v.slice(Math.max(0, a - 30), a),
                    hit: first[0],
                    after: f.v.slice(a + first[0].length, a + first[0].length + 60)
                  });
                }
              })
            )
          );
        const rep = pred => {
          let cnt = 0;
          const mk = () => new RegExp(re.source, re.flags),
            tf = b => {
              let y = b;
              textFields(b).forEach(f => {
                const c = (f.v.match(mk()) || []).length;
                if (!c) return;
                cnt += c;
                const G = textFields(y).find(z => z.k === f.k);
                if (G)
                  y = G.set(
                    y,
                    f.v.replace(mk(), () => F.r)
                  );
              });
              return y;
            };
          this.pushUndo('doc', this.snapDoc(this.curDoc()), true);
          this.setState(
            z => ({
              docs: z.docs.map(d =>
                scope.some(x => x.id === d.id) ? { ...d, blocks: d.blocks.map(b => (pred(d, b) ? tf(b) : b)) } : d
              )
            }),
            () => {
              this.schedule();
              this.toast(cnt ? 'Erstattet ' + cnt + (cnt === 1 ? ' forekomst' : ' forekomster') : 'Ingen treff');
            }
          );
        };
        v.fd = {
          q: F.q,
          r: F.r,
          onQ: e => this.setState({ find: { ...this.state.find, q: e.target.value } }),
          onR: e => this.setState({ find: { ...this.state.find, r: e.target.value } }),
          onKey: e => {
            if (e.key === 'Enter' && res[0]) this.gotoHit(res[0].d.id, res[0].b.id);
          },
          caseBg: F.cs ? ACCL : 'var(--kfff,#fff)',
          caseBorder: F.cs ? ACCB : 'var(--ke2dfd9,#e2dfd9)',
          onCase: () => this.setState({ find: { ...F, cs: !F.cs } }),
          scopes: [
            ['Dette dokumentet', false],
            ['Alle prosjekter', true]
          ].map(([l, a]) => ({
            label: l,
            onClick: () => this.setState({ find: { ...F, all: a } }),
            bg: !!F.all === a ? 'var(--kfff,#fff)' : 'transparent',
            shadow: !!F.all === a ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
          })),
          count: !q
            ? ''
            : total
              ? total + ' treff' + (F.all ? ' i ' + new Set(res.map(r => r.d.id)).size + ' dok.' : '')
              : 'Ingen treff',
          onReplaceAll: () => {
            if (re && total) rep(() => true);
          },
          hasResults: res.length > 0,
          onClose: () => this.setState({ find: null }),
          results: res.slice(0, 60).map(r => ({
            where: (F.all ? r.d.title + ' · ' : '') + (summary(r.b) || '').slice(0, 40),
            before: r.before,
            hit: r.hit,
            after: r.after,
            onClick: () => this.gotoHit(r.d.id, r.b.id),
            onReplace: e => {
              e.stopPropagation();
              rep((d, b) => d.id === r.d.id && b.id === r.b.id);
            }
          }))
        };
      }
    }
    {
      const n = s.net,
        off = !n.on || n.sim;
      v.netShow = off || n.syncing;
      v.netText = n.syncing
        ? 'Synkroniserer …'
        : 'Frakoblet' + (n.queue ? ' · ' + n.queue + (n.queue === 1 ? ' endring' : ' endringer') + ' venter' : '');
      v.netColor = n.syncing ? 'oklch(0.45 0.15 250)' : '#6b4a1a';
      v.netBg = n.syncing ? 'oklch(0.95 0.03 250)' : 'oklch(0.95 0.04 80)';
      v.netTitle = n.sim
        ? 'Simulert frakobling. Klikk for å koble til igjen.'
        : 'Ingen nettforbindelse. Alt lagres lokalt og kompileres på maskinen.';
      v.netClick = () => {
        if (this.state.net.sim) this.setNet({ sim: false });
      };
    }
    {
      const p = s.plot;
      v.plotOpen = !!p;
      v.closePlot = () => this.setState({ plot: null });
      v.csvRef = this.csvRef;
      v.pl = { kinds: [] };
      if (p) {
        const d = parseCSV(p.csv);
        v.pl = {
          title: p.bid ? 'Rediger graf' : 'Ny graf fra data',
          csv: p.csv,
          onCsv: e => this.plotSet({ csv: e.target.value }),
          xlabel: p.xlabel,
          ylabel: p.ylabel,
          caption: p.caption,
          onX: e => this.plotSet({ xlabel: e.target.value }),
          onY: e => this.plotSet({ ylabel: e.target.value }),
          onCap: e => this.plotSet({ caption: e.target.value }),
          kinds: [
            ['Linjediagram', 'line'],
            ['Bode-diagram', 'bode']
          ].map(([l, k]) => ({
            label: l,
            onClick: () => this.plotSet({ kind: k }),
            bg: p.kind === k ? 'var(--kfff,#fff)' : 'transparent',
            shadow: p.kind === k ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
            fw: p.kind === k ? 600 : 400
          })),
          onSample: () => this.plotSet(this.plotSample(p.kind)),
          onFile: () => this.csvRef.current && this.csvRef.current.click(),
          onFilePick: e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const r = new FileReader();
            r.onload = () => this.plotSet({ csv: String(r.result) });
            r.readAsText(f);
          },
          svg:
            d.rows.length >= 2
              ? plotSvg(p, { w: 460, h: p.kind === 'bode' && d.head.length >= 3 ? 170 : 270, max: 520 })
              : 'Lim inn data for å se grafen',
          info: d.rows.length
            ? d.rows.length +
              ' punkter · ' +
              Math.max(0, d.head.length - 1) +
              (d.head.length === 2 ? ' serie' : ' serier') +
              ' · ' +
              d.head.join(', ')
            : 'Forhåndsvisning',
          note:
            p.kind === 'bode'
              ? 'Første kolonne er frekvens og får logaritmisk akse. Andre kolonne er forsterkning; en tredje kolonne med fase tegnes i et eget panel under.'
              : 'Første kolonne er x. Hver av de neste kolonnene blir en egen kurve. Skilletegn kan være semikolon, komma eller tab.',
          err: p.err,
          onSubmit: () => this.submitPlot(),
          submitLabel: p.bid ? 'Oppdater' : 'Sett inn'
        };
      }
    }
    {
      const x = s.xls;
      v.xlsOpen = !!x;
      v.closeXls = () => this.setState({ xls: null });
      v.xl = {};
      if (x) {
        const g = x.text.trim() ? parseGrid(x.text) : [];
        v.xl = {
          text: x.text,
          onText: e => this.setState({ xls: { ...x, text: e.target.value, err: '' } }),
          err: x.err,
          info: g.length
            ? g.length + ' rader × ' + g[0].length + ' kolonner. Første rad blir overskrift.'
            : 'Kopier cellene i Excel, Numbers eller Google Sheets og lim dem inn her. Du kan også trykke ⌘V rett i tabellen.',
          onSubmit: () => {
            if (!g.length) return this.setState({ xls: { ...x, err: 'Ingenting å lime inn.' } });
            this.setState({ xls: null });
            this.applyGrid(x.bid, g);
          }
        };
      }
    }

    v.shareOpen = s.share;
    v.shareTop = 58;
    v.invite = s.invite;
    v.inviteErr = s.inviteErr;
    v.hasInviteErr = !!s.inviteErr;
    v.linkRole = s.linkRole;
    {
      const pb = this.publicBase(),
        me = ACCOUNTS.find(a => a.id === s.me) || ACCOUNTS[0];
      v.shareFull = pb.url + '/d/' + slug(doc.title);
      v.shareUrl = v.shareFull.replace(/^https?:\/\//, '');
      v.linkExt = pb.ext;
      v.linkLocal = !pb.ext;
      v.linkNote = pb.ext
        ? 'Ekstern adresse via DuckDNS. Fungerer utenfor hjemmenettet.'
        : 'Lenken bruker serveradressen ' +
          pb.url.replace(/^https?:\/\//, '') +
          '. Slå på DuckDNS for å dele utenfor hjemmenettet.';
      v.linkNoteAction = me.admin && !pb.ext ? 'Sett opp DuckDNS' : '';
      v.hasLinkAction = !!v.linkNoteAction;
      v.goDuck = () => this.setState({ view: 'settings', setTab: 'duck', share: false });
    }
    v.copyLabel = s.copied ? 'Kopiert' : 'Kopier';
    v.onInvite = e => this.setState({ invite: e.target.value, inviteErr: '' });
    v.sendInvite = () => {
      const x = s.invite.trim(),
        mail = s.inviteMail;
      if (!x) return this.setState({ inviteErr: 'Skriv inn en e-postadresse.' });
      if ((mail || x.includes('@')) && !EMAIL_RE.test(x)) return this.setState({ inviteErr: 'Ugyldig e-postadresse.' });
      if (s.people.some(p => p.email === x)) return this.setState({ inviteErr: x + ' har allerede tilgang.' });
      const nm = x.includes('@')
        ? x
            .split('@')[0]
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
        : x;
      const ini = nm
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
      this.setState(st => ({
        people: [
          ...st.people,
          {
            id: uid(),
            name: nm,
            email: x.includes('@') ? x : '',
            initials: ini,
            color: 'oklch(0.62 0.13 ' + Math.floor(Math.random() * 360) + ')',
            role: st.inviteRole,
            status: 'Invitert'
          }
        ],
        invite: '',
        inviteMsg: ''
      }));
      if (mail) {
        const m = this.addMail({
          kind: 'invite',
          link: this.publicBase().url + '/i/' + uid() + uid(),
          to: x,
          subject: 'Sebastian Kristoffersen har delt «' + doc.title + '» med deg',
          body: s.inviteMsg,
          role: s.inviteRole,
          docTitle: doc.title
        });
        this.toast(
          m.status === 'Sendt'
            ? 'Invitasjon sendt på e-post til ' + x
            : 'Invitasjonen ligger i utboksen til SMTP er satt opp'
        );
      } else this.toast(nm + ' har fått tilgang');
    };
    v.onInviteKey = e => {
      if (e.key === 'Enter') v.sendInvite();
    };
    v.shareTabs = [
      ['Inviter', 'invite'],
      ['Send på e-post', 'mail']
    ].map(([l, k]) => ({
      label: l,
      onClick: () => this.setState({ shareTab: k }),
      bg: s.shareTab === k ? 'var(--kfff,#fff)' : 'transparent',
      fw: s.shareTab === k ? 600 : 400,
      shadow: s.shareTab === k ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
    }));
    v.isInviteTab = s.shareTab === 'invite';
    v.isMailTab = s.shareTab === 'mail';
    v.inviteRole = s.inviteRole;
    v.onInviteRole = e => this.setState({ inviteRole: e.target.value });
    v.inviteMsg = s.inviteMsg;
    v.onInviteMsg = e => this.setState({ inviteMsg: e.target.value });
    v.inviteMailBox = s.inviteMail ? '✓' : '';
    v.inviteMailBg = s.inviteMail ? ACC : 'var(--kfff,#fff)';
    v.toggleInviteMail = () => this.setState(x => ({ inviteMail: !x.inviteMail }));
    v.smtpWarn = !this.smtpOk();
    v.smtpAction = this.account().admin
      ? 'Sett opp SMTP'
      : 'Si fra til administrator';
    v.goSmtp = () => {
      if (this.account().admin)
        this.setState({ view: 'settings', setTab: 'smtp', share: false });
      else this.toast('Administratoren har fått beskjed');
    };
    v.sendTo = s.sendTo;
    v.onSendTo = e => this.setState({ sendTo: e.target.value, sendErr: '' });
    v.sendSubj = s.sendSubj || doc.title;
    v.onSendSubj = e => this.setState({ sendSubj: e.target.value });
    v.sendMsg = s.sendMsg;
    v.onSendMsg = e => this.setState({ sendMsg: e.target.value });
    v.sendErr = s.sendErr;
    v.sendDocMail = this.sendDocMail;
    v.mailtoDoc = this.mailtoDoc;
    v.attOpts = [
      ['PDF', 'pdf'],
      ['.tex', 'tex'],
      ['Bilder', 'img']
    ].map(([l, k]) => ({
      label: l,
      onClick: () => this.setState(x => ({ att: { ...x.att, [k]: !x.att[k] } })),
      box: s.att[k] ? '✓' : '',
      boxBg: s.att[k] ? ACC : 'var(--kfff,#fff)'
    }));
    v.mailList = s.mails
      .slice(0, 4)
      .map(m => ({
        to: m.to,
        what: m.kind === 'invite' ? 'Invitasjon' : 'Dokument',
        time: m.time,
        status: m.status,
        stColor: m.status === 'Sendt' ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--kb26a1e,#b26a1e)',
        onView: () => this.setState({ mailPreview: m.id })
      }));
    v.hasMails = !!s.mails.length;
    const mp = s.mails.find(m => m.id === s.mailPreview);
    v.mailOpen = !!mp;
    v.closeMail = () => this.setState({ mailPreview: null });
    if (mp) {
      const pb = this.publicBase(),
        host = pb.url.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      v.mp = {
        btn: mp.kind === 'invite' ? 'Godta invitasjon' : 'Åpne dokumentet',
        from: smtpFrom(s.smtp) || 'Kobling <noreply@' + host + '>',
        to: mp.to,
        subject: mp.subject,
        isInvite: mp.kind === 'invite',
        isDoc: mp.kind === 'doc',
        body: mp.body,
        hasBody: !!mp.body,
        role: mp.role,
        docTitle: mp.docTitle,
        url: mp.link || pb.url + '/d/' + slug(mp.docTitle || ''),
        att: (mp.att || []).join(', '),
        hasAtt: !!(mp.att && mp.att.length),
        status: mp.status + ' ' + mp.date + ' kl. ' + mp.time,
        stColor: mp.status === 'Sendt' ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--kb26a1e,#b26a1e)'
      };
    } else v.mp = {};
    v.people = s.people.map(p => ({
      ...p,
      hasStatus: !!p.status,
      isOwner: p.role === 'Eier',
      notOwner: p.role !== 'Eier',
      onRole: e => {
        const r = e.target.value;
        this.setState(st => ({
          people:
            r === 'Fjern'
              ? st.people.filter(k => k.id !== p.id)
              : st.people.map(k => (k.id === p.id ? { ...k, role: r } : k))
        }));
      }
    }));
    v.onLinkRole = e => this.setState({ linkRole: e.target.value });
    v.copyLink = () => {
      try {
        navigator.clipboard.writeText(v.shareFull);
      } catch (e) {}
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 1600);
    };

    const p = s.picker;
    v.pickerOpen = !!p;
    v.closePicker = () => this.setState({ picker: null });
    if (p) {
      const q = p.q.trim().toLowerCase(),
        mt = o => !q || (o.n + ' ' + o.s + ' ' + (o.c || o.tex || '')).toLowerCase().includes(q);
      const sel = on => ({
        border: on ? `2px solid ${ACC}` : '1px solid var(--ke2dfd9,#e2dfd9)',
        bg: on ? ACCL : 'var(--kfff,#fff)'
      });
      const val = { num: p.num || '0', prefix: p.prefix, unit: p.unit };
      v.pk = {
        q: p.q,
        onQ: e => this.pk({ q: e.target.value }),
        onKey: e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.pickerSubmit();
          }
        },
        isQty: p.tab === 'qty',
        isSym: p.tab === 'sym',
        isMath: p.tab === 'math',
        maths: MATH.filter(x => mt({ n: x.n, s: x.s, c: x.tex })).map(x => ({
          s: x.s,
          n: x.n,
          code: x.tex,
          onClick: () => this.insertMath(x.tex)
        })),
        mathHint: (() => {
          const a = this.findBlock(s.active);
          return a && a.type === 'eq'
            ? 'Klikk for å legge til i den valgte likningen.'
            : 'Klikk for å lage en ny likning med symbolet.';
        })(),
        tabs: [
          ['Verdi med enhet', 'qty'],
          ['Størrelser og symboler', 'sym'],
          ['Formler', 'math']
        ].map(([l, k]) => ({
          label: l,
          onClick: () => this.pk({ tab: k, err: '' }),
          bg: p.tab === k ? 'var(--kfff,#fff)' : 'transparent',
          fw: p.tab === k ? 600 : 400
        })),
        num: p.num,
        onNum: e => this.pk({ num: e.target.value, err: '' }),
        prefixLabel: (pf(p.prefix).s || '–') + '  ' + pf(p.prefix).n,
        unitLabel: un(p.unit).s + '  ' + un(p.unit).n,
        preview: qtyText(val, dec),
        code: qtyCode(val),
        prefixes: PFX.filter(x => mt(x) || x.k === p.prefix).map(x => ({
          s: x.s || '–',
          n: x.n,
          onClick: () => this.pk({ prefix: x.k }),
          ...sel(x.k === p.prefix)
        })),
        units: UNITS.filter(x => mt(x) || x.k === p.unit).map(x => ({
          s: x.s,
          n: x.n,
          onClick: () => this.pk({ unit: x.k }),
          ...sel(x.k === p.unit)
        })),
        syms: SYMS.filter(x => mt({ n: x.n, s: x.base, c: x.tex })).map(x => ({
          s: x.base,
          n: x.n,
          onClick: () => this.pk({ base: x.base, tex: x.tex }),
          ...sel(x.base === p.base)
        })),
        base: p.base,
        sub: p.sub,
        onSub: e => this.pk({ sub: e.target.value }),
        symCode: symCode({ tex: p.tex, sub: p.sub.trim() }),
        err: p.err,
        isEdit: !!p.edit,
        onRemove: () => {
          this.setState({ picker: null });
          this.removeSeg(p.edit.bid, p.edit.si);
        },
        onSubmit: this.pickerSubmit,
        submitLabel: p.edit ? 'Oppdater' : 'Sett inn'
      };
    } else v.pk = { maths: [], tabs: [], prefixes: [], units: [], syms: [] };

    v.groups = GROUPS.map(g => ({
      label: g,
      count: s.docs.filter(d => d.folder === g).length,
      onClick: () => this.setState({ group: g }),
      bg: s.group === g ? 'var(--ke4e0d9,#e4e0d9)' : 'transparent',
      fw: s.group === g ? 600 : 400
    }));
    v.syncText = S.sync ? 'Synkronisert med ' + S.server.replace(/^https?:\/\//, '') : 'Synkronisering av';
    v.syncColor = S.sync ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--ka29e97,#a29e97)';
    v.projectCards = s.docs
      .filter(d => d.folder === s.group)
      .map(d => ({
        title: d.title,
        meta: d.meta,
        onOpen: () => this.openDoc(d.id),
        onDelete: e => {
          e.stopPropagation();
          this.deleteDoc(d.id);
        },
        border: d.id === s.cur ? ACCB : 'var(--ke2dfd9,#e2dfd9)',
        cols: S.cols === 2 ? '1fr 1fr' : '1fr',
        authors: d.authors,
        group: d.group,
        colN: S.cols === 2 ? 2 : 1,
        mini: (() => {
          const nb2 = numberDoc(d.blocks),
            out = [];
          for (const b of d.blocks) {
            if (out.length > 40) break;
            if (b.type === 'abstract' && b.text) out.push({ isP: true, t: 'Sammendrag. ' + b.text });
            else if (b.type === 'h1') out.push({ isH: true, fs: '3cqw', t: nb2.num[b.id] + '  ' + (b.text || '') });
            else if (b.type === 'h2') out.push({ isH: true, fs: '2.6cqw', t: nb2.num[b.id] + '  ' + (b.text || '') });
            else if (b.type === 'p') {
              const tx = plain(b, dec);
              if (tx.trim()) out.push({ isP: true, t: tx });
            } else if (b.type === 'fig' || b.type === 'img' || b.type === 'plot')
              out.push({ isBox: true, h: '16cqw', t: 'Figur ' + nb2.num[b.id] });
            else if (b.type === 'table')
              out.push({
                isBox: true,
                h: Math.min(30, 4 + b.rows.length * 2.4) + 'cqw',
                t: b.style === 'list' ? 'Liste' : 'Tabell ' + nb2.num[b.id]
              });
            else if (b.type === 'eq') out.push({ isBox: true, h: '6cqw', t: '(' + nb2.num[b.id] + ')' });
            else if (b.type === 'raw') {
              const tx = (b.src || '')
                .replace(/%.*$/gm, '')
                .replace(/\\(begin|end)\{[^}]*\}(\{[^}]*\})?/g, '')
                .replace(/\\(sub)*section\*?\{([^}]*)\}/g, '\n§$2\n')
                .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, '')
                .replace(/[{}$&\\]/g, ' ');
              tx.split('\n')
                .map(x => x.trim())
                .filter(Boolean)
                .slice(0, 12)
                .forEach(x =>
                  out.push(
                    x[0] === '§' ? { isH: true, fs: '2.8cqw', t: x.slice(1) } : { isP: true, t: x.replace(/\s+/g, ' ') }
                  )
                );
            }
          }
          if (!out.length) out.push({ isP: true, t: '' });
          return out;
        })()
      }));
    v.openNewProj = () => this.setState({ newProj: { title: '', tpl: 'rapport', err: '' } });
    v.closeNewProj = () => this.setState({ newProj: null });
    v.templates = TPLS.map(x => ({
      ...x,
      onClick: () => this.setState({ newProj: { title: '', tpl: x.k, err: '' } })
    }));
    v.newProjOpen = !!s.newProj;
    const np = s.newProj;
    if (np) {
      const create = () => {
        const ti = np.title.trim();
        if (!ti) return this.setState(x => ({ newProj: { ...x.newProj, err: 'Gi obligen en tittel.' } }));
        const d = {
          id: uid(),
          title: ti,
          authors: 'Sebastian Kristoffersen',
          group: 'Gruppe ADK 61',
          folder: s.group,
          meta: 'Opprettet nå',
          blocks: skeleton(np.tpl)
        };
        this.setState(
          x => ({ docs: [...x.docs, d], newProj: null }),
          () => this.openDoc(d.id)
        );
      };
      v.np = {
        title: np.title,
        err: np.err,
        onTitle: e => this.setState(x => ({ newProj: { ...x.newProj, title: e.target.value, err: '' } })),
        onKey: e => {
          if (e.key === 'Enter') create();
        },
        onCreate: create,
        tpls: TPLS.map(x => ({
          ...x,
          onClick: () => this.setState(y => ({ newProj: { ...y.newProj, tpl: x.k } })),
          border: np.tpl === x.k ? `2px solid ${ACC}` : '1px solid var(--ke2dfd9,#e2dfd9)',
          bg: np.tpl === x.k ? ACCL : 'var(--kfff,#fff)'
        }))
      };
    } else v.np = { tpls: [] };

    const togX = (label, on, fn) => ({
      isToggle: true,
      label,
      onToggle: fn,
      tbg: on ? ACC : 'var(--kd6d2cb,#d6d2cb)',
      knob: on ? 'translateX(16px)' : 'translateX(0)'
    });
    const segX = (label, cur, opts, fn, font) => ({
      isSeg: true,
      label,
      opts: opts.map(([l, val]) => ({
        label: l,
        onClick: () => fn(val),
        bg: cur === val ? 'var(--kfff,#fff)' : 'transparent',
        shadow: cur === val ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
        font: font || 'inherit'
      }))
    });
    const seg = (label, k, opts, font) => segX(label, S[k], opts, val => this.setS(k, val), font);
    const tog = (label, k) => togX(label, S[k], () => this.setS(k, !S[k]));
    const head = label => ({ isHead: true, label }),
      note = text => ({ isNote: true, text });
    const fld = (label, val, on, o = {}) => ({
      isField: true,
      label,
      value: val,
      onInput: e => on(e.target.value),
      ph: o.ph || '',
      type: o.type || 'text',
      hasSuffix: !!o.suffix,
      suffix: o.suffix || '',
      hasEye: !!o.eye,
      eyeLabel: o.eyeLabel || '',
      onEye: o.eye,
      err: o.err || '',
      hasErr: !!o.err,
      help: o.help || '',
      hasHelp: !!o.help,
      border: o.err ? 'var(--ke8b4ae,#e8b4ae)' : 'var(--ke2dfd9,#e2dfd9)'
    });
    const btns = arr => ({
      isButtons: true,
      btns: arr.map(([label, fn, primary, disabled]) => ({
        label,
        onClick: disabled ? undefined : fn,
        bg: primary ? ACC : 'var(--kfff,#fff)',
        color: primary ? 'var(--kfff,#fff)' : 'var(--k1f1e1c,#1f1e1c)',
        border: primary ? ACC : 'var(--kd6d2cb,#d6d2cb)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer'
      }))
    });
    const d = s.duck,
      du = s.duckUi,
      bk = s.smb,
      bu = s.smbUi,
      dep = s.deploy,
      mt = s.smtp,
      mu = s.smtpUi,
      G = this.gen,
      cfg = { duck: d, smb: bk, deploy: dep, smtp: mt };
    const masked = {
      duck: { ...d, token: d.token ? '••••••••' + d.token.slice(-4) : '' },
      smb: { ...bk, pass: bk.pass ? '••••••••' : '' },
      deploy: dep,
      smtp: { ...mt, pass: mt.pass ? '••••••••' : '' }
    };
    const duckAddr = d.domain
      ? d.tls
        ? 'https://' + d.domain + '.duckdns.org'
        : 'http://' + d.domain + '.duckdns.org:' + dep.port
      : '';
    const dErr = d.domain && !DUCK_RE.test(d.domain) ? 'Bare små bokstaver, tall og bindestrek.' : '',
      tErr = d.token && !TOKEN_RE.test(d.token) ? 'Tokenet har formatet xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.' : '';
    const intErr = (x, min, max) =>
      !/^\d+$/.test(x) || +x < min || +x > max ? 'Heltall mellom ' + min + ' og ' + max + '.' : '';
    const ME = this.account(),
      isAdmin = ME.admin;
    const TB = !isAdmin && ADMIN_TABS.includes(s.setTab) ? 'konto' : s.setTab;
    v.isAdmin = isAdmin;
    const tabItem = ([l, k]) => ({
      isTab: true,
      label: l,
      onClick: () => this.setState({ setTab: k }),
      bg: TB === k ? 'var(--ke4e0d9,#e4e0d9)' : 'transparent',
      fw: TB === k ? 600 : 400
    });
    v.setTabs = [
      { isHead: true, label: 'MINE INNSTILLINGER' },
      ...[
        ['Mal-oppsett', 'mal'],
        ['Kompilering', 'komp'],
        ['Konto', 'konto']
      ].map(tabItem),
      ...(isAdmin
        ? [
            { isHead: true, label: 'ADMINISTRASJON' },
            ...[
              ['Server', 'server'],
              ['DuckDNS', 'duck'],
              ['Backup til SMB', 'backup'],
              ['E-post (SMTP)', 'smtp'],
              ['Installer server', 'install'],
              ['Oppdatering', 'update']
            ].map(tabItem)
          ]
        : [
            { isHead: true, label: 'ADMINISTRASJON' },
            { isLocked: true, label: 'Bare for administrator' }
          ])
    ];
    let rows;
    if (TB === 'mal')
      rows = [
        head('DOKUMENT'),
        seg('Skriftstørrelse', 'size', [
          ['10pt', '10pt'],
          ['11pt', '11pt'],
          ['12pt', '12pt']
        ]),
        seg('Spalter', 'cols', [
          ['Én', 1],
          ['To', 2]
        ]),
        tog('Innrykk i avsnitt', 'indent'),
        seg('Maks antall sider', 'maxPages', [
          ['4', 4],
          ['5', 5],
          ['6', 6]
        ]),
        head('TALL OG ENHETER (SIUNITX)'),
        seg('Desimaltegn', 'dec', [
          ['2,3', ','],
          ['2.3', '.']
        ]),
        seg(
          'Imaginær enhet',
          'imag',
          [
            ['j', 'j'],
            ['i', 'i']
          ],
          "'STIX Two Text',serif"
        ),
        tog('Advar mot feil notasjon (U for spenning, 1V uten \\qty)', 'warn'),
        head('KRETSER'),
        seg('Symbolstil', 'style', [
          ['Amerikansk', 'american'],
          ['Europeisk', 'european']
        ]),
        head('TABELLER'),
        seg('Standard for nye tabeller', 'tableStyle', [
          ['Rutenett', 'grid'],
          ['Booktabs', 'booktabs'],
          ['Enkel', 'plain'],
          ['Punktliste', 'list']
        ])
      ];
    else if (TB === 'komp')
      rows = [
        head('KOMPILERING'),
        seg('Motor', 'engine', [
          ['pdfLaTeX', 'pdfLaTeX'],
          ['LuaLaTeX', 'LuaLaTeX'],
          ['XeLaTeX', 'XeLaTeX']
        ]),
        tog('Kompiler automatisk ved endring', 'auto'),
        {
          isInfo: true,
          label: 'TeX-distribusjon',
          value: this._server || isWeb ? 'Kompileres på serveren' : 'Lokal TeX Live 2026',
          color: 'var(--k4d8a5a,#4d8a5a)'
        }
      ];
    else if (TB === 'konto')
      rows = [
        head('UTSEENDE'),
        seg('Tema', 'theme', [
          ['Lys', 'light'],
          ['Mørk', 'dark'],
          ['Som systemet', 'system']
        ]),
        head('KONTO'),
        { isInfo: true, label: 'Innlogget som', value: ME.name + ' · ' + ME.email, color: ME.color || USERS[ME.id].color },
        {
          isInfo: true,
          label: 'Rolle',
          value: isAdmin ? 'Administrator' : 'Bruker',
          color: isAdmin ? ACC : 'var(--k8d8982,#8d8982)'
        },
        {
          isInfo: true,
          label: 'Server',
          value: S.server.replace(/^https?:\/\//, ''),
          color: S.sync ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--ka29e97,#a29e97)'
        },
        tog('Synkroniser automatisk', 'sync'),
        {
          isInfo: true,
          label: 'Sanntid mellom faner',
          value: this._server ? 'Via serveren' : this.bc ? 'På' : 'Ikke støttet',
          color: this._server || this.bc ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--ka29e97,#a29e97)'
        },
        ...(isAdmin
          ? []
          : [note('Server, DuckDNS, backup, e-post og installasjon styres av administratoren for serveren.')]),
        ...(this._server ? this._server.kontoRows({ head, btns, note }) : [head('DEMO'), segX(
          'Logg inn som',
          s.me,
          ACCOUNTS.map(a => [a.name.split(' ')[0] + (a.admin ? ' (admin)' : ''), a.id]),
          x => {
            this.setState({ me: x });
            this.toast('Logget inn som ' + ACCOUNTS.find(a => a.id === x).name);
          }
        )])
      ];
    else if (TB === 'update') {
      const u = s.upd,
        ui = s.updUi,
        r = ui.run,
        f = ui.found,
        bkOk = bk.host && bk.share;
      rows = [
        {
          isUpd: true,
          ver: u.ver,
          built: 'Bygget ' + u.built,
          channel: u.channel === 'beta' ? 'Beta' : 'Stabil',
          chBg: u.channel === 'beta' ? 'var(--koklch096003075,oklch(0.96 0.03 75))' : 'var(--acc-g-tint,#e2f3e7)',
          chColor: u.channel === 'beta' ? 'var(--k8a5310,#8a5310)' : 'var(--acc-g-ink,#0f6e2b)',
          lastCheck: u.lastCheck ? 'Sist sjekket ' + u.lastCheck : 'Ikke sjekket ennå',
          checkLabel: ui.checking ? 'Sjekker …' : 'Se etter oppdateringer',
          onCheck: ui.checking || (r && !r.done) ? undefined : this.checkUpdate,
          checkOp: ui.checking || (r && !r.done) ? 0.5 : 1,
          hasFound: !!f && f !== 'none' && !r,
          isLatest: f === 'none' && !r,
          fVer: f && f.ver,
          fMeta: f && f.ver ? 'Utgitt ' + f.date + ' · ' + f.size : '',
          fNotes: f && f.notes ? f.notes.map(t => ({ t })) : [],
          bkNote: u.backup
            ? bkOk
              ? 'Tar backup til //' + bk.host + '/' + bk.share + ' før oppdatering.'
              : 'Backup før oppdatering er på, men SMB-backup er ikke satt opp.'
            : 'Ingen backup før oppdatering.',
          bkColor: u.backup && !bkOk ? 'var(--kb26a1e,#b26a1e)' : 'var(--k6b6862,#6b6862)',
          onUpdate: () => this.runUpdate(),
          running: !!r && !r.done,
          isDone: !!r && r.done,
          pct: r ? Math.min(100, Math.round(r.pct)) + '%' : '0%',
          pctNum: r ? Math.min(100, Math.round(r.pct)) + ' %' : '',
          step: r ? r.step : '',
          log: r ? r.log.map(t => ({ t })) : [],
          doneText:
            r && r.done
              ? r.rollback
                ? 'Tilbake på ' + r.to + '. Alt kjører.'
                : 'Oppdatert til ' + r.to + '. Alt kjører.'
              : '',
          hasPrev: !!u.prev && !(r && !r.done),
          prevLabel: 'Gå tilbake til ' + (u.prev || ''),
          onRollback: () => this.runUpdate({ ver: u.prev, date: u.built, size: '' }, true),
          closeDone: () => this.uu({ run: null })
        },
        head('KANAL'),
        segX(
          'Oppdateringskanal',
          u.channel,
          [
            ['Stabil', 'stable'],
            ['Beta', 'beta']
          ],
          x => {
            this.up({ channel: x });
            this.uu({ found: null });
          }
        ),
        note(
          u.channel === 'beta'
            ? 'Beta får nye funksjoner tidligere, men kan ha feil. Ikke anbefalt rett før innlevering.'
            : 'Stabil får testede versjoner omtrent én gang i måneden.'
        ),
        head('AUTOMATISK'),
        togX('Oppdater automatisk', u.auto, () => this.up({ auto: !u.auto })),
        ...(u.auto
          ? [
              segX(
                'Tidspunkt',
                u.time,
                [
                  ['02:00', '02:00'],
                  ['04:00', '04:00'],
                  ['06:00', '06:00']
                ],
                x => this.up({ time: x })
              )
            ]
          : []),
        togX('Ta backup før oppdatering', u.backup, () => this.up({ backup: !u.backup })),
        togX('Varsle innloggede brukere 5 min før', u.notify, () => this.up({ notify: !u.notify })),
        note(
          'Under oppdateringen er serveren nede i omtrent 20 sekunder. Ulagrede endringer holdes i appen og synkroniseres når serveren er oppe igjen. Mac- og Windows-appene oppdaterer seg selv ved neste oppstart.'
        )
      ];
    } else if (TB === 'server')
      rows = [
        head('TILGANG FOR ANDRE BRUKERE'),
        togX('Vis versjonshistorikk', S.histOthers !== false, () => this.setS('histOthers', S.histOthers === false)),
        note(
          S.histOthers === false
            ? 'Bare administratorer ser Historikk-fanen. Historikken lagres fortsatt og tas med i backup.'
            : 'Alle med tilgang til et dokument kan se og gjenopprette tidligere versjoner.'
        ),
        head('SERVER'),
        fld('Serveradresse', S.server, x => this.setS('server', x.trim()), {
          ph: 'https://mitt-navn.duckdns.org',
          err: S.server && !/^https?:\/\/[^\s/]+/.test(S.server) ? 'Adressen må starte med http:// eller https://' : ''
        }),
        tog('Synkroniser automatisk', 'sync'),
        {
          isInfo: true,
          label: 'Status',
          value: S.sync ? 'Tilkoblet' : 'Frakoblet',
          color: S.sync ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--ka29e97,#a29e97)'
        },
        {
          isInfo: true,
          label: 'Brukere på serveren',
          value: s.serverUsers
            ? s.serverUsers.n + ' (' + s.serverUsers.admins + ' administrator)'
            : ACCOUNTS.length + ' (' + ACCOUNTS.filter(a => a.admin).length + ' administrator)',
          color: 'var(--k4d8a5a,#4d8a5a)'
        }
      ];
    else if (TB === 'duck')
      rows = [
        head('DUCKDNS'),
        note(
          'DuckDNS gir serveren et fast navn selv om IP-adressen hjemme endrer seg. Serveren sender IP-adressen sin til DuckDNS med jevne mellomrom.'
        ),
        togX('Bruk DuckDNS', d.on, () => this.dk({ on: !d.on })),
        togX('Bruk DuckDNS-adressen i delingslenker og invitasjoner', d.on && d.links !== false, () =>
          this.dk({ links: d.links === false })
        ),
        fld('Subdomene', d.domain, x => this.dk({ domain: x.trim().toLowerCase() }), {
          ph: 'mitt-navn',
          suffix: '.duckdns.org',
          err: dErr
        }),
        fld('Token', d.token, x => this.dk({ token: x.trim() }), {
          type: du.showToken ? 'text' : 'password',
          ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          eye: () => this.dku({ showToken: !du.showToken }),
          eyeLabel: du.showToken ? 'Skjul' : 'Vis',
          err: tErr,
          help: 'Står øverst på duckdns.org når du er logget inn.'
        }),
        segX(
          'Oppdater IP hvert',
          d.interval,
          [
            ['5 min', 5],
            ['10 min', 10],
            ['30 min', 30]
          ],
          x => this.dk({ interval: x })
        ),
        togX('Oppdater IPv6 også', d.ipv6, () => this.dk({ ipv6: !d.ipv6 })),
        togX('HTTPS med Let’s Encrypt (DNS-01 via DuckDNS)', d.tls, () => this.dk({ tls: !d.tls })),
        btns([
          [du.busy ? 'Oppdaterer …' : 'Oppdater nå', this.duckUpdate, true, du.busy || !d.domain || !d.token],
          [
            'Bruk som serveradresse',
            () => {
              this.setS('server', duckAddr);
              this.toast('Serveradressen er satt til ' + duckAddr);
            },
            false,
            !d.domain || !!dErr
          ]
        ])
      ];
    else if (TB === 'smtp') {
      const ms = x =>
        this.setState(st => {
          const n = { ...st.smtp, ...x };
          n.from = smtpFrom(n);
          return { smtp: n, smtpUi: { ...st.smtpUi, test: null } };
        });
      const pv = mt.provider || 'custom';
      const setPv = k =>
        ms({
          provider: k,
          ...SMTP_PRESETS[k],
          ...(k === 'proton' && !mt.user ? { user: ME.email, fromName: mt.fromName || ME.name } : {})
        });
      const pErr =
        pv === 'proton' && mt.user && PROTON_FREE.test(mt.user)
          ? '@proton.me-adresser kan ikke få SMTP-token. Bruk adressen på ditt eget domene, eller velg Proton Bridge.'
          : pv === 'proton' && mt.user && !EMAIL_RE.test(mt.user)
            ? 'Skriv hele adressen, f.eks. sebastian@kristo.no.'
            : '';
      const steps = {
        proton: [
          'Du trenger et betalt Proton Mail-abonnement (Mail Plus, Unlimited eller Business) og en adresse på eget domene, for eksempel ' +
            ME.email +
            '. Adresser på @proton.me kan ikke brukes her.',
          'Logg inn på proton.me og gå til Innstillinger › Alle innstillinger › IMAP/SMTP › SMTP-tokens.',
          'Trykk «Generer token». Kall det «Kobling» og velg adressen invitasjonene skal sendes fra.',
          'Skriv inn Proton-passordet ditt. Kopier SMTP-brukernavnet og tokenet med en gang. Proton viser tokenet bare én gang.',
          'Lim dem inn under, og trykk «Send test-e-post».',
          'Sjekk at SPF, DKIM og DMARC er grønne under Innstillinger › Domenenavn i Proton. Ellers kan invitasjonene havne i søppelpost.'
        ],
        bridge: [
          'Bruk dette hvis du bare har en @proton.me-adresse. Proton Mail Bridge krever betalt abonnement.',
          'Installer Proton Mail Bridge på maskinen som kjører Kobling-serveren, og logg inn.',
          'Åpne «Mailbox details» i Bridge og kopier brukernavn og passord. Det er ikke Proton-passordet ditt.',
          'Bridge må stå på hele tiden, ellers sendes ingen e-post.'
        ]
      };
      rows = [
        head('E-POST (SMTP)'),
        note('Invitasjoner, varsler om kommentarer og dokumenter du deler sendes fra din egen e-postadresse.'),
        segX(
          'Leverandør',
          pv,
          [
            ['Proton Mail', 'proton'],
            ['Proton Bridge', 'bridge'],
            ['Gmail', 'gmail'],
            ['Outlook', 'outlook'],
            ['Annen', 'custom']
          ],
          setPv
        ),
        ...(steps[pv]
          ? [
              {
                isSteps: true,
                label: pv === 'proton' ? 'SLIK KOBLER DU TIL PROTON MAIL' : 'SLIK BRUKER DU PROTON BRIDGE',
                steps: steps[pv].map((t, i) => ({ n: i + 1, t }))
              }
            ]
          : []),
        ...(pv === 'proton'
          ? [
              {
                isInfo: true,
                label: 'Server',
                value: 'smtp.protonmail.ch · 587 · STARTTLS',
                color: 'var(--k4d8a5a,#4d8a5a)'
              },
              fld('SMTP-brukernavn', mt.user, x => ms({ user: x.trim() }), {
                ph: ME.email,
                err: pErr,
                help: 'Adressen Proton viser sammen med tokenet.'
              }),
              fld('SMTP-token', mt.pass, x => ms({ pass: x.trim() }), {
                type: mu.showPass ? 'text' : 'password',
                ph: 'Lim inn tokenet fra Proton',
                eye: () => this.setState(st => ({ smtpUi: { ...st.smtpUi, showPass: !st.smtpUi.showPass } })),
                eyeLabel: mu.showPass ? 'Skjul' : 'Vis',
                help: 'Ikke Proton-passordet ditt. Slett tokenet i Proton for å stoppe utsending.'
              }),
              fld('Avsendernavn', mt.fromName, x => ms({ fromName: x }), { ph: ME.name })
            ]
          : [
              fld('SMTP-server', mt.host, x => ms({ host: x.trim() }), { ph: 'smtp.eksempel.no' }),
              segX(
                'Sikkerhet',
                mt.sec,
                [
                  ['STARTTLS', 'starttls'],
                  ['SSL/TLS', 'ssl'],
                  ['Ingen', 'none']
                ],
                x => ms({ sec: x })
              ),
              fld('Port', mt.port, x => ms({ port: x.trim() }), { err: intErr(mt.port || '0', 1, 65535) }),
              fld('Brukernavn', mt.user, x => ms({ user: x.trim() }), { ph: pv === 'gmail' ? 'navn@gmail.com' : '' }),
              fld('Passord', mt.pass, x => ms({ pass: x }), {
                type: mu.showPass ? 'text' : 'password',
                eye: () => this.setState(st => ({ smtpUi: { ...st.smtpUi, showPass: !st.smtpUi.showPass } })),
                eyeLabel: mu.showPass ? 'Skjul' : 'Vis',
                help: pv === 'gmail' ? 'Bruk et app-passord fra myaccount.google.com › Sikkerhet.' : ''
              }),
              ...(pv === 'bridge'
                ? [fld('Avsendernavn', mt.fromName, x => ms({ fromName: x }), { ph: ME.name })]
                : [fld('Avsender', mt.from, x => ms({ from: x }), { ph: ME.name + ' <' + ME.email + '>' })])
            ]),
        { isInfo: true, label: 'Sendes som', value: smtpFrom(mt) || '–', color: 'var(--k4a4742,#4a4742)' },
        togX('Varsle på e-post om nye kommentarer', mt.notify, () => ms({ notify: !mt.notify })),
        btns([[mu.testing ? 'Tester …' : 'Send test-e-post', this.testSmtp, true, mu.testing]]),
        ...(mu.test
          ? [
              {
                isInfo: true,
                label: mu.test.ok ? 'OK' : 'Feil',
                value: mu.test.msg,
                color: mu.test.ok ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--kb3261e,#b3261e)'
              }
            ]
          : []),
        {
          isInfo: true,
          label: 'Status',
          value: this.smtpOk()
            ? 'Klar. Invitasjoner sendes fra ' + (mt.user || smtpFrom(mt))
            : 'Ikke satt opp. E-post legges i utboksen.',
          color: this.smtpOk() ? 'var(--k4d8a5a,#4d8a5a)' : 'var(--kb26a1e,#b26a1e)'
        }
      ];
    } else if (TB === 'backup')
      rows = [
        head('BACKUP TIL SMB-SHARE'),
        note(
          'Dokumenter, figurer og versjonshistorikk pakkes og kopieres til en delt mappe på NAS-en, for eksempel Unraid, TrueNAS eller Windows.'
        ),
        togX('Automatisk backup', bk.on, () => this.sb({ on: !bk.on })),
        this.smbRow(bk, bu),
        segX(
          'Tidsplan',
          bk.schedule,
          [
            ['Hver time', 'hourly'],
            ['Daglig 03:00', 'daily'],
            ['Ukentlig', 'weekly']
          ],
          x => this.sb({ schedule: x })
        ),
        segX(
          'Behold',
          bk.keep,
          [
            ['7', 7],
            ['14', 14],
            ['30', 30]
          ],
          x => this.sb({ keep: x })
        ),
        head('INNHOLD'),
        togX('Dokumenter (.tex og blokker)', bk.incl.docs, () =>
          this.sb({ incl: { ...bk.incl, docs: !bk.incl.docs } })
        ),
        togX('Figurer og kretsskjema', bk.incl.figs, () => this.sb({ incl: { ...bk.incl, figs: !bk.incl.figs } })),
        togX('Versjonshistorikk og kommentarer', bk.incl.hist, () =>
          this.sb({ incl: { ...bk.incl, hist: !bk.incl.hist } })
        ),
        togX('Brukere og innstillinger', bk.incl.users, () => this.sb({ incl: { ...bk.incl, users: !bk.incl.users } })),
        btns([
          [bu.testing ? 'Tester …' : 'Test tilkobling', this.testSmb, false, bu.testing || !!bu.run],
          [bu.run ? 'Kjører …' : 'Kjør backup nå', this.runBackup, true, !!bu.run]
        ])
      ];
    else {
      const pf2 = (k, label, o) => fld(label, dep[k], x => this.dp({ [k]: x.trim() }), o || {});
      rows = [
        head('INSTALLER SERVER'),
        segX(
          'Plattform',
          dep.target,
          [
            ['Proxmox (LXC)', 'proxmox'],
            ['Unraid', 'unraid'],
            ['Docker Compose', 'compose']
          ],
          x => this.dp({ target: x })
        ),
        ...(dep.target === 'proxmox'
          ? [
              pf2('ctid', 'CT-ID', { err: intErr(dep.ctid, 100, 999999999) }),
              pf2('hostname', 'Vertsnavn', {
                err: /^[a-z0-9-]+$/i.test(dep.hostname) ? '' : 'Bare bokstaver, tall og bindestrek.'
              }),
              pf2('cores', 'CPU-kjerner', { err: intErr(dep.cores, 1, 64) }),
              pf2('ram', 'Minne (MB)', { err: intErr(dep.ram, 512, 262144) }),
              pf2('disk', 'Disk (GB)', { err: intErr(dep.disk, 4, 4096) }),
              pf2('storage', 'Lagring', { ph: 'local-lvm' }),
              pf2('bridge', 'Nettverksbro', { ph: 'vmbr0' }),
              pf2('ip', 'IP-adresse', {
                ph: 'dhcp',
                help: 'dhcp eller statisk, f.eks. 192.168.1.50/24',
                err:
                  dep.ip !== 'dhcp' && !/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(dep.ip)
                    ? 'Skriv dhcp eller en adresse med maske.'
                    : ''
              }),
              ...(dep.ip !== 'dhcp'
                ? [
                    pf2('gw', 'Gateway', {
                      ph: '192.168.1.1',
                      err: !/^\d{1,3}(\.\d{1,3}){3}$/.test(dep.gw) ? 'Skriv gateway-adressen.' : ''
                    })
                  ]
                : []),
              pf2('port', 'Port', { err: intErr(dep.port, 1, 65535) })
            ]
          : dep.target === 'unraid'
            ? [
                pf2('port', 'Port', { err: intErr(dep.port, 1, 65535) }),
                pf2('appdata', 'Appdata-sti', { ph: '/mnt/user/appdata/kobling' })
              ]
            : [
                pf2('port', 'Port', { err: intErr(dep.port, 1, 65535) }),
                pf2('datadir', 'Datamappe', { ph: './data' })
              ]),
        note('Innstillingene fra DuckDNS og Backup til SMB tas med automatisk i filene til høyre.')
      ];
    }
    v.setRows = rows;
    v.isDuckTab = TB === 'duck';
    v.isBackupTab = TB === 'backup';
    v.isInstallTab = TB === 'install';
    v.resetDemo = this.resetDemo;
    v.duckAddr = duckAddr || '–';
    v.duckIp = du.ip || '–';
    v.duckLast = du.last || 'Aldri';
    v.duckNext = !d.on ? 'DuckDNS er av' : du.last ? 'Om ' + d.interval + ' min' : 'Etter første oppdatering';
    v.duckLog = du.log.map(l => ({
      txt: l.t + '  ' + l.txt,
      color: l.ok ? 'var(--k3d6b47,#3d6b47)' : 'var(--kb3261e,#b3261e)'
    }));
    v.noDuckLog = !du.log.length;
    v.duckPortNote = 'Videresend TCP ' + (d.tls ? '443' : dep.port) + ' i ruteren til serveren for å nå den utenfra. Virker ikke adressen hjemmefra, prøv fra mobilnett: mange rutere sender ikke trafikk til egen offentlig IP tilbake inn (NAT-loopback).';
    v.hasSmbTest = !!bu.test;
    v.smbTestMsg = bu.test ? bu.test.msg : '';
    v.smbTestColor = bu.test && bu.test.ok ? 'var(--k3d6b47,#3d6b47)' : 'var(--kb3261e,#b3261e)';
    v.smbTestBg =
      bu.test && bu.test.ok
        ? 'var(--koklch096003150,oklch(0.96 0.03 150))'
        : 'var(--koklch09600325,oklch(0.96 0.03 25))';
    v.smbRunning = !!bu.run;
    v.smbPct = bu.run ? Math.min(100, Math.round(bu.run.pct)) : 0;
    v.smbStep = bu.run ? bu.run.step : '';
    v.smbTarget = bk.host ? '//' + bk.host + '/' + bk.share + '/' + bk.path : 'Ikke satt opp';
    v.backupNext = bk.on
      ? 'Neste automatiske backup: ' +
        (bk.schedule === 'hourly'
          ? 'innen en time'
          : bk.schedule === 'daily'
            ? 'i natt kl. 03:00'
            : 'mandag kl. 03:00') +
        ' · beholder ' +
        bk.keep
      : 'Automatisk backup er av.';
    v.backupList = s.backups.map(k => ({
      name: k.name,
      meta: k.date + ' ' + k.time + ' · ' + k.size + ' · ' + k.files + ' filer',
      onRestore: () => this.openRestore(k),
      isRemote: !!k.remote,
      onDownload: () => {
        download(k.name.replace('.tar.zst', '.json'), JSON.stringify(k.docs, null, 2), 'application/json');
        this.toast('Backup lastet ned');
      }
    }));
    v.noBackups = !s.backups.length;
    v.fetchBackups = this.fetchBackups;
    v.fetchLabel = s.fetchingBk ? 'Henter …' : 'Hent fra sharen';
    v.pickBackupFile = () => {
      const el = this.bkFileRef.current;
      if (el) el.click();
    };
    v.bkFileRef = this.bkFileRef;
    v.onBackupFile = this.onBackupFile;
    v.hasCmd = dep.target !== 'unraid';
    v.cmdShown = dep.target === 'proxmox' ? (G ? G.pveOneLiner(masked) : 'Laster …') : 'docker compose up -d';
    v.copyCmd = () => this.copyText(dep.target === 'proxmox' && G ? G.pveOneLiner(cfg) : 'docker compose up -d');
    v.steps = (
      dep.target === 'proxmox'
        ? [
            'Åpne Shell på Proxmox-noden (Datacenter › node › Shell).',
            'Lim inn kommandoen og trykk Enter. Skriptet laster ned Debian 12, oppretter CT ' +
              dep.ctid +
              ' og installerer Docker.',
            'Eller last ned install.sh til høyre og kjør bash install.sh.',
            'Åpne adressen skriptet skriver ut og legg den inn under Server og konto.'
          ]
        : dep.target === 'unraid'
          ? [
              'Last ned my-kobling-server.xml til høyre.',
              'Kopier filen til /boot/config/plugins/dockerMan/templates-user/ (for eksempel via \\\\tower\\flash).',
              'Gå til Docker › Add Container og velg kobling-server under Template.',
              'Sjekk verdiene og trykk Apply. WebUI åpnes på port ' + dep.port + '.'
            ]
          : [
              'Last ned docker-compose.yml og .env til høyre og legg dem i samme mappe.',
              'Kjør kommandoen i mappen.',
              'Åpne http://<server>:' + dep.port + ' og legg adressen inn under Server og konto.'
            ]
    ).map((x, i) => ({ n: i + 1, text: x }));
    const envOf = (c, re) =>
      G
        ? G.envFile(c)
            .split('\n')
            .filter(l => re.test(l))
            .join('\n')
        : '';
    let file;
    if (TB === 'mal' || TB === 'komp' || TB === 'konto') {
      const p = preamble(S).join('\n');
      file = {
        title: 'Generert preamble',
        sub: 'Oppdateres med valgene',
        text: p,
        real: p,
        tex: true,
        dl: [['preamble.tex', p]]
      };
    } else if (TB === 'server')
      file = {
        title: '.env',
        sub: 'Miljøvariabler for serveren',
        text: G ? G.envFile(masked) : 'Laster …',
        real: G ? G.envFile(cfg) : '',
        dl: G ? [['kobling.env', G.envFile(cfg)]] : []
      };
    else if (TB === 'duck') {
      const mk = c =>
        '# Serveren sender denne forespørselen hvert ' +
        d.interval +
        '. minutt\ncurl -s "https://www.duckdns.org/update?domains=' +
        (d.domain || '<subdomene>') +
        '&token=' +
        (c.duck.token || '<token>') +
        '&ip=' +
        (d.ipv6 ? '&ipv6=<ipv6>' : '') +
        '"\n# DuckDNS svarer OK (oppdatert) eller KO (feil subdomene eller token)\n\n' +
        envOf(c, /^(KOBLING_PUBLIC_URL|DUCKDNS|TLS)/);
      file = { title: 'DuckDNS', sub: 'Forespørsel og variabler', text: mk(masked), real: mk(cfg), dl: [] };
    } else if (TB === 'smtp') {
      const mk = c => '# Brukes for invitasjoner, varsler og «Send på e-post»\n' + envOf(c, /^(SMTP|NOTIFY)/);
      file = { title: '.env (e-post)', sub: 'SMTP-variabler', text: mk(masked), real: mk(cfg), dl: [] };
    } else if (TB === 'backup') {
      const inc =
        Object.entries({ docs: 'documents', figs: 'figures', hist: 'history', users: 'users.db' })
          .filter(([k]) => bk.incl[k])
          .map(([, x]) => x)
          .join(' ') || '(ingenting valgt)';
      const mk = c =>
        '# Kjøres av serveren etter BACKUP_CRON\nF=kobling-$(date +%F_%H%M).tar.zst\ntar -C /data -c ' +
        inc +
        ' | zstd -q > /tmp/$F\nsmbclient "//' +
        (bk.host || '<server>') +
        '/' +
        bk.share +
        '" -U "' +
        bk.domain +
        '\\' +
        (bk.user || '<bruker>') +
        '%' +
        (c.smb.pass || '<passord>') +
        '" -m SMB' +
        (bk.ver === '2.1' ? '2' : '3') +
        ' \\\n  -c "mkdir ' +
        bk.path +
        '; cd ' +
        bk.path +
        '; put /tmp/$F $F"\n# Bare de ' +
        bk.keep +
        ' nyeste beholdes på sharen\n\n' +
        envOf(c, /^BACKUP/);
      file = { title: 'Backup-jobb', sub: 'smbclient, ingen mount nødvendig', text: mk(masked), real: mk(cfg), dl: [] };
    } else if (TB === 'update') {
      const ver = (s.updUi.found && s.updUi.found.ver) || 'latest';
      const sh =
        dep.target === 'proxmox'
          ? '#!/usr/bin/env bash\n# Kjør på Proxmox-noden (Kobling er installert direkte i containeren)\npct exec ' +
            dep.ctid +
            ' -- kobling-update'
          : dep.target === 'unraid'
            ? '# Unraid: Docker › kobling-server › Check for updates › Apply update\n# eller i terminal:\ndocker pull ghcr.io/sebastiankristo/kobling-server:latest\ndocker restart kobling-server'
            : '#!/usr/bin/env bash\ncd ' +
              (dep.datadir || '.').replace(/\/data$/, '') +
              '\ndocker compose pull\ndocker compose up -d\ndocker image prune -f';
      file = {
        title: 'update.sh',
        sub:
          'Manuell oppdatering (' +
          (dep.target === 'proxmox' ? 'Proxmox' : dep.target === 'unraid' ? 'Unraid' : 'Docker Compose') +
          ')',
        text: sh,
        real: sh,
        dl: [['update.sh', sh]]
      };
    } else if (!G)
      file = {
        title: 'Filer',
        sub: '',
        text: this.genErr ? 'Kunne ikke laste deploy/generators.js' : 'Laster …',
        real: '',
        dl: []
      };
    else if (dep.target === 'proxmox')
      file = {
        title: 'install.sh',
        sub: 'Proxmox VE 8 · Debian 12 LXC',
        text: G.pveScript(masked),
        real: G.pveScript(cfg),
        dl: [['install.sh', G.pveScript(cfg)]]
      };
    else if (dep.target === 'unraid')
      file = {
        title: 'my-kobling-server.xml',
        sub: 'Unraid Docker-mal',
        text: G.unraidXml(masked),
        real: G.unraidXml(cfg),
        dl: [['my-kobling-server.xml', G.unraidXml(cfg)]]
      };
    else
      file = {
        title: 'docker-compose.yml + .env',
        sub: 'Docker Compose',
        text: G.composeYml(cfg) + '\n\n# ---- .env ----\n' + G.envFile(masked),
        real: G.composeYml(cfg),
        dl: [
          ['docker-compose.yml', G.composeYml(cfg)],
          ['kobling.env', G.envFile(cfg)]
        ]
      };
    v.fileTitle = file.title;
    v.fileSub = file.sub;
    v.fileLines = file.text.split('\n').map(x => ({ parts: file.tex ? tok(x) : tokSh(x) }));
    v.fileBtns = [
      { label: 'Kopier', onClick: () => this.copyText(file.real) },
      ...file.dl.map(([n, txt]) => ({
        label: 'Last ned ' + n,
        onClick: () => {
          download(n, txt);
          this.toast(n + ' lastet ned');
        }
      }))
    ];

    const c = s.circ;
    if (c) {
      const bk = doc.blocks.find(b => b.id === c.bid);
      v.circFile = bk ? 'figurer/' + bk.label.replace('fig:', '') + '.kob' : 'krets.kob';
      v.circInsertLabel = `Lagre som Figur ${bk ? nb.num[bk.id] : ''}`;
      v.circCancel = () => this.setState({ view: 'editor', circ: null });
      v.circInsert = () => {
        this.updBlock(c.bid, { circuit: { ...clone(c.data), manual: !c.auto } }, 'Oppdaterte kretsskjema');
        this.activeSrc = 'circuit';
        this.setState({ view: 'editor', circ: null, active: c.bid });
        this.toast('Kretsskjemaet er lagret i dokumentet');
      };
      v.circSvg = drawCircuit(c.data, {
        interactive: true,
        pad: 40,
        sel: c.sel,
        tool: c.tool,
        pending: c.pending,
        style: S.style,
        dec,
        onComp: this.onComp,
        onTerm: this.onTerm,
        onWire: this.onWire,
        onBg: this.onBg
      });
      v.circTools = [
        ['Velg', 'select', 'V'],
        ['Ledning', 'wire', 'W']
      ].map(([l, k, key]) => ({
        label: l,
        key,
        onClick: () => this.circSet({ tool: k, pending: null }),
        bg: c.tool === k ? 'var(--kfff,#fff)' : 'transparent',
        color: c.tool === k ? 'var(--k1f1e1c,#1f1e1c)' : 'var(--k6b6862,#6b6862)',
        shadow: c.tool === k ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
      }));
      v.layoutOpts = [
        ['Auto', true],
        ['Manuell', false]
      ].map(([l, on]) => ({
        label: l,
        onClick: () => {
          if (c.auto !== on) this.setAuto(on);
        },
        bg: c.auto === on ? 'var(--kfff,#fff)' : 'transparent',
        color: c.auto === on ? 'var(--k1f1e1c,#1f1e1c)' : 'var(--k6b6862,#6b6862)',
        shadow: c.auto === on ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
      }));
      v.showTidy = !c.auto;
      v.tidyNow = this.tidyNow;
      v.circHint =
        c.auto && c.tool !== 'wire'
          ? 'Auto: legg til komponenter og koble dem, så plasseres de ryddig. Dra en komponent for å plassere selv.'
          : c.tool === 'wire'
            ? c.pending
              ? 'Klikk et annet tilkoblingspunkt for å koble · Esc avbryter'
              : 'Klikk et tilkoblingspunkt for å starte en ledning'
            : 'Dra for å flytte · R roterer · ⌫ sletter · W for ledning';
      v.circCode = circLines(c.data, S.style).map((l, i) => ({
        n: i + 1,
        parts: tok(l.s),
        bg: l.cid && l.cid === c.sel ? HL : 'transparent',
        onClick: () => l.cid && this.circSet({ sel: l.cid })
      }));
      const q = s.palQ.trim().toLowerCase(),
        icDark = themeAttr === 'dark',
        icInk = icDark ? '#e6ebf1' : '#16181d',
        icBg = icDark ? '#222a35' : '#fff';
      v.palette = PAL.map(g => ({
        label: g.g,
        items: g.items
          .filter(k => !q || CT[k].n.toLowerCase().includes(q) || k.includes(q))
          .map(k => {
            const T = CT[k];
            const big = !T.two && !T.gate && T.pins.length === 3;
            return {
              name: T.n,
              onClick: () => this.addComp(k),
              icon: h(
                'svg',
                {
                  width: T.two || T.gate || k === 'opamp' ? 62 : big ? 34 : 32,
                  height: big || k === 'opamp' ? 40 : 32,
                  viewBox: iconVB(k),
                  fill: 'none',
                  stroke: icInk,
                  strokeWidth: T.gate || k === 'opamp' || big ? 2.8 : 2.4
                },
                symEls(k, S.style, icBg, icInk)
              )
            };
          })
      })).filter(g => g.items.length);
      const sc = c.sel && !c.sel.startsWith('w:') ? c.data.comps.find(k => k.id === c.sel) : null;
      v.hasSelComp = !!sc;
      v.hasSelWire = !!(c.sel && c.sel.startsWith('w:'));
      v.noSel = !c.sel;
      v.ins = sc
        ? {
            title: CT[sc.type].n,
            hasName: sc.type === 'net' || !!CT[sc.type].p,
            nameLabel: sc.type === 'net' ? 'Nettnavn og indeks' : 'Navn og indeks',
            name: sc.name,
            sub: sc.sub,
            onName: e => this.updComp(() => ({ name: e.target.value })),
            onSub: e => this.updComp(() => ({ sub: e.target.value })),
            hasVal: !!sc.val,
            num: sc.val ? sc.val.num : '',
            prefix: sc.val ? sc.val.prefix : '',
            unit: sc.val ? sc.val.unit : '',
            onNum: e => {
              const x = e.target.value;
              this.updComp(k => ({ val: { ...k.val, num: x } }));
            },
            onPrefix: e => {
              const x = e.target.value;
              this.updComp(k => ({ val: { ...k.val, prefix: x } }));
            },
            onUnit: e => {
              const x = e.target.value;
              this.updComp(k => ({ val: { ...k.val, unit: x } }));
            },
            code: sc.val ? qtyCode(sc.val) : '',
            err: sc.val && !/^-?\d+([.,]\d+)?$/.test(sc.val.num.trim()) ? 'Verdien må være et tall.' : '',
            canRotate: !!CT[sc.type].two,
            onRotate: () => this.rotateSel(),
            hasIc: !!CT[sc.type].gate,
            ic: sc.ic || '',
            onIc: e => {
              const x = e.target.value;
              this.updComp(() => ({ ic: x }));
            },
            hasPins: !!CT[sc.type].io,
            pinRows: CT[sc.type].io
              ? CT[sc.type].pins.map(([k]) => {
                  const pl = (sc.pinl && sc.pinl[k]) || {};
                  return {
                    label: PINLBL[k] || k,
                    name: pl.name || '',
                    pin: pl.pin || '',
                    ph: PINPH[k] || '',
                    onName: e => {
                      const x = e.target.value;
                      this.updComp(q => ({
                        pinl: { ...(q.pinl || {}), [k]: { ...((q.pinl || {})[k] || {}), name: x } }
                      }));
                    },
                    onPin: e => {
                      const x = e.target.value;
                      this.updComp(q => ({
                        pinl: { ...(q.pinl || {}), [k]: { ...((q.pinl || {})[k] || {}), pin: x } }
                      }));
                    }
                  };
                })
              : []
          }
        : { pinRows: [] };
      v.prefixOpts = PFX.map(x => ({ k: x.k, label: x.s || '–' }));
      v.unitOpts = UNITS.map(x => ({ k: x.k, label: x.s }));
      const gates = c.data.comps.filter(k => (CT[k.type] || {}).gate).length,
        nands = c.data.comps.filter(k => k.type === 'nand').length;
      v.circCount = c.data.comps.length;
      v.wireCount = c.data.wires.length;
      v.gateCount = gates;
      v.icCount = Math.ceil(nands / 4);
    } else {
      v.circFile = '';
      v.palette = [];
      v.circCode = [];
      v.circTools = [];
      v.layoutOpts = [];
      v.ins = { pinRows: [] };
      v.prefixOpts = [];
      v.unitOpts = [];
    }
    const ps = s.paste;
    v.pasteOpen = !!ps;
    v.pasteText = ps ? ps.text : '';
    v.onPasteText = e =>
      this.setState({ paste: { ...this.state.paste, text: e.target.value, err: '', done: false, warn: [] } });
    v.pasteErr = ps ? ps.err : '';
    v.pasteWarn = ps && ps.warn ? ps.warn.slice(0, 6).map(t => ({ t })) : [];
    v.hasPasteWarn = !!(ps && ps.warn && ps.warn.length);
    v.closePaste = () => this.setState({ paste: null });
    v.applyPaste = this.applyPaste;
    v.pasteIsCircuit = !!ps && ps.target === 'circuit';
    v.pasteModes = ps
      ? [
          ['Erstatt skjemaet', 'replace'],
          ['Legg til ved siden av', 'add']
        ].map(([l, k]) => ({
          label: l,
          onClick: () => this.setState({ paste: { ...ps, mode: k } }),
          bg: ps.mode === k ? 'var(--kfff,#fff)' : 'transparent',
          shadow: ps.mode === k ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
        }))
      : [];
    v.openPaste = () => this.openPaste('');
    v.pasteBtn = ps && ps.done ? 'Lukk' : 'Importer';
    v.pasteAct = ps && ps.done ? v.closePaste : this.applyPaste;
    v.delSel = this.delSel;
    v.palQ = s.palQ;
    v.onPalQ = e => this.setState({ palQ: e.target.value });
    v.edRef = this.edRef;
    v.pdfRef = this.pdfRef;
    v.rootRef = this.rootRef;
    v.fileRef = this.fileRef;
    v.onFilePick = this.onFilePick;
    v.edDragOver = this.edDragOver;
    v.edDragLeave = this.edDragLeave;
    v.edDrop = this.edDrop;
    v.edPaste = this.edPaste;
    v.dragEnd = () => this.state.dropAt && this.setState({ dropAt: null });
    v.colOpts = [
      ['1 spalte', 1],
      ['2 spalter', 2]
    ].map(([l, c]) => ({
      label: l,
      onClick: () => {
        this.setS('cols', c);
        this.toast(c === 2 ? 'Tospalte, som i malen' : 'Én spalte');
      },
      bg: S.cols === c ? 'var(--kfff,#fff)' : 'transparent',
      shadow: S.cols === c ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
      fw: S.cols === c ? 600 : 400
    }));
    const rw = Math.max(320, Math.min(s.rightW, (window.innerWidth || 1440) - (s.sideHidden ? 0 : 246) - 380));
    v.rightW = rw;
    const z = Math.max(0.6, Math.min(2.4, (rw - 56) / 440));
    v.pdfZoom = z;
    v.zoomLabel = Math.round(z * 100) + ' %';
    v.onResizeDown = this.onResizeDown;
    v.resetSplit = () => this.setState({ rightW: 500 });
    v.splitPresets = [
      ['Smal', 360],
      ['Lik', Math.round((window.innerWidth - 236) / 2)],
      ['Bred', Math.round((window.innerWidth - 236) * 0.62)]
    ].map(([l, w]) => ({
      label: l,
      onClick: () => this.setState({ rightW: Math.max(320, Math.min(window.innerWidth - 236 - 380, w)) })
    }));
    v.fileMenuOpen = s.fileMenu;
    v.toggleFileMenu = e => {
      e.stopPropagation();
      this.setState(x => ({ fileMenu: !x.fileMenu, share: false }));
    };
    v.closeFileMenu = () => this.setState({ fileMenu: false });
    {
      const mk = ([label, key, icon, fn]) => ({
          label,
          key,
          icon,
          onClick: () => {
            this.setState({ fileMenu: false });
            fn();
          }
        }),
        nImg = doc.blocks.filter(b => b.type === 'img').length;
      v.fileItemsNew = [
        [
          'Nytt dokument …',
          MOD + 'N',
          'M8 3.5v9M3.5 8h9',
          () => this.setState({ newProj: { title: '', tpl: 'rapport', err: '' } })
        ],
        ['Dupliser dokument', '', 'M5.5 5.5h7v7h-7zM10.5 5.5v-2h-7v7h2', () => this.duplicateDoc()],
        ['Last opp bilder …', '', 'M8 11V3.5M5 6.5l3-3 3 3M3 12.5h10', () => this.pickImage({ library: true })]
      ].map(mk);
      v.fileItemsExp = [
        [
          'PDF',
          MOD + 'P',
          'M4 1.75h5.25L12.5 5v9.25H4zM6 9.5h4M6 11.5h3',
          () => {
            this.setState({ view: 'editor', right: 'pdf' });
            setTimeout(this.printPdf, 300);
          }
        ],
        ['LaTeX-kildekode', '.tex', 'M6 5 3 8l3 3M10 5l3 3-3 3', () => v.downloadTex()],
        [
          'Bilder',
          nImg ? String(nImg) : '',
          'M2.5 3.5h11v9h-11zM2.5 10.5l3.5-3 3 2.5 2-1.5 2.5 2',
          () => {
            const im = doc.blocks.filter(b => b.type === 'img');
            if (!im.length) return this.toast('Dokumentet har ingen bilder');
            im.forEach((b, i) =>
              setTimeout(() => {
                try {
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(dataToBlob(b.src));
                  a.download = b.file;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                } catch (e) {}
              }, i * 250)
            );
          }
        ]
      ].map(mk);
      v.fileAllProjects = () => this.setState({ fileMenu: false, view: 'projects', circ: null });
      v.fileBtnBg = s.fileMenu ? 'var(--kfff,#fff)' : 'var(--kfbfaf8,#fbfaf8)';
      v.fileBtnBorder = s.fileMenu ? 'oklch(0.55 0.15 250)' : 'var(--ke2dfd9,#e2dfd9)';
      v.fileBtnRing = s.fileMenu
        ? '0 0 0 3px var(--koklch086006250,oklch(0.86 0.06 250))'
        : '0 1px 2px rgba(0,0,0,.06)';
      v.fileChevron = s.fileMenu ? 'rotate(180deg)' : 'none';
    }
    v.recentItems = s.recent
      .map(id => s.docs.find(x => x.id === id))
      .filter(Boolean)
      .slice(0, 6)
      .map(x => ({
        title: x.title,
        meta: x.folder + (x.id === s.cur ? ' · åpen nå' : ''),
        fw: x.id === s.cur ? 600 : 400,
        border: x.id === s.cur ? 'oklch(0.55 0.15 250)' : 'var(--ke2dfd9,#e2dfd9)',
        onClick: () => this.openDoc(x.id)
      }));
    v.hasRecent = v.recentItems.length > 0;
    const hv = s.hover;
    v.hoverOpen = !!hv && s.view === 'editor';
    v.hoverTop = hv ? hv.top : 0;
    v.hoverIsFig = !!hv && hv.kind === 'fig';
    v.hoverIsTex = !!hv && hv.kind === 'tex';
    v.hoverIsImg = !!hv && hv.kind === 'img';
    if (hv && hv.kind === 'fig') {
      const fb = doc.blocks.find(x => x.id === hv.bid);
      v.hoverTitle = fb ? 'figurer/' + fb.label.replace('fig:', '') + '.kob' : '';
      v.hoverSvg =
        fb && fb.circuit.comps.length ? drawCircuit(fb.circuit, { style: S.style, dec, k: 0.62, maxH: 200 }) : null;
      v.hoverEmpty = !v.hoverSvg;
      v.hoverMeta = fb
        ? 'Figur ' +
          nb.num[fb.id] +
          ' · ' +
          fb.circuit.comps.length +
          ' komponenter · ' +
          fb.circuit.wires.length +
          ' ledninger'
        : '';
      v.hoverCaption = fb ? fb.caption : '';
    } else if (hv && hv.kind === 'lib') {
      const lf = (doc.files || []).find(x => x.id === hv.fid);
      v.hoverIsImg = true;
      v.hoverTitle = lf ? 'bilder/' + lf.file : '';
      v.hoverImg = lf ? lf.src : '';
      v.hoverCaption = '';
      v.hoverMeta = 'Ikke brukt i dokumentet ennå · dra det inn eller klikk';
    } else if (hv && hv.kind === 'img') {
      const ib = doc.blocks.find(x => x.id === hv.bid);
      v.hoverTitle = ib ? 'bilder/' + ib.file : '';
      v.hoverImg = ib ? ib.src : '';
      v.hoverCaption = ib ? ib.caption : '';
      v.hoverMeta = ib
        ? 'Figur ' + nb.num[ib.id] + ' · ' + Math.round((ib.w || 0.8) * 100) + ' % av spaltebredden'
        : '';
    } else {
      v.hoverTitle = 'main.tex';
      v.hoverSvg = null;
      v.hoverEmpty = false;
      const words = doc.blocks.reduce(
        (n, x) => n + (x.type === 'p' ? plain(x, dec) : x.text || x.caption || '').split(/\s+/).filter(Boolean).length,
        0
      );
      v.hoverMeta =
        pages.length +
        ' ' +
        (pages.length === 1 ? 'side' : 'sider') +
        ' · ' +
        words +
        ' ord · ' +
        (S.cols === 2 ? 'tospalte' : 'enspalte');
      v.hoverCaption = '';
    }
    v.hoverDocTitle = doc.title;
    v.hoverHeads = doc.blocks
      .filter(x => x.type === 'h1')
      .slice(0, 7)
      .map(x => ({ t: nb.num[x.id] + ' ' + x.text }));
    v.hoverCols = S.cols === 2 ? '1fr 1fr' : '1fr';
    v.isDemo = true;
    return this._server ? this._server.view(v) : v;
  }
  account() {
    if (this._server) return this._server.account();
    return ACCOUNTS.find(a => a.id === this.state.me) || ACCOUNTS[0];
  }
  texEl(src, display) {
    const k = window.katex;
    if (!k)
      return React.createElement(
        'span',
        { style: { fontFamily: 'Geist Mono, monospace', fontSize: '0.75em', color: 'var(--k6b6862,#6b6862)' } },
        src
      );
    let html;
    try {
      html = k.renderToString(src, { displayMode: false, throwOnError: false, macros: { ...MACROS } });
    } catch (e) {
      html = src;
    }
    return React.createElement('span', { dangerouslySetInnerHTML: { __html: html } });
  }
  // Må stå sist: overstyrer demo-metodene over når appen kjører mot en server.
  _server = this.props.server ? this.props.server.attach(this) : null;
}
