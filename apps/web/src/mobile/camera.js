// Kamera på mobil (README §12): i appen brukes @capacitor/camera (systemkameraet), i nettleseren en
// direkte søker med getUserMedia. Bildet beskjæres med fire håndtak og komprimeres til maks 1600 px
// før det settes inn som figur. «Skann dokument» gir gråtone med høy kontrast og litt innfelt beskjæring.
import React from 'react';

const h = React.createElement;
const MAX = 1600;

export const isNative = () => {
  const c = window.Capacitor;
  return !!(c && c.isNativePlatform && c.isNativePlatform());
};

export async function startCamera(app) {
  stopCamera(app);
  if (isNative() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const facing = (app.state.mob && app.state.mob.facing) || 'environment';
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    if (!app.state.mob || app.state.mob.cam !== 'shoot') return st.getTracks().forEach(t => t.stop());
    app._camStream = st;
    const tr = st.getVideoTracks()[0];
    try { app._camTorch = !!(tr && tr.getCapabilities && tr.getCapabilities().torch) } catch (e) { app._camTorch = false }
    app.forceUpdate();
  } catch (e) {
    app.mob({ camErr: true });
  }
}

export function stopCamera(app) {
  if (app._camStream) app._camStream.getTracks().forEach(t => t.stop());
  app._camStream = null;
  app._camTorch = false;
}

export async function setTorch(app, on) {
  const tr = app._camStream && app._camStream.getVideoTracks()[0];
  if (!tr || !app._camTorch) return app.toast(isNative() ? 'Blitsen styres i kameraet som åpnes' : 'Blits støttes ikke i denne nettleseren');
  try {
    await tr.applyConstraints({ advanced: [{ torch: on }] });
    app.mob({ torch: on });
  } catch (e) {
    app.toast('Kunne ikke slå på blitsen');
  }
}

const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src });
const fileUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) });

async function review(app, src) {
  const im = await loadImg(src);
  stopCamera(app);
  const scan = app.state.mob.camMode === 'scan';
  const d = new Date(), p = n => String(n).padStart(2, '0');
  app.mob({
    cam: 'review',
    shot: { src, w: im.naturalWidth, h: im.naturalHeight },
    crop: scan ? { x0: 0.04, y0: 0.04, x1: 0.96, y1: 0.96 } : { x0: 0, y0: 0, x1: 1, y1: 1 },
    stamp: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  });
}

async function nativePhoto(source) {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const ph = await Camera.getPhoto({ source: source === 'photos' ? CameraSource.Photos : CameraSource.Camera, resultType: CameraResultType.DataUrl, quality: 90, width: MAX, correctOrientation: true });
  return ph.dataUrl;
}

function filePick(capture) {
  return new Promise(res => {
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = 'image/*';
    if (capture) el.setAttribute('capture', 'environment');
    el.onchange = () => res(el.files && el.files[0] ? fileUrl(el.files[0]) : null);
    el.click();
  });
}

export async function capture(app) {
  try {
    const v = app._camVideo;
    if (app._camStream && v && v.videoWidth) {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      return review(app, c.toDataURL('image/jpeg', 0.92));
    }
    const src = isNative() ? await nativePhoto('camera') : await filePick(true);
    if (src) await review(app, src);
  } catch (e) {
    if (!/cancel/i.test(String(e && e.message))) app.toast('Fikk ikke tatt bildet');
  }
}

// direct: «Fra bildebiblioteket» i Sett inn-arket. I nettleseren går det rett inn som på desktop;
// i appen og fra kameraskjermen går bildet via beskjæring og figurtekst.
export async function pickPhoto(app, direct) {
  try {
    if (direct && !isNative()) return app.pickImage({ after: app.state.active });
    const src = isNative() ? await nativePhoto('photos') : await filePick(false);
    if (!src) return;
    if (!app.state.mob.cam) app.mob({ cam: 'shoot', camMode: 'photo' });
    await review(app, src);
  } catch (e) {
    if (!/cancel/i.test(String(e && e.message))) app.toast('Fikk ikke hentet bildet');
  }
}

export async function finishPhoto(app, { name, caption, w }) {
  const m = app.state.mob, shot = m.shot, cr = m.crop || { x0: 0, y0: 0, x1: 1, y1: 1 };
  if (!shot) return;
  const im = await loadImg(shot.src);
  const sx = cr.x0 * im.naturalWidth, sy = cr.y0 * im.naturalHeight;
  const sw = (cr.x1 - cr.x0) * im.naturalWidth, sh = (cr.y1 - cr.y0) * im.naturalHeight;
  const k = Math.min(1, MAX / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const g = c.getContext('2d');
  if (m.camMode === 'scan') g.filter = 'grayscale(1) contrast(1.45) brightness(1.08)';
  g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  const before = new Set(app.curDoc().blocks.map(b => b.id));
  await app.insertImages([new File([blob], name, { type: 'image/jpeg' })], app.state.active);
  let nb = null;
  for (let i = 0; i < 40 && !nb; i++) {
    nb = app.curDoc().blocks.find(b => b.type === 'img' && !before.has(b.id));
    if (!nb) await new Promise(r => setTimeout(r, 50));
  }
  if (nb) app.updBlock(nb.id, { caption: caption.trim() || nb.caption, w }, 'Satte inn bilde fra kamera');
  app.setState(s => ({ mob: { ...s.mob, cam: null, shot: null, seg: 'write', caption: null } }));
  app.toast('Figuren er satt inn');
}

// Beskjæring: bildet med et rektangel og fire håndtak i hjørnene (dra med én finger).
export function CropView({ src, crop, onCrop }) {
  const box = React.useRef(null);
  const cr = crop || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const drag = corner => e => {
    e.preventDefault();
    e.stopPropagation();
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const move = ev => {
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      const n = { ...cr };
      if (corner[0] === 'l') n.x0 = Math.min(x, cr.x1 - 0.1); else n.x1 = Math.max(x, cr.x0 + 0.1);
      if (corner[1] === 't') n.y0 = Math.min(y, cr.y1 - 0.1); else n.y1 = Math.max(y, cr.y0 + 0.1);
      Object.assign(cr, n);
      onCrop({ ...n });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const pct = x => x * 100 + '%';
  const handle = (corner, left, top) => h('div', { key: corner, onPointerDown: drag(corner), style: { position: 'absolute', left: pct(left), top: pct(top), width: 44, height: 44, marginLeft: -22, marginTop: -22, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: 'grab', zIndex: 2 } },
    h('div', { style: { width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.4)' } }));
  return h('div', { ref: box, style: { position: 'relative', maxWidth: '100%', maxHeight: '100%', lineHeight: 0, touchAction: 'none' } },
    h('img', { src, alt: '', draggable: false, style: { display: 'block', maxWidth: '100%', maxHeight: '52vh', borderRadius: 4, userSelect: 'none' } }),
    h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' } },
      h('div', { style: { position: 'absolute', left: pct(cr.x0), top: pct(cr.y0), width: pct(cr.x1 - cr.x0), height: pct(cr.y1 - cr.y0), border: '2px solid #fff', boxSizing: 'border-box', boxShadow: '0 0 0 9999px rgba(0,0,0,.45)' } })),
    handle('lt', cr.x0, cr.y0), handle('rt', cr.x1, cr.y0), handle('lb', cr.x0, cr.y1), handle('rb', cr.x1, cr.y1));
}
