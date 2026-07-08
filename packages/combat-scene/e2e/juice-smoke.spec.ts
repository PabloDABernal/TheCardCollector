import { test } from '@playwright/test';

/**
 * H2.5 spec §7 — verificación manual complementaria (NO gate de CI, no forma parte de `npm test`).
 * Navega a `juice-smoke.html` (bootstrap standalone de `JuiceSmokeScene`), espera a que la
 * animación de `diceRoll` (rotación + `particleBurst`) se dispare sobre los placeholders de dado, y
 * captura un screenshot como evidencia visual — ejecutar a mano con
 * `npm run verify:visual --workspace=@collector/combat-scene` antes de pasar la historia a
 * Reviewer/QA.
 */
test('diceRoll se dispara visualmente sobre placeholders de dado (smoke visual, no automatizado en CI)', async ({
  page,
}) => {
  await page.goto('/e2e/juice-smoke.html');

  // Captura a mitad del tween de diceRoll (duration: 500ms, dice-roll.ts) — dados visiblemente
  // rotando/escalando, todavía sobre el tablero (no destruidos).
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'e2e/screenshots/juice-smoke-dice-roll-mid-tween.png' });

  // Captura justo al completar el tween — momento del particleBurst embebido (spec §3.1 punto 3).
  // NOTA (verificación manual, no bloqueante): con los parámetros literales de la spec (textura
  // base `__WHITE` 1×1px, `scale: { start: 0.4, end: 0 }`) el burst es visualmente casi
  // imperceptible a resolución de pantalla completa — confirmado con `emitter.getAliveParticleCount()`
  // que las partículas SÍ se crean y viven su `lifespan`, solo que su tamaño renderizado es
  // sub-píxel. Documentado como desviación/limitación a confirmar con Architect, no como bug de la
  // receta (ver entrega).
  await page.waitForTimeout(280);
  await page.screenshot({ path: 'e2e/screenshots/juice-smoke-dice-roll-particle-burst.png' });
});
