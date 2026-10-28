import React from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './theme.css';
import { skeleton } from '@kobling/core';
import templateSrc from './template.html?raw';
import { setTemplate } from './dc-runtime';
import Desktop from './App.js';
import { withMobile } from './mobile/mobile.js';
import { detectPlatform, windowControls } from './platform';
import { api, isDesktop, isNativeApp } from './api';
import { Login, LoginMode } from './Login';
import { ServerSession, readCache } from './server-mode.js';

(window as any).katex = katex;
const App = withMobile(Desktop);
setTemplate(templateSrc, windowControls);

const params = new URLSearchParams(location.search);
const platform = detectPlatform();
const root = createRoot(document.getElementById('root')!);
const startView = params.get('view') || 'editor';

// Demo uten server: bare i utvikling eller med ?demo=1 (som prototypen).
const renderDemo = () => root.render(React.createElement(App as any, { platform, startView, simulateCollab: true }));
const renderLogin = (mode: LoginMode, error?: string) =>
  root.render(React.createElement(Login, { mode, error, platform, onDone: async (user: any) => start(user, (await api('GET', '/api/me').catch(() => ({}))).access) }));

async function start(user: any, access?: any, offlineDocs?: any[]) {
  try {
    let docs: any[] = offlineDocs || await api('GET', '/api/docs');
    if (!docs.length) {
      await api('POST', '/api/docs', { doc: { title: 'Rapportmal ELI1300', authors: user.name, group: '', folder: 'Privat', meta: 'Opprettet nå', blocks: skeleton('rapport') } });
      docs = await api('GET', '/api/docs');
    }
    const server = new ServerSession({ user, docs, access });
    root.render(React.createElement(App as any, { key: user.id, platform, startView, simulateCollab: false, server }));
  } catch (e: any) {
    renderLogin('login', e.message);
  }
}

async function boot() {
  if (params.get('demo') === '1') return renderDemo();
  try {
    await api('GET', '/api/health', undefined, { timeout: 3000 });
  } catch {
    // Uten nett: åpne med det som er lagret lokalt fra sist (dokumentene ligger i IndexedDB)
    const c = readCache();
    if (c && c.user && c.docs && c.docs.length) return start(c.user, c.access, c.docs);
    if (isDesktop()) return renderLogin('server');
    if (import.meta.env.DEV) return renderDemo();
    return renderLogin('login', 'Fikk ikke kontakt med serveren. Prøv igjen om litt.');
  }
  try {
    if ((await api('GET', '/api/setup')).needed) return renderLogin('setup');
  } catch { /* eldre server */ }
  try {
    const { user, access } = await api('GET', '/api/me');
    return start(user, access);
  } catch {
    return renderLogin('login');
  }
}

// Uten nett: appen lastes fra service worker-bufferen (bare på nettet; desktop og mobil har filene lokalt)
if (!isDesktop() && !isNativeApp() && !import.meta.env.DEV && 'serviceWorker' in navigator && location.protocol.startsWith('http'))
  navigator.serviceWorker.register('/sw.js').catch(() => {});

boot();
