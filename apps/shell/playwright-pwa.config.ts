import { defineConfig } from '@playwright/test';

/**
 * H2.15 spec §6.2 — verificación de instalabilidad PWA (NO gate de CI, mismo criterio no-CI que
 * `playwright.config.ts`/`verify:visual`). A diferencia de `playwright.config.ts` (H2.9, apunta a
 * `npm run dev`/5173), el service worker solo existe en el build de producción
 * (`devOptions.enabled: false` en `vite.config.ts`) — este config levanta `vite preview` sobre el
 * build real en el puerto 4173.
 */
export default defineConfig({
  testDir: './e2e-pwa',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
