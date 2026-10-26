// Sanntidskanal: WebSocket mot Kobling-serveren (/sync/<rom>), med BroadcastChannel
// mellom faner som reserve når serveren ikke svarer. Samme grensesnitt som BroadcastChannel.
type Handler = ((e: { data: any }) => void) | null;

export function openChannel(room: string) {
  const ch = { onmessage: null as Handler, postMessage(_m: any) {}, close() {} };
  let bc: BroadcastChannel | null = null;
  try { bc = new BroadcastChannel('kobling-' + room); bc.onmessage = e => ch.onmessage?.(e) } catch { /* ikke støttet */ }
  let ws: WebSocket | null = null, queue: string[] = [], closed = false, wait = 500;
  const connect = () => {
    if (closed || !/^https?:$/.test(location.protocol)) return;
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/sync/' + encodeURIComponent(room));
    ws.onopen = () => { wait = 500; queue.forEach(m => ws!.send(m)); queue = [] };
    ws.onmessage = e => { try { ch.onmessage?.({ data: JSON.parse(e.data) }) } catch { /* ugyldig melding */ } };
    ws.onclose = e => { ws = null; if (e.code !== 4401) setTimeout(connect, wait = Math.min(wait * 2, 15000)) };
  };
  connect();
  ch.postMessage = m => {
    bc?.postMessage(m);
    const s = JSON.stringify(m);
    if (ws && ws.readyState === 1) ws.send(s); else queue = [s];
  };
  ch.close = () => { closed = true; bc?.close(); ws?.close() };
  return ch;
}
