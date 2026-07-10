export type { BoardViewContext, HandCardViewData, AbilityViewData, DramaturgiaCardViewData } from './board-view-context';
export type { BoardView } from './board-view';
export { createBoardView } from './board-view';
export type { RoleView } from './role-view';
export { createLeaderRoleView, createEnemyRoleView, createScenarioRoleView } from './role-view';
// H4 spec §6 — `card-hand-view.ts`/`ability-cooldown-view.ts` ELIMINADOS (mano y habilidades del
// Líder migraron a HTML). `cardTileName` sobrevive en `tile-names.ts` (sigue haciendo falta como
// `sourceId` estable de comando). `abilityIconGroupName` RETIRADA junto a la juice recipe
// `cooldownReady` que era su único consumidor (fix Reviewer, ver `../juice/recipes/index.ts`).
export { cardTileName } from './tile-names';
// NUEVO H4.x — `allies-view.ts`/`minions-view.ts` (Phaser) ELIMINADOS (spec
// H4_targeting_habilidades_y_ficha_personaje.md §2.2): el visual real migró a
// `MinionRow.tsx`/`AllyRow.tsx` (HTML, `apps/shell`). `board-anchors-view.ts` sustituye su única
// responsabilidad restante (anclas de juice) — no se reexporta desde aquí, es interno a `board-view.ts`.
export type { NucleoTableView } from './nucleo-table-view';
export { createNucleoTable } from './nucleo-table-view';
export type { TargetingHighlightView } from './targeting-highlight-view';
export { createTargetingHighlightView } from './targeting-highlight-view';
// FIX QA (Bug 3) — feedback visual (shake/flash rojo) de rechazo puntual de un dado gastado.
export type { DieRejectionView } from './die-rejection-view';
export { createDieRejectionView } from './die-rejection-view';
export { createBoard } from './board';
export type { PanelZone } from './board-layout';
export {
  LEADER_POSITION,
  ENEMY_POSITION,
  SCENARIO_POSITION,
  HAND_ROW_POSITION,
  NUCLEO_TABLE_ROW_Y,
  ALLIES_ROW_Y,
  MINIONS_ROW_Y,
  ALLIES_ROW_X_ORIGIN,
  MINIONS_ROW_X_ORIGIN,
  TILE_SEPARATION_PX,
  LEADER_ABILITIES_ROW_Y,
  ENEMY_ABILITIES_ROW_Y,
  ABILITY_ICON_SEPARATION_PX,
  // H4 spec §2.3 — `apps/shell` (`CombatBoardOverlay.tsx`) reutiliza estas MISMAS coordenadas para
  // las etiquetas de zona y las líneas de rol, sin duplicar ningún número de posición.
  PANEL_ZONES,
} from './board-layout';
export { NUCLEO_COLOR_HEX } from './nucleo-colors';
