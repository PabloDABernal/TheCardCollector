import type { CombatSide } from './turn';

/** GDD §2.1: "2 acciones por turno" del Líder. Constante de regla, no de contenido —
 *  mismo estatus que LEADER_SHIELD_MAX/UMBRAL_BONUS_THRESHOLD/ABILITY_BASE_COOLDOWN_MIN. */
export const LEADER_BASE_ACTIONS_PER_TURN = 2;

/** GDD §3.4: "Una acción por turno" del Enemigo. */
export const ENEMY_BASE_ACTIONS_PER_TURN = 1;

/** GDD §2.6: Combo "permite una 3ª acción" — techo de +1, no acumulable más allá en el
 *  mismo turno aunque se activen varias habilidades con keyword Combo (ver spec §0.2). */
export const COMBO_MAX_BONUS_ACTIONS_PER_TURN = 1;

export function baseActionsForSide(side: CombatSide): number {
  return side === 'LEADER' ? LEADER_BASE_ACTIONS_PER_TURN : ENEMY_BASE_ACTIONS_PER_TURN;
}

/** Snapshot de solo lectura del conteo de acciones del `turnOwner` ACTUAL — se resetea
 *  en cada END_TURN para el lado que recibe el turno (ver combat-engine.ts, handleEndTurn). */
export interface ActionsStateSnapshot {
  readonly side: CombatSide;
  readonly actionsTaken: number;
  readonly actionsAllowed: number;
  /** `true` si ya se concedió el bonus de Combo este turno (tope, ver COMBO_MAX_BONUS_ACTIONS_PER_TURN). */
  readonly comboBonusGranted: boolean;
}
