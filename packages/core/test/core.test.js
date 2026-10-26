import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeDocs, docCode, parseBlock, parseCircuit, circLines, autoLayout, DEF_SET, numberDoc, paginate } from '../src/index.js';

const S = { ...DEF_SET };
const docs = makeDocs();
const strip = b => { const { id, ...r } = b; if (!r.span) delete r.span; return r };

describe('docCode', () => {
  it.each(docs.map(d => [d.title, d]))('%s gir et komplett dokument', (_, d) => {
    const tex = docCode(d, S).map(l => l.s).join('\n');
    expect(tex.startsWith('\\documentclass[11pt,a4paper,twocolumn]{article}')).toBe(true);
    expect(tex.trim().endsWith('\\end{document}')).toBe(true);
    expect(tex).toMatch(/\\usepackage(\[[^\]]*\])?\{cleveref\}/);
    expect((tex.match(/\\begin\{/g) || []).length).toBe((tex.match(/\\end\{/g) || []).length);
  });
});

describe('rundtur visuell → LaTeX → visuell', () => {
  const blocks = docs.flatMap(d => d.blocks.map(b => [d.id + ':' + b.type + ':' + b.id, d, b]));
  it.each(blocks)('%s', (_, d, b) => {
    const code = docCode(d, S).filter(l => l.bid === b.id).map(l => l.s).join('\n');
    const back = { ...b, ...parseBlock(b, code) };
    expect(strip(back)).toEqual(strip(b));
  });
});

describe('CircuiTikZ', () => {
  const main = readFileSync(new URL('../../../design_handoff_kobling/reference/main.tex', import.meta.url), 'utf8');
  const src = main.match(/\\begin\{circuitikz\}[\s\S]*?\\end\{circuitikz\}/)[0];

  it('importerer diodekretsen fra main.tex', () => {
    const r = parseCircuit(src);
    expect(r.data).not.toBeNull();
    const types = r.data.comps.filter(c => c.type !== 'pt').map(c => c.type).sort();
    expect(types).toEqual(['R', 'V', 'led']);
  });

  it('eksporterer og importerer igjen uten tap', () => {
    const a = parseCircuit(src).data;
    const code = circLines(a, 'european').map(l => l.s).join('\n');
    expect(code).toMatch(/^\\begin\{circuitikz\}/);
    expect(code).toContain('\\end{circuitikz}');
    const b = parseCircuit(code).data;
    const sig = d => d.comps.filter(c => c.type !== 'pt').map(c => c.type + (c.val ? c.val.num + c.val.unit : '')).sort();
    expect(sig(b)).toEqual(sig(a));
  });

  it('auto-plassering gir rutenett-justerte posisjoner', () => {
    const d = autoLayout(parseCircuit(src).data);
    d.comps.forEach(c => { expect((c.x * 2) % 1).toBe(0); expect((c.y * 2) % 1).toBe(0) });
  });
});

describe('nummerering og paginering', () => {
  it('bilder og kretsfigurer deler figurnummer', () => {
    const d = docs[0];
    const nb = numberDoc(d.blocks);
    const figs = d.blocks.filter(b => b.type === 'fig' || b.type === 'img').map(b => nb.num[b.id]);
    expect(figs).toEqual(figs.map((_, i) => i + 1));
  });
  it('paginerer til minst én side', () => {
    expect(paginate(docs[0].blocks, 2, ',').length).toBeGreaterThan(0);
  });
});
