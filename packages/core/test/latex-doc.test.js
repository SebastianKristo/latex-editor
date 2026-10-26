import { describe, it, expect } from 'vitest';
import { makeDocs, docCode, parseDocument, DEF_SET } from '../src/index.js';

const S = { ...DEF_SET };
const code = d => docCode(d, S).map(l => l.s).join('\n');

describe('parseDocument: hele main.tex tilbake til blokker', () => {
  it.each(makeDocs().map(d => [d.title, d]))('%s: uendret kode gir identisk dokument', (_, d) => {
    const r = parseDocument(code(d), { S, prev: d });
    expect(r.title).toBe(d.title);
    expect(r.authors).toBe(d.authors);
    expect(r.preamble).toBe('');
    expect(r.blocks).toEqual(d.blocks);
  });

  it('endringer i tekst, overskrift og enhet leses inn som vanlige blokker', () => {
    const d = makeDocs()[0];
    const tex = code(d).replace('\\section{Innledning}', '\\section{Bakgrunn}').replace('fra USB-C.', 'fra et batteri på \\qty{9}{\\volt}.');
    const r = parseDocument(tex, { S, prev: d });
    const h = r.blocks.find(b => b.type === 'h1' && b.text === 'Bakgrunn');
    expect(h).toBeTruthy();
    expect(h.id).toBe(d.blocks.find(b => b.text === 'Innledning').id); // samme id, kommentarer beholdes
    const p = r.blocks.find(b => b.type === 'p' && b.segs.some(s => s.t === 'unit' && s.num === '9'));
    expect(p).toBeTruthy();
    expect(r.blocks.some(b => b.type === 'raw')).toBe(false);
    expect(code({ ...d, ...r })).toBe(tex);
  });

  it('ukjent LaTeX beholdes ordrett som LaTeX-blokk, og egen preamble tas vare på', () => {
    const d = makeDocs()[1];
    const extra = '\\begin{align}\n  a &= b \\\\\n  c &= d\n\\end{align}';
    const tex = code(d).replace('\\usepackage[norsk]{cleveref}', '\\usepackage[norsk]{cleveref}\n\\usepackage{xcolor}')
      .replace('\\maketitle', '\\maketitle\n\n' + extra + '\n\nTekst med \\textcolor{red}{farge} og $x^2 + y^2$.');
    const r = parseDocument(tex, { S, prev: d });
    expect(r.preamble).toBe('\\usepackage{xcolor}');
    expect(r.blocks[0]).toMatchObject({ type: 'raw', src: extra });
    expect(r.blocks[1]).toMatchObject({ type: 'raw', src: 'Tekst med \\textcolor{red}{farge} og $x^2 + y^2$.' });
    // generert kode inneholder alt som ble skrevet
    const out = code({ ...d, ...r });
    expect(out).toContain('\\usepackage{xcolor}');
    expect(out).toContain(extra);
    expect(parseDocument(out, { S, prev: { ...d, ...r } }).blocks).toEqual(r.blocks);
  });

  it('utdrag uten \\begin{document} (innliming) gir blokker', () => {
    const r = parseDocument('\\section{Måling}\nVi målte \\qty{4,7}{\\kilo\\ohm} over $R_1$.\n\n\\begin{equation}\n  v = R \\cdot i\n  \\label{eq:ohm}\n\\end{equation}', { S });
    expect(r.blocks.map(b => b.type)).toEqual(['h1', 'p', 'eq']);
    expect(r.title).toBeUndefined();
    expect(r.blocks[2]).toMatchObject({ src: 'v = R \\cdot i', label: 'eq:ohm' });
  });

  it('kretsfigur i koden importeres som krets', () => {
    const tex = '\\begin{figure}[ht]\n  \\centering\n  \\begin{circuitikz}\n    \\draw (0,0) to[R, l=$R_1$, a=\\qty{220}{\\ohm}] (2,0);\n  \\end{circuitikz}\n  \\caption{Motstand.}\n  \\label{fig:r}\n\\end{figure}';
    const [b] = parseDocument(tex, { S }).blocks;
    expect(b.type).toBe('fig');
    expect(b.caption).toBe('Motstand.');
    expect(b.circuit.comps.some(c => c.type === 'R' && c.val && c.val.num === '220')).toBe(true);
  });

  it('manglende \\end gir feil med linjenummer', () => {
    expect(() => parseDocument('a\n\n\\begin{equation}\n x = 1\n', { S })).toThrow(/Linje 3: \\begin\{equation\} mangler \\end\{equation\}/);
    expect(() => parseDocument('\\begin{document}\nx', { S })).toThrow(/Mangler \\end\{document\}/);
  });
});
