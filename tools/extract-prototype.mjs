// Engangs-bootstrap: trakk logikk og mal ut av design_handoff_kobling/prototype/Kobling App.dc.html.
// Utdataene (packages/core, packages/ui, apps/web/src/App.js, template.html) vedlikeholdes nå for hånd;
// ikke kjør på nytt uten å sjekke diff.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'design_handoff_kobling/prototype/Kobling App.dc.html'), 'utf8');
const lines = src.split('\n');
const at = re => lines.findIndex(l => re.test(l));

// --- mal ---
const tStart = at(/^<x-dc>/), tEnd = at(/^<\/x-dc>/);
let tpl = lines.slice(tStart + 1, tEnd).join('\n').replace(/<helmet>[\s\S]*?<\/helmet>\n?/, '');
// Plattformbryteren nederst er bare for prototypen.
const sw = tpl.lastIndexOf('<div style="position:absolute;bottom:16px;left:50%');
if (sw > 0) tpl = tpl.slice(0, sw).trimEnd() + '\n</div>\n';
write('apps/web/src/template.html', tpl);

// --- skript ---
const sStart = at(/<script type="text\/x-dc" data-dc-script/), sEnd = lines.length - 1 - [...lines].reverse().findIndex(l => /^<\/script>/.test(l));
const script = lines.slice(sStart + 1, sEnd);
const clsIdx = script.findIndex(l => /^class Component extends DCLogic/.test(l));
const top = script.slice(0, clsIdx), cls = script.slice(clsIdx);

// Del toppnivået i setninger med acorn og navngi hver etter det den deklarerer.
const topSrc = top.join('\n');
const ast = acorn.parse(topSrc, { ecmaVersion: 'latest', sourceType: 'module' });
const blocks = ast.body.map(n => ({
  code: topSrc.slice(n.start, n.end),
  names: n.type === 'FunctionDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name) : []
}));
const UI = new Set(['symEls', 'drawCircuit']);
const BROWSER = new Set(['SAVED', 'LSK', 'download', 'readImg', 'dataToBlob']);
const pick = test => blocks.filter(b => b.names.some(test));
const join_ = bs => bs.map(b => b.code).join('\n');
const coreBlocks = pick(n => !UI.has(n) && !BROWSER.has(n));
const coreNames = coreBlocks.flatMap(b => b.names);
const coreCode = join_(coreBlocks);
write('packages/core/src/index.js',
  '// Generert fra prototypen av tools/extract-prototype.mjs. Ren logikk uten DOM.\n/* eslint-disable */\n' +
  coreCode + '\n\nexport {' + coreNames.join(',') + '};\n');

const uiCode = join_(pick(n => UI.has(n)));
write('packages/ui/src/circuit.js',
  "// Generert fra prototypen av tools/extract-prototype.mjs. Kretssymboler som SVG (React-elementer).\n/* eslint-disable */\nimport React from 'react';\nimport {" +
  coreNames.join(',') + "} from '@kobling/core';\n" + uiCode + '\n\nexport {symEls,drawCircuit};\n');

const brCode = join_(pick(n => BROWSER.has(n)));
let clsCode = cls.join('\n')
  .replace("import('./deploy/generators.js')", 'Promise.resolve(GEN)');
write('apps/web/src/App.js',
  "// Generert fra prototypen av tools/extract-prototype.mjs. Appens tilstand og visningsmodell.\n/* eslint-disable */\nimport React from 'react';\nimport {" +
  coreNames.join(',') + "} from '@kobling/core';\nimport {symEls,drawCircuit} from '@kobling/ui';\nimport {DCLogic} from './dc-runtime';\nimport * as GEN from '../../../deploy/generators.js';\n" +
  brCode + '\n' + clsCode.replace(/^class Component/m, 'export default class Component') + '\n');

function write(rel, text) { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); console.log('skrev', rel, text.length) }
