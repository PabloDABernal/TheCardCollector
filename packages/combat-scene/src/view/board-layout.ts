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

export const NUCLEO_POOL_ROW_Y = 1450;
export const ALLIES_ROW_Y = 1300;
export const TILE_SEPARATION_PX = 140;

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
