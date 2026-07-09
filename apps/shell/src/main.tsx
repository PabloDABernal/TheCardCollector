import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
// H4 spec §1.3 — 3 tipografías self-hosted vía `@fontsource` (npm), NO `<link>` a Google Fonts CDN:
// `apps/shell` ya usa `vite-plugin-pwa`/Workbox para instalación offline, y un `<link>` externo
// rompería ese caso (ya validado, decisions.md 2026-07-06 H2.15). Vite empaqueta estos imports como
// assets estáticos que Workbox cachea igual que el resto del bundle — cero llamada de red nueva en
// runtime, funciona offline desde el primer arranque exactamente igual que hoy.
import '@fontsource/staatliches/400.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './index.css';
import { App } from './App';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
