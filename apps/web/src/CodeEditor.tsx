// Redigerbar main.tex med fargekoding og linjenumre: en gjennomsiktig textarea ligger over den
// fargelagte koden. Endringer sendes til onApply etter en kort pause (og når feltet forlates);
// så lenge man skriver, overskrives ikke teksten av dokumentet.
import React from 'react';
import { tok } from '@kobling/core';

type Line = { s: string; bid?: string | null };
type Props = {
  lines: Line[];                     // generert kode for dokumentet
  active: string | null;             // aktiv blokk (markeres)
  onApply: (text: string) => boolean; // false = kunne ikke leses (feilen vises av appen)
  onLine: (bid: string) => void;      // markøren står i en blokk
  onDone: () => void;                 // redigering avsluttet
};

const FONT: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.7, fontVariantLigatures: 'none', tabSize: 2 };
const GUTTER = 54; // 16 px marg + 38 px linjenummer, som i den opprinnelige kodevisningen
const HL = 'oklch(0.93 0.04 250)';

export function CodeEditor({ lines, active, onApply, onLine, onDone }: Props) {
  const generated = React.useMemo(() => lines.map(l => l.s).join('\n'), [lines]);
  const [draft, setDraft] = React.useState(generated);
  const [editing, setEditing] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ta = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => { if (!editing) setDraft(generated) }, [generated, editing]);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, []);

  const apply = (text: string) => { if (timer.current) clearTimeout(timer.current); timer.current = null; return onApply(text) };
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDraft(v);
    setEditing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(v), 700);
  };
  const onBlur = () => {
    // Lar teksten stå hvis den ikke kunne leses, så man kan rette feilen.
    if (editing && apply(draft) === false) return;
    setEditing(false);
    onDone();
  };
  const caret = () => {
    const el = ta.current;
    if (!el || editing) return;
    const n = el.value.slice(0, el.selectionStart).split('\n').length;
    const bid = lines[n - 1] && lines[n - 1].bid;
    if (bid && bid !== active) onLine(bid);
  };

  const shown = draft.split('\n');
  return (
    <div style={{ position: 'relative', minWidth: 'max-content', minHeight: '100%' }}>
      <div aria-hidden style={{ ...FONT, padding: '8px 0', pointerEvents: 'none' }}>
        {shown.map((l, i) => {
          const bid = !editing && lines[i] ? lines[i].bid : null;
          return (
            <div key={i} style={{ display: 'flex', padding: '0 16px', whiteSpace: 'pre', background: bid && bid === active ? HL : 'transparent' }}>
              <span style={{ width: 38, flex: 'none', color: '#b5b0a8', textAlign: 'right', paddingRight: 14 }}>{i + 1}</span>
              <span>{tok(l).map((p: any, k: number) => <span key={k} style={{ color: p.c }}>{p.t}</span>)}{'​'}</span>
            </div>
          );
        })}
      </div>
      <textarea
        ref={ta}
        value={draft}
        onChange={onChange}
        onBlur={onBlur}
        onClick={caret}
        onKeyUp={caret}
        onKeyDown={e => {
          if (e.key === 'Tab') { // innrykk i stedet for å forlate feltet
            e.preventDefault();
            const el = e.currentTarget, a = el.selectionStart, b = el.selectionEnd;
            const v = draft.slice(0, a) + '  ' + draft.slice(b);
            onChange({ target: { value: v } } as any);
            requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2 });
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') apply(draft);
        }}
        spellCheck={false}
        wrap="off"
        aria-label="LaTeX-kode for dokumentet"
        style={{
          ...FONT, position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, border: 'none', outline: 'none', resize: 'none',
          padding: `8px 16px 8px ${GUTTER}px`, background: 'transparent', color: 'transparent', caretColor: '#1f1e1c', overflow: 'hidden', whiteSpace: 'pre'
        }}
      />
    </div>
  );
}
