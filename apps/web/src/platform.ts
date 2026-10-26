// mac/win når appen kjører i Tauri-skallet, ellers web.
export function detectPlatform(): 'mac' | 'win' | 'web' {
  const forced = new URLSearchParams(location.search).get('platform');
  if (forced === 'mac' || forced === 'win' || forced === 'web') return forced;
  if (!('__TAURI_INTERNALS__' in window)) return 'web';
  return /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'win';
}

// Vindusknapper for Windows-tittellinjen (bare i Tauri).
const win = async () => (await import('@tauri-apps/api/window')).getCurrentWindow();
export const windowControls = {
  winMin: () => win().then(w => w.minimize()),
  winMax: () => win().then(w => w.toggleMaximize()),
  winClose: () => win().then(w => w.close())
};
