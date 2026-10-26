// Typer for den rene kjernelogikken (implementert i index.js, løftet fra prototypen).
export type Seg =
  | { t: 'text'; v: string }
  | { t: 'unit'; num: string; prefix: string; unit: string }
  | { t: 'sym'; base: string; sub?: string; tex: string }
  | { t: 'ref'; target: string };
export interface Component { id: string; type: string; x: number; y: number; rot: number; name: string; sub: string; val?: { num: string; prefix: string; unit: string } | null; ic?: string; pinl?: Record<string, { name?: string; pin?: string }> }
export interface Wire { id: string; a: { c: string; t: string }; b: { c: string; t: string } }
export interface Circuit { comps: Component[]; wires: Wire[]; manual?: boolean }
export type Block = { id: string } & (
  | { type: 'abstract' | 'h1' | 'h2'; text: string }
  | { type: 'p'; segs: Seg[] }
  | { type: 'eq'; src: string; label: string }
  | { type: 'fig'; caption: string; label: string; span?: boolean; circuit: Circuit }
  | { type: 'img'; src: string; file: string; w: number; span?: boolean; caption: string; label: string }
  | { type: 'table'; style: string; caption: string; label: string; rows: string[][] }
);
export interface Doc { id: string; title: string; authors: string; group: string; folder: string; meta?: string; blocks: Block[] }
export interface Settings { size: string; cols: number; dec: string; imag: string; style: string; indent: boolean; warn: boolean; maxPages: number; engine: string; auto: boolean; [k: string]: any }
export interface Line { s: string; bid?: string | null; cid?: string }

export const CT: Record<string, any>;
export const PFX: { k: string; s: string; n: string; c: string }[];
export const UNITS: { k: string; s: string; n: string; c: string }[];
export const SYMS: any[];
export const MACROS: Record<string, string>;
export const DEF_SET: Settings;
export const DEF_SMTP: Record<string, any>;
export const PROTON_FREE: RegExp;
export const EMAIL_RE: RegExp;
export const DUCK_RE: RegExp;
export const TOKEN_RE: RegExp;
export function preamble(S: Settings): string[];
export function docCode(doc: Doc, S: Settings): Line[];
export function circLines(d: Circuit, style: string): Line[];
export function parseCircuit(src: string): { data: Circuit | null; warn: string[]; style?: string; count?: number };
export function autoLayout(d: Circuit): Circuit;
export function parseBlock(b: Block, code: string): Partial<Block>;
export function parseInline(s: string): Seg[];
export function numberDoc(blocks: Block[]): { num: Record<string, any>; labels: Record<string, any>; refText(l: string): string };
export function paginate(blocks: Block[], cols: number, dec: string): Block[][];
export function makeDocs(): Doc[];
export function skeleton(tpl: string): Block[];
export function terms(c: Component): Record<string, { x: number; y: number }>;
export function cbox(d: Circuit): { x0: number; y0: number; x1: number; y1: number };
export function qtyCode(v: { num: string; prefix: string; unit: string }): string;
export function esc(s: string): string;
export function slug(s: string): string;
export function diode(): Circuit;
export function gamepad(): Circuit;
