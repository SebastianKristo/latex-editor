// Ekte PDF fra serveren, tegnet med pdf.js. Klikk gir PDF-koordinater (punkt fra øvre venstre hjørne)
// til SyncTeX; markerte bokser viser hvor aktiv blokk ligger.
import React from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Box = { page: number; x: number; y: number; w: number; h: number };
type Props = { data: Uint8Array; zoom: number; boxes: Box[]; onPick: (page: number, x: number, y: number) => void };

const PAGE_W = 440; // samme bredde som forhåndsvisningen ved 100 %

export function PdfView({ data, zoom, boxes, onPick }: Props) {
  const [pages, setPages] = React.useState<{ w: number; h: number }[]>([]);
  const docRef = React.useRef<any>(null);
  const canvases = React.useRef<(HTMLCanvasElement | null)[]>([]);
  const hlRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let dead = false;
    const task = pdfjs.getDocument({ data: data.slice() });
    task.promise.then(async doc => {
      if (dead) return doc.destroy();
      const sizes = [];
      for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const vp = p.getViewport({ scale: 1 }); sizes.push({ w: vp.width, h: vp.height }) }
      docRef.current?.destroy();
      docRef.current = doc;
      setPages(sizes);
    }).catch(() => {});
    return () => { dead = true };
  }, [data]);

  React.useEffect(() => () => { docRef.current?.destroy() }, []);

  React.useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    let dead = false;
    const dpr = window.devicePixelRatio || 1;
    pages.forEach(async (sz, i) => {
      const page = await doc.getPage(i + 1);
      const c = canvases.current[i];
      if (!c || dead) return;
      const scale = (PAGE_W * zoom) / sz.w;
      const vp = page.getViewport({ scale: scale * dpr });
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise.catch(() => {});
    });
    return () => { dead = true };
  }, [pages, zoom]);

  React.useEffect(() => { hlRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [boxes]);

  return (
    <>
      {pages.map((sz, i) => {
        const scale = (PAGE_W * zoom) / sz.w;
        const mine = boxes.filter(b => b.page === i + 1);
        return (
          <div key={i} data-page={i + 1} data-paper="1" style={{ position: 'relative', width: PAGE_W * zoom, height: sz.h * scale, flex: 'none', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.12)', cursor: 'pointer' }}
            onClick={e => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); onPick(i + 1, (e.clientX - r.left) / scale, (e.clientY - r.top) / scale) }}>
            <canvas ref={el => { canvases.current[i] = el }} style={{ width: '100%', height: '100%', display: 'block' }} />
            {mine.map((b, k) => (
              <div key={k} ref={k === 0 ? hlRef : undefined} style={{ position: 'absolute', left: b.x * scale - 2, top: (b.y - b.h) * scale - 2, width: b.w * scale + 4, height: Math.max(b.h, 8) * scale + 4, background: 'rgba(43, 98, 196, .16)', borderRadius: 2, pointerEvents: 'none' }} />
            ))}
          </div>
        );
      })}
    </>
  );
}
