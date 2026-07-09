import { PLACEHOLDER_POSITIONS, CARD_HAND_POSITION } from '../juice/recipes/placeholder';

/**
 * H2.8 spec §3.1 — única fuente de verdad de coordenadas de rol. REUTILIZA exactamente
 * `PLACEHOLDER_POSITIONS` (H2.5) para que el sprite persistente de Líder/Enemigo/Escenario ocupe la
 * MISMA posición que `resolveOrCreatePlaceholder` ya asume al hacer fallback — cero desalineamiento
 * visual posible entre "el sprite real" y "donde el placeholder de emergencia aparecería si el sprite
 * faltara".
 */
export const LEADER_POSITION = PLACEHOLDER_POSITIONS.leader!; // {x:540, y:1700}
export const ENEMY_POSITION = PLACEHOLDER_POSITIONS.enemy!; // {x:540, y:300}
export const SCENARIO_POSITION = PLACEHOLDER_POSITIONS.scenario!; // {x:540, y:960}
export const HAND_ROW_POSITION = CARD_HAND_POSITION; // {x:540, y:1600} — justo sobre el Líder (y:1700)

/** RENOMBRADO H3.4 de `NUCLEO_POOL_ROW_Y` — mesa persistente de dados (ya no "pool" que se vacía).
 *  Alias `NUCLEO_POOL_ROW_Y` conservado para no romper imports existentes fuera de este cambio. */
export const NUCLEO_TABLE_ROW_Y = 1450;
export const NUCLEO_POOL_ROW_Y = NUCLEO_TABLE_ROW_Y;
export const ALLIES_ROW_Y = 1300;
export const TILE_SEPARATION_PX = 140;
/** NUEVO H3 (capa visual) — separación vertical entre un dado FIXED y sus dados EXTRA apilados del
 *  mismo color (spec H3 §5.2, "agrupación visual por color"). */
export const NUCLEO_EXTRA_DIE_STACK_OFFSET_PX = 70;

// H2.10 spec §2.3 — fila de iconos de CD de habilidad, debajo del tile de rol y su HUD de texto.
export const LEADER_ABILITIES_ROW_Y = LEADER_POSITION.y + 180;
export const ENEMY_ABILITIES_ROW_Y = ENEMY_POSITION.y + 180;

// FIX_combat_viewport_and_layout.md §2.1 — `MINIONS_ROW_Y` debe dejar hueco vertical suficiente
// contra `ENEMY_ABILITIES_ROW_Y` para que el tile de secuaz (120x180, `CARD_PLACEHOLDER_HEIGHT`,
// `juice/recipes/placeholder.ts`) no solape con el icono de habilidad del Enemigo (`ICON_HEIGHT`,
// `ability-cooldown-view.ts`). Constantes duplicadas localmente (no importadas desde `juice/` ni
// desde `ability-cooldown-view.ts`) para no crear una dependencia cruzada solo por un número —
// mismo criterio de aislamiento que ya separa esos módulos. Exportadas para que
// `board-layout.test.ts` pueda verificar los rangos verticales sin duplicar los valores.
export const MINION_TILE_HEIGHT_PX = 180; // = CARD_PLACEHOLDER_HEIGHT (juice/recipes/placeholder.ts)
export const ABILITY_ICON_HEIGHT_PX = 24; // = ICON_HEIGHT (ability-cooldown-view.ts)

// ENEMY_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX/2 + MINION_TILE_HEIGHT_PX/2 + margen de 20px
// = 480 + 12 + 90 + 20 = 602 → redondeado a 620 para dejar margen legible (no pixel-perfect al
// límite) — ver FIX_combat_viewport_and_layout.md §2.1. 620 es un valor fijado y verificado en la
// spec, no recalculado en runtime.
export const MINIONS_ROW_Y = 620;

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

// Bounds calculados centrando cada panel sobre el contenido conocido de esa fila + un margen
// (spec §2.3). Punto de partida derivado de constantes reales del código, verificado contra
// capturas reales — ver nota de implementación de la spec sobre posible solape panel-hand/panel-nucleos.
export const PANEL_ZONES: readonly PanelZone[] = [
  { id: 'panel-enemy', x: 540, y: 390, width: 1000, height: 300, label: 'Enemigo' },
  { id: 'panel-minions', x: 540, y: 620, width: 1000, height: 220, label: 'Secuaces' },
  { id: 'panel-scenario', x: 540, y: 960, width: 1000, height: 280, label: 'Escenario' },
  { id: 'panel-allies', x: 540, y: 1300, width: 1000, height: 220, label: 'Aliados' },
  { id: 'panel-nucleos', x: 540, y: 1480, width: 1000, height: 300, label: 'Núcleos' },
  { id: 'panel-hand', x: 540, y: 1600, width: 1040, height: 200, label: 'Mano' },
  { id: 'panel-leader', x: 540, y: 1790, width: 1000, height: 300, label: 'Líder' },
];
