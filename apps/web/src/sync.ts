// Demo-modus uten server: synk mellom faner i samme nettleser (som i prototypen).
// Med server går sanntid via Yjs (se ysocket.ts og server-mode.js).
export function openChannel(room: string) {
  const bc = new BroadcastChannel('kobling-' + room);
  const ch = {
    onmessage: null as ((e: { data: any }) => void) | null,
    postMessage: (m: any) => bc.postMessage(m),
    close: () => bc.close()
  };
  bc.onmessage = e => ch.onmessage?.(e);
  return ch;
}
