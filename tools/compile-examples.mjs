// Kompilerer alle eksempeldokumentene fra prototypen med latexmk og feiler ved første feil.
import { makeDocs, docCode, DEF_SET } from '../packages/core/src/index.js';
import { compileTex } from '../apps/server/src/compile.js';

let failed = 0;
for (const S of [DEF_SET, { ...DEF_SET, cols: 1, size: '12pt' }]) {
  for (const d of makeDocs()) {
    // Bilder i eksemplene er data-URL-er; erstatt med en ramme så kompileringen ikke trenger filene.
    const tex = docCode(d, S).map(l => l.s).join('\n').replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, '\\fbox{bilde}');
    const r = await compileTex({ tex });
    console.log((r.ok ? 'OK  ' : 'FEIL') + ` ${d.title} (${S.cols} sp.) ${r.ms} ms`);
    if (!r.ok) { failed++; console.log(r.errors, r.log.slice(-3000)) }
  }
}
process.exit(failed ? 1 : 0);
