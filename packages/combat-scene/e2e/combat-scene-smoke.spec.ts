import { test, expect } from '@playwright/test';

/**
 * H2.6 spec §5.3 — verificación manual complementaria (NO gate de CI, no forma parte de `npm test`),
 * mismo criterio no-CI que H2.5 §7 (`juice-smoke.spec.ts`). Navega a `combat-scene-smoke.html`
 * (bootstrap standalone que reusa `CombatScene`/`buildDefaultCombatBridge` reales de producción, ver
 * `combat-scene-smoke-main.ts`), confirma que el `<canvas>` de Phaser existe con el `Scale Manager` en
 * modo `FIT` (viewport virtual 1080×1920), que no hay errores de consola/excepciones no capturadas
 * durante el arranque, y que al menos una receta de juice se dispara visualmente.
 *
 * DESVIACIÓN respecto a la spec §5.3 (documentada, no bloqueante): la spec asumía que "`NUCLEO_POOL_ROLLED`
 * ya ocurre al construir el `CombatEngine` inicial [...] así que el `EffectsDirector` ya dispara `diceRoll`
 * una vez al arrancar, sin necesitar disparar nada a mano". Verificado contra el `CombatEngine` real
 * (`packages/domain/combat/src/combat-engine.ts`, constructor): la tirada inicial del pool
 * (`this.nucleoPool = this.rollNewPool()`) ocurre ANTES de que `createCombatBridge` se suscriba al motor
 * (`engine.subscribe(...)`), y el propio motor documenta explícitamente que esa tirada inicial "no emite
 * evento (constructor, sin subscriptores todavía)". Por tanto `diceRoll` NUNCA se dispara solo con arrancar
 * la escena contra el motor real — confirmado empíricamente (screenshot en blanco sin ningún placeholder de
 * dado). Se usa entonces la alternativa que la propia spec preveía como opción B: exponer temporalmente
 * `window.__combatBridge` (solo en este harness de e2e, nunca en `src/main.ts` de producción) y disparar
 * comandos `END_TURN` reales contra el `CombatBridge` — la IA de Enemigo (opt-in, poblada por
 * `buildCombatEngineConfig` contra el contenido real) consume Núcleos en cada uno de sus turnos
 * automáticos, lo que eventualmente vacía el pool y dispara un reroll real (`NUCLEO_POOL_ROLLED`), que sí
 * tiene un subscriptor (`EffectsDirector.attach`, H2.6 `CombatScene.create()`) y dispara `diceRoll`.
 */
test('CombatScene arranca con canvas real, sin errores, y diceRoll se dispara al agotarse el pool de Núcleos', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/e2e/combat-scene-smoke.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Scale Manager en modo FIT: el canvas se ajusta al contenedor manteniendo el aspect ratio del
  // viewport virtual 1080×1920 (COMBAT_SCENE_VIEWPORT) — no necesariamente esos px exactos en pantalla,
  // pero sí el mismo aspect ratio (1080/1920).
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width / box.height).toBeCloseTo(1080 / 1920, 1);
  }

  await page.waitForFunction(() => Boolean((window as unknown as { __combatBridge?: unknown }).__combatBridge));

  // Drena el pool de Núcleos disparando END_TURN reales — ver nota de desviación arriba. 12 vueltas
  // (LEADER→ENEMY→LEADER cada una, con turno automático de IA de Enemigo incluido) son de sobra para
  // agotar el pool inicial (6 Núcleos) contra el contenido real 2×2×2.
  await page.evaluate(() => {
    const bridge = (window as unknown as { __combatBridge: { dispatch: (c: { type: string }) => unknown } })
      .__combatBridge;
    for (let i = 0; i < 12; i += 1) {
      bridge.dispatch({ type: 'END_TURN' });
    }
  });

  // Captura a mitad del tween de diceRoll (duration: 500ms, dice-roll.ts), disparado por el reroll real
  // del pool de Núcleos provocado arriba.
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/screenshots/combat-scene-smoke-dice-roll-mid-tween.png' });

  expect(pageErrors).toEqual([]);
});
