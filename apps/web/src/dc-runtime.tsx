// Kjører prototypens mal-DSL (sc-if, sc-for, {{ sti }}, style-hover) som React.
// Malen parses én gang til et tre; hver render binder treet mot visningsmodellen fra renderVals().
import React from 'react';

type Node = { tag: string; attrs: [string, string][]; kids: Node[] } | string;
type Scope = Record<string, any>;

const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);

export function parseTemplate(src: string): Node[] {
  let i = 0;
  const root: Node[] = [], stack: { tag: string; kids: Node[] }[] = [{ tag: '#root', kids: root }];
  const top = () => stack[stack.length - 1];
  while (i < src.length) {
    if (src[i] === '<') {
      if (src[i + 1] === '/') {
        const end = src.indexOf('>', i);
        const tag = src.slice(i + 2, end).trim();
        while (stack.length > 1 && top().tag !== tag) stack.pop();
        if (stack.length > 1) stack.pop();
        i = end + 1;
        continue;
      }
      let j = i + 1;
      while (/[\w-]/.test(src[j])) j++;
      const tag = src.slice(i + 1, j), attrs: [string, string][] = [];
      let selfClose = false;
      for (;;) {
        while (/\s/.test(src[j])) j++;
        if (src[j] === '>') { j++; break }
        if (src[j] === '/' && src[j + 1] === '>') { selfClose = true; j += 2; break }
        let k = j;
        while (/[^\s=>/]/.test(src[k])) k++;
        const name = src.slice(j, k);
        if (src[k] === '=') {
          const q = src[k + 1], e = src.indexOf(q, k + 2);
          attrs.push([name, src.slice(k + 2, e)]);
          j = e + 1;
        } else { attrs.push([name, 'true']); j = k }
      }
      const el = { tag, attrs, kids: [] as Node[] };
      top().kids.push(el);
      if (!selfClose && !VOID.has(tag)) stack.push(el);
      i = j;
    } else {
      const e = src.indexOf('<', i);
      const text = src.slice(i, e < 0 ? src.length : e);
      if (text.trim() || /\S/.test(text) || (text && !/\n/.test(text))) top().kids.push(text);
      i = e < 0 ? src.length : e;
    }
  }
  return root;
}

const LIT: Record<string, any> = { true: true, false: false, null: null };
const get = (scope: Scope, path: string): any => path in LIT ? LIT[path] : /^\d+$/.test(path) ? Number(path) : path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
const ONE = /^\{\{\s*([\w.$]+)\s*\}\}$/;
const ANY = /\{\{\s*([\w.$]+)\s*\}\}/g;

function value(raw: string, scope: Scope): any {
  const m = raw.match(ONE);
  if (m) return get(scope, m[1]);
  return raw.replace(ANY, (_, p) => { const v = get(scope, p); return v == null ? '' : String(v) });
}

const styleCache = new Map<string, React.CSSProperties>();
function cssToObj(css: string): React.CSSProperties {
  const hit = styleCache.get(css);
  if (hit) return hit;
  const o: Record<string, string> = {};
  // Del på ; utenfor parenteser (url(...), oklch(...) osv.)
  let d = 0, cur = '';
  const parts: string[] = [];
  for (const ch of css) {
    if (ch === '(') d++; else if (ch === ')') d--;
    if (ch === ';' && d === 0) { parts.push(cur); cur = '' } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const c = p.indexOf(':');
    if (c < 0) continue;
    const k = p.slice(0, c).trim(), v = p.slice(c + 1).trim();
    if (!k) continue;
    o[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = v;
  }
  if (styleCache.size > 5000) styleCache.clear();
  styleCache.set(css, o as React.CSSProperties);
  return o as React.CSSProperties;
}

const Hover = React.forwardRef<any, { tag: string; props: any; hover: React.CSSProperties; children?: React.ReactNode }>(
  function Hover({ tag, props, hover, children }, ref) {
    const [on, setOn] = React.useState(false);
    const p = {
      ...props, ref,
      style: on ? { ...props.style, ...hover } : props.style,
      onMouseEnter: (e: any) => { setOn(true); props.onMouseEnter?.(e) },
      onMouseLeave: (e: any) => { setOn(false); props.onMouseLeave?.(e) }
    };
    return React.createElement(tag, p, children);
  }
);

const RENAME: Record<string, string> = { class: 'className', for: 'htmlFor' };

function renderNodes(nodes: Node[], scope: Scope, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((n, idx) => {
    const key = keyBase + '.' + idx;
    if (typeof n === 'string') {
      const parts = n.split(/(\{\{\s*[\w.$]+\s*\}\})/);
      parts.forEach((p, pi) => {
        if (!p) return;
        const m = p.match(ONE);
        if (!m) { out.push(p); return }
        const v = get(scope, m[1]);
        if (v == null || v === false) return;
        out.push(React.isValidElement(v) ? React.cloneElement(v, { key: key + ':' + pi }) : Array.isArray(v) ? React.createElement(React.Fragment, { key: key + ':' + pi }, v) : String(v));
      });
      return;
    }
    const at = Object.fromEntries(n.attrs);
    if (n.tag === 'sc-if') {
      if (value(at.value, scope)) out.push(...renderNodes(n.kids, scope, key));
      return;
    }
    if (n.tag === 'sc-for') {
      const list = (value(at.list, scope) as any[]) || [];
      list.forEach((item, li) => out.push(React.createElement(React.Fragment, { key: key + '#' + (item && item.key != null && typeof item.key !== 'object' ? item.key : li) }, renderNodes(n.kids, { ...scope, [at.as]: item }, key + '#' + li))));
      return;
    }
    const props: any = { key };
    let hover: React.CSSProperties | null = null;
    for (const [name, raw] of n.attrs) {
      if (name.startsWith('hint-')) continue;
      const v = value(raw, scope);
      if (name === 'style') props.style = cssToObj(String(v));
      else if (name === 'style-hover') hover = cssToObj(String(v));
      else if (name === 'key') props.key = key + '|' + v;
      else if (name === 'contentEditable') props.contentEditable = v === true || v === 'true';
      else if (name === 'suppressContentEditableWarning' || name === 'multiple' || name === 'autoFocus' || name === 'draggable') props[name] = v === true || v === 'true';
      else if (name === 'spellCheck') props.spellCheck = v === true || v === 'true';
      // SVG-attributter som stroke-width skrives camelCase i React; data-/aria- beholdes.
      else if (name.includes('-') && !/^(data|aria)-/.test(name)) props[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
      else props[RENAME[name] || name] = v;
    }
    if (VOID.has(n.tag) || n.tag === 'textarea') delete props.children;
    const kids = n.tag === 'textarea' ? undefined : renderNodes(n.kids, scope, key);
    const children = kids && kids.length ? kids : undefined;
    if (hover) out.push(React.createElement(Hover, { key: props.key, tag: n.tag, props: { ...props, key: undefined, ref: undefined }, hover, ref: props.ref }, children));
    else out.push(React.createElement(n.tag, props, children));
  });
  return out;
}

let TREE: Node[] = [], GLOBALS: Scope = {};
export function setTemplate(src: string, globals: Scope = {}) { TREE = parseTemplate(src); GLOBALS = globals }

// Basisklassen prototypen arver fra: render() binder malen mot renderVals().
export class DCLogic<P = any, S = any> extends React.Component<P, S> {
  renderVals(): Scope { return {} }
  render() {
    const nodes = renderNodes(TREE, { ...GLOBALS, ...this.renderVals() }, 'r');
    return nodes.length === 1 ? nodes[0] : React.createElement(React.Fragment, null, nodes);
  }
}
