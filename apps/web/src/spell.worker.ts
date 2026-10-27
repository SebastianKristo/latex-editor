// Stavekontroll med Hunspell-ordbøker (nb_NO, en_US) via nspell, i egen tråd så editoren ikke stopper.
// Ordbøkene hentes fra serveren (/dict/<språk>.aff|dic) første gang de trengs.
import nspell from 'nspell';

let sp: any = null, lang = '', loading: Promise<void> | null = null;
const cache = new Map<string, string | null>();

async function load(l: string, base: string) {
  if (lang === l && sp) return;
  if (loading && lang === l) return loading;
  lang = l;
  cache.clear();
  loading = (async () => {
    const [aff, dic] = await Promise.all(['aff', 'dic'].map(f => fetch(base + '/dict/' + l + '.' + f).then(r => {
      if (!r.ok) throw new Error('Fant ikke ordboken');
      return r.text();
    })));
    sp = nspell(aff, dic);
  })();
  try { await loading } finally { loading = null }
}

// Norsk setter sammen ord fritt; godta to (eller tre) kjente ledd, eventuelt med fuge-s/-e
function ok(w: string, depth = 0): boolean {
  if (sp.correct(w)) return true;
  if (lang !== 'nb' || depth > 1 || w.length < 7) return false;
  for (let i = 3; i <= w.length - 4; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    const tail = () => sp.correct(b) || ok(b, depth + 1);
    if (sp.correct(a) && tail()) return true;
    if (a.length > 4 && /[se]$/.test(a) && sp.correct(a.slice(0, -1)) && tail()) return true;
  }
  return false;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, lang: l, base, words } = e.data as { id: number; lang: string; base: string; words: string[] };
  try {
    await load(l, base);
    const out: Record<string, string> = {};
    for (const w of words) {
      if (!cache.has(w)) cache.set(w, ok(w) ? null : sp.suggest(w)[0] || '');
      const r = cache.get(w);
      if (r !== null && r !== undefined) out[w] = r;
    }
    (self as any).postMessage({ id, lang: l, out });
  } catch (err: any) {
    (self as any).postMessage({ id, lang: l, error: String(err && err.message || err) });
  }
};
