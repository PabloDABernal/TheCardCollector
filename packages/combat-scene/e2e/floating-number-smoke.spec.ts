import { test, expect } from '@playwright/test';

/**
 * H2.11 spec §5.4 — verificación visual complementaria (NO gate de CI, no forma parte de `npm test`),
 * mismo criterio no-CI que el resto de specs de juice (H2.5/H2.6/H2.8/H2.10). Reusa el mismo harness
 * `combat-scene-smoke.html` (`CombatScene`/`window.__combatBridge` reales, contenido real 2×2×2) para
 * verificar: (1) el floating number `-N` aparece sobre el objetivo tras un golpe real y sube/se
 * desvanece en frames sucesivos; (2) el tile del Escenario cambia a color de alerta al cruzar
 * `scenarioPlotDefeatThreshold`.
 */
test('floatingNumber aparece tras un golpe real y sube/se desvanece en frames sucesivos', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  // Un turno de Enemigo real (IA activa) casi siempre resuelve una habilidad ATTACK/PLOT contra
  // Líder/Escenario — dispara LEADER_DAMAGED o SCENARIO_PLOT_CHANGED reales, con floatingNumber
  // como primer step (parallel) de JUICE_CONFIG.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    bridge.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY (la IA de Enemigo actúa aquí)
  });

  // 3 capturas sucesivas mientras el tween de subida/fade corre en background (900ms totales) —
  // evidencia de "sube" (y decreciente) + "se desvanece" (alpha decreciente).
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'e2e/screenshots/floating-number-smoke-frame-1.png' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/screenshots/floating-number-smoke-frame-2.png' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/screenshots/floating-number-smoke-frame-3.png' });

  expect(pageErrors).toEqual([]);
});

test('el tile del Escenario se resalta en rojo al cruzar scenarioPlotDefeatThreshold', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  await page.screenshot({ path: 'e2e/screenshots/floating-number-smoke-scenario-before.png' });

  // Contenido real 2×2×2 (`scenario-bosque-encantado-base`, `scenarioPlotDefeatThreshold: 10`, ver
  // `plotThresholds` del JSON): dispara END_TURN reales hasta que la IA de Enemigo (opt-in) acumule
  // Trama suficiente vía sus habilidades PLOT, o el combate termine (COMBAT_ENDED) por cualquier vía.
  // 80 vueltas son de sobra para ese contenido — no gate de CI, no bloqueante si el combate termina
  // antes por otra condición (derrota del Líder), documentado como desviación si ocurre.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    for (let i = 0; i < 80; i += 1) {
      bridge.dispatch({ type: 'END_TURN' });
    }
  });

  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/screenshots/floating-number-smoke-scenario-after.png' });

  expect(pageErrors).toEqual([]);
});
