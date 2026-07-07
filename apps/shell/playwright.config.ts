import { defineConfig } from '@playwright/test';

/**
 * H2.9 spec §6.3 — verificación manual complementaria (NO gate de CI, no forma parte de
 * `npm test`), mismo criterio no-CI que `packages/combat-scene/playwright.config.ts`
 * (H2.5/H2.6/H2.7/H2.8). Levanta `npm run dev` de `apps/shell` (Vite, puerto 5173,
 * `vite.config.ts`) y navega a `/combat` — primer test Playwright de `apps/shell`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    // Viewport 1080×1920 — mismo tamaño que `COMBAT_SCENE_VIEWPORT` (`combat-scene`), para que las
    // coordenadas de tiles de mano/Núcleo (calculadas en el mismo espacio virtual) queden dentro del
    // área visible del screenshot.
    viewport: { width: 1080, height: 1920 },
    // NOTA de entorno (no forma parte de la spec, mismo criterio que
    // `packages/combat-scene/playwright.config.ts`): este sandbox de desarrollo bloquea la descarga
    // de nuevos binarios de Chromium desde cdn.playwright.dev — se apunta al Chromium ya
    // preinstalado en la imagen en vez de forzar `playwright install`. Configurable vía
    // `PW_CHROMIUM_PATH` para no romper en máquinas de desarrollo sin esa ruta exacta.
    launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
