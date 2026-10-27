import { describe, it, expect } from 'vitest';
import {
  makeDocs, docCode, parseDoc, DEF_SET, parseCSV, plotLines, wdiff, textFields, parseBibtex, toBibtex,
  citeNums, isSpice, spiceToTikz, parseCircuit, parseGrid
} from '../src/index.js';

const S = { ...DEF_SET };
const code = (d, s = S) => docCode(d, s).map(l => l.s).join('\n');
const roundtrip = d => {
  const tex = code(d), r = parseDoc(tex, d, S), S2 = { ...S, ...r.settings };
  return { tex, tex2: code({ ...d, ...r }, S2), r };
};
const base = () => ({ ...makeDocs()[0], blocks: [], bib: [] });

describe('akseptanse 11: rundtur for plot, cite og tabeller med 2–8 kolonner', () => {
  it('plot-blokk (linje og Bode)', () => {
    for (const kind of ['line', 'bode']) {
      const d = { ...base(), blocks: [{ id: 'p1', type: 'plot', kind, csv: 'f;G;fase\n10;-0,1;-5\n100;-3;-45\n1000;-20;-84', xlabel: 'f (Hz)', ylabel: 'G (dB)', caption: 'Frekvensrespons.', label: 'fig:bode' }] };
      const { tex, tex2, r } = roundtrip(d);
      expect(tex2).toBe(tex);
      expect(r.blocks.map(b => b.type)).toEqual(['plot']);
    }
  });
  it('graf fra kode uten eksisterende blokk bygges fra koordinatene', () => {
    const d = { ...base(), blocks: [{ id: 'p1', type: 'plot', kind: 'line', csv: 't;u;i\n0;0;1\n1;2,5;0,5\n2;4;0,25', xlabel: 't (s)', ylabel: 'Spenning', caption: 'Lading.', label: 'fig:lad' }] };
    const tex = code(d);
    const r = parseDoc(tex, { ...d, blocks: [] }, S);
    expect(r.blocks[0]).toMatchObject({ type: 'plot', kind: 'line', xlabel: 't (s)', caption: 'Lading.', label: 'fig:lad' });
    expect(code({ ...d, ...r })).toBe(tex);
  });
  it('cite i avsnitt', () => {
    const d = { ...base(), bib: [{ type: 'article', key: 'hansen2020', author: 'Ola Hansen', title: 'Kretser', year: '2020' }],
      blocks: [{ id: 'a', type: 'p', segs: [{ t: 'text', v: 'Se ' }, { t: 'cite', key: 'hansen2020' }, { t: 'text', v: ' for mer.' }] }] };
    const { tex, tex2, r } = roundtrip(d);
    expect(tex).toContain('\\cite{hansen2020}');
    expect(tex2).toBe(tex);
    expect(r.blocks[0].segs.some(s => s.t === 'cite' && s.key === 'hansen2020')).toBe(true);
  });
  it.each([2, 3, 5, 8])('tabell med %i kolonner', n => {
    const rows = [Array.from({ length: n }, (_, i) => 'K' + i), Array.from({ length: n }, (_, i) => String(i)), Array.from({ length: n }, (_, i) => String(i * 2))];
    const d = { ...base(), blocks: [{ id: 't', type: 'table', style: 'grid', caption: 'Målinger.', label: 'tab:m', rows }] };
    const { tex, tex2, r } = roundtrip(d);
    expect(tex2).toBe(tex);
    expect(r.blocks[0].type).toBe('table');
    expect(r.blocks[0].rows[0]).toHaveLength(n);
  });
});

describe('akseptanse 12: BibTeX fra Zotero uten tap av felt', () => {
  const zotero = `@article{hansen_kretser_2020,
	title = {Kretser og {NAND}-porter},
	volume = {12},
	url = {https://example.org/a},
	doi = {10.1000/xyz123},
	journal = {Elektronikk},
	author = {Hansen, Ola and Nordmann, Kari},
	year = {2020},
	pages = {1--10},
}`;
  it('alle felt beholdes gjennom parseBibtex → toBibtex → parseBibtex', () => {
    const [e] = parseBibtex(zotero);
    expect(e).toMatchObject({ key: 'hansen_kretser_2020', doi: '10.1000/xyz123', journal: 'Elektronikk', year: '2020', author: 'Hansen, Ola og Nordmann, Kari', title: 'Kretser og NAND-porter' });
    const out = toBibtex([e]);
    for (const f of ['title = {Kretser og {NAND}-porter}', 'volume = {12}', 'pages = {1--10}', 'url = {https://example.org/a}', 'doi = {10.1000/xyz123}', 'author = {Hansen, Ola and Nordmann, Kari}'])
      expect(out).toContain(f);
    expect(parseBibtex(out)[0]).toEqual(e);
  });
  it('en endret tittel skrives ut, resten beholdes', () => {
    const [e] = parseBibtex(zotero);
    const out = toBibtex([{ ...e, title: 'Ny tittel' }]);
    expect(out).toContain('title = {Ny tittel}');
    expect(out).toContain('pages = {1--10}');
  });
});

describe('akseptanse 13: SPICE-netliste blir en krets', () => {
  it.each([
    ['2 elementer', 'V1 1 0 DC 9\nR1 1 0 220'],
    ['spenningsdeler', '* deler\nV1 in 0 DC 12\nR1 in out 10k\nR2 out 0 4.7k'],
    ['RC', 'V1 1 0 5\nR1 1 2 1k\nC1 2 0 100n'],
    ['10 elementer', 'V1 1 0 9\nR1 1 2 1k\nR2 2 3 1k\nR3 3 4 1k\nR4 4 5 1k\nR5 5 0 1k\nC1 2 0 1u\nC2 3 0 1u\nL1 4 0 1m\nR6 5 6 220']
  ])('%s', (_, net) => {
    expect(isSpice(net)).toBe(true);
    const tikz = spiceToTikz(net);
    const r = parseCircuit(tikz);
    expect(r.data, (r.warn || []).join(' ')).toBeTruthy();
    expect(r.data.comps.length).toBeGreaterThanOrEqual(net.split('\n').filter(l => /^[RCLV]/i.test(l)).length);
  });
  it('vanlig tekst er ikke SPICE', () => {
    expect(isSpice('R1 er en motstand\nog V1 er en kilde')).toBe(false);
  });
});

describe('hjelpefunksjoner', () => {
  it('parseCSV: skilletegn, desimalkomma og overskrift', () => {
    expect(parseCSV('t;v\n0;1,5\n1;2,5')).toMatchObject({ head: ['t', 'v'], rows: [[0, 1.5], [1, 2.5]] });
    expect(parseCSV('0\t1\n1\t2').rows).toHaveLength(2);
  });
  it('plotLines lager pgfplots med logaritmisk akse for Bode', () => {
    const b = { kind: 'bode', csv: 'f,G,fase\n10,0,-5\n100,-3,-45\n1000,-20,-84', xlabel: 'f', ylabel: 'G' };
    const l = plotLines(b).join('\n');
    expect(l).toContain('xmode=log');
    expect(l).toContain('name=mag');
  });
  it('wdiff markerer ord som er lagt til og fjernet', () => {
    const d = wdiff('motstanden er 220 ohm', 'motstanden er 330 ohm');
    expect(JSON.stringify(d)).toContain('220');
    expect(JSON.stringify(d)).toContain('330');
  });
  it('textFields finner tekst i avsnitt, tabeller og likninger', () => {
    const fs = [...textFields({ type: 'p', segs: [{ t: 'text', v: 'hei' }] }), ...textFields({ type: 'eq', src: 'U=RI', label: 'x' })];
    expect(fs.map(f => f.v)).toEqual(expect.arrayContaining(['hei', 'U=RI']));
  });
  it('citeNums nummererer etter første sitat', () => {
    const doc = { bib: [{ key: 'a' }, { key: 'b' }], blocks: [{ type: 'p', segs: [{ t: 'cite', key: 'b' }, { t: 'cite', key: 'a' }] }] };
    expect(citeNums(doc)).toEqual({ b: 1, a: 2 });
  });
  it('parseGrid leser tabulatorskilte celler fra Excel', () => {
    expect(parseGrid('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
