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
  unesc,
  parseInline,
  parseBlock,
  ACCOUNTS,
  ADMIN_TABS,
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
import { symEls, drawCircuit } from '@kobling/ui';
import { DCLogic } from './dc-runtime';
import { CodeEditor } from './CodeEditor';
import { parseDocument } from '@kobling/core';
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
      { id: 'LA', name: 'Læringsassistent', initials: 'LA', color: '#bdb7ae', role: 'Kan kommentere' }
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
    smtp: { ...DEF_SMTP, ...((SAVED && SAVED.smtp) || {}) },
    smtpUi: { showPass: false, test: null, testing: false }
  };
  edRef = React.createRef();
  pdfRef = React.createRef();
  rootRef = React.createRef();
  fileRef = React.createRef();
  componentDidMount() {
    this._sel = () => this.onSel();
    document.addEventListener('selectionchange', this._sel);
    this._pst = e => this.onDocPaste(e);
    document.addEventListener('paste', this._pst);
    this._key = e => this.onKey(e);
    window.addEventListener('keydown', this._key);
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
      'me'
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
    if ((ps.docs !== this.state.docs || ps.comments !== this.state.comments) && !this._remote && this.bc) {
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
    if (m && k === 'e' && s.view === 'editor') {
      e.preventDefault();
      this.openPicker('qty');
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
      this.setState({ view: 'settings' });
      return;
    }
    if (m && e.altKey && k === 'l') {
      e.preventDefault();
      this.setState(x => ({ mode: x.mode === 'visual' ? 'split' : 'visual' }));
      return;
    }
    if (e.key === 'Escape') {
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
      this.setState({
        compile: { status: 'ok', time: (0.5 + Math.random() * 0.5).toFixed(1).replace('.', ',') },
        pdfSnap: clone(this.curDoc())
      });
    }, 650);
  };
  setDoc(fn, hist) {
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
    this.setState(s => ({ circ: { ...s.circ, ...(typeof p === 'function' ? p(s.circ) : p) } }));
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
  // Hele main.tex redigert i kodevisningen: les inn igjen som blokker (ukjent LaTeX beholdes ordrett).
  applyFullCode = text => {
    const doc = this.curDoc();
    let r;
    try {
      r = parseDocument(text, { S: this.state.settings, prev: doc });
    } catch (e) {
      this.setState({ codeErr: e.message });
      return false;
    }
    const next = { ...doc, ...r };
    if (this.state.codeErr) this.setState({ codeErr: '' });
    if (JSON.stringify(next) === JSON.stringify(doc)) return true;
    this.setDoc(() => next, this._codeHist ? null : 'Redigerte LaTeX-koden');
    this._codeHist = true;
    return true;
  };
  openCodeEdit = () => {
    const b = this.findBlock(this.state.active);
    if (!b) return;
    const lines = docCode(this.curDoc(), this.state.settings)
      .filter(l => l.bid === b.id)
      .map(l => l.s);
    this.setState({ codeEdit: { bid: b.id, text: lines.join('\n'), err: '' } });
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
    if (tg.replace) this.replaceImage(tg.replace, files[0]);
    else this.insertImages(files, tg.after);
  };
  edDragOver = e => {
    const ty = [...(e.dataTransfer.types || [])];
    const isF = ty.includes('Files'),
      isB = ty.includes('application/x-kobling-blk');
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
    if (files.length) return this.insertImages(files, afterId);
    if ([...(e.dataTransfer.files || [])].length) return this.toast('Bare bildefiler kan slippes her');
    const mv = e.dataTransfer.getData('application/x-kobling-blk');
    if (mv && at && mv !== at.bid) this.moveBlock(mv, afterId);
  };
  edPaste = e => {
    const tx = e.clipboardData && e.clipboardData.getData('text/plain');
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
      r = parseDocument(tx, { S: this.state.settings });
    } catch (err) {
      e.preventDefault();
      this.toast(err.message);
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
        preamble: r.preamble ? [d.preamble, r.preamble].filter(Boolean).join('\n') : d.preamble,
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
    const r = parseCircuit(p.text);
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
    if (tx && /\\(draw|node|begin\{circuitikz\})/.test(tx)) {
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
    const url =
      'https://' + (this.state.settings.server || 'kobling.app').replace(/^https?:\/\//, '') + '/d/' + slug(doc.title);
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
      bg: s.platform === k ? '#fff' : 'transparent',
      color: s.platform === k ? '#1f1e1c' : '#d9d5ce'
    }));
    const st = s.compile.status;
    v.statusText =
      st === 'ok'
        ? `Kompilert ${s.compile.time} s`
        : st === 'running'
          ? 'Kompilerer …'
          : 'Ikke kompilert · ' + MOD + 'S';
    v.statusColor = st === 'ok' ? '#4d8a5a' : st === 'running' ? 'oklch(0.55 0.12 75)' : '#8d8982';
    v.compile = this.compile;
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
      bg: s.mode === k ? '#fff' : 'transparent',
      color: s.mode === k ? '#1f1e1c' : '#6b6862',
      shadow: s.mode === k ? '0 1px 2px rgba(0,0,0,.1)' : 'none'
    }));
    v.showVisual = s.mode !== 'code';
    v.showCode = s.mode !== 'visual';
    v.showDrawer = true;
    v.showSplit = () => this.setState(x => ({ mode: x.mode === 'visual' ? 'split' : 'visual' }));
    v.splitLabel = s.mode === 'visual' ? 'Vis kode ⌥⌘L' : 'Skjul kode ⌥⌘L';
    v.toast = s.toast;
    v.hasToast = !!s.toast;

    const nb = numberDoc(doc.blocks);
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
            : b.type === 'fig' || b.type === 'img'
              ? `Figur ${nb.num[b.id]}: ${b.caption}`
              : b.type === 'table'
                ? `Tabell ${nb.num[b.id]}: ${b.caption}`
                : b.type === 'eq'
                  ? `Likning (${nb.num[b.id]})`
                  : 'Sammendrag';
    v.blocks = doc.blocks.map(b => {
      const act = s.active === b.id;
      const vm = {
        id: b.id,
        kind: KIND[b.type],
        isActive: act,
        ring: act ? ACCB : 'transparent',
        bgc: act ? '#fff' : 'transparent',
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
          const L = nb.labels[sg.target];
          return {
            isRef: true,
            key,
            label: nb.refText(sg.target),
            code: `\\cref{${sg.target}} · klikk for å gå dit`,
            color: L ? '#3d3a36' : '#b3261e',
            onClick: e => {
              e.stopPropagation();
              if (L) this.focusBlock(L.id, 'ref');
            }
          };
        });
        vm.showPh = b.segs.every(x => x.t === 'text' && !x.v) && !act;
      }
      if (b.type === 'raw') {
        vm.src = b.src;
        vm.rows = Math.min(24, Math.max(2, (b.src || '').split('\n').length));
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
      if (b.type === 'fig' || b.type === 'img') {
        vm.canSpan = S.cols === 2;
        vm.spanLabel = b.span ? '✓ Over begge spalter' : 'Over begge spalter';
        vm.spanBg = b.span ? ACCL : '#f3f1ed';
        vm.spanColor = b.span ? 'oklch(0.42 0.15 250)' : '#3d3a36';
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
          bg: (b.w || 0.8) === w ? '#fff' : 'transparent',
          shadow: (b.w || 0.8) === w ? '0 1px 2px rgba(0,0,0,.12)' : 'none'
        }));
        vm.onReplace = e => {
          e.stopPropagation();
          this.pickImage({ replace: b.id });
        };
      }
      if (b.type === 'fig' || b.type === 'table' || b.type === 'img') {
        vm.caption = b.caption || '\u200B';
        vm.rk = b.id + ':c:' + b.caption;
        vm.onCapBlur = e => this.saveField(b.id, 'caption', e.currentTarget.innerText);
      }
      if (b.type === 'table') {
        vm.rows = b.rows.map((r, ri) => ({
          bg: ri === 0 ? '#f6f4f0' : '#fff',
          fw: ri === 0 ? 600 : 400,
          cells: r.map((c, ci) => ({
            v: c || '\u200B',
            rk: `${b.id}:${ri}:${ci}:${c}`,
            onBlur: e => this.saveCell(b.id, ri, ci, e.currentTarget.innerText)
          }))
        }));
        vm.onAddRow = e => {
          e.stopPropagation();
          this.updBlock(b.id, x => ({ rows: [...x.rows, ['', '', '']] }), 'La til tabellrad');
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
          bg: st === k ? '#fff' : 'transparent',
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
      }
    ].map(x => ({
      ...x,
      sep: !!x.sep,
      bg: x.accent ? ACCL : '#fff',
      border: x.accent ? ACCB : '#e2dfd9',
      color: x.accent ? 'oklch(0.42 0.15 250)' : '#2f2d2a',
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
    v.codeEditor = h(CodeEditor, {
      lines: code,
      active: s.active,
      onApply: this.applyFullCode,
      onLine: bid => {
        this.activeSrc = 'code';
        this.setState({ active: bid });
      },
      onDone: () => (this._codeHist = false)
    });
    v.codeErr = s.codeErr || '';
    v.codeLines = code.map((l, i) => ({
      n: i + 1,
      parts: tok(l.s),
      bg: l.bid && l.bid === s.active ? HL : 'transparent',
      cursor: l.bid ? 'pointer' : 'default',
      onClick: () => l.bid && this.focusBlock(l.bid, 'code')
    }));
    v.copyCode = () => {
      try {
        navigator.clipboard.writeText(code.map(l => l.s).join('\n'));
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
    v.codeEditMsgColor = ce && ce.err ? '#b3261e' : '#6b6862';

    v.outline = doc.blocks
      .filter(b => b.type === 'h1' || b.type === 'h2' || b.type === 'abstract')
      .map(b => ({
        label: b.type === 'abstract' ? 'Sammendrag' : `${nb.num[b.id]} ${b.text || 'Uten tittel'}`,
        pad: b.type === 'h2' ? 24 : 8,
        bg: s.active === b.id ? '#fff' : 'transparent',
        color: s.active === b.id ? 'oklch(0.45 0.15 250)' : b.type === 'h2' ? '#7a766f' : '#4a4742',
        fw: s.active === b.id ? 600 : 400,
        onClick: () => this.focusBlock(b.id, 'outline')
      }));
    v.figFiles = doc.blocks
      .filter(b => b.type === 'fig')
      .map(b => ({
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
          label: 'bilder/' + b.file,
          onClick: () => {
            this.unhover();
            this.focusBlock(b.id, 'outline');
          },
          onEnter: e => this.hoverFile(e, { kind: 'img', bid: b.id }),
          onLeave: this.unhover
        }))
    );
    v.mainEnter = e => this.hoverFile(e, { kind: 'tex' });
    v.mainLeave = this.unhover;

    const pdoc = s.pdfSnap && s.pdfSnap.id === doc.id ? s.pdfSnap : doc;
    const pn = numberDoc(pdoc.blocks);
    const pages = paginate(pdoc.blocks, S.cols, dec);
    const refs = new Set();
    doc.blocks.forEach(b => b.type === 'p' && b.segs.forEach(x => x.t === 'ref' && refs.add(x.target)));
    const unref = doc.blocks.filter(
      b => (b.type === 'fig' || b.type === 'img' || b.type === 'table') && !refs.has(b.label)
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
      color: c.ok ? '#4d8a5a' : '#b26a1e',
      cursor: c.go ? 'pointer' : 'default',
      onClick: () => c.go && this.focusBlock(c.go.id, 'outline')
    }));
    v.indent = S.indent ? '1.2em' : '0';
    v.pages = pages.map((pg, pi) => ({
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
                  : { isRef: true, label: pn.refText(x.target) }
          );
        if (b.type === 'eq') vm.eqEl = this.texEl(b.src, false);
        if (b.type === 'fig')
          vm.svg = b.circuit.comps.length ? drawCircuit(b.circuit, { style: S.style, dec, k: 0.42, maxH: 110 }) : null;
        if (b.type === 'table') {
          const st = b.style || 'grid';
          vm.isTable = st !== 'list';
          vm.isTList = st === 'list';
          vm.items = b.rows
            .slice(1)
            .map(r => ({ t: listItem(r, false) }))
            .filter(x => x.t);
          vm.tOuter = st === 'grid' ? '0.6px solid #111' : 'none';
          vm.tTop = st === 'booktabs' ? '1px solid #111' : vm.tOuter;
          vm.tBot = vm.tTop;
          vm.tCell = st === 'grid' ? '0.6px solid #111' : 'none';
          vm.rows = b.rows.map((r, ri) => ({
            rule:
              st === 'grid'
                ? ri === 0
                  ? '1.2px double #111'
                  : '0.6px solid #111'
                : st === 'booktabs' && ri === 0
                  ? '0.5px solid #111'
                  : 'none',
            fw: ri === 0 && st !== 'grid' ? 600 : 400,
            cells: r.map(c => ({ v: c }))
          }));
        }
        return vm;
      })
    }));
    v.pageInfo = `main.pdf · ${pages.length} ${pages.length === 1 ? 'side' : 'sider'}`;
    v.downloadTex = () => {
      download(slug(doc.title) + '.tex', code.map(l => l.s).join('\n'), 'application/x-tex');
      this.toast(slug(doc.title) + '.tex lastet ned');
    };
    v.printPdf = this.printPdf;

    const openC = s.comments.filter(c => c.doc === doc.id && !c.resolved).length,
      resC = s.comments.filter(c => c.doc === doc.id && c.resolved).length;
    v.rightTabs = [
      ['PDF', 'pdf'],
      [`Kommentarer ${openC || ''}`, 'comments'],
      ['Historikk', 'history']
    ].map(([l, k]) => ({
      label: l.trim(),
      onClick: () => this.setState({ right: k }),
      bg: s.right === k ? '#fff' : 'transparent',
      fw: s.right === k ? 600 : 400,
      color: s.right === k ? '#1f1e1c' : '#6b6862'
    }));
    v.isPdfTab = s.right === 'pdf';
    v.isCommentsTab = s.right === 'comments';
    v.isHistoryTab = s.right === 'history';
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
          border: c.bid === s.active ? ACCB : '#e2dfd9'
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
      }
    }));

    v.shareOpen = s.share;
    v.shareTop = 58;
    v.invite = s.invite;
    v.inviteErr = s.inviteErr;
    v.hasInviteErr = !!s.inviteErr;
    v.linkRole = s.linkRole;
    v.shareUrl = 'kobling.app/d/' + slug(doc.title);
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
          link: 'https://' + (S.server || 'https://kobling.app').replace(/^https?:\/\//, '') + '/i/' + uid() + uid(),
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
      bg: s.shareTab === k ? '#fff' : 'transparent',
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
    v.inviteMailBg = s.inviteMail ? ACC : '#fff';
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
      boxBg: s.att[k] ? ACC : '#fff'
    }));
    v.mailList = s.mails
      .slice(0, 4)
      .map(m => ({
        to: m.to,
        what: m.kind === 'invite' ? 'Invitasjon' : 'Dokument',
        time: m.time,
        status: m.status,
        stColor: m.status === 'Sendt' ? '#4d8a5a' : '#b26a1e',
        onView: () => this.setState({ mailPreview: m.id })
      }));
    v.hasMails = !!s.mails.length;
    const mp = s.mails.find(m => m.id === s.mailPreview);
    v.mailOpen = !!mp;
    v.closeMail = () => this.setState({ mailPreview: null });
    if (mp) {
      const host = (S.server || 'https://kobling.app').replace(/^https?:\/\//, '');
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
        url: mp.link || 'https://' + host + '/d/' + slug(mp.docTitle || ''),
        att: (mp.att || []).join(', '),
        hasAtt: !!(mp.att && mp.att.length),
        status: mp.status + ' ' + mp.date + ' kl. ' + mp.time,
        stColor: mp.status === 'Sendt' ? '#4d8a5a' : '#b26a1e'
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
        navigator.clipboard.writeText('https://' + v.shareUrl);
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
      const sel = on => ({ border: on ? `2px solid ${ACC}` : '1px solid #e2dfd9', bg: on ? ACCL : '#fff' });
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
        tabs: [
          ['Verdi med enhet', 'qty'],
          ['Størrelser og symboler', 'sym']
        ].map(([l, k]) => ({
          label: l,
          onClick: () => this.pk({ tab: k, err: '' }),
          bg: p.tab === k ? '#fff' : 'transparent',
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
    } else v.pk = { tabs: [], prefixes: [], units: [], syms: [] };

    v.groups = GROUPS.map(g => ({
      label: g,
      count: s.docs.filter(d => d.folder === g).length,
      onClick: () => this.setState({ group: g }),
      bg: s.group === g ? '#e4e0d9' : 'transparent',
      fw: s.group === g ? 600 : 400
    }));
    v.syncText = S.sync ? 'Synkronisert med ' + S.server.replace(/^https?:\/\//, '') : 'Synkronisering av';
    v.syncColor = S.sync ? '#4d8a5a' : '#a29e97';
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
        border: d.id === s.cur ? ACCB : '#e2dfd9',
        cols: S.cols === 2 ? '1fr 1fr' : '1fr'
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
          border: np.tpl === x.k ? `2px solid ${ACC}` : '1px solid #e2dfd9',
          bg: np.tpl === x.k ? ACCL : '#fff'
        }))
      };
    } else v.np = { tpls: [] };

    const togX = (label, on, fn) => ({
      isToggle: true,
      label,
      onToggle: fn,
      tbg: on ? ACC : '#d6d2cb',
      knob: on ? 'translateX(16px)' : 'translateX(0)'
    });
    const segX = (label, cur, opts, fn, font) => ({
      isSeg: true,
      label,
      opts: opts.map(([l, val]) => ({
        label: l,
        onClick: () => fn(val),
        bg: cur === val ? '#fff' : 'transparent',
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
      border: o.err ? '#e8b4ae' : '#e2dfd9'
    });
    const btns = arr => ({
      isButtons: true,
      btns: arr.map(([label, fn, primary, disabled]) => ({
        label,
        onClick: disabled ? undefined : fn,
        bg: primary ? ACC : '#fff',
        color: primary ? '#fff' : '#1f1e1c',
        border: primary ? ACC : '#d6d2cb',
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
      bg: TB === k ? '#e4e0d9' : 'transparent',
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
              ['Installer server', 'install']
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
          color: '#4d8a5a'
        }
      ];
    else if (TB === 'konto')
      rows = [
        head('KONTO'),
        { isInfo: true, label: 'Innlogget som', value: ME.name + ' · ' + ME.email, color: ME.color || USERS[ME.id].color },
        { isInfo: true, label: 'Rolle', value: isAdmin ? 'Administrator' : 'Bruker', color: isAdmin ? ACC : '#8d8982' },
        {
          isInfo: true,
          label: 'Server',
          value: S.server.replace(/^https?:\/\//, ''),
          color: S.sync ? '#4d8a5a' : '#a29e97'
        },
        tog('Synkroniser automatisk', 'sync'),
        {
          isInfo: true,
          label: 'Sanntid mellom faner',
          value: this._server ? 'Via serveren' : this.bc ? 'På' : 'Ikke støttet',
          color: this._server || this.bc ? '#4d8a5a' : '#a29e97'
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
    else if (TB === 'server')
      rows = [
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
          color: S.sync ? '#4d8a5a' : '#a29e97'
        },
        {
          isInfo: true,
          label: 'Brukere på serveren',
          value: ACCOUNTS.length + ' (' + ACCOUNTS.filter(a => a.admin).length + ' administrator)',
          color: '#4d8a5a'
        }
      ];
    else if (TB === 'duck')
      rows = [
        head('DUCKDNS'),
        note(
          'DuckDNS gir serveren et fast navn selv om IP-adressen hjemme endrer seg. Serveren sender IP-adressen sin til DuckDNS med jevne mellomrom.'
        ),
        togX('Bruk DuckDNS', d.on, () => this.dk({ on: !d.on })),
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
              { isInfo: true, label: 'Server', value: 'smtp.protonmail.ch · 587 · STARTTLS', color: '#4d8a5a' },
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
        { isInfo: true, label: 'Sendes som', value: smtpFrom(mt) || '–', color: '#4a4742' },
        togX('Varsle på e-post om nye kommentarer', mt.notify, () => ms({ notify: !mt.notify })),
        btns([[mu.testing ? 'Tester …' : 'Send test-e-post', this.testSmtp, true, mu.testing]]),
        ...(mu.test
          ? [
              {
                isInfo: true,
                label: mu.test.ok ? 'OK' : 'Feil',
                value: mu.test.msg,
                color: mu.test.ok ? '#4d8a5a' : '#b3261e'
              }
            ]
          : []),
        {
          isInfo: true,
          label: 'Status',
          value: this.smtpOk()
            ? 'Klar. Invitasjoner sendes fra ' + (mt.user || smtpFrom(mt))
            : 'Ikke satt opp. E-post legges i utboksen.',
          color: this.smtpOk() ? '#4d8a5a' : '#b26a1e'
        }
      ];
    } else if (TB === 'backup')
      rows = [
        head('BACKUP TIL SMB-SHARE'),
        note(
          'Dokumenter, figurer og versjonshistorikk pakkes og kopieres til en delt mappe på NAS-en, for eksempel Unraid, TrueNAS eller Windows.'
        ),
        togX('Automatisk backup', bk.on, () => this.sb({ on: !bk.on })),
        fld('Server', bk.host, x => this.sb({ host: x.trim() }), { ph: '192.168.1.10 eller tower.local' }),
        fld('Share', bk.share, x => this.sb({ share: x.trim() }), {
          ph: 'backup',
          err: /[\\/]/.test(bk.share) ? 'Bare navnet på sharen, uten skråstrek.' : ''
        }),
        fld('Mappe', bk.path, x => this.sb({ path: x.trim() }), { ph: 'kobling' }),
        fld('Brukernavn', bk.user, x => this.sb({ user: x }), { ph: 'backup' }),
        fld('Passord', bk.pass, x => this.sb({ pass: x }), {
          type: bu.showPass ? 'text' : 'password',
          eye: () => this.sbu({ showPass: !bu.showPass }),
          eyeLabel: bu.showPass ? 'Skjul' : 'Vis'
        }),
        fld('Domene / arbeidsgruppe', bk.domain, x => this.sb({ domain: x }), { ph: 'WORKGROUP' }),
        segX(
          'SMB-versjon',
          bk.ver,
          [
            ['2.1', '2.1'],
            ['3.0', '3.0'],
            ['3.1.1', '3.1.1']
          ],
          x => this.sb({ ver: x })
        ),
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
    v.duckLog = du.log.map(l => ({ txt: l.t + '  ' + l.txt, color: l.ok ? '#3d6b47' : '#b3261e' }));
    v.noDuckLog = !du.log.length;
    v.duckPortNote = 'Videresend TCP ' + (d.tls ? '443' : dep.port) + ' i ruteren til serveren for å nå den utenfra. Virker ikke adressen hjemmefra, prøv fra mobilnett: mange rutere sender ikke trafikk til egen offentlig IP tilbake inn (NAT-loopback).';
    v.hasSmbTest = !!bu.test;
    v.smbTestMsg = bu.test ? bu.test.msg : '';
    v.smbTestColor = bu.test && bu.test.ok ? '#3d6b47' : '#b3261e';
    v.smbTestBg = bu.test && bu.test.ok ? 'oklch(0.96 0.03 150)' : 'oklch(0.96 0.03 25)';
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
      onRestore: () => this.restoreBackup(k),
      onDownload: () => {
        download(k.name.replace('.tar.zst', '.json'), JSON.stringify(k.docs, null, 2), 'application/json');
        this.toast('Backup lastet ned');
      }
    }));
    v.noBackups = !s.backups.length;
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
        bg: c.tool === k ? '#fff' : 'transparent',
        color: c.tool === k ? '#1f1e1c' : '#6b6862',
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
        bg: c.auto === on ? '#fff' : 'transparent',
        color: c.auto === on ? '#1f1e1c' : '#6b6862',
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
      const q = s.palQ.trim().toLowerCase();
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
                  width: T.two || T.gate || k === 'opamp' ? 54 : big ? 30 : 28,
                  height: big || k === 'opamp' ? 36 : 28,
                  viewBox: iconVB(k),
                  fill: 'none',
                  stroke: '#1f1e1c',
                  strokeWidth: T.gate || k === 'opamp' || big ? 2.6 : 2
                },
                symEls(k, S.style, '#fff', '#1f1e1c')
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
          bg: ps.mode === k ? '#fff' : 'transparent',
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
      bg: S.cols === c ? '#fff' : 'transparent',
      shadow: S.cols === c ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
      fw: S.cols === c ? 600 : 400
    }));
    const rw = Math.max(320, Math.min(s.rightW, (window.innerWidth || 1440) - 236 - 380));
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
    v.fileItems = [
      ['Ny fil …', MOD + 'N', () => this.setState({ newProj: { title: '', tpl: 'rapport', err: '' } })],
      ['Dupliser dokument', '', () => this.duplicateDoc()],
      ['Last ned .tex', '', () => v.downloadTex()],
      [
        'Skriv ut / lagre som PDF',
        MOD + 'P',
        () => {
          this.setState({ view: 'editor', right: 'pdf' });
          setTimeout(this.printPdf, 300);
        }
      ],
      [
        'Last ned bilder (' + doc.blocks.filter(b => b.type === 'img').length + ')',
        '',
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
      ],
      ['Alle prosjekter', '', () => this.setState({ view: 'projects', circ: null })]
    ].map(([label, key, fn]) => ({
      label,
      key,
      onClick: () => {
        this.setState({ fileMenu: false });
        fn();
      }
    }));
    v.recentItems = s.recent
      .map(id => s.docs.find(x => x.id === id))
      .filter(Boolean)
      .slice(0, 6)
      .map(x => ({
        title: x.title,
        meta: x.folder + (x.id === s.cur ? ' · åpen nå' : ''),
        fw: x.id === s.cur ? 600 : 400,
        onClick: () => this.openDoc(x.id)
      }));
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
        { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75em', color: '#6b6862' } },
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
