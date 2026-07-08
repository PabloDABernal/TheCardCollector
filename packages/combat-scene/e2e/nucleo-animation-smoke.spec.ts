import { test, expect } from '@playwright/test';

/**
 * H2.12 spec §5.5 — verificación visual complementaria (NO gate de CI, no forma parte de `npm test`),
 * mismo criterio no-CI que `board-view-smoke.spec.ts` (H2.8)/`combat-scene-smoke.spec.ts` (H2.6).
 * Reusa el mismo harness `combat-scene-smoke.html` (`CombatScene`/`CombatBridge` reales de
 * producción) para confirmar visualmente:
 *   1. La pintura inicial del pool de Núcleos, sin animación (screenshot de referencia).
 *   2. Un Núcleo gastado encogiéndose/desvaneciéndose EN SU POSICIÓN REAL de la fila del pool
 *      (`NUCLEO_POOL_ROW_Y`), no en el centro de pantalla del Escenario.
 *   3. El pool relanzado (`NUCLEO_POOL_ROLLED`) con los 6 dados nuevos rotando/escalando en su fila
 *      real, sin ningún dado fantasma superpuesto sobre el tile del Escenario (spec §0.2 — el bug que
 *      esta historia elimina al retirar `NUCLEO_POOL_ROLLED` de `JUICE_CONFIG`).
 */
test('un Núcleo gastado se desvanece en su posición real y el pool relanzado rueda sobre los sprites reales', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  // 1) Pintura inicial del pool, sin animación (H2.12 spec §1.2 punto 4, primer render).
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'e2e/screenshots/nucleo-animation-smoke-initial-pool.png' });

  // 2) Un par de END_TURN reales: la IA de Enemigo gasta Núcleos activando habilidades en sus turnos
  // automáticos (mismo mecanismo que `combat-scene-smoke.spec.ts`), sin necesariamente vaciar el pool
  // todavía — captura a mitad del fade+shrink de 300ms del Núcleo gastado.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    bridge.dispatch({ type: 'END_TURN' });
    bridge.dispatch({ type: 'END_TURN' });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'e2e/screenshots/nucleo-animation-smoke-nucleo-spent-mid-fade.png' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/screenshots/nucleo-animation-smoke-nucleo-spent-after-fade.png' });

  // 3) Drena el pool por completo (mismo mecanismo que `combat-scene-smoke.spec.ts`, 12 vueltas de
  // sobra contra el contenido real 2×2×2) para forzar `NUCLEO_POOL_ROLLED` — captura a mitad del
  // tween de "dado rodando" (duration: 500ms) sobre los sprites reales de la fila del pool.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    for (let i = 0; i < 12; i += 1) {
      bridge.dispatch({ type: 'END_TURN' });
    }
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/screenshots/nucleo-animation-smoke-pool-rolled-mid-tween.png' });

  expect(pageErrors).toEqual([]);
});
