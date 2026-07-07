import { test, expect } from '@playwright/test';

/**
 * H2.8 spec §5.2 — verificación visual complementaria (NO gate de CI, no forma parte de `npm test`),
 * mismo criterio no-CI que H2.5/H2.6/H2.7. Reusa el mismo harness `combat-scene-smoke.html`
 * (`CombatScene`/`buildDefaultCombatBridge` reales de producción, `window.__combatBridge` expuesto solo
 * en este harness de e2e) para verificar que `BoardView` (H2.8) pinta el pool de Núcleos real
 * (colores/valores reales del contenido 2×2×2) y el HUD de Líder/Enemigo/Escenario con datos reales,
 * antes/después de disparar `END_TURN`.
 */
test('BoardView pinta el pool de Núcleos real y el HUD de Líder/Enemigo/Escenario con datos reales', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  // Deja que `CombatScene.create()` complete la pintura inicial de `BoardView` (spec §4: `render()` se
  // llama una vez al construir la escena, síncrono, pero se da un margen mínimo de frame por seguridad).
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'e2e/screenshots/board-view-smoke-initial-pool.png' });

  // Dispara un par de vueltas de END_TURN reales — mismo mecanismo que `combat-scene-smoke.spec.ts`
  // (H2.6) usa para forzar actividad real del motor: la IA de Enemigo actúa en sus turnos automáticos,
  // cambiando vida/daño/Trama/fase real, que `BoardView.render(...)` debe reflejar vía
  // `subscribeHudEvents`.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    bridge.dispatch({ type: 'END_TURN' });
    bridge.dispatch({ type: 'END_TURN' });
  });

  await page.waitForTimeout(100);
  await page.screenshot({ path: 'e2e/screenshots/board-view-smoke-hud-after-end-turn.png' });

  expect(pageErrors).toEqual([]);
});
