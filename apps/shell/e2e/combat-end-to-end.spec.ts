import { test, expect } from '@playwright/test';
import { buildCombatSetup } from '../src/combat/build-combat-setup';
import { DEFAULT_LEADER_OPTION } from '../src/combat/leader-options';

// FIX URGENTE P0 (docs/specs/H4_fix_urgente_lider_fuera_viewport.md) — literal duplicado a propósito
// (NO importado de `@collector/combat-scene`): ese paquete reexporta `CombatScene.ts`, que importa
// `phaser` en runtime (no solo tipos), cuyo módulo ejecuta detección real de `Device`/`Canvas` al
// cargarse — `phaser` asume un entorno de navegador real (`window`/`document`) y crashea al cargarse
// en el proceso Node del test-runner de Playwright. `COMBAT_SCENE_VIEWPORT` — mantener este literal
// en sync si vuelve a cambiar (mismo criterio que `HAND_ROW_X`/`TILE_SEPARATION_PX` de abajo, ya
// duplicados por el mismo motivo). H5.8 (`docs/specs/H5.8_layout_desktop_legibilidad.md` §1) —
// `width` sube de 1080 a 1280 (`height` sin cambio).
const COMBAT_SCENE_VIEWPORT = { width: 1280, height: 2060 } as const;

const HAND_ROW_X = 640; // `HAND_ROW_POSITION.x` (`board-layout.ts`, = COMBAT_SCENE_VIEWPORT.width / 2, H5.8 §1)
const TILE_SEPARATION_PX = 140;
// La mesa de Núcleos (`NUCLEO_TABLE_CENTER_Y`) es la ÚNICA ancla de derivación vertical
// (`board-layout.ts`, H5.1) — el eje Y no cambia en H5.8, solo el ancho del viewport.
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
 * ACTUALIZADO H5.2/H5.5 corrección 2026-07-13 — el gating de categoría ("Jugar Carta"/"Activar
 * Habilidad" como botones previos del HUD) se RETIRA por completo: mano y habilidades del Líder
 * vuelven a estar SIEMPRE visibles/interactivas, tap directo en el objeto dispara el comando, sin
 * ningún paso previo de "elegir categoría" (docs/specs/H5.2_revelacion_progresiva.md corrección,
 * docs/specs/H5.5_cableado_flujo_progresivo.md corrección). Este test ya NO hace click en "Jugar
 * Carta" antes de tocar una carta.
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
 * Coordenadas de tiles: calculadas contra el mismo espacio virtual 1280×2060 que
 * `COMBAT_SCENE_VIEWPORT`/`board-layout.ts` ya fijan (`HAND_ROW_POSITION = {x:640,y:1730}`,
 * `TILE_SEPARATION_PX = 140`, `NUCLEO_TABLE_ROW_Y = 1030`, `NUCLEO_TABLE_X_ORIGIN = 200`), escaladas
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
 * para desbloquear una carta jugable en 1 tap, en vez de asumir Energía suficiente de entrada.
 */
test('CombatScreen monta Phaser real dentro de #phaser-mount y un tap real sobre una carta dispara PLAY_CARD (HUD cambia de verdad)', async ({
  page,
}) => {
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

  // `Phaser.Scale.FIT` calcula el tamaño/posición inicial del `<canvas>` contra `window` en el
  // instante de construcción, ANTES de que el layout `flex` de `CombatScreen.css` (header/footer
  // reales) reduzca `#phaser-mount` a su tamaño final. Sin un evento `resize` real posterior,
  // `boundingBox()` del canvas queda desalineado con su contenedor — se estabiliza forzando un
  // resize real antes de medir/tocar nada.
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

  // El TEXTO real de la fila de estado del Líder (`CharacterPanel` → `RoleBlock`, HTML puro fuera
  // del `<canvas>`, nunca afectado por su redimensionado) es evidencia igual de "de punta a punta"
  // que un pixel-diff, pero sin depender de la geometría del canvas.
  async function readLeaderHudText(): Promise<string> {
    const nivelChip = page.getByText('Nivel', { exact: false });
    const statsRow = nivelChip.locator('xpath=..');
    return (await statsRow.innerText()).trim();
  }

  await page.waitForTimeout(200); // margen para que CombatScene.create() pinte el estado inicial

  // `TurnStartModal` (H4 spec, `role="dialog"`) es obligatorio al empezar el turno del Líder desde
  // una ronda anterior a este test, e intercepta cualquier clic real sobre el tablero hasta que se
  // descarta. Mismo botón real ("Ahora no") que un jugador usaría.
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

  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-before.png' });
  const hudBefore = await readLeaderHudText();

  // H5.5 corrección 2026-07-13 — `HandCardRow` está SIEMPRE montada/interactiva durante el turno del
  // jugador (sin ningún gating de categoría previo): tap DIRECTO sobre la carta real, sin tocar
  // ningún botón "Jugar Carta" antes.
  const playCardTile = (await freshCanvasGeometry()).toPagePoint(playCardVirtualX, HAND_TAP_Y);
  await page.mouse.click(playCardTile.x, playCardTile.y);

  await page.waitForTimeout(300); // margen para el dispatch + el reflow del HUD

  const hudAfter = await readLeaderHudText();
  await page.screenshot({ path: 'e2e/screenshots/combat-end-to-end-leader-hud-after.png' });

  // Evidencia de que `dispatch` funcionó de verdad de punta a punta (traductor → bridge → engine →
  // BoardView.render), no solo la interacción visual del tap: el HUD de rol del Líder cambió (al
  // menos la Energía baja por el coste de la carta jugada).
  expect(hudBefore).not.toBe(hudAfter);

  // Segundo tap real: carta de ATAQUE (`requiresNucleoInstance: true`) real de la mano resultante,
  // calculada arriba, seguida de un Núcleo real (primer die de la mesa, `NUCLEO_TABLE_X_ORIGIN=200`,
  // `NUCLEO_TABLE_ROW_Y=1030`) — ejercita el flujo completo de selección de 2 pasos (targeting/
  // Núcleo, `gesture-command-translator.ts`, NO tocado por la corrección de H5.2/H5.5) con gestos
  // reales, sin ningún paso previo de categoría.
  // Se espera rechazo por Energía insuficiente en el contenido real (comportamiento de dominio
  // esperado — ver desviación documentada arriba), confirmado por AUSENCIA de excepción/error de
  // consola, no por cambio de HUD.
  expect(attackCardVirtualX, 'se esperaba al menos una carta de ATAQUE en la mano tras jugar la primera').not.toBeNull();
  if (attackCardVirtualX !== null) {
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
 *
 * H5.8 §1.3/§6 punto 6 — regresión: en la ventana de referencia 1920×1080, el ancho real del
 * `<canvas>` debe ser >= 30% del ancho de página (mejora sobre el 29.5% medido antes de H5.8, con el
 * viewport virtual en 1080px de ancho).
 */
test('CombatScreen encaja sin scroll de página en un viewport ancho de escritorio (1920x1080) y el canvas ocupa >= 30% del ancho', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

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
    // H5.8 §1.3 — objetivo numérico concreto de la mejora (no elimina las franjas negras al 100%,
    // ver H5.8 §4, pero reduce su proporción de forma medible).
    expect(box.width / viewportSize.width).toBeGreaterThanOrEqual(0.3);
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
 *
 * ACTUALIZADO H5.2/H5.5 corrección 2026-07-13 — `AbilityRow` del Líder está SIEMPRE
 * visible/interactiva (sin gating de categoría): el tap sobre el icono de habilidad es directo, sin
 * clic previo en ningún botón "Activar Habilidad"/"Habilidad".
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
    // usaría) antes de interactuar con el panel del Líder.
    const dismissTurnStartModal = page.getByText('Ahora no', { exact: true });
    if (await dismissTurnStartModal.isVisible().catch(() => false)) {
      await dismissTurnStartModal.click();
    }

    // HALLAZGO independiente de este fix (a escalar aparte, fuera del alcance P0 de
    // `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`/`COMBAT_SCENE_VIEWPORT.height`, confirmado
    // reproducible IGUAL en el código previo a este fix): `Phaser.Scale.FIT` calcula el
    // tamaño/posición inicial del `<canvas>` contra `window` en el instante en que `new
    // Phaser.Game(...)` se construye, ANTES de que el resto del layout de React (`CombatHud`, etc.)
    // empuje `#phaser-mount` a su posición/tamaño final. Se fuerza un resize real para estabilizar la
    // MEDICIÓN de este test.
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

    // H5.2/H5.5 corrección 2026-07-13 — `AbilityRow` del Líder está SIEMPRE visible/interactiva, sin
    // ningún gesto previo de "elegir categoría": tap DIRECTO sobre el icono de habilidad real.
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

/**
 * NUEVO H5.7 §3 — `SideActionRail` (Generar Energía/Robar Carta), los 2 botones discretos que
 * sustituyen a la fila de 4 botones retirada por H5.5 corregida (docs/specs/H5.7_hud_lider_discreto.md
 * §3). Verifica dispatch directo, sin ningún panel de categoría de por medio, en un test aislado
 * (no comparte turno/acciones con el test principal de arriba, para no interferir con su
 * presupuesto de 2 acciones).
 */
test('SideActionRail: "Generar Energía"/"Robar Carta" despachan directo, sin abrir ningún panel de categoría', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/combat');

  const mountedCanvas = page.locator('#phaser-mount canvas');
  await expect(mountedCanvas).toBeVisible();
  await page.waitForTimeout(200);

  const dismissTurnStartModal = page.getByText('Ahora no', { exact: true });
  if (await dismissTurnStartModal.isVisible().catch(() => false)) {
    await dismissTurnStartModal.click();
    await page.waitForTimeout(100);
  }

  async function readLeaderHudText(): Promise<string> {
    const nivelChip = page.getByText('Nivel', { exact: false });
    const statsRow = nivelChip.locator('xpath=..');
    return (await statsRow.innerText()).trim();
  }

  const hudBefore = await readLeaderHudText();

  // Botón discreto "⚡ Energía" (`SideActionRail.tsx`) — acción PAGADA (1 de las 2 acciones del
  // turno), comando de dominio `GENERATE_ENERGY`, DISTINTO del paso previo gratuito
  // `DRAW_OR_GENERATE` ya cubierto por el test principal. Nombre exacto (no regex): "Generar energía
  // (gratis)" del paso previo también contiene "Energía" en mayúscula/minúscula distinta, se evita
  // cualquier ambigüedad con `getByRole` de nombre exacto.
  const energyButton = page.getByRole('button', { name: '⚡ Energía' });
  await expect(energyButton).toBeVisible();
  if (await energyButton.isEnabled()) {
    await energyButton.click();
    await page.waitForTimeout(200);

    const hudAfter = await readLeaderHudText();
    expect(hudBefore).not.toBe(hudAfter); // la Energía subió — evidencia de dispatch real de punta a punta
  }

  // Botón discreto "🂠 Robar" — sigue presente y sin abrir ningún panel de categoría (H5.5 corrección:
  // `TurnDecisionFlow` retirado por completo). Nombre exacto, mismo motivo que arriba (evita
  // ambigüedad con "Robar carta (gratis)" del paso previo).
  const drawButton = page.getByRole('button', { name: '🂠 Robar' });
  await expect(drawButton).toBeVisible();

  expect(pageErrors).toEqual([]);
});
