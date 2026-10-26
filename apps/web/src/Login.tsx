// Innlogging, førstegangsoppsett (første bruker blir administrator) og valg av server i desktop-appen.
import React from 'react';
import { api, isDesktop, serverBase, setServerBase, setToken } from './api';

export type LoginMode = 'login' | 'setup' | 'server';
type Props = { mode: LoginMode; error?: string; onDone: (user: any) => void; platform: 'mac' | 'win' | 'web' };

const ACC = 'oklch(0.52 0.15 250)';
const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #e2dfd9', borderRadius: 8, outline: 'none', fontFamily: 'inherit', fontSize: 14, color: '#1f1e1c', background: '#fff' };
const label: React.CSSProperties = { fontSize: 13, color: '#6b6862' };

export function Login({ mode: start, error: startErr, onDone, platform }: Props) {
  const [mode, setMode] = React.useState<LoginMode>(start);
  const [server, setServer] = React.useState(serverBase());
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [err, setErr] = React.useState(startErr || '');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'server') {
        if (!/^https?:\/\/[^\s/]+/.test(server.trim())) throw new Error('Skriv hele adressen, for eksempel https://mitt-navn.duckdns.org.');
        setServerBase(server);
        await api('GET', '/api/health', undefined, { timeout: 4000 });
        const { needed } = await api('GET', '/api/setup');
        setMode(needed ? 'setup' : 'login');
        return;
      }
      const r = mode === 'setup'
        ? await api('POST', '/api/setup', { name: name.trim(), email: email.trim(), password })
        : await api('POST', '/api/login', { email: email.trim(), password });
      setToken(r.token);
      onDone(r.user);
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'setup' ? 'Opprett administrator' : mode === 'server' ? 'Koble til server' : 'Logg inn';
  const sub = mode === 'setup'
    ? 'Serveren er ny. Den første kontoen blir administrator og kan invitere de andre.'
    : mode === 'server' ? 'Skriv adressen til Kobling-serveren din.' : 'Logg inn for å åpne dokumentene dine.';
  const btn = busy ? 'Vent …' : mode === 'setup' ? 'Opprett og logg inn' : mode === 'server' ? 'Koble til' : 'Logg inn';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fbfaf8', fontFamily: "'Instrument Sans',sans-serif", color: '#1f1e1c' }}>
      <div data-tauri-drag-region="true" style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', background: '#f3f1ed', borderBottom: '1px solid #e2dfd9' }}>
        {platform === 'mac' ? <div style={{ width: 60 }} /> : <div style={{ width: 18, height: 18, borderRadius: 4, background: ACC, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>K</div>}
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.01em' }}>Kobling</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <form onSubmit={submit} style={{ width: 380, background: '#fff', border: '1px solid #e2dfd9', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.08)', padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em' }}>{title}</div>
            <div style={{ fontSize: 13.5, color: '#6b6862', marginTop: 6, lineHeight: 1.5 }}>{sub}</div>
          </div>
          {mode === 'server' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Serveradresse</span>
              <input style={input} value={server} onChange={e => setServer(e.target.value)} placeholder="https://mitt-navn.duckdns.org" autoFocus /></label>
          )}
          {mode === 'setup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Navn</span>
              <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Fornavn Etternavn" autoFocus /></label>
          )}
          {mode !== 'server' && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>E-post</span>
                <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="navn@student.no" autoFocus={mode === 'login'} autoComplete="username" /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Passord</span>
                <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} placeholder={mode === 'setup' ? 'Minst 8 tegn' : ''} /></label>
            </>
          )}
          {err && <div role="alert" style={{ fontSize: 13, color: '#b3261e', lineHeight: 1.45 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ marginTop: 4, padding: '10px 14px', borderRadius: 8, border: 'none', background: ACC, color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>{btn}</button>
          {mode === 'login' && <div style={{ fontSize: 12.5, color: '#8d8982', lineHeight: 1.5 }}>Fikk du en invitasjon? Åpne lenken i e-posten, så kommer du rett inn i dokumentet.</div>}
          {isDesktop() && mode !== 'server' && (
            <div onClick={() => { setErr(''); setMode('server') }} style={{ fontSize: 12.5, color: 'oklch(0.45 0.15 250)', cursor: 'pointer' }}>Bytt server ({serverBase().replace(/^https?:\/\//, '')})</div>
          )}
        </form>
      </div>
    </div>
  );
}
