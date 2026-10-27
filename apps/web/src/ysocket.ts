// Kobler et Y.Doc til serveren (/sync/<dokument>) med y-websocket-protokollen,
// inkludert awareness for live-markører. Kobler til på nytt ved brudd.
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Y } from '@kobling/core/ydoc';
import { wsBase, authQuery } from './api';

const MSG_SYNC = 0, MSG_AWARENESS = 1, MSG_DENIED = 9, MSG_NOTICE = 10;

export class YSocket {
  doc = new Y.Doc();
  awareness = new awarenessProtocol.Awareness(this.doc);
  synced = false;
  onSynced: () => void = () => {};
  onDenied: () => void = () => {};
  onNotice: (text: string) => void = () => {};
  onStatus: (s: 'online' | 'offline' | 'closed', code?: number) => void = () => {};
  private ws: WebSocket | null = null;
  private wait = 500;
  private closed = false;

  constructor(private docId: string) {
    this.doc.on('update', (u: Uint8Array, origin: any) => {
      if (origin === this) return;
      this.send(MSG_SYNC, enc => syncProtocol.writeUpdate(enc, u));
    });
    this.awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
      if (origin === 'remote') return;
      const changed = added.concat(updated, removed);
      this.send(MSG_AWARENESS, enc => encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)));
    });
    window.addEventListener('beforeunload', this.unload);
    this.connect();
  }

  private unload = () => awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'unload');

  private connect() {
    if (this.closed) return;
    const ws = new WebSocket(wsBase() + '/sync/' + encodeURIComponent(this.docId) + authQuery());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      this.wait = 500;
      this.onStatus('online');
      this.send(MSG_SYNC, enc => syncProtocol.writeSyncStep1(enc, this.doc));
      if (this.awareness.getLocalState())
        this.send(MSG_AWARENESS, enc => encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])));
    };
    ws.onmessage = e => {
      const dec = decoding.createDecoder(new Uint8Array(e.data));
      const type = decoding.readVarUint(dec);
      if (type === MSG_SYNC) {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MSG_SYNC);
        const st = syncProtocol.readSyncMessage(dec, enc, this.doc, this);
        if (encoding.length(enc) > 1) ws.send(encoding.toUint8Array(enc));
        if (st === syncProtocol.messageYjsSyncStep2 && !this.synced) { this.synced = true; this.onSynced() }
      } else if (type === MSG_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(dec), 'remote');
      } else if (type === MSG_DENIED) this.onDenied();
      else if (type === MSG_NOTICE) this.onNotice(decoding.readVarString(dec));
    };
    ws.onclose = e => {
      this.ws = null;
      const others = [...this.awareness.getStates().keys()].filter(k => k !== this.doc.clientID);
      awarenessProtocol.removeAwarenessStates(this.awareness, others, 'remote');
      if (this.closed || e.code === 4000 || e.code === 4401 || e.code === 4403) { this.onStatus('closed', e.code); return }
      this.onStatus('offline');
      setTimeout(() => this.connect(), this.wait = Math.min(this.wait * 2, 10000));
    };
  }

  private send(type: number, write: (e: encoding.Encoder) => void) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, type);
    write(enc);
    this.ws.send(encoding.toUint8Array(enc));
  }

  destroy() {
    this.closed = true;
    this.unload();
    window.removeEventListener('beforeunload', this.unload);
    this.ws?.close();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
