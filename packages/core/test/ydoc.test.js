import { describe, it, expect } from 'vitest';
import { makeDocs } from '../src/index.js';
import { Y, applyDocToY, docFromY, applyCommentsToY, commentsFromY, pushHistory, historyFromY, isEmptyY, HISTORY_MAX } from '../src/ydoc.js';

const sync = (a, b) => { Y.applyUpdate(b, Y.encodeStateAsUpdate(a)); Y.applyUpdate(a, Y.encodeStateAsUpdate(b)) };

describe('Yjs-dokumentmodell', () => {
  const doc = makeDocs()[0];

  it('rundtur dokument -> Y -> dokument uten tap', () => {
    const y = new Y.Doc();
    expect(isEmptyY(y)).toBe(true);
    applyDocToY(y, doc);
    const { meta, ...rest } = docFromY(y, doc.id);
    expect(rest).toEqual({ id: doc.id, title: doc.title, authors: doc.authors, group: doc.group, folder: doc.folder, pre: [], files: [], blocks: doc.blocks });
  });

  it('samtidige endringer i ulike blokker flettes', () => {
    const a = new Y.Doc(), b = new Y.Doc();
    applyDocToY(a, doc); sync(a, b);
    const da = docFromY(a, doc.id), db = docFromY(b, doc.id);
    applyDocToY(a, { ...da, blocks: da.blocks.map((x, i) => (i === 1 ? { ...x, text: 'Endret av A' } : x)) });
    applyDocToY(b, { ...db, title: 'Ny tittel fra B', blocks: [...db.blocks, { id: 'ny', type: 'h1', text: 'Fra B' }] });
    sync(a, b);
    const ra = docFromY(a, doc.id);
    expect(ra).toEqual(docFromY(b, doc.id));
    expect(ra.title).toBe('Ny tittel fra B');
    expect(ra.blocks[1].text).toBe('Endret av A');
    expect(ra.blocks.at(-1).id).toBe('ny');
  });

  it('ingen oppdatering når ingenting er endret', () => {
    const y = new Y.Doc(); applyDocToY(y, doc);
    let n = 0; y.on('update', () => n++);
    applyDocToY(y, docFromY(y, doc.id));
    expect(n).toBe(0);
  });

  it('kommentarer og historikk', () => {
    const y = new Y.Doc();
    applyCommentsToY(y, [{ id: 'k1', text: 'A', ts: 2 }, { id: 'k2', text: 'B', ts: 1 }]);
    expect(commentsFromY(y).map(c => c.id)).toEqual(['k2', 'k1']);
    applyCommentsToY(y, [{ id: 'k2', text: 'B', ts: 1, resolved: true }]);
    expect(commentsFromY(y)).toEqual([{ id: 'k2', text: 'B', ts: 1, resolved: true }]);
    for (let i = 0; i < HISTORY_MAX + 5; i++) pushHistory(y, { id: 'h' + i });
    expect(historyFromY(y).length).toBe(HISTORY_MAX);
    expect(historyFromY(y)[0].id).toBe('h' + (HISTORY_MAX + 4));
  });
});
