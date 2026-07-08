import { test, expect } from '@playwright/test';

/**
 * H2.13 spec §4.6 — verificación manual complementaria (NO gate de CI, no forma parte de `npm test`),
 * mismo criterio no-CI que `combat-scene-smoke.spec.ts` (H2.6) y `juice-smoke.spec.ts` (H2.5). Web
 * Audio no es capturable por captura de pantalla — esta es la única vía fiable de confirmar que el
 * audio real (no solo el mock unitario) se agenda correctamente, capturando los mensajes de
 * `console.log` que `createWebAudioSoundManager({ debug: true })` emite (`CombatScene.create()` ya lo
 * construye así, ver `scenes/CombatScene.ts`).
 *
 * Reusa `combat-scene-smoke.html`/`combat-scene-smoke-main.ts` (misma `CombatScene` real de
 * producción, mismo `window.__combatBridge` expuesto solo en este harness de e2e).
 */
test('SoundManager con debug:true loguea unlock/cardFlip/hit/victoria-o-derrota en consola tras un gesto real + eventos de dominio reales', async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));

  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  // Primer tap/click real sobre el canvas — dispara `this.input.once('pointerdown', ...)` de
  // `CombatScene.create()`, que llama a `soundManager.unlock()` (spec §1.7).
  await canvas.click();

  await expect
    .poll(() => consoleMessages.some((m) => m === '[SoundManager] unlocked'))
    .toBe(true);

  // PLAY_CARD real contra el CombatBridge → CARD_PLAYED → step 'cardFlip' con soundId 'cardFlip'
  // (H2.13 spec §3). `card-soldado-base-04` (EQUIPO, coste 1 Energía, sin efecto de Ataque — no
  // requiere `nucleoInstanceId`) del contenido 2×2×2 real usado por este harness (`main.ts`).
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: unknown) => unknown } }).__combatBridge;
    bridge.dispatch({ type: 'PLAY_CARD', cardId: 'card-soldado-base-04', sourceId: 'e2e-audio-smoke' });
  });

  await expect
    .poll(() => consoleMessages.some((m) => m === '[SoundManager] playing cue: cardFlip'))
    .toBe(true);

  // Drena el pool de Núcleos / fuerza turnos de Enemigo disparando END_TURN reales — mismo mecanismo
  // que `combat-scene-smoke.spec.ts` (H2.6 §5.3) para forzar que la IA de Enemigo ataque, lo que
  // eventualmente emite LEADER_DAMAGED (step 'hitImpact' con soundId 'hit') y, si el combate llega a
  // su fin, COMBAT_ENDED (receta 'combatOutcomeSound' → 'victory'/'defeat').
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    for (let i = 0; i < 24; i += 1) {
      bridge.dispatch({ type: 'END_TURN' });
    }
  });

  await expect
    .poll(() =>
      consoleMessages.some(
        (m) =>
          m === '[SoundManager] playing cue: hit' ||
          m === '[SoundManager] playing cue: victory' ||
          m === '[SoundManager] playing cue: defeat',
      ),
    )
    .toBe(true);

  expect(pageErrors).toEqual([]);
});
