import React from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import templateSrc from './template.html?raw';
import { setTemplate } from './dc-runtime';
import App from './App.js';
import { detectPlatform, windowControls } from './platform';

(window as any).katex = katex;
setTemplate(templateSrc, windowControls);

const params = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(
  React.createElement(App as any, {
    platform: detectPlatform(),
    startView: params.get('view') || 'editor',
    simulateCollab: params.get('demo') === '1'
  })
);
