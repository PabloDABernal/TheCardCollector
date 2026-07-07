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
export const MINIONS_ROW_Y = 500;
export const TILE_SEPARATION_PX = 140;
