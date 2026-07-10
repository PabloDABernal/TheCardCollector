import { FIXED_NUCLEO_DICE_COUNT, DEFAULT_NUCLEO_TABLE_MAX_DICE } from '@collector/domain-combat';

/**
 * H4 spec (`docs/specs/H4_layout_fuente_unica.md`) §2.1 — única fuente de verdad de coordenadas de
 * combate. Todo lo que se deriva de un vecino (`HAND_ROW_POSITION`, `LEADER_POSITION`, `ALLIES_ROW_Y`,
 * `NUCLEO_TABLE_ROW_Y`, ...) se calcula por fórmula en este mismo módulo — nunca se redeclara en otro
 * archivo. `ENEMY_POSITION`/`SCENARIO_POSITION` son las únicas ANCLAS (no dependen de ninguna fila
 * vecina por encima), así que permanecen como literales documentados aquí mismo.
 *
 * Dirección de dependencia: `juice/recipes/placeholder.ts` IMPORTA estas constantes (nunca al revés)
 * — este archivo no importa nada de `placeholder.ts`, así que no hay ciclo posible. La importación de
 * `@collector/domain-combat` (`FIXED_NUCLEO_DICE_COUNT`/`DEFAULT_NUCLEO_TABLE_MAX_DICE`, ver más abajo
 * junto a `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`) no crea ciclo — es un paquete de dominio, no de
 * `combat-scene`.
 */
export const ENEMY_POSITION = { x: 540, y: 300 };
export const SCENARIO_POSITION = { x: 540, y: 960 };

// FIX QA post-`6d14b52` — duplicados documentados de las dimensiones reales de sprite que SÍ dibujan
// `role-view.ts` (`ROLE_SIZE` 200×200, tile de Líder/Enemigo/Escenario) y `nucleo-table-view.ts`
// (`NUCLEO_DIE_SIZE` 64, solo el dado FIXED base — los dados EXTRA apilados con
// `NUCLEO_EXTRA_DIE_STACK_OFFSET_PX` quedan fuera de este cálculo, limitación conocida y
// preexistente, no introducida por este fix). Mismo criterio de aislamiento que
// `MINION_TILE_HEIGHT_PX`/`ABILITY_ICON_HEIGHT_PX` (más abajo): se duplica el número en vez de
// importarlo, para no crear una dependencia cruzada view-a-view solo por una constante — pero queda
// comentado 1:1 contra su origen para que un cambio futuro en uno se refleje manualmente en el otro.
export const ROLE_TILE_HALF_PX = 100; // = ROLE_SIZE.width/height (200) / 2 (role-view.ts)
export const NUCLEO_TILE_HALF_PX = 32; // = NUCLEO_DIE_SIZE (64) / 2 (nucleo-table-view.ts)
export const ROLE_HUD_TEXT_OFFSET_PX = 120; // = HUD_TEXT_OFFSET_Y (role-view.ts)
// Alto aproximado de una línea de texto HUD (fontSize 20px, role-view.ts) — el texto de
// Enemigo/Líder/Escenario no usa saltos de línea (`\n`) hoy, así que basta con una línea; si algún
// día se añaden más líneas, este valor (y por tanto el hueco de `panel-scenario`) debe crecer con él.
export const ROLE_HUD_TEXT_LINE_HEIGHT_PX = 24;

// FIX_combat_viewport_and_layout.md §2.1 — `MINIONS_ROW_Y` debe dejar hueco vertical suficiente
// contra `ENEMY_ABILITIES_ROW_Y` para que el tile de secuaz (120x180, `CARD_PLACEHOLDER_HEIGHT`,
// `juice/recipes/placeholder.ts`) no solape con el icono de habilidad del Enemigo (`ICON_HEIGHT`,
// `ability-cooldown-view.ts`). Constantes duplicadas localmente (no importadas desde `juice/` ni
// desde `ability-cooldown-view.ts`) para no crear una dependencia cruzada solo por un número —
// mismo criterio de aislamiento que ya separa esos módulos. Exportadas para que
// `board-layout.test.ts` pueda verificar los rangos verticales sin duplicar los valores.
export const MINION_TILE_HEIGHT_PX = 180; // = CARD_PLACEHOLDER_HEIGHT (juice/recipes/placeholder.ts)
export const ABILITY_ICON_HEIGHT_PX = 24; // = ICON_HEIGHT (ability-cooldown-view.ts)
// Mismas dimensiones de tile (`CARD_PLACEHOLDER_WIDTH/HEIGHT`, 120×180) que `MINION_TILE_HEIGHT_PX`
// ya documenta para Secuaces — Aliados y cartas de Mano usan el mismo tile, así que reutilizan la
// misma semi-altura (FIX QA post-`6d14b52`, ver auditoría de `panel-allies`/`panel-hand` abajo).
export const CARD_TILE_HALF_PX = MINION_TILE_HEIGHT_PX / 2; // 90

// ENEMY_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX/2 + MINION_TILE_HEIGHT_PX/2 + margen de 20px
// = 480 + 12 + 90 + 20 = 602 → redondeado a 620 para dejar margen legible (no pixel-perfect al
// límite) — ver FIX_combat_viewport_and_layout.md §2.1. 620 es un valor fijado y verificado en la
// spec, no recalculado en runtime.
export const MINIONS_ROW_Y = 620;

// H2.10 spec §2.3 — fila de iconos de CD de habilidad, debajo del tile de rol y su HUD de texto.
// `LEADER_ABILITIES_ROW_Y` se define más abajo, junto a `LEADER_POSITION` (depende de `HAND_ROW_POSITION`).
export const ENEMY_ABILITIES_ROW_Y = ENEMY_POSITION.y + 180;

// Margen mínimo garantizado entre el borde real (bounding box) de dos filas de contenido
// consecutivas (tiles/texto/iconos), NO solo entre los fondos de `PANEL_ZONES`. Toda fila derivada
// de este archivo (`ALLIES_ROW_Y`, `NUCLEO_TABLE_ROW_Y`, `HAND_ROW_POSITION`, `LEADER_POSITION`, ...)
// se calcula a partir de este valor — H4 spec §2.1, ver también `board-layout.test.ts`.
// FIX visual (feedback Director Creativo en móvil real, docs/specs/H4_diseno_real_ui.md) — bajado de
// 20 a 12: el Director señaló huecos negros muertos entre paneles (HUD↔panel-scenario, dentro de
// panel-scenario alrededor del tile, panel-allies vacío ocupando demasiado alto) en su móvil real.
// 12px sigue dejando margen real y positivo entre bounding boxes de contenido consecutivas (encima de
// `PANEL_CONTENT_PADDING_PX` × 2 = 10, así que el fondo de dos `PanelZone` vecinas nunca llega a
// tocarse — `board-layout.test.ts` "sin solapes" lo verifica), solo reduce el AIRE sobrante que no
// aportaba nada.
export const CONTENT_GAP_PX = 12;

// Borde inferior real del contenido de `panel-scenario`: el texto HUD (offset 120 + una línea, 144)
// cae más abajo que el propio tile (100) — Math.max cubre ambos casos sin asumir cuál domina.
const SCENARIO_CONTENT_BOTTOM_Y = Math.max(
  SCENARIO_POSITION.y + ROLE_TILE_HALF_PX,
  SCENARIO_POSITION.y + ROLE_HUD_TEXT_OFFSET_PX + ROLE_HUD_TEXT_LINE_HEIGHT_PX,
); // 1104

// FIX QA post-`6d14b52` — antes 1300 (número fijo, nunca recalculado tras ajustar filas vecinas).
// Derivado del borde inferior real de `panel-scenario` (`SCENARIO_CONTENT_BOTTOM_Y`) + `CONTENT_GAP_PX`
// + la semi-altura real del tile de Aliado (`CARD_TILE_HALF_PX`) — bug análogo al del Líder hallado
// al auditar el resto de filas: el tile de Aliado (120×180) se solapaba ~10px con `panel-nucleos`.
export const ALLIES_ROW_Y = SCENARIO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX + CARD_TILE_HALF_PX; // 1206
const ALLIES_CONTENT_BOTTOM_Y = ALLIES_ROW_Y + CARD_TILE_HALF_PX; // 1296

/** RENOMBRADO H3.4 de `NUCLEO_POOL_ROW_Y` — mesa persistente de dados (ya no "pool" que se vacía).
 *  Alias `NUCLEO_POOL_ROW_Y` conservado para no romper imports existentes fuera de este cambio.
 *  FIX QA post-`6d14b52` — antes 1450 (número fijo). Ahora derivado de `ALLIES_CONTENT_BOTTOM_Y` +
 *  `CONTENT_GAP_PX` + `NUCLEO_TILE_HALF_PX`, dejando sitio real (no solo en `PANEL_ZONES`) entre el
 *  tile de Aliado y el dado FIXED — el tile de Aliado se solapaba ~10px con `panel-nucleos` antes. */
export const NUCLEO_TABLE_ROW_Y = ALLIES_CONTENT_BOTTOM_Y + CONTENT_GAP_PX + NUCLEO_TILE_HALF_PX; // 1340
export const NUCLEO_POOL_ROW_Y = NUCLEO_TABLE_ROW_Y;

/** NUEVO H3 (capa visual) — separación vertical entre un dado FIXED y sus dados EXTRA apilados del
 *  mismo color (spec H3 §5.2, "agrupación visual por color"). Declarada aquí (antes de su primer uso
 *  en `NUCLEO_MAX_STACK_OFFSET_PX` más abajo) — movida desde su ubicación original junto a
 *  `MINIONS_ROW_X_ORIGIN`/`ALLIES_ROW_X_ORIGIN` para resolver TS2448/TS2454 ("used before its
 *  declaration"): esas dos constantes son literales independientes sin relación de orden con esta, así
 *  que moverla aquí no las afecta ni cambia ningún valor, solo el orden textual del archivo. */
export const NUCLEO_EXTRA_DIE_STACK_OFFSET_PX = 70;

// FIX solape móvil real (Director Creativo, hallazgo de este Programmer) — el bounding box de
// `panel-nucleos` usaba SOLO el tamaño del dado FIXED (`NUCLEO_TILE_HALF_PX`), ignorando que
// `nucleo-table-view.ts` (`positionFor`) apila los dados EXTRA de un mismo color DEBAJO del FIXED,
// cada uno separado `NUCLEO_EXTRA_DIE_STACK_OFFSET_PX` (70) más que el anterior del mismo color. Con
// al menos 1 dado EXTRA en mesa, el bottom real de la mesa de Núcleos queda por debajo de lo que este
// archivo asumía, invadiendo el hueco reservado para Mano (medido en móvil real: ~-13px de overlap).
//
// Peor caso posible: todos los dados EXTRA que caben en mesa (`DEFAULT_NUCLEO_TABLE_MAX_DICE` menos
// los `FIXED_NUCLEO_DICE_COUNT` fijos, uno por color) son del MISMO color y se apilan en una sola
// columna — es la pila más alta que `positionFor` puede llegar a dibujar. El bounding box de
// `panel-nucleos`/el hueco hacia Mano deben soportar este peor caso siempre, no solo el caso con 0
// dados EXTRA, para que el gap nunca pueda volverse negativo sin importar cuántas cartas/equipo
// añadan dados EXTRA de Núcleo durante el combate.
// FIX Reviewer (hallazgo doc. tras commit `195ecca`) — este layout es COMPILE-TIME (constantes
// módulo-level, calculadas una sola vez al cargar el archivo) y por eso usa
// `DEFAULT_NUCLEO_TABLE_MAX_DICE` (el valor por defecto de dominio), NO `CombatEngineConfig.tableMaxDice`
// (que SÍ es configurable por instancia en runtime, ver `packages/domain-combat`). Hoy nadie
// sobreescribe `tableMaxDice` en `apps/shell`, así que no hay bug activo. Pero si en el futuro se
// configura una mesa con `tableMaxDice` mayor que el default, `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`
// (y por tanto `NUCLEO_CONTENT_BOTTOM_Y`/`HAND_ROW_POSITION`/`LEADER_POSITION` en cascada) quedarían
// cortos para el peor caso real de esa mesa, sin que ningún test de este archivo lo detecte — el
// layout no lee `tableMaxDice` de config en runtime porque es compile-time. Si se configura una mesa
// custom con más dados que el default, este número debe revisarse a mano.
export const NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR = DEFAULT_NUCLEO_TABLE_MAX_DICE - FIXED_NUCLEO_DICE_COUNT; // 10-5 = 5
const NUCLEO_MAX_STACK_OFFSET_PX = NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR * NUCLEO_EXTRA_DIE_STACK_OFFSET_PX; // 5*70 = 350
const NUCLEO_CONTENT_BOTTOM_Y = NUCLEO_TABLE_ROW_Y + NUCLEO_MAX_STACK_OFFSET_PX + NUCLEO_TILE_HALF_PX; // 1340+350+32 = 1722 (peor caso: pila EXTRA al máximo)

// H4 spec (`docs/specs/H4_layout_fuente_unica.md`) §2.1 — antes literal (1474, importado de
// `juice/recipes/placeholder.ts`), ahora derivado por fórmula del borde inferior real de Núcleos.
// NOTA DE VERIFICACIÓN (Programmer anterior): con SOLO el dado FIXED (`NUCLEO_TILE_HALF_PX`), este
// número coincidía EXACTAMENTE con el literal anterior (1474) — el `board-layout.test.ts` de "sin
// solapes" ya estaba en VERDE antes de esa migración con 0 dados EXTRA, pero el bug real reportado en
// móvil (Director Creativo) aparecía con >=1 dado EXTRA apilado, caso que ese bounding box no
// contemplaba (medido: ~-13px de overlap real con la fila de Mano).
// FIX de este Programmer (hallazgo de la investigación anterior) — `NUCLEO_CONTENT_BOTTOM_Y` ahora
// asume el PEOR CASO posible de apilado de dados EXTRA (ver `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`
// arriba: 1722 en vez de 1372), así que `HAND_ROW_POSITION` (1824, antes 1474) baja lo suficiente para
// dejar hueco real SIEMPRE, no solo en el caso feliz de 0 dados EXTRA.
export const HAND_ROW_POSITION = { x: 540, y: NUCLEO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX + CARD_TILE_HALF_PX }; // 1722+12+90 = 1824

// H4 spec §2.1 — derivado del borde inferior real de Mano (antes literal 1676, luego 1676 tras H4).
// Al mover `HAND_ROW_POSITION` al peor caso de apilado (arriba), `LEADER_POSITION` cascada con él
// (misma cadena de derivación H4, sin cambios de fórmula) hasta 2026.
//
// ⚠️ HALLAZGO A ESCALAR A ARCHITECT (no resuelto en este fix, fuera del alcance de un bounding-box de
// Núcleos-vs-Mano): con el PEOR CASO teórico (los 5 dados EXTRA que caben en mesa, todos del mismo
// color, apilados en una sola columna — matemáticamente posible según `DEFAULT_NUCLEO_TABLE_MAX_DICE`/
// `FIXED_NUCLEO_DICE_COUNT`, sin tope por color en el dominio), `LEADER_CONTENT.bottom` (ver más abajo)
// llega a 2218px — 298px por ENCIMA del viewport virtual de 1920px (`COMBAT_SCENE_VIEWPORT`,
// `CombatScene.ts`), que el propio H4 spec §2.1 exigía respetar ("cabe con 36px de margen"). La cadena
// de derivación de H4 (Líder deriva de Mano, que deriva de Núcleos) es correcta y evita CUALQUIER
// solape entre filas consecutivas incluso en el peor caso — pero no puede, a la vez, garantizar que
// todo quepa dentro de los 1920px si el peor caso de apilado de Núcleos EXTRA (350px) es mayor que el
// margen disponible (52px) antes de este fix. Este Programmer NO decide cómo resolver esa tensión
// (opciones posibles: tope por color en el dominio, desacoplar el ancla de Líder de la posición de
// Mano, o limitar visualmente cuántos EXTRA se apilan antes de reordenar en otra columna/fila) — es una
// decisión de diseño/arquitectura, no de este bugfix puntual (que solo cubre "Núcleos nunca solapa
// Mano"). Verificado en Playwright con 1 dado EXTRA (caso real reportado, no el peor caso teórico): sin
// overlap, ver resumen de esta sesión.
export const LEADER_POSITION = {
  x: 540,
  y: HAND_ROW_POSITION.y + CARD_TILE_HALF_PX + CONTENT_GAP_PX + ROLE_TILE_HALF_PX, // (1824+90)+12+100 = 2026
};

// H2.10 spec §2.3 — fila de iconos de CD de habilidad, debajo del tile de rol y su HUD de texto.
export const LEADER_ABILITIES_ROW_Y = LEADER_POSITION.y + 180; // 2026+180 = 2206

export const TILE_SEPARATION_PX = 140;
// NUEVO H4.x — exportadas (antes privadas a minions-view.ts/allies-view.ts, eliminados ese mismo
// spec §2.2) para que `MinionRow.tsx`/`AllyRow.tsx` (apps/shell, HTML) posicionen sus tiles en las
// mismas coordenadas de viewport virtual que Phaser ya usaba, y para que `board-anchors-view.ts`
// (anclas invisibles de juice, ver ese archivo) siga anclando `hitImpact`/`floatingNumber` al mismo
// punto en pantalla que el tile HTML real ocupa.
export const MINIONS_ROW_X_ORIGIN = 200;
export const ALLIES_ROW_X_ORIGIN = 200;

// FIX_combat_viewport_and_layout.md §2.2 — antes: 100. A 14px, la etiqueta más larga del catálogo
// MVP ("Grito de Guerra 2/4", ~20 caracteres) ocupa ~170-180px renderizados — muy por encima de los
// 100px anteriores, provocando solapamiento horizontal entre etiquetas adyacentes con 2+
// habilidades del mismo lado. Con 200px de separación y 4 habilidades por lado (máximo actual del
// catálogo), la fila completa (3 × 200 = 600px, centrada en x=540) cae dentro del viewport de
// 1080px con margen sobrado.
export const ABILITY_ICON_SEPARATION_PX = 200;

// H4 spec §4.1 — paleta y tabla de paneles delimitados por zona (E4.2), sustituye la paleta gris
// genérica anterior por el sistema de diseño real (`--binder`/`--rule`, `apps/shell/src/ui/tokens.css`).
// `board-layout.ts` sigue siendo la única fuente de verdad de coordenadas; `panel-view.ts` consume
// `PANEL_ZONES` sin recalcular nada.
export const PANEL_FILL_COLOR = 0x1f1e26; // = --binder
export const PANEL_FILL_ALPHA = 0.62; // ligeramente más opaco que antes (0.55) — más lectura de
                                       // "funda de carta" sólida, menos "cristal flotante"
export const PANEL_BORDER_COLOR = 0x3a3744; // = --rule
export const PANEL_BORDER_WIDTH_PX = 2;
// ZONE_LABEL_COLOR_HEX retirado (H4 spec §4.1) — la etiqueta de zona deja de dibujarse en Phaser,
// migrada a `CombatBoardOverlay.tsx` (apps/shell), ver §2 de la spec.

export interface PanelZone {
  readonly id: string; // nombre estable, usado como scene name (debug/QA)
  readonly x: number; // centro X
  readonly y: number; // centro Y
  readonly width: number;
  readonly height: number;
  readonly label: string; // reutiliza el mismo texto que board.ts ya usaba en `zoneLabels`
}

// FIX QA post-`6d14b52` — REESCRITO: la versión anterior derivaba cada `PanelZone` a partir de
// puntos medios ENTRE CENTROS de fila/panel vecino ("boundaries"), sin conocer nunca el tamaño real
// del sprite que cada panel aloja — así fue como se coló el bug reportado (el tile de 200×200 del
// Líder no cabía en un panel dimensionado solo por la distancia a su vecino). Ahora cada zona parte
// de su BOUNDING BOX de contenido real (tile + HUD/iconos, usando las mismas constantes de tamaño
// que sus vistas — `ROLE_TILE_HALF_PX`, `CARD_TILE_HALF_PX`, `NUCLEO_TILE_HALF_PX`, etc.) y el panel
// se construye como ese bounding box + un margen fijo (`PANEL_CONTENT_PADDING_PX`). Como
// `CONTENT_GAP_PX` (12, tras el FIX visual de más arriba) ya garantiza esa separación mínima entre
// bounding boxes de filas vecinas, y `PANEL_CONTENT_PADDING_PX` (5) consume como mucho 10 de esos
// 12px en cada frontera (dejando ~2px libres reales entre fondos de panel), ningún panel puede
// solaparse con su vecino ni dejar su sprite fuera — por construcción, no por coincidencia.
const PANEL_CONTENT_PADDING_PX = 5;

export interface ContentBox {
  readonly top: number;
  readonly bottom: number;
}

function panelFromContent(x: number, width: number, id: string, label: string, content: ContentBox): PanelZone {
  const top = content.top - PANEL_CONTENT_PADDING_PX;
  const bottom = content.bottom + PANEL_CONTENT_PADDING_PX;
  return { id, x, y: (top + bottom) / 2, width, height: bottom - top, label };
}

const ENEMY_CONTENT: ContentBox = {
  top: ENEMY_POSITION.y - ROLE_TILE_HALF_PX,
  bottom: ENEMY_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
};
const MINIONS_CONTENT: ContentBox = {
  top: MINIONS_ROW_Y - CARD_TILE_HALF_PX,
  bottom: MINIONS_ROW_Y + CARD_TILE_HALF_PX,
};
const SCENARIO_CONTENT: ContentBox = {
  top: SCENARIO_POSITION.y - ROLE_TILE_HALF_PX,
  bottom: SCENARIO_CONTENT_BOTTOM_Y,
};
const ALLIES_CONTENT: ContentBox = {
  top: ALLIES_ROW_Y - CARD_TILE_HALF_PX,
  bottom: ALLIES_CONTENT_BOTTOM_Y,
};
const NUCLEOS_CONTENT: ContentBox = {
  top: NUCLEO_TABLE_ROW_Y - NUCLEO_TILE_HALF_PX,
  bottom: NUCLEO_CONTENT_BOTTOM_Y,
};
const HAND_CONTENT: ContentBox = {
  top: HAND_ROW_POSITION.y - CARD_TILE_HALF_PX,
  bottom: HAND_ROW_POSITION.y + CARD_TILE_HALF_PX,
};
const LEADER_CONTENT: ContentBox = {
  top: LEADER_POSITION.y - ROLE_TILE_HALF_PX,
  bottom: LEADER_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
};

/**
 * H4 spec §3 paso 3 — las 7 filas de contenido real (no fondos de panel), ordenadas de arriba a
 * abajo (Enemigo → Secuaces → Escenario → Aliados → Núcleos → Mano → Líder). Expuesto para que
 * `board-layout.test.ts` verifique que el gap real entre bounding boxes consecutivas de CONTENIDO
 * es siempre `>= CONTENT_GAP_PX`, no solo `> 0` — la red de seguridad que debería haber atrapado el
 * bug de solape Núcleos↔Mano si se hubiera corrido tras el último cambio de `CONTENT_GAP_PX`.
 */
export const CONTENT_BOXES_TOP_TO_BOTTOM: readonly { readonly id: string; readonly box: ContentBox }[] = [
  { id: 'enemy', box: ENEMY_CONTENT },
  { id: 'minions', box: MINIONS_CONTENT },
  { id: 'scenario', box: SCENARIO_CONTENT },
  { id: 'allies', box: ALLIES_CONTENT },
  { id: 'nucleos', box: NUCLEOS_CONTENT },
  { id: 'hand', box: HAND_CONTENT },
  { id: 'leader', box: LEADER_CONTENT },
];

export const PANEL_ZONES: readonly PanelZone[] = [
  panelFromContent(540, 1000, 'panel-enemy', 'Enemigo', ENEMY_CONTENT),
  panelFromContent(540, 1000, 'panel-minions', 'Secuaces', MINIONS_CONTENT),
  panelFromContent(540, 1000, 'panel-scenario', 'Escenario', SCENARIO_CONTENT),
  panelFromContent(540, 1000, 'panel-allies', 'Aliados', ALLIES_CONTENT),
  panelFromContent(540, 1000, 'panel-nucleos', 'Núcleos', NUCLEOS_CONTENT),
  panelFromContent(540, 1040, 'panel-hand', 'Mano', HAND_CONTENT),
  panelFromContent(540, 1000, 'panel-leader', 'Líder', LEADER_CONTENT),
];
