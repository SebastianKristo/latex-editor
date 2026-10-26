export const DUCK_RE = /^[a-z0-9-]{1,63}$/;
export const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function duckUpdate(d, fetchImpl = fetch) {
  if (!DUCK_RE.test(d.domain)) return { ok: false, msg: 'Ugyldig subdomene.' };
  if (!TOKEN_RE.test(d.token)) return { ok: false, msg: 'Token må være en UUID.' };
  const url = `https://www.duckdns.org/update?domains=${d.domain}&token=${d.token}&ip=${d.ipv6 ? '&ipv6=' : ''}&verbose=true`;
  try {
    const r = await fetchImpl(url);
    const body = (await r.text()).trim();
    const [status, ip] = body.split('\n');
    return status === 'OK' ? { ok: true, ip: ip || '', msg: 'OK ' + (ip || '') } : { ok: false, msg: 'DuckDNS svarte KO (sjekk subdomene og token).' };
  } catch (e) {
    return { ok: false, msg: 'Fikk ikke kontakt med DuckDNS: ' + e.message };
  }
}

export function startDuck(getCfg, log) {
  let timer = null;
  const tick = async () => {
    const d = getCfg();
    if (d.on) log(await duckUpdate(d));
    timer = setTimeout(tick, Math.max(1, d.interval || 5) * 60000);
  };
  tick();
  return () => clearTimeout(timer);
}
