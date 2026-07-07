import { test, expect } from '@playwright/test';

/**
 * H2.9 spec §6.3 — primer test Playwright de `apps/shell` (verificación manual complementaria, NO
 * gate de CI, mismo criterio no-CI que `packages/combat-scene/e2e/*.spec.ts`). Navega a `/combat`
 * contra el dev server real de `apps/shell` (`npm run dev`, puerto 5173), confirma que
 * `<CombatScreen>` monta un `Phaser.Game` real DENTRO de `div#phaser-mount` (React aloja Phaser,
 * §3), y que un tap real sobre una carta real de la mano dispara `bridge.dispatch(...)` de punta a
 * punta — evidencia observable: el texto HUD de rol del Líder (pintado por `role-view.ts` dentro
 * del canvas) cambia de verdad, no solo la interacción visual del tap.
 *
 * Coordenadas de tiles: calculadas contra el mismo espacio virtual 1080×1920 que
 * `COMBAT_SCENE_VIEWPORT`/`board-layout.ts` ya fijan (`HAND_ROW_POSITION = {x:540,y:1600}`,
 * `TILE_SEPARATION_PX = 140`, `NUCLEO_POOL_ROW_Y = 1450`, `NUCLEO_POOL_X_ORIGIN = 200`), escaladas
 * contra el `boundingBox()` real del `<canvas>` bajo `Scale Manager` `FIT` — mismo mecanismo que
 * `combat-scene-smoke.spec.ts` (H2.6) ya usa.
 *
 * DESVIACIÓN documentada respecto al criterio literal de §6.3 punto 4 ("tap sobre el primer tile de
 * mano con `requiresNucleoInstance: true`"): el contenido 2×2×2 real (`leader-soldado-base`) fija
 * `LEADER_ENERGY_INITIAL_DEFAULT = 1` (`domain/combat/src/types/energy.ts`) sin ningún mecanismo de
 * regeneración de Energía dentro del combate — y las 3 únicas cartas EVENTO con `requiresNucleoInstance:
 * true` de `leader.cardPoolIds` (`Estocada`/`Golpe Certero`/`Arremetida`) cuestan 1/2/2 Energía. La
 * única con coste 1 (`Estocada`, índice 0 del pool) cae en `x = -90` en el espacio virtual —
 * fuera del área visible del `<canvas>` (0..1080) por el layout de 10 tiles de `card-hand-view.ts`
 * (H2.8, sin cambio en esta historia) — y las 2 restantes cuestan 2 Energía, inasequibles con
 * Energía inicial 1. Por tanto NINGÚN tile de mano visible con `requiresNucleoInstance: true` es
 * asequible en el estado inicial real — confirmado empíricamente (captura adjunta,
 * `initial-hand.png`: los tiles de ataque aparecen atenuados por `card-hand-view.ts` alpha
 * no-afford). La máquina de estados de 2 pasos (PLAY_CARD + Núcleo) ya está cubierta al 100% contra
 * mocks controlables en `gesture-command-translator.test.ts` (§6.1, 9 casos) — este E2E cubre en su
 * lugar el camino de 1 paso con contenido real 100% asequible (`Escudo de Guardia`,
 * `requiresNucleoInstance: false`, coste 1) para la verificación de aceptación literal del backlog
 * ("Usuario puede clickear una carta en mano → PLAY_CARD"), y añade un segundo tap real sobre una
 * carta de ataque + un Núcleo real para confirmar que el flujo de 2 pasos con gestos reales no lanza
 * ningún error (rechazado por Energía insuficiente, comportamiento de dominio esperado — §4.5 punto
 * 4: "se completa la selección de 2 pasos independientemente de si dispatch tuvo éxito").
 */
test('CombatScreen monta Phaser real dentro de #phaser-mount y un tap real sobre una carta dispara PLAY_CARD (HUD cambia de verdad)', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/combat');

  // React aloja Phaser: el canvas real vive DENTRO de div#phaser-mount, no en un contenedor
  // separado (spec §3.2).
  const mountedCanvas = page.locator('#phaser-mount canvas');
  await expect(mountedCanvas).toBeVisible();

  const box = await mountedCanvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  // Scale Manager FIT preserva el aspect ratio 1080/1920 del viewport virtual.
  expect(box.width / box.height).toBeCloseTo(1080 / 1920, 1);

  const scaleX = box.width / 1080;
  const scaleY = box.height / 1920;
  const toPagePoint = (virtualX: number, virtualY: number) => ({
    x: box.x + virtualX * scaleX,
    y: box.y + virtualY * scaleY,
  });

  await page.waitForTimeout(200); // margen para que CombatScene.create() pinte el estado inicial

  // Clip del texto HUD de rol del Líder (`role-view.ts`, LEADER_POSITION {x:540,y:1700} + offset
  // vertical 120 del texto) — región amplia para no depender de un layout de texto pixel-perfect.
  const leaderHudClip = {
    x: toPagePoint(340, 1795).x,
    y: toPagePoint(340, 1795).y,
    width: 400 * scaleX,
    height: 90 * scaleY,
  };
  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-before.png' });
  const hudBefore = await page.screenshot({ clip: leaderHudClip });

  // Tap real sobre "Escudo de Guardia" (`card-soldado-base-04`, EQUIPO, DEFENSA_X, coste 1,
  // `requiresNucleoInstance: false` — asequible con la Energía inicial real, único tile de mano
  // afordable+visible del contenido 2×2×2, índice 3 de `leaderCardPool` → HAND_ROW_POSITION.x=540,
  // startX = 540 - (10-1)*140/2 = -90, x(3) = -90 + 3*140 = 330).
  const equipoTile = toPagePoint(330, 1600);
  await page.mouse.click(equipoTile.x, equipoTile.y);

  await page.waitForTimeout(200); // margen para que el dispatch síncrono repinte el HUD

  const hudAfter = await page.screenshot({ clip: leaderHudClip });
  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-after.png' });

  // Evidencia de que `dispatch` funcionó de verdad de punta a punta (traductor → bridge → engine →
  // BoardView.render), no solo la interacción visual del tap: el HUD de rol del Líder cambió
  // (Energía 1→0, Escudo 0→2 tras `DEFENSA_X:2`).
  expect(hudBefore.equals(hudAfter)).toBe(false);

  // Segundo tap real: carta de ATAQUE (`Golpe Certero`, requiresNucleoInstance: true, índice 1,
  // x(1) = -90 + 140 = 50) seguida de un Núcleo real (primer die del pool, NUCLEO_POOL_X_ORIGIN=200,
  // NUCLEO_POOL_ROW_Y=1450) — ejercita el flujo completo de selección de 2 pasos con gestos reales.
  // Rechazado por Energía insuficiente (0 tras el primer tap, coste 2) — comportamiento de dominio
  // esperado (ver desviación documentada arriba), confirmado por AUSENCIA de excepción/error de
  // consola, no por cambio de HUD.
  const attackCardTile = toPagePoint(50, 1600);
  await page.mouse.click(attackCardTile.x, attackCardTile.y);
  const firstNucleoTile = toPagePoint(200, 1450);
  await page.mouse.click(firstNucleoTile.x, firstNucleoTile.y);

  await page.waitForTimeout(200);

  expect(pageErrors).toEqual([]);
});
