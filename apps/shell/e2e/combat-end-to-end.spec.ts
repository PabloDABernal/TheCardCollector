import { test, expect } from '@playwright/test';
import { buildCombatSetup } from '../src/combat/build-combat-setup';
import { DEFAULT_LEADER_OPTION } from '../src/combat/leader-options';

// FIX URGENTE P0 (docs/specs/H4_fix_urgente_lider_fuera_viewport.md) — literal duplicado a propósito
// (NO importado de `@collector/combat-scene`): ese paquete reexporta `CombatScene.ts`, que importa
// `phaser` en runtime — `phaser` asume un entorno de navegador real (`window`/`document`) y crashea
// al cargarse en el proceso Node del test-runner de Playwright (a diferencia del código que corre
// DENTRO de `page.evaluate`/el navegador real). `COMBAT_SCENE_VIEWPORT.height` subió de 1920 a 2060
// — mantener este literal en sync si ese valor vuelve a cambiar (mismo criterio que
// `HAND_ROW_X`/`TILE_SEPARATION_PX` de abajo, ya duplicados por el mismo motivo).
const COMBAT_SCENE_VIEWPORT = { width: 1080, height: 2060 } as const;

const HAND_ROW_X = 540; // `HAND_ROW_POSITION.x` (`board-layout.ts`)
const TILE_SEPARATION_PX = 140;
// ACTUALIZADO H5.1 (`docs/specs/H5.1_mesa_dados_centro.md`) — la mesa de Núcleos pasa a ser la
// ÚNICA ancla de derivación (`NUCLEO_TABLE_CENTER_Y`, centro exacto del viewport) y todo lo demás se
// recalcula en cadena desde ahí (`board-layout.ts`). `HAND_ROW_POSITION.y` real HOY es 1730 (antes
// 1600, luego 1724 — el fix de deuda técnica de `CONTENT_GAP_PX` en `board-layout.ts` desplazó +6px
// toda la zona inferior) — las cartas ocupan y ∈ [1640, 1820] (`CARD_TILE_HALF_PX=90`), y el tile del
// Líder (`LEADER_POSITION.y=1896`, `COMPACT_ROLE_TILE_HALF_PX=70`) ya no arranca hasta y=1826: con
// este layout el centro exacto de la fila (1730) cae de sobra dentro del tile de carta sin solapar
// el Líder (a diferencia del layout H4 anterior, donde había que evitar el centro exacto).
const HAND_TAP_Y = 1730;

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
 * Coordenadas de tiles: calculadas contra el mismo espacio virtual 1080×2060 que
 * `COMBAT_SCENE_VIEWPORT`/`board-layout.ts` ya fijan (`HAND_ROW_POSITION = {x:540,y:1730}`,
 * `TILE_SEPARATION_PX = 140`, `NUCLEO_TABLE_ROW_Y = 1030`, `NUCLEO_TABLE_X_ORIGIN = 200` — los 3
 * primeros ACTUALIZADOS por H5.1 (mesa de Núcleos al centro exacto del viewport) y por el fix de
 * deuda técnica de `CONTENT_GAP_PX`), escaladas contra el `boundingBox()` real del `<canvas>` bajo
 * `Scale Manager` `FIT` — mismo mecanismo que
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
  // H5.5 — el flujo de revelación progresiva añade 2 gestos explícitos más (seleccionar "Jugar
  // Carta" antes de cada tap sobre una carta) frente al timeout por defecto de 30s
  // (`playwright.config.ts`), ya ajustado para el resto del test — margen explícito para no correr
  // pegado al límite con las esperas reales añadidas.
  test.setTimeout(60_000);

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

  // Mismo "HALLAZGO independiente" documentado más abajo en este archivo (test "el Líder... es
  // visible y clickeable de verdad") — `Phaser.Scale.FIT` calcula el tamaño/posición inicial del
  // `<canvas>` contra `window` en el instante de construcción, ANTES de que el layout `flex` de
  // `CombatScreen.css` (header/footer reales) reduzca `#phaser-mount` a su tamaño final. Sin un
  // evento `resize` real posterior, `boundingBox()` del canvas queda desalineado con su contenedor —
  // NECESARIO estabilizarlo aquí (mismo mecanismo que el otro test) porque, tras H5.1, el HUD de rol
  // del Líder (`leaderHudClip` más abajo) cae en la franja inferior del canvas que ese desalineamiento
  // deja fuera del área realmente pintada.
  await page.setViewportSize({ width: COMBAT_SCENE_VIEWPORT.width + 1, height: COMBAT_SCENE_VIEWPORT.height });
  await page.setViewportSize({ width: COMBAT_SCENE_VIEWPORT.width, height: COMBAT_SCENE_VIEWPORT.height });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const mount = document.querySelector('#phaser-mount');
          const canvas = mount?.querySelector('canvas');
          if (!mount || !canvas) return false;
          const mountRect = mount.getBoundingClientRect();
          const canvasRect = canvas.getBoundingClientRect();
          return canvasRect.top >= mountRect.top - 1 && canvasRect.bottom <= mountRect.bottom + 1;
        }),
      { timeout: 15_000, message: 'el <canvas> de Phaser nunca terminó de alinearse con su contenedor #phaser-mount' },
    )
    .toBe(true);

  const box = await mountedCanvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  // Scale Manager FIT preserva el aspect ratio de COMBAT_SCENE_VIEWPORT.
  expect(box.width / box.height).toBeCloseTo(COMBAT_SCENE_VIEWPORT.width / COMBAT_SCENE_VIEWPORT.height, 1);

  // FIX_combat_viewport_and_layout.md §3.1 punto 2 — la aserción de aspect ratio de arriba, por sí
  // sola, NO detecta el Bug 1 (un canvas a tamaño nativo COMBAT_SCENE_VIEWPORT sin escalar también
  // cumple esa proporción). Confirmar que el canvas realmente encogió para caber en la ventana:
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

  // FIX flakiness (H5.5) — `CombatHud.tsx` cambia de altura real entre fase CATEGORY (4 botones) y
  // fase DETAIL ("Elige una carta", 1 fila) — `.combat-screen-canvas-area` es `flex: 1`
  // (`CombatScreen.css`), así que ese cambio de altura del header REDIMENSIONA el `<canvas>` de
  // Phaser (y con él, el `transform` de `CombatBoardOverlay`) cada vez que se entra/sale de DETAIL.
  // Un `toPagePoint`/`scale` calculado UNA sola vez al arranque (como hacía este test antes) queda
  // STALE tras cualquier transición de fase — `freshCanvasGeometry`/`captureLeaderHudClip` recalculan
  // la geometría real del canvas en el momento exacto de cada click/screenshot, en vez de asumir que
  // no cambió desde el arranque.
  async function freshCanvasGeometry(): Promise<{
    toPagePoint: (vx: number, vy: number) => { x: number; y: number };
    scaleX: number;
    scaleY: number;
  }> {
    const freshBox = await mountedCanvas.boundingBox();
    if (!freshBox) throw new Error('canvas sin bounding box real en el momento de medir');
    const fx = freshBox.width / COMBAT_SCENE_VIEWPORT.width;
    const fy = freshBox.height / COMBAT_SCENE_VIEWPORT.height;
    return {
      toPagePoint: (virtualX: number, virtualY: number) => ({
        x: freshBox.x + virtualX * fx,
        y: freshBox.y + virtualY * fy,
      }),
      scaleX: fx,
      scaleY: fy,
    };
  }

  // FIX flakiness adicional (H5.5) — un screenshot-diff pixel a pixel de una región del canvas sigue
  // siendo frágil incluso con geometría fresca: el propio reflow de `CombatHud.tsx` (CATEGORY↔DETAIL)
  // puede dejar el `<canvas>` en un estado transitorio (`Phaser.Scale.FIT` recalcula contra `window`,
  // ver el "HALLAZGO independiente" documentado más abajo en este archivo) en el instante exacto de
  // la captura, sin relación con si `PLAY_CARD` se disparó o no — confirmado empíricamente: capturas
  // completas de página (`e2e/screenshots/*.png`, generadas por este mismo test) mostrando el canvas
  // genuinamente desalineado/recortado en `hudBefore`, pese a que `actionsTaken`/Energía SÍ habían
  // cambiado de verdad en el DOM en ese momento. En vez de perseguir esa inestabilidad de `Phaser.Scale`
  // (fuera de alcance de este fix, ya documentada como limitación conocida), se lee el TEXTO real de
  // la fila de estado del Líder (`CharacterPanel` → `RoleBlock`, HTML puro fuera del `<canvas>`,
  // NUNCA afectado por su redimensionado) — evidencia igual de "de punta a punta" que un pixel-diff,
  // pero sin depender de la geometría del canvas en absoluto.
  async function readLeaderHudText(): Promise<string> {
    const nivelChip = page.getByText('Nivel', { exact: false });
    const statsRow = nivelChip.locator('xpath=..');
    return (await statsRow.innerText()).trim();
  }

  await page.waitForTimeout(200); // margen para que CombatScene.create() pinte el estado inicial

  // FIX test preexistente (regresión detectada al verificar el fix urgente P0 de
  // `docs/specs/H4_fix_urgente_lider_fuera_viewport.md`) — `TurnStartModal` (H4 spec, `role="dialog"`)
  // es obligatorio al empezar el turno del Líder desde una ronda anterior a este test, e intercepta
  // cualquier clic real sobre el tablero hasta que se descarta. Mismo botón real ("Ahora no") que un
  // jugador usaría, mismo patrón ya usado más abajo en este archivo.
  const dismissTurnStartModal = page.getByText('Ahora no', { exact: true });
  if (await dismissTurnStartModal.isVisible().catch(() => false)) {
    await dismissTurnStartModal.click();
    await page.waitForTimeout(100);
  }

  if (usedFreeGenerate) {
    // Real, mismo botón accionable del HUD que un jugador usaría (`CombatHud.tsx`, paso previo
    // gratuito) — desbloquea la carta jugable en 1 tap calculada arriba en la réplica en Node.
    await page.getByText('Generar energía (gratis)').click();
    await page.waitForTimeout(200);
  }

  // ACTUALIZADO H4.x/H5.1 — el `Text` de estado del Líder (Daño/Escudo/Energía/Nivel) ya NO vive en
  // el canvas de Phaser (`role-view.ts` lo retiró, ver su docstring): vive en el panel HTML real
  // `CharacterPanel` (`CombatBoardOverlay.tsx`), 3ª línea del bloque (bajo la etiqueta "Líder" y el
  // nombre) — el nombre NO cambia al jugar una carta, así que `readLeaderHudText()` (arriba) lee
  // específicamente la fila de chips ♥/🛡/⚡/✦ por texto, no por posición de pixel.
  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-before.png' });
  const hudBefore = await readLeaderHudText();

  // H5.5 spec §3/§4 — `HandCardRow` ya no está montado hasta pasar por
  // `turnDecisionFlow.selectCategory('PLAY_CARD')`: la revelación progresiva exige elegir la
  // categoría "Jugar Carta" como gesto EXPLÍCITO del HUD (botón real, mismo patrón que "Generar
  // energía (gratis)" arriba) antes de que la fila de cartas de mano se vuelva visible/tocable.
  await page.getByText('Jugar Carta', { exact: true }).click();
  await page.waitForTimeout(150); // margen para que el cambio de fase (CATEGORY→DETAIL) reflowee el header/canvas

  // Tap real sobre la carta EQUIPO/EVENTO jugable en 1 tap, calculada arriba contra la mano real
  // determinista (ver docstring — H3.6 ya no tiene layout fijo de mano). `HAND_TAP_Y` (no
  // `HAND_ROW_Y`) evita el solape con el tile de rol del Líder (ver comentario de la constante).
  // Geometría recalculada en el momento del tap (mismo motivo documentado junto a `freshCanvasGeometry`).
  const playCardTile = (await freshCanvasGeometry()).toPagePoint(playCardVirtualX, HAND_TAP_Y);
  await page.mouse.click(playCardTile.x, playCardTile.y);

  await page.waitForTimeout(300); // margen para el dispatch + el reflow de vuelta a fase CATEGORY

  const hudAfter = await readLeaderHudText();
  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-after.png' });

  // Evidencia de que `dispatch` funcionó de verdad de punta a punta (traductor → bridge → engine →
  // BoardView.render), no solo la interacción visual del tap: el HUD de rol del Líder cambió (al
  // menos la Energía baja por el coste de la carta jugada).
  expect(hudBefore).not.toBe(hudAfter);

  // Segundo tap real: carta de ATAQUE (`requiresNucleoInstance: true`) real de la mano resultante,
  // calculada arriba, seguida de un Núcleo real (primer die de la mesa, `NUCLEO_TABLE_X_ORIGIN=200`,
  // `NUCLEO_TABLE_ROW_Y=1030` — ACTUALIZADO por H5.1, antes 1450) — ejercita el flujo completo de
  // selección de 2 pasos con gestos reales.
  // Se espera rechazo por Energía insuficiente en el contenido real (comportamiento de dominio
  // esperado — ver desviación documentada arriba), confirmado por AUSENCIA de excepción/error de
  // consola, no por cambio de HUD.
  expect(attackCardVirtualX, 'se esperaba al menos una carta de ATAQUE en la mano tras jugar la primera').not.toBeNull();
  if (attackCardVirtualX !== null) {
    // H5.5 — el primer PLAY_CARD exitoso disparó `CARD_PLAYED`, que cierra el tramo de detalle
    // automáticamente y devuelve el HUD a fase CATEGORY (`turn-decision-flow.ts`); hay que volver a
    // seleccionar "Jugar Carta" para que `HandCardRow` se remonte antes de este segundo tap.
    await page.getByText('Jugar Carta', { exact: true }).click();
    await page.waitForTimeout(150);

    // Geometría recalculada en el momento de cada tap (mismo motivo que arriba).
    const attackCardTile = (await freshCanvasGeometry()).toPagePoint(attackCardVirtualX, HAND_TAP_Y);
    await page.mouse.click(attackCardTile.x, attackCardTile.y);
    const firstNucleoTile = (await freshCanvasGeometry()).toPagePoint(200, 1030);
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

  expect(box.width / box.height).toBeCloseTo(COMBAT_SCENE_VIEWPORT.width / COMBAT_SCENE_VIEWPORT.height, 1);

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

/**
 * FIX URGENTE P0 (docs/specs/H4_fix_urgente_lider_fuera_viewport.md §5) — regresión: el Líder (tile,
 * HP, sus 4 habilidades) se renderizaba SIEMPRE fuera del viewport (`LEADER_POSITION`/
 * `LEADER_ABILITIES_ROW_Y` cascadeaban por encima de `COMBAT_SCENE_VIEWPORT.height`), haciéndolo
 * intocable — bloqueaba todo combate. Ningún test anterior lo detectó porque solo comparaban
 * constantes de `board-layout.ts` entre sí (consistencia interna), nunca contra coordenadas DOM
 * reales medidas en pantalla, que es justo el método que QA usó para encontrar el bug. Reproduce ese
 * método: mide `boundingClientRect()` real del panel del Líder (`CharacterPanel`, H4.x,
 * `CombatBoardOverlay.tsx` — ya NO Phaser/`role-view.ts`) y confirma que cae DENTRO de
 * `[0, window.innerHeight]`, luego dispara un CLIC REAL (no `force`) sobre ese panel y sobre uno de
 * sus 4 iconos de habilidad, confirmando que el gesto se registra. Corre en AMBOS tamaños de ventana
 * que QA usó para detectar la regresión.
 */
for (const viewportSize of [
  { width: 1400, height: 900 },
  { width: 390, height: 844 },
] as const) {
  test(`el Líder (panel + habilidad) es visible y clickeable de verdad en viewport ${viewportSize.width}x${viewportSize.height}`, async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.setViewportSize(viewportSize);

    // Réplica en Node del mismo build determinista de producción (ver docstring del primer test de
    // este archivo) — nos da el `abilityId` real de la primera habilidad del Líder, sin asumir
    // ningún catálogo fijo.
    const { boardContext } = await buildCombatSetup({ leaderId: DEFAULT_LEADER_OPTION.leaderId });
    const firstLeaderAbilityId = boardContext.leaderAbilities[0]?.abilityId;
    expect(firstLeaderAbilityId, 'se esperaba al menos 1 habilidad de Líder en el contenido real').toBeDefined();

    await page.goto('/combat');

    const mountedCanvas = page.locator('#phaser-mount canvas');
    await expect(mountedCanvas).toBeVisible();
    await page.waitForTimeout(200); // margen para que CombatScene.create() pinte el estado inicial

    // `TurnStartModal` (H4 spec §1, `role="dialog"`) es obligatorio al empezar el turno del Líder —
    // intercepta CUALQUIER clic real sobre el tablero de abajo hasta que se descarta (spec §1.4: "que
    // no se te olvide" es deliberado). Se cierra con "Ahora no" (mismo botón real que un jugador
    // usaría) antes de interactuar con el panel del Líder — necesario para que el clic real de este
    // test no falle por un elemento distinto (y correcto) tapando el objetivo.
    const dismissTurnStartModal = page.getByText('Ahora no', { exact: true });
    if (await dismissTurnStartModal.isVisible().catch(() => false)) {
      await dismissTurnStartModal.click();
    }

    // HALLAZGO independiente de este fix (a escalar aparte, fuera del alcance P0 de
    // `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`/`COMBAT_SCENE_VIEWPORT.height`, confirmado
    // reproducible IGUAL en el código previo a este fix — 1920/N=5 — así que no es una regresión de
    // `H4_fix_urgente_lider_fuera_viewport.md`): `Phaser.Scale.FIT` calcula el tamaño/posición
    // inicial del `<canvas>` contra `window` en el instante en que `new Phaser.Game(...)` se
    // construye, ANTES de que el resto del layout de React (`CombatHud`, etc.) empuje
    // `#phaser-mount` a su posición/tamaño final. Sin un evento `resize` real posterior, el canvas
    // queda desalineado con su propio contenedor Y (bug relacionado en
    // `use-phaser-viewport-transform.ts`) la capa HTML superpuesta (`CombatBoardOverlay`, donde vive
    // el panel del Líder) queda con un `transform` CSS obsoleto de forma PERMANENTE, porque su
    // `ResizeObserver` solo observa el contenedor `#phaser-mount` (que no cambia de tamaño) y nunca
    // el `<canvas>` en sí (que sí cambia, por la causa de arriba) — confirmado que NO se autocorrige
    // ni esperando 10s. Disparar un evento `resize` real (no solo esperar) fuerza el recompute de
    // ambos (`Scale Manager` interno de Phaser + el listener `window.addEventListener('resize', ...)`
    // de `usePhaserViewportTransform`) — se usa aquí solo como estabilización de la MEDICIÓN de este
    // test, no como fix de producción (fuera de alcance de este bugfix P0).
    await page.setViewportSize({ width: viewportSize.width + 1, height: viewportSize.height });
    await page.setViewportSize(viewportSize);
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const mount = document.querySelector('#phaser-mount');
            const canvas = mount?.querySelector('canvas');
            if (!mount || !canvas) return false;
            const mountRect = mount.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            return canvasRect.top >= mountRect.top - 1 && canvasRect.bottom <= mountRect.bottom + 1;
          }),
        { timeout: 15_000, message: 'el <canvas> de Phaser nunca terminó de alinearse con su contenedor #phaser-mount' },
      )
      .toBe(true);

    // Panel del Líder: `CharacterPanel` (H4.x) renderiza `label` ("Líder") + `name` (leaderName real)
    // dentro de un `<span>` — localizamos por el label estable (no el nombre, que depende del
    // fixture) y subimos al contenedor `CharacterPanel` real (2 niveles: span -> RoleBlock div ->
    // CharacterPanel div, ver `CombatBoardOverlay.tsx`). `PANEL_ZONES` también pinta una etiqueta de
    // zona con el mismo texto exacto "Líder" (`CombatBoardOverlay.tsx`, lista de `<span>` de zona,
    // ANTES en el DOM que los `CharacterPanel`) — `.last()` resuelve al `<span>` de `RoleBlock`
    // dentro de `CharacterPanel`, el único de los dos con un panel clickeable como ancestro real.
    const leaderLabel = page.getByText('Líder', { exact: true }).last();
    await expect(leaderLabel).toBeVisible();
    const leaderPanel = leaderLabel.locator('xpath=ancestor::div[2]');
    await expect(leaderPanel).toBeVisible();

    const panelBox = await leaderPanel.boundingBox();
    expect(panelBox, 'el panel del Líder debe tener un bounding box real medible').not.toBeNull();
    if (!panelBox) return;

    // MEDICIÓN REAL (no tautológica, reproduce el método de QA) — el panel completo del Líder debe
    // caer DENTRO del área visible real de la ventana, no solo "dentro del viewport virtual de
    // Phaser" (que las aserciones algebraicas de `board-layout.test.ts` ya garantizan).
    expect(panelBox.y, `panel del Líder empieza en y=${panelBox.y}, por ENCIMA del área visible`).toBeGreaterThanOrEqual(0);
    expect(
      panelBox.y + panelBox.height,
      `panel del Líder termina en y=${panelBox.y + panelBox.height}, por DEBAJO de window.innerHeight (${viewportSize.height})`,
    ).toBeLessThanOrEqual(viewportSize.height);

    // H5.5 spec §3/§4 — igual que `HandCardRow`, `AbilityRow` del Líder solo queda visible/interactiva
    // tras `turnDecisionFlow.selectCategory('ACTIVATE_ABILITY')` (mismo gesto explícito del HUD que
    // el flujo de "Jugar Carta" ya usa en el test de arriba de este archivo). H4 spec §4 —
    // `CombatHud.tsx` abrevia la etiqueta del botón a "Habilidad" bajo el mismo breakpoint compacto
    // que `use-is-compact-viewport.ts` (`COMPACT_VIEWPORT_BREAKPOINT_PX`, 480px) — este `for` recorre
    // exactamente ese caso (viewport 390×844), así que hay que tocar el botón real por su texto real.
    const activateAbilityLabel = viewportSize.width <= 480 ? 'Habilidad' : 'Activar Habilidad';
    await page.getByText(activateAbilityLabel, { exact: true }).click();
    await page.waitForTimeout(100);

    // NOTA: el mismo `abilityId` puede aparecer 2 veces en el DOM — una vez en `AbilityRow`
    // (interactivo, `pointer-events: auto`) y, si la ficha ampliada del Líder está abierta, otra vez
    // DENTRO de `CharacterSheetPreview` (solo lectura, `pointer-events: none`, ver `AbilityTile.tsx`).
    // `AbilityRow` del Líder se pinta ANTES que el modal de ficha (último nodo del árbol,
    // `CombatBoardOverlay.tsx`), así que `.first()` resuelve siempre al tile real interactivo.
    const abilityTile = page.locator(`[data-ability-id="${firstLeaderAbilityId}"]`).first();
    await expect(abilityTile).toBeVisible();
    const abilityBox = await abilityTile.boundingBox();
    expect(abilityBox, 'el tile de habilidad del Líder debe tener un bounding box real medible').not.toBeNull();
    if (!abilityBox) return;

    expect(abilityBox.y, `icono de habilidad del Líder empieza en y=${abilityBox.y}, por ENCIMA del área visible`).toBeGreaterThanOrEqual(0);
    expect(
      abilityBox.y + abilityBox.height,
      `icono de habilidad del Líder termina en y=${abilityBox.y + abilityBox.height}, por DEBAJO de window.innerHeight (${viewportSize.height})`,
    ).toBeLessThanOrEqual(viewportSize.height);

    // CLIC REAL (no `force: true`) — Playwright falla si el elemento objetivo no es realmente
    // "actionable" (visible, dentro del viewport, no tapado por otro elemento) en la posición real
    // del clic, exactamente la condición que QA reportó rota antes de este fix.
    const leaderNameBefore = await page.getByText(DEFAULT_LEADER_OPTION.label, { exact: true }).count();
    await leaderPanel.click();
    // `CharacterPanel` abre la ficha ampliada (`CharacterSheetPreview`) en `onMouseEnter` — Playwright
    // mueve el puntero real al centro del elemento antes de hacer click, disparando ese hover.
    await expect
      .poll(async () => page.getByText(DEFAULT_LEADER_OPTION.label, { exact: true }).count())
      .toBeGreaterThan(leaderNameBefore);

    await abilityTile.click();
    await page.waitForTimeout(200);

    expect(pageErrors).toEqual([]);
  });
}
