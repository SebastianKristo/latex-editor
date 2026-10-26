// Dokumentmodellen i Yjs. Felles for klient og server.
//   meta:     Y.Map  title, authors, group, folder, meta
//   order:    Y.Array blokk-id-er i rekkefølge
//   blocks:   Y.Map  id -> blokk (JSON)
//   comments: Y.Map  id -> kommentar (JSON)
//   history:  Y.Array versjoner, nyeste først (JSON med snapshot av blokkene)
// Blokker er atomære verdier: samtidige endringer i ulike blokker flettes, i samme blokk vinner siste.
import * as Y from 'yjs';

export const META_KEYS = ['title', 'authors', 'group', 'folder', 'meta'];
export const HISTORY_MAX = 60;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function docFromY(ydoc, id) {
  const meta = ydoc.getMap('meta'), blocks = ydoc.getMap('blocks');
  const d = { id };
  META_KEYS.forEach(k => { d[k] = meta.get(k) ?? '' });
  d.blocks = ydoc.getArray('order').toArray().map(bid => blocks.get(bid)).filter(Boolean).map(b => ({ ...b }));
  return d;
}

export const isEmptyY = ydoc => ydoc.getArray('order').length === 0 && !ydoc.getMap('meta').has('title');

// Skriver bare det som faktisk er endret, i én transaksjon.
export function applyDocToY(ydoc, doc, origin) {
  const meta = ydoc.getMap('meta'), blocks = ydoc.getMap('blocks'), order = ydoc.getArray('order');
  ydoc.transact(() => {
    META_KEYS.forEach(k => { if (doc[k] !== undefined && meta.get(k) !== doc[k]) meta.set(k, doc[k]) });
    const ids = doc.blocks.map(b => b.id);
    doc.blocks.forEach(b => { if (!same(blocks.get(b.id), b)) blocks.set(b.id, b) });
    const cur = order.toArray();
    if (!same(cur, ids)) { order.delete(0, cur.length); order.insert(0, ids) }
    const keep = new Set(ids);
    [...blocks.keys()].forEach(k => { if (!keep.has(k)) blocks.delete(k) });
  }, origin);
}

export const commentsFromY = ydoc => [...ydoc.getMap('comments').values()].map(c => ({ ...c })).sort((a, b) => (a.ts || 0) - (b.ts || 0));

export function applyCommentsToY(ydoc, list, origin) {
  const m = ydoc.getMap('comments');
  ydoc.transact(() => {
    const keep = new Set(list.map(c => c.id));
    list.forEach(c => { if (!same(m.get(c.id), c)) m.set(c.id, c) });
    [...m.keys()].forEach(k => { if (!keep.has(k)) m.delete(k) });
  }, origin);
}

export const historyFromY = ydoc => ydoc.getArray('history').toArray();

export function pushHistory(ydoc, entry, origin) {
  const h = ydoc.getArray('history');
  ydoc.transact(() => {
    h.insert(0, [entry]);
    if (h.length > HISTORY_MAX) h.delete(HISTORY_MAX, h.length - HISTORY_MAX);
  }, origin);
}

export { Y };
