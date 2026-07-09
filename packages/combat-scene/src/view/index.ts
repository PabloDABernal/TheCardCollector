export type { BoardViewContext, HandCardViewData, AbilityViewData } from './board-view-context';
export type { BoardView } from './board-view';
export { createBoardView } from './board-view';
export type { RoleView } from './role-view';
export { createLeaderRoleView, createEnemyRoleView, createScenarioRoleView } from './role-view';
export type { CardHandView } from './card-hand-view';
export { cardTileName, createCardHandView } from './card-hand-view';
export type { AlliesView } from './allies-view';
export { createAlliesView } from './allies-view';
export type { MinionsView } from './minions-view';
export { createMinionsView } from './minions-view';
export type { NucleoTableView } from './nucleo-table-view';
export { createNucleoTable } from './nucleo-table-view';
export type { AbilityCooldownView } from './ability-cooldown-view';
export { createAbilityCooldownView, abilityIconGroupName } from './ability-cooldown-view';
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
  TILE_SEPARATION_PX,
  LEADER_ABILITIES_ROW_Y,
  ENEMY_ABILITIES_ROW_Y,
  ABILITY_ICON_SEPARATION_PX,
  // H4 spec §2.3 — `apps/shell` (`CombatBoardOverlay.tsx`) reutiliza estas MISMAS coordenadas para
  // las etiquetas de zona y las líneas de rol, sin duplicar ningún número de posición.
  PANEL_ZONES,
} from './board-layout';
export { NUCLEO_COLOR_HEX } from './nucleo-colors';
