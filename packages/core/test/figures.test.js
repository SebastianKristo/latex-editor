import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { makeDocs, docCode, rawHtml, DEF_SET, sha256, figPreamble, extractFigures } from '../src/index.js';

const S = { ...DEF_SET };
globalThis.window = globalThis.window || {};
const FIG = '\\begin{circuitikz}\n  \\draw (0,0) to[R=$R_1$] (2,0); % kommentar\n\\end{circuitikz}';

describe('figurer fra serveren (README §9)', () => {
  it('sha256 er standard SHA-256', () => {
    for (const s of ['', 'abc', 'æøå'.repeat(50), 'x'.repeat(200)]) expect(sha256(s)).toBe(createHash('sha256').update(s).digest('hex'));
  });

  it.each([
    ['alene', FIG],
    ['i resizebox', '\\resizebox{0.6\\linewidth}{!}{%\n' + FIG + '\n}'],
    ['i figure', '\\begin{figure}[h]\n\\centering\n\\resizebox{0.5\\textwidth}{!}{' + FIG + '}\n\\caption{Krets}\n\\end{figure}']
  ])('klient og server får samme nøkkel (%s)', (_, src) => {
    const d = { ...makeDocs()[0], pre: ['\\newcommand{\\R}{\\mathbb{R}}'] };
    d.blocks = [...d.blocks.filter(b => b.type !== 'fig'), { id: 'r1', type: 'raw', src }];
    const tex = docCode(d, S).map(l => l.s).join('\n');
    const server = extractFigures(tex);
    expect(server).toHaveLength(1);
    expect(tex.split('\n')[server[0].line - 1]).toContain('\\begin{circuitikz}');
    const seen = [];
    rawHtml(src, { fig: { pre: figPreamble(tex), url: h => '/fig/' + h, state: h => (seen.push(h), undefined) } });
    expect(seen).toEqual([server[0].hash]);
    expect(server[0].code.startsWith(src.includes('resizebox') ? '\\resizebox{' : '\\begin{circuitikz}')).toBe(true);
  });

  it('bilde når figuren finnes, rød plassholder ved feil, puls mens den tegnes', () => {
    const ctx = st => ({ fig: { pre: '', url: h => '/fig/' + h + '.svg', state: () => st } });
    expect(rawHtml(FIG, ctx('ok'))).toMatch(/<img src="\/fig\/[0-9a-f]{64}\.svg"/);
    expect(rawHtml(FIG, ctx('error'))).toContain('Figuren kunne ikke tegnes · se logg');
    expect(rawHtml(FIG, ctx('busy'))).toContain('kobling-pulse');
    expect(rawHtml(FIG, ctx(undefined))).toContain('tegnes av serveren etter kompilering');
  });
});
