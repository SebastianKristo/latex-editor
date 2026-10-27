import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeDocs, docCode, parseDoc, lintTex, mergePre, DEF_SET } from '../src/index.js';

const S = { ...DEF_SET };
const code = (d, s = S) => docCode(d, s).map(l => l.s).join('\n');
// Tomme avsnitt gir bare tomme linjer; de sammenlignes ikke.
const content = t => t.replace(/\n{2,}/g, '\n\n');

describe('parseDoc (redigerbar kode, v2)', () => {
  it.each(makeDocs().map(d => [d.title, d]))('%s: uendret kode gir samme innhold', (_, d) => {
    const r = parseDoc(code(d), d, S);
    expect(r.title).toBe(d.title);
    expect(content(code({ ...d, ...r, pre: r.pre }, { ...S, ...r.settings }))).toBe(content(code(d)));
  });

  it('ukjent LaTeX blir raw ordrett, egen preamble havner i pre', () => {
    const d = makeDocs()[1];
    const extra = '\\begin{multicols}{2}\nTo spalter her.\n\\end{multicols}';
    const tex = code(d).replace('\\usepackage[norsk]{cleveref}', '\\usepackage[norsk]{cleveref}\n\\usepackage{multicol}')
      .replace('\\maketitle', '\\maketitle\n\n' + extra);
    const r = parseDoc(tex, d, S);
    expect(r.pre).toContain('\\usepackage{multicol}');
    expect(r.blocks.find(b => b.type === 'raw').src).toBe(extra);
  });

  it('manglende \\end{document} gir feil med linjenummer', () => {
    expect(() => parseDoc('\\begin{document}\nx', makeDocs()[0], S)).toThrow();
    try { parseDoc('\\begin{document}\nx', makeDocs()[0], S) } catch (e) { expect(e.msg).toMatch(/end\{document\}/) }
  });
});

describe('lintTex', () => {
  it('skolens main.tex gir ingen falske feil (akseptanse 9)', () => {
    const main = readFileSync(new URL('../../../design_handoff_kobling/reference/main.tex', import.meta.url), 'utf8');
    const errs = lintTex(main, new Set(['ntnu-logo.png', 'kretsskjema-eksempel.png'])).filter(d => d.sev === 'error');
    // bilder i malen finnes ikke her; alt annet skal være feilfritt
    expect(errs.filter(d => !/bilde|fil/i.test(d.msg))).toEqual([]);
  });
  it('finner ekte feil: manglende } og manglende pakke', () => {
    const t = '\\documentclass{article}\n\\newcommand{\\nb}{x\n\\begin{document}\n\\begin{multicols}{2}\na\n\\end{multicols}\n\\end{document}';
    const msgs = lintTex(t, new Set()).filter(d => d.sev === 'error').map(d => d.line + ': ' + d.msg);
    expect(msgs.some(m => /^2: /.test(m))).toBe(true);
    expect(msgs.some(m => /multicol/.test(m))).toBe(true);
  });
});

describe('egen preamble mot generert', () => {
  const pre = ['\\usepackage[margin=2.5cm]{geometry}', '\\usepackage[hyphens]{url}', '\\usepackage{hyperref}', '\\usepackage{amsmath}'];
  const d = { ...makeDocs()[0], pre };
  const tex = code(d);
  const loads = n => tex.split('\n').filter(l => new RegExp('\\\\usepackage(\\[[^\\]]*\\])?\\{' + n + '\\}').test(l));

  it('egen \\usepackage{geometry} erstatter den genererte (ingen option clash)', () => {
    expect(loads('geometry')).toEqual(['\\usepackage[margin=2.5cm]{geometry}']);
    expect(loads('amsmath')).toHaveLength(1);
    expect(lintTex(tex).filter(x => /Option clash/.test(x.msg))).toEqual([]);
  });

  it('cleveref lastes etter hyperref', () => {
    const ls = tex.split('\n');
    expect(ls.findIndex(l => /\{cleveref\}/.test(l))).toBeGreaterThan(ls.findIndex(l => /\{hyperref\}/.test(l)));
  });

  it('koden kan leses inn igjen uten at linjene dobles', () => {
    const r = parseDoc(tex, d, S);
    expect(code({ ...d, ...r }, { ...S, ...r.settings })).toBe(tex);
  });

  it('lintTex finner samme pakke lastet med ulike valg', () => {
    const t = '\\documentclass{article}\n\\usepackage[a4paper]{geometry}\n\\usepackage[margin=1cm]{geometry}\n\\begin{document}\nx\n\\end{document}';
    const e = lintTex(t).filter(x => /Option clash/.test(x.msg));
    expect(e.map(x => x.line)).toEqual([3]);
  });
});

describe('preamble over flere linjer', () => {
  const src = [
    '\\documentclass[11pt,a4paper]{article}',
    '\\usepackage[a4paper,',
    '            top=2cm,',
    '            marginparwidth=1.75cm]{geometry}',
    '\\sisetup{',
    '  output-complex-root = \\ensuremath{\\mathit{j}},',
    '  output-decimal-marker = {,}',
    '}',
    '% Markering av grupper',
    '\\newcommand{\\markcell}[1]{%',
    '    \\draw[red] (#1.north west) rectangle (#1.south east);',
    '}',
    '\\author{Ola Nordmann, Kari Nordmann\\\\Gruppe 1}',
    '\\begin{document}',
    'Tekst.',
    '\\end{document}'
  ].join('\n');
  const d0 = { ...makeDocs()[0], blocks: [] };
  const r = parseDoc(src, d0, S), S2 = { ...S, ...r.settings };
  const tex = code({ ...d0, ...r }, S2);

  it('geometry over flere linjer erstatter den genererte (ingen option clash)', () => {
    expect(tex.match(/\{geometry\}/g)).toHaveLength(1);
    expect(tex).toContain('marginparwidth=1.75cm]{geometry}');
    expect(lintTex(tex).filter(x => /Option clash/.test(x.msg))).toEqual([]);
  });

  it('en linje med bare } i en egen makro forsvinner ikke', () => {
    expect(tex).toContain('\\newcommand{\\markcell}[1]{%\n    \\draw[red] (#1.north west) rectangle (#1.south east);\n}');
    expect(lintTex(tex).filter(x => x.sev === 'error')).toEqual([]);
  });

  it('sisetup blir innstillinger, forfattere beholder mellomrom, og rundturen er stabil', () => {
    expect(r.settings.dec).toBe(',');
    expect(r.settings.imag).toBe('j');
    expect(r.authors).toBe('Ola Nordmann, Kari Nordmann');
    expect(r.pre).toContain('% Markering av grupper');
    const r2 = parseDoc(tex, { ...d0, ...r }, S2);
    expect(code({ ...d0, ...r, ...r2 }, { ...S2, ...r2.settings })).toBe(tex);
  });

  it('bilder med bare filnavn finnes i bilder/', () => {
    expect(tex).toContain('\\graphicspath{{bilder/}}');
  });
});

describe('TikZ-biblioteker i feilsjekken', () => {
  const doc = lib => ['\\documentclass{article}', '\\usepackage{tikz}', lib, '\\begin{document}',
    '\\begin{tikzpicture}', '\\matrix (m) [matrix of nodes] { a & b \\\\ };', '\\node[above=2mm of m] {x};', '\\end{tikzpicture}', '\\end{document}'].join('\n');
  const tikz = t => lintTex(t).filter(d => /tikz|TikZ/.test(d.msg));

  it('matrix of nodes og above=… of uten bibliotek gir feil med hurtigretting', () => {
    const d = tikz(doc(''));
    expect(d.map(x => [x.line, x.sev])).toEqual([[6, 'error'], [7, 'error']]);
    expect(d[0].hint).toContain('\\usetikzlibrary{matrix}');
    expect(d[0].fix).toEqual({ label: 'Legg til \\usetikzlibrary{matrix}', line: 2, append: '\n\\usetikzlibrary{matrix}' });
    expect(d[1].hint).toContain('\\usetikzlibrary{positioning}');
  });

  it('ingen feil når bibliotekene er lastet', () => {
    expect(tikz(doc('\\usetikzlibrary{arrows.meta, positioning,matrix}'))).toEqual([]);
  });

  it('ingen falske funn i eksemplene', () => {
    for (const d of makeDocs()) expect(tikz(code(d))).toEqual([]);
  });
});

describe('innlimt preamble slås sammen setning for setning', () => {
  it('en } som avslutter en egen makro beholdes selv om den finnes fra før', () => {
    const a = ['\\newcommand{\\a}[1]{%', '  #1', '}'];
    const b = ['\\newcommand{\\b}[1]{%', '  #1', '}', '\\newcommand{\\a}[1]{%', '  #1', '}', '\\usetikzlibrary{matrix}'];
    expect(mergePre(a, b)).toEqual([...a, '\\newcommand{\\b}[1]{%', '  #1', '}', '\\usetikzlibrary{matrix}']);
  });
});
