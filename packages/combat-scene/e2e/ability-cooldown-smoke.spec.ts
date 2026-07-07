import { test, expect } from '@playwright/test';

/**
 * H2.10 spec §5.4 — verificación visual complementaria (NO gate de CI, no forma parte de `npm test`),
 * mismo criterio no-CI que `board-view-smoke.spec.ts` (H2.8). Reusa el mismo harness
 * `combat-scene-smoke.html` para confirmar que los iconos de CD de habilidad (Líder) se pintan al
 * arrancar el combate y cambian de color/longitud tras un `END_TURN` real.
 */
test('AbilityCooldownView pinta las barras de CD del Líder y cambian tras END_TURN', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  await page.waitForTimeout(100);
  await page.screenshot({ path: 'e2e/screenshots/ability-cooldown-smoke-initial.png' });

  // Dos END_TURN reales (Líder → Enemigo → Líder), mismo mecanismo que `board-view-smoke.spec.ts`:
  // el primero descuenta CD de Enemigo (COOLDOWNS_TICKED side=ENEMY al abrir su turno), el segundo
  // vuelve a abrir turno de Líder — GDD §2.2 "cooldown baja 1 por vuelta completa".
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    bridge.dispatch({ type: 'END_TURN' });
    bridge.dispatch({ type: 'END_TURN' });
  });

  await page.waitForTimeout(400); // margen para el tween de 250ms de la barra (spec §1.3)
  await page.screenshot({ path: 'e2e/screenshots/ability-cooldown-smoke-after-end-turn.png' });

  expect(pageErrors).toEqual([]);
});
