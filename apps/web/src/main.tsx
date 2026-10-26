import React from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { skeleton } from '@kobling/core';
import templateSrc from './template.html?raw';
import { setTemplate } from './dc-runtime';
import App from './App.js';
import { detectPlatform, windowControls } from './platform';
import { api, isDesktop } from './api';
import { Login, LoginMode } from './Login';
import { ServerSession } from './server-mode.js';

(window as any).katex = katex;
setTemplate(templateSrc, windowControls);

const params = new URLSearchParams(location.search);
const platform = detectPlatform();
const root = createRoot(document.getElementById('root')!);
const startView = params.get('view') || 'editor';

// Demo uten server: bare i utvikling eller med ?demo=1 (som prototypen).
const renderDemo = () => root.render(React.createElement(App as any, { platform, startView, simulateCollab: true }));
const renderLogin = (mode: LoginMode, error?: string) =>
  root.render(React.createElement(Login, { mode, error, platform, onDone: (user: any) => start(user) }));

async function start(user: any) {
  try {
    let docs = await api('GET', '/api/docs');
    if (!docs.length) {
      await api('POST', '/api/docs', { doc: { title: 'Rapportmal ELI1300', authors: user.name, group: '', folder: 'Privat', meta: 'Opprettet nå', blocks: skeleton('rapport') } });
      docs = await api('GET', '/api/docs');
    }
    const server = new ServerSession({ user, docs });
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
    if (isDesktop()) return renderLogin('server');
    if (import.meta.env.DEV) return renderDemo();
    return renderLogin('login', 'Fikk ikke kontakt med serveren. Prøv igjen om litt.');
  }
  try {
    if ((await api('GET', '/api/setup')).needed) return renderLogin('setup');
  } catch { /* eldre server */ }
  try {
    const { user } = await api('GET', '/api/me');
    return start(user);
  } catch {
    return renderLogin('login');
  }
}

boot();
