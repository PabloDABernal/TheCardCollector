import { PLACEHOLDER_POSITIONS, CARD_HAND_POSITION } from '../juice/recipes/placeholder';

/**
 * H2.8 spec §3.1 — única fuente de verdad de coordenadas de rol. REUTILIZA exactamente
 * `PLACEHOLDER_POSITIONS` (H2.5) para que el sprite persistente de Líder/Enemigo/Escenario ocupe la
 * MISMA posición que `resolveOrCreatePlaceholder` ya asume al hacer fallback — cero desalineamiento
 * visual posible entre "el sprite real" y "donde el placeholder de emergencia aparecería si el sprite
 * faltara".
 *
 * FIX QA post-`6d14b52` — el tile REAL del Líder (200×200, `role-view.ts`, `ROLE_TILE_HALF_PX` más
 * abajo) invadía visualmente el panel vecino "Mano" (`panel-hand`): con `LEADER_POSITION.y` = 1700,
 * su borde superior (1700 - 100 = 1600) caía justo en el CENTRO de la fila de Mano (`y` = 1600),
 * mezclándose con sus cartas. La corrección anterior (`f912c92`/`6d14b52`) solo verificaba que los
 * FONDOS de `PANEL_ZONES` no se solaparan entre sí — nunca comprobó que el sprite real cupiera dentro
 * de su panel. `LEADER_POSITION.y`/`HAND_ROW_POSITION.y` (`PLACEHOLDER_POSITIONS.leader`/
 * `CARD_HAND_POSITION`, `juice/recipes/placeholder.ts`) están ahora recalculados junto con
 * `ALLIES_ROW_Y`/`NUCLEO_TABLE_ROW_Y` (abajo) para que el BOUNDING BOX real de cada tile quepa dentro
 * de su panel con margen (`CONTENT_GAP_PX`) — verificado por `board-layout.test.ts`.
 */
export const LEADER_POSITION = PLACEHOLDER_POSITIONS.leader!; // {x:540, y:1708} — antes 1700, ver FIX QA arriba
export const ENEMY_POSITION = PLACEHOLDER_POSITIONS.enemy!; // {x:540, y:300}
export const SCENARIO_POSITION = PLACEHOLDER_POSITIONS.scenario!; // {x:540, y:960}
export const HAND_ROW_POSITION = CARD_HAND_POSITION; // {x:540, y:1498} — antes 1600, ver FIX QA arriba

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
export const LEADER_ABILITIES_ROW_Y = LEADER_POSITION.y + 180;
export const ENEMY_ABILITIES_ROW_Y = ENEMY_POSITION.y + 180;

// FIX QA post-`6d14b52` — margen mínimo garantizado entre el borde real (bounding box) de dos filas
// de contenido consecutivas (tiles/texto/iconos), NO solo entre los fondos de `PANEL_ZONES`. Se usa
// para derivar `ALLIES_ROW_Y`/`NUCLEO_TABLE_ROW_Y` aquí, y — con el mismo valor — para fijar
// `LEADER_POSITION.y`/`HAND_ROW_POSITION.y` en `juice/recipes/placeholder.ts` (no se puede derivar
// ahí en runtime porque `placeholder.ts` es importado POR este archivo, no al revés — evita ciclo).
export const CONTENT_GAP_PX = 20;

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
export const ALLIES_ROW_Y = SCENARIO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX + CARD_TILE_HALF_PX; // 1214
const ALLIES_CONTENT_BOTTOM_Y = ALLIES_ROW_Y + CARD_TILE_HALF_PX; // 1304

/** RENOMBRADO H3.4 de `NUCLEO_POOL_ROW_Y` — mesa persistente de dados (ya no "pool" que se vacía).
 *  Alias `NUCLEO_POOL_ROW_Y` conservado para no romper imports existentes fuera de este cambio.
 *  FIX QA post-`6d14b52` — antes 1450 (número fijo). Ahora derivado de `ALLIES_CONTENT_BOTTOM_Y` +
 *  `CONTENT_GAP_PX` + `NUCLEO_TILE_HALF_PX`, dejando sitio real (no solo en `PANEL_ZONES`) entre el
 *  tile de Aliado y el dado FIXED — el tile de Aliado se solapaba ~10px con `panel-nucleos` antes. */
export const NUCLEO_TABLE_ROW_Y = ALLIES_CONTENT_BOTTOM_Y + CONTENT_GAP_PX + NUCLEO_TILE_HALF_PX; // 1356
export const NUCLEO_POOL_ROW_Y = NUCLEO_TABLE_ROW_Y;
const NUCLEO_CONTENT_BOTTOM_Y = NUCLEO_TABLE_ROW_Y + NUCLEO_TILE_HALF_PX; // 1388 (solo dado FIXED base)

export const TILE_SEPARATION_PX = 140;
/** NUEVO H3 (capa visual) — separación vertical entre un dado FIXED y sus dados EXTRA apilados del
 *  mismo color (spec H3 §5.2, "agrupación visual por color"). */
export const NUCLEO_EXTRA_DIE_STACK_OFFSET_PX = 70;

// FIX_combat_viewport_and_layout.md §2.2 — antes: 100. A 14px, la etiqueta más larga del catálogo
// MVP ("Grito de Guerra 2/4", ~20 caracteres) ocupa ~170-180px renderizados — muy por encima de los
// 100px anteriores, provocando solapamiento horizontal entre etiquetas adyacentes con 2+
// habilidades del mismo lado. Con 200px de separación y 4 habilidades por lado (máximo actual del
// catálogo), la fila completa (3 × 200 = 600px, centrada en x=540) cae dentro del viewport de
// 1080px con margen sobrado.
export const ABILITY_ICON_SEPARATION_PX = 200;

// H4 spec §2.2/§2.3 — paleta y tabla de paneles delimitados por zona (E4.2). `board-layout.ts`
// sigue siendo la única fuente de verdad de coordenadas; `panel-view.ts` consume `PANEL_ZONES` sin
// recalcular nada.
export const PANEL_FILL_COLOR = 0x1e1e24; // ~mitad de camino entre #222 y #333 (decisions.md/backlog H4)
export const PANEL_FILL_ALPHA = 0.55; // translúcido — se lee como "panel" sin tapar contenido detrás
export const PANEL_BORDER_COLOR = 0x3a3a42;
export const PANEL_BORDER_WIDTH_PX = 2;
export const ZONE_LABEL_COLOR_HEX = '#9a9aa4'; // SUSTITUYE '#666666' de board.ts (bajo contraste)

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
// `CONTENT_GAP_PX` (20) ya garantiza esa separación mínima entre bounding boxes de filas vecinas, y
// `PANEL_CONTENT_PADDING_PX` (5) consume como mucho 10 de esos 20px en cada frontera, ningún panel
// puede solaparse con su vecino ni dejar su sprite fuera — por construcción, no por coincidencia.
const PANEL_CONTENT_PADDING_PX = 5;

interface ContentBox {
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

export const PANEL_ZONES: readonly PanelZone[] = [
  panelFromContent(540, 1000, 'panel-enemy', 'Enemigo', ENEMY_CONTENT),
  panelFromContent(540, 1000, 'panel-minions', 'Secuaces', MINIONS_CONTENT),
  panelFromContent(540, 1000, 'panel-scenario', 'Escenario', SCENARIO_CONTENT),
  panelFromContent(540, 1000, 'panel-allies', 'Aliados', ALLIES_CONTENT),
  panelFromContent(540, 1000, 'panel-nucleos', 'Núcleos', NUCLEOS_CONTENT),
  panelFromContent(540, 1040, 'panel-hand', 'Mano', HAND_CONTENT),
  panelFromContent(540, 1000, 'panel-leader', 'Líder', LEADER_CONTENT),
];
