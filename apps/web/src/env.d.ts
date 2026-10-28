declare module '*.html?raw' { const s: string; export default s }
declare module './App.js' { const C: any; export default C }
declare module 'katex';
declare module './server-mode.js' { export class ServerSession { constructor(o: { user: any; docs: any[]; access?: any }) } export function readCache(): any }
declare module '*?url' { const s: string; export default s }
declare module 'nspell';
