/** GDD §4.3/§7.3: "3 niveles: inicial + máximo 2 subidas". */
export const LEADER_LEVEL_BASE = 1;
export const LEADER_LEVEL_UPS_MAX = 2;
export const LEADER_LEVEL_MAX = LEADER_LEVEL_BASE + LEADER_LEVEL_UPS_MAX; // 3

/**
 * NUEVO H1.17. `level` se deriva SIEMPRE de `levelUpsSpent` (`LEADER_LEVEL_BASE +
 * levelUpsSpent`) — nunca estado independiente, ver spec H1.17 §0.6. Contador único por
 * run (decisions.md): comparte el mismo `levelUpsSpent` los Level-Up ganados dentro de
 * combate (esta historia, checkpoint de fase) y los ganados en descanso (H1.18/GDD §7.3)
 * — un futuro `CombatEngine` que reciba `initialLeaderLevelUpsSpent` no en 0 refleja
 * niveles ya ganados en un combate anterior de la misma run.
 */
export interface LeaderState {
  readonly level: number; // LEADER_LEVEL_BASE..LEADER_LEVEL_MAX (1-3)
  readonly levelUpsSpent: number; // 0..LEADER_LEVEL_UPS_MAX (0-2)
}
