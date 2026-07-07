import { defineConfig } from '@playwright/test';

/**
 * H2.5 spec §7 — configuración de Playwright para la verificación manual complementaria
 * (`npm run verify:visual`), fuera de `npm test`/CI por defecto. Levanta `npm run dev` de
 * `combat-scene` (Vite, puerto 5174 — `vite.config.ts`) y navega a `e2e/juice-smoke.html`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
    // Viewport 1080×1920 — mismo tamaño que `Phaser.Game` (`e2e/juice-smoke-main.ts`), para que el
    // placeholder de dado (posicionado en el centro del layout virtual, `placeholder.ts` §2) quede
    // dentro del área visible del screenshot.
    viewport: { width: 1080, height: 1920 },
    // NOTA de entorno (no forma parte de la spec): este sandbox de desarrollo bloquea la descarga
    // de nuevos binarios de Chromium desde cdn.playwright.dev (política de red del entorno) — se
    // apunta al Chromium ya preinstalado en la imagen en vez de forzar `playwright install`. En un
    // entorno sin esa restricción, esta línea es innecesaria (usar el Chromium gestionado por
    // Playwright por defecto).
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
