// Kall mot Kobling-serveren. På web er serveren samme opprinnelse; i desktop- og mobilappen
// lagres serveradressen lokalt og økten sendes som Bearer-token.
const LS_SERVER = 'kobling-server', LS_TOKEN = 'kobling-token';

const read = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } };
const write = (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch { /* privat modus */ } };

// Mobilappen (Capacitor) har filene lokalt og snakker med en server på en annen adresse, som desktop.
export const isNativeApp = () => { const c = (window as any).Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()) };
export const isDesktop = () => '__TAURI_INTERNALS__' in window || isNativeApp();
export function serverBase(): string {
  if (!isDesktop()) return '';
  return read(LS_SERVER).replace(/\/+$/, '');
}
export const setServerBase = (url: string) => write(LS_SERVER, url.trim().replace(/\/+$/, ''));
export const setToken = (t: string) => write(LS_TOKEN, t);
export const wsBase = () => {
  const b = serverBase() || location.origin;
  return b.replace(/^http/, 'ws');
};
export const authQuery = () => (read(LS_TOKEN) && isDesktop() ? '?token=' + encodeURIComponent(read(LS_TOKEN)) : '');

export class ApiError extends Error { status: number; data: any; constructor(m: string, s: number, d: any) { super(m); this.status = s; this.data = d } }

export async function api<T = any>(method: string, path: string, body?: any, opts: { raw?: boolean; timeout?: number } = {}): Promise<T> {
  if (isDesktop() && !serverBase()) throw new ApiError('Velg en server først.', 0, null);
  const headers: Record<string, string> = {};
  const tok = read(LS_TOKEN);
  if (tok) headers.authorization = 'Bearer ' + tok;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const ctl = new AbortController();
  const timer = opts.timeout ? setTimeout(() => ctl.abort(), opts.timeout) : null;
  let res: Response;
  try {
    res = await fetch(serverBase() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include', signal: ctl.signal });
  } catch {
    throw new ApiError('Fikk ikke kontakt med serveren.', 0, null);
  } finally { if (timer) clearTimeout(timer) }
  if (opts.raw && res.ok) return res as any;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError((data && data.error) || 'Noe gikk galt (' + res.status + ').', res.status, data);
  // Alle API-svar er JSON; HTML betyr at adressen ikke er en Kobling-server.
  if (!ct.includes('json')) throw new ApiError('Adressen svarer, men er ikke en Kobling-server.', res.status, null);
  return data as T;
}

export const b64 = async (blob: Blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};
