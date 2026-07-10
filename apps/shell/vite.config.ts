import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

// Configurable vía VITE_BASE_PATH para despliegues bajo subpath (p. ej. GitHub Pages de proyecto:
// https://pablodabernal.github.io/TheCardCollector/). Por defecto '/' — sin cambios para dev local
// ni para un futuro despliegue en la raíz de un dominio propio.
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      // generateSW: Workbox genera el SW completo a partir de config declarativa (spec §1) — sin
      // service-worker.js propio que mantener a mano.
      strategies: 'generateSW',
      registerType: 'autoUpdate', // el SW nuevo reemplaza al anterior sin prompt de usuario (MVP: sin UI de "hay una versión nueva, recarga").
      manifest: {
        // Sustituye por completo a apps/shell/src/pwa/manifest.webmanifest (retirado — spec §2.3).
        name: 'The Collector',
        short_name: 'Collector',
        description: 'Juego de cartas PVE roguelite — cruza universos TCG en combates asimétricos.',
        display: 'standalone',
        orientation: 'portrait-primary', // móvil primero (decisions.md), PC sigue funcionando en navegador normal
        start_url: base,
        scope: base,
        theme_color: '#1a1a2e', // tono oscuro coherente con temática "coleccionista/cajas", placeholder ajustable sin bloquear la historia
        background_color: '#1a1a2e',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache del app shell: JS/CSS/HTML del build de Vite + iconos + los 9 JSON de catálogo ya
        // copiados a public/data (mismo criterio "cache-first para el catálogo hoy empaquetado" de
        // decisions.md/architecture_stack.md §4.1 — Workbox precachea todo lo que matchea el glob,
        // sirviéndolo cache-first por defecto una vez precacheado).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,json}'],
        // Runtime caching explícito para los datos de catálogo bajo /data/**: NetworkFirst, no
        // CacheFirst — aunque hoy el catálogo va empaquetado (precacheado igualmente por el glob
        // anterior), esta regla deja funcionando de fábrica la migración futura a catálogo remoto
        // (architecture_stack.md §4.1: "network-first/stale-while-revalidate para el catálogo si en
        // el futuro se sirve remoto") sin tener que tocar esta config de nuevo.
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'collector-catalog-data',
              networkTimeoutSeconds: 3,
            },
          },
        ],
        // App shell real (index.html), no offline.html: navigateFallback es lo que Workbox sirve para
        // CUALQUIER navegación sin match exacto en precache — con React Router (rutas cliente como
        // /run-start, /combat) el fallback correcto es el shell de la SPA, que monta React y resuelve la
        // ruta en el cliente. index.html ya está precacheado por globPatterns, así que esto sigue
        // funcionando offline (Workbox lo sirve desde caché sin red). offline.html queda retirado — spec
        // §4 de H2.15_pwa.md no contempló rutas de React Router al escribir este fallback; ver
        // decisions.md fix de "offline" en toda navegación directa a ruta de la app.
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [new RegExp(`^${base}data/`)], // no interceptar peticiones de datos como si fueran navegación
      },
      devOptions: {
        enabled: false, // SW no se activa en `npm run dev` — coherente con que la verificación usa build+preview, evita interferencias de caché durante desarrollo activo
      },
    }),
  ],
  server: { port: 5173 },
});
