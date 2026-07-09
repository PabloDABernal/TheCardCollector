import { test, expect } from '@playwright/test';
import { buildCombatSetup } from '../src/combat/build-combat-setup';
import { DEFAULT_LEADER_OPTION } from '../src/combat/leader-options';

const HAND_ROW_X = 540; // `HAND_ROW_POSITION.x` (`board-layout.ts`)
const TILE_SEPARATION_PX = 140;
// `HAND_ROW_POSITION.y` real es 1600, pero tocar ese centro exacto es ambiguo para las cartas
// centrales: el tile de rol del Líder (`LEADER_POSITION = {x:540, y:1700}`, `ROLE_SIZE 200x200`,
// `role-view.ts`) empieza justo en y=1600 y se solapa en x con las cartas cercanas al centro
// (440..640) — un tap ahí puede resolver contra el rol del Líder en vez de la carta (confirmado
// empíricamente, `hitTestPointer` devuelve el sprite superior de ese solape). Las cartas ocupan
// y ∈ [1510, 1690] (`CARD_HEIGHT=180`); se toca `y=1550`, dentro del tile de carta y por encima del
// borde superior del rol del Líder.
const HAND_TAP_Y = 1550;

/** Misma fórmula que `card-hand-view.ts` (`tileX`, no exportada) — reproducida aquí a propósito, no
 *  importada, para no acoplar este E2E a detalles internos de `combat-scene` más allá de las
 *  constantes de layout ya públicas de `board-layout.ts`. */
function tileX(index: number, handSize: number): number {
  const startX = HAND_ROW_X - ((handSize - 1) * TILE_SEPARATION_PX) / 2;
  return startX + index * TILE_SEPARATION_PX;
}

/**
 * H2.9 spec §6.3 — primer test Playwright de `apps/shell` (verificación manual complementaria, NO
 * gate de CI, mismo criterio no-CI que `packages/combat-scene/e2e/*.spec.ts`). Navega a `/combat`
 * contra el dev server real de `apps/shell` (`npm run dev`, puerto 5173), confirma que
 * `<CombatScreen>` monta un `Phaser.Game` real DENTRO de `div#phaser-mount` (React aloja Phaser,
 * §3), y que un tap real sobre una carta real de la mano dispara `bridge.dispatch(...)` de punta a
 * punta — evidencia observable: el texto HUD de rol del Líder (pintado por `role-view.ts` dentro
 * del canvas) cambia de verdad, no solo la interacción visual del tap.
 *
 * REESCRITO (bug QA battle-loop-design, commit `3b796c1`) — H3.6 sustituyó el pool COMPLETO de 10
 * cartas del Líder (layout fijo por posición de catálogo) por una mano dinámica de 5-7 cartas
 * robadas de un mazo barajado (`snapshot.leaderHand`, `card-hand-view.ts`), así que ninguna
 * coordenada fija de tile es válida de antemano. En su lugar, este test replica en Node — ANTES de
 * navegar al navegador — el mismo `buildCombatSetup()` de producción que `CombatScreen` ejecuta
 * (mismo `SHELL_SEED` fijo en `build-combat-setup.ts`, mismo Líder por defecto sin
 * `location.state`, mismo `RandomSource` determinista) para leer la mano real (`leaderHand`) y
 * calcular en tiempo de ejecución qué tile de mano tocar — nunca una posición asumida. Ambos
 * procesos (esta réplica en Node y `CombatScreen` en el navegador) parten de la misma semilla y
 * reciben la misma secuencia de comandos, así que producen exactamente el mismo estado.
 *
 * Coordenadas de tiles: calculadas contra el mismo espacio virtual 1080×1920 que
 * `COMBAT_SCENE_VIEWPORT`/`board-layout.ts` ya fijan (`HAND_ROW_POSITION = {x:540,y:1600}`,
 * `TILE_SEPARATION_PX = 140`, `NUCLEO_POOL_ROW_Y = 1450`, `NUCLEO_POOL_X_ORIGIN = 200`), escaladas
 * contra el `boundingBox()` real del `<canvas>` bajo `Scale Manager` `FIT` — mismo mecanismo que
 * `combat-scene-smoke.spec.ts` (H2.6) ya usa.
 *
 * DESVIACIÓN documentada respecto al criterio literal de §6.3 punto 4 ("tap sobre el primer tile de
 * mano con `requiresNucleoInstance: true`"): el contenido 2×2×2 real (`leader-soldado-base`) fija
 * `LEADER_ENERGY_INITIAL_DEFAULT = 1` sin ningún mecanismo de regeneración de Energía dentro del
 * combate, y la mano inicial determinista (semilla fija) no contiene ninguna carta EQUIPO/EVENTO
 * `requiresNucleoInstance: false` asequible a 1 Energía (confirmado empíricamente contra la réplica
 * en Node de arriba) — por eso el test ejecuta primero el paso previo gratuito real ("Generar
 * energía (gratis)", botón real del HUD de `CombatHud.tsx`, sin coste de las 2 acciones del turno)
 * para desbloquear una carta jugable en 1 tap, en vez de asumir Energía suficiente de entrada. La
 * máquina de estados de 2 pasos (PLAY_CARD + Núcleo) ya está cubierta al 100% contra mocks
 * controlables en `gesture-command-translator.test.ts` (§6.1, 9 casos) — este E2E cubre en su lugar
 * el camino de 1 paso con contenido real 100% asequible tras el paso previo gratuito para la
 * verificación de aceptación literal del backlog ("Usuario puede clickear una carta en mano →
 * PLAY_CARD"), y añade un segundo tap real sobre una carta de ataque + un Núcleo real para
 * confirmar que el flujo de 2 pasos con gestos reales no lanza ningún error (rechazado por Energía
 * insuficiente, comportamiento de dominio esperado — §4.5 punto 4: "se completa la selección de 2
 * pasos independientemente de si dispatch tuvo éxito").
 */
test('CombatScreen monta Phaser real dentro de #phaser-mount y un tap real sobre una carta dispara PLAY_CARD (HUD cambia de verdad)', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  // Réplica en Node del mismo build determinista de producción (ver docstring de arriba) — nos da
  // la mano real robada y su orden, sin asumir ningún layout fijo de mano.
  const { bridge, boardContext } = await buildCombatSetup({ leaderId: DEFAULT_LEADER_OPTION.leaderId });
  const cardById = new Map(boardContext.leaderCardPool.map((card) => [card.cardId, card] as const));

  const findAffordablePlayCard = (hand: readonly string[], energy: number) =>
    hand
      .map((id) => cardById.get(id)!)
      .find(
        (card) =>
          (card.cardType === 'EQUIPO' || card.cardType === 'EVENTO') &&
          !card.requiresNucleoInstance &&
          card.energyCost <= energy,
      );

  let snapshot = bridge.getSnapshot();
  let playCard = findAffordablePlayCard(snapshot.leaderHand, snapshot.leaderEnergy);
  let usedFreeGenerate = false;
  if (!playCard) {
    // Ninguna carta jugable en 1 tap es asequible con la Energía inicial real (ver DESVIACIÓN
    // arriba) — el propio paso previo gratuito real del HUD desbloquea una.
    bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' });
    snapshot = bridge.getSnapshot();
    playCard = findAffordablePlayCard(snapshot.leaderHand, snapshot.leaderEnergy);
    usedFreeGenerate = true;
  }
  expect(playCard, 'contenido real 2×2×2: se esperaba al menos una carta EQUIPO/EVENTO jugable en 1 tap').toBeDefined();

  const playCardIndex = snapshot.leaderHand.indexOf(playCard!.cardId);
  const playCardVirtualX = tileX(playCardIndex, snapshot.leaderHand.length);

  // Tras jugar la carta anterior, calcula dónde queda una carta de ATAQUE (`requiresNucleoInstance:
  // true`) real en la mano resultante, para el segundo tap del flujo de 2 pasos más abajo.
  bridge.dispatch({ type: 'PLAY_CARD', cardId: playCard!.cardId, sourceId: `card-${playCard!.cardId}` });
  const handAfterPlay = bridge.getSnapshot().leaderHand;
  const attackCard = handAfterPlay.map((id) => cardById.get(id)!).find((card) => card.requiresNucleoInstance);
  const attackCardIndex = attackCard ? handAfterPlay.indexOf(attackCard.cardId) : -1;
  const attackCardVirtualX = attackCard ? tileX(attackCardIndex, handAfterPlay.length) : null;

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

  // FIX_combat_viewport_and_layout.md §3.1 punto 2 — la aserción de aspect ratio de arriba, por sí
  // sola, NO detecta el Bug 1 (un canvas a tamaño nativo 1080×1920 sin escalar también cumple esa
  // proporción). Confirmar que el canvas realmente encogió para caber en la ventana:
  const viewportSize = page.viewportSize();
  expect(viewportSize).not.toBeNull();
  if (viewportSize) {
    expect(box.width).toBeLessThanOrEqual(viewportSize.width);
    expect(box.height).toBeLessThanOrEqual(viewportSize.height);
  }

  // Ausencia de scroll de página (tolerancia de 1-2px por redondeo de subpíxel).
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 2);

  const scaleX = box.width / 1080;
  const scaleY = box.height / 1920;
  const toPagePoint = (virtualX: number, virtualY: number) => ({
    x: box.x + virtualX * scaleX,
    y: box.y + virtualY * scaleY,
  });

  await page.waitForTimeout(200); // margen para que CombatScene.create() pinte el estado inicial

  if (usedFreeGenerate) {
    // Real, mismo botón accionable del HUD que un jugador usaría (`CombatHud.tsx`, paso previo
    // gratuito) — desbloquea la carta jugable en 1 tap calculada arriba en la réplica en Node.
    await page.getByText('Generar energía (gratis)').click();
    await page.waitForTimeout(200);
  }

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

  // Tap real sobre la carta EQUIPO/EVENTO jugable en 1 tap, calculada arriba contra la mano real
  // determinista (ver docstring — H3.6 ya no tiene layout fijo de mano). `HAND_TAP_Y` (no
  // `HAND_ROW_Y`) evita el solape con el tile de rol del Líder (ver comentario de la constante).
  const playCardTile = toPagePoint(playCardVirtualX, HAND_TAP_Y);
  await page.mouse.click(playCardTile.x, playCardTile.y);

  await page.waitForTimeout(200); // margen para que el dispatch síncrono repinte el HUD

  const hudAfter = await page.screenshot({ clip: leaderHudClip });
  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-after.png' });

  // Evidencia de que `dispatch` funcionó de verdad de punta a punta (traductor → bridge → engine →
  // BoardView.render), no solo la interacción visual del tap: el HUD de rol del Líder cambió (al
  // menos la Energía baja por el coste de la carta jugada).
  expect(hudBefore.equals(hudAfter)).toBe(false);

  // Segundo tap real: carta de ATAQUE (`requiresNucleoInstance: true`) real de la mano resultante,
  // calculada arriba, seguida de un Núcleo real (primer die del pool, NUCLEO_POOL_X_ORIGIN=200,
  // NUCLEO_POOL_ROW_Y=1450) — ejercita el flujo completo de selección de 2 pasos con gestos reales.
  // Se espera rechazo por Energía insuficiente en el contenido real (comportamiento de dominio
  // esperado — ver desviación documentada arriba), confirmado por AUSENCIA de excepción/error de
  // consola, no por cambio de HUD.
  expect(attackCardVirtualX, 'se esperaba al menos una carta de ATAQUE en la mano tras jugar la primera').not.toBeNull();
  if (attackCardVirtualX !== null) {
    const attackCardTile = toPagePoint(attackCardVirtualX, HAND_TAP_Y);
    await page.mouse.click(attackCardTile.x, attackCardTile.y);
    const firstNucleoTile = toPagePoint(200, 1450);
    await page.mouse.click(firstNucleoTile.x, firstNucleoTile.y);
  }

  await page.waitForTimeout(200);

  expect(pageErrors).toEqual([]);
});

/**
 * FIX_combat_viewport_and_layout.md §3.1 punto 3 — cubre el caso "desktop ancho" citado en el
 * diagnóstico del bug original (reportado exactamente en ese contexto: viewport bien más ancho que
 * la proporción 9:16 del combate). Repite las aserciones de tamaño real/ausencia de scroll del test
 * de arriba, con un viewport fijado explícitamente ancho.
 */
test('CombatScreen encaja sin scroll de página en un viewport ancho de escritorio (1280x800)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/combat');

  const mountedCanvas = page.locator('#phaser-mount canvas');
  await expect(mountedCanvas).toBeVisible();

  const box = await mountedCanvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  expect(box.width / box.height).toBeCloseTo(1080 / 1920, 1);

  const viewportSize = page.viewportSize();
  expect(viewportSize).not.toBeNull();
  if (viewportSize) {
    expect(box.width).toBeLessThanOrEqual(viewportSize.width);
    expect(box.height).toBeLessThanOrEqual(viewportSize.height);
  }

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 2);
});
