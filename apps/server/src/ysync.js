// Yjs-synk over WebSocket (samme protokoll som y-websocket): ett rom per dokument,
// tilstanden lagres i SQLite, og tilgang styres av dokumentrollen.
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Y, docFromY, applyDocToY, isEmptyY, commentsFromY, META_KEYS } from '@kobling/core/ydoc';
import { RANK } from './auth.js';

const MSG_SYNC = 0, MSG_AWARENESS = 1;

export function createSync(db, { onComment = () => {}, saveDelay = 800 } = {}) {
  const rooms = new Map();

  function loadRoom(docId) {
    let r = rooms.get(docId);
    if (r) return r;
    const doc = new Y.Doc();
    const row = db.prepare('SELECT state FROM ydocs WHERE doc_id = ?').get(docId);
    if (row) Y.applyUpdate(doc, new Uint8Array(row.state));
    else {
      const d = db.prepare('SELECT data FROM documents WHERE id = ?').get(docId);
      if (d) applyDocToY(doc, JSON.parse(d.data), 'init');
    }
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    r = { id: docId, doc, awareness, conns: new Map(), timer: null };
    rooms.set(docId, r);

    doc.on('update', (update, origin) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.writeUpdate(enc, update);
      broadcast(r, encoding.toUint8Array(enc), null);
      clearTimeout(r.timer);
      r.timer = setTimeout(() => persist(r), saveDelay);
    });
    doc.getMap('comments').observe((ev, tx) => {
      const by = tx.origin && tx.origin.user;
      if (!by) return;
      ev.changes.keys.forEach((ch, key) => { if (ch.action === 'add') onComment(docId, by, doc.getMap('comments').get(key)) });
    });
    awareness.on('update', ({ added, updated, removed }, conn) => {
      const changed = added.concat(updated, removed);
      if (conn && r.conns.has(conn)) {
        const ids = r.conns.get(conn).clients;
        added.forEach(c => ids.add(c)); removed.forEach(c => ids.delete(c));
      }
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      broadcast(r, encoding.toUint8Array(enc), null);
    });
    return r;
  }

  function persist(r) {
    clearTimeout(r.timer); r.timer = null;
    if (r.dead) return;
    if (!db.prepare('SELECT 1 FROM documents WHERE id = ?').get(r.id)) return;
    const state = Y.encodeStateAsUpdate(r.doc);
    db.prepare('INSERT INTO ydocs (doc_id, state, updated) VALUES (?, ?, ?) ON CONFLICT(doc_id) DO UPDATE SET state = excluded.state, updated = excluded.updated')
      .run(r.id, state, Date.now());
    if (!isEmptyY(r.doc)) {
      const d = docFromY(r.doc, r.id);
      db.prepare('UPDATE documents SET data = ?, title = ?, updated = ? WHERE id = ?').run(JSON.stringify(d), d.title || '', Date.now(), r.id);
    }
  }

  function broadcast(r, msg, except) {
    for (const [ws] of r.conns) if (ws !== except && ws.readyState === 1) ws.send(msg);
  }

  // Lesere får ingen endringer gjennom; kommentatorer bare endringer i kommentarene.
  // Tomme oppdateringer (f.eks. synk-svar uten nytt innhold) slippes alltid gjennom.
  function allowed(r, update, role) {
    if (RANK[role] >= RANK['Kan redigere']) return true;
    const probe = new Y.Doc();
    Y.applyUpdate(probe, Y.encodeStateAsUpdate(r.doc));
    const before = snapshot(probe), cb = JSON.stringify(commentsFromY(probe));
    Y.applyUpdate(probe, update);
    const same = snapshot(probe) === before, sameComments = JSON.stringify(commentsFromY(probe)) === cb;
    probe.destroy();
    return role === 'Kan kommentere' ? same : same && sameComments;
  }
  const snapshot = d => JSON.stringify([docFromY(d, ''), d.getArray('history').toArray(), META_KEYS.map(k => d.getMap('meta').get(k))]);

  function handle(ws, docId, user, role) {
    const r = loadRoom(docId);
    const conn = { user, role, clients: new Set() };
    r.conns.set(ws, conn);
    const origin = { user, ws };

    ws.on('message', raw => {
      try {
        const data = new Uint8Array(raw);
        const dec = decoding.createDecoder(data);
        const type = decoding.readVarUint(dec);
        if (type === MSG_SYNC) {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, MSG_SYNC);
          const sub = decoding.peekVarUint(dec);
          if (sub !== syncProtocol.messageYjsSyncStep1) {
            // step2/update: sjekk rettigheter før det slippes inn
            decoding.readVarUint(dec);
            const update = decoding.readVarUint8Array(dec);
            if (!allowed(r, update, role)) return sendDenied(ws);
            Y.applyUpdate(r.doc, update, origin);
            return;
          }
          syncProtocol.readSyncMessage(dec, enc, r.doc, origin);
          if (encoding.length(enc) > 1) ws.send(encoding.toUint8Array(enc));
        } else if (type === MSG_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(r.awareness, decoding.readVarUint8Array(dec), ws);
        }
      } catch { /* ødelagt melding ignoreres */ }
    });
    ws.on('close', () => {
      const c = r.conns.get(ws);
      r.conns.delete(ws);
      if (c) awarenessProtocol.removeAwarenessStates(r.awareness, [...c.clients], null);
      if (!r.conns.size && !r.dead) { persist(r); r.doc.destroy(); rooms.delete(docId) }
    });

    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeSyncStep1(enc, r.doc);
    ws.send(encoding.toUint8Array(enc));
    const states = [...r.awareness.getStates().keys()];
    if (states.length) {
      const a = encoding.createEncoder();
      encoding.writeVarUint(a, MSG_AWARENESS);
      encoding.writeVarUint8Array(a, awarenessProtocol.encodeAwarenessUpdate(r.awareness, states));
      ws.send(encoding.toUint8Array(a));
    }
  }

  function sendDenied(ws) {
    // Egendefinert melding (type 9): klienten viser «bare lesetilgang».
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 9);
    ws.send(encoding.toUint8Array(enc));
  }

  // Gir dokumentets Y-tilstand som JSON uten å holde rommet åpent (til kompilering, e-post osv.).
  function readDoc(docId) {
    const r = rooms.get(docId);
    if (r) return docFromY(r.doc, docId);
    const d = db.prepare('SELECT data FROM documents WHERE id = ?').get(docId);
    return d ? JSON.parse(d.data) : null;
  }
  function readComments(docId) {
    const r = rooms.get(docId);
    if (r) return commentsFromY(r.doc);
    const row = db.prepare('SELECT state FROM ydocs WHERE doc_id = ?').get(docId);
    if (!row) return [];
    const d = new Y.Doc(); Y.applyUpdate(d, new Uint8Array(row.state));
    return commentsFromY(d);
  }
  // Etter gjenoppretting fra backup: kast rom i minnet så de lastes på nytt.
  // Klientene får kode 4000 og laster siden på nytt, så de ikke fletter inn den gamle tilstanden igjen.
  function reset() {
    for (const r of rooms.values()) {
      r.dead = true;
      clearTimeout(r.timer);
      for (const [ws] of r.conns) ws.close(4000, 'Gjenopprettet');
      r.doc.destroy();
    }
    rooms.clear();
  }
  function flushAll() { for (const r of rooms.values()) persist(r) }

  return { handle, readDoc, readComments, reset, flushAll, rooms };
}
