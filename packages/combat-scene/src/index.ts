// packages/combat-scene/src/index.ts — barrel público de librería (NUEVO H2.9, spec §2.2).
//
// Hasta H2.8, ningún paquete importaba `@collector/combat-scene` como dependencia — su único
// consumidor era su propio harness (`index.html` → `/src/main.ts` directamente, sin pasar por
// `package.json#main`) y sus propios tests. `apps/shell` es el primer consumidor real y solo
// necesita, por nombre de paquete: `CombatScene`, `COMBAT_SCENE_VIEWPORT`, `CombatSceneInitData`,
// `BoardViewContext`, `HandCardViewData`, `DefaultCombatSetup`.
//
// No se reexporta `createInputAdapter`/`createBoardView`/`createEffectsDirector`/el traductor de
// gestos — son detalles internos que `CombatScene` ya orquesta; `apps/shell` nunca necesita
// tocarlos directamente (spec §0.1).
export { CombatScene, COMBAT_SCENE_VIEWPORT } from './scenes/CombatScene';
export type { CombatSceneInitData, GestureCommandTranslatorHandle } from './scenes/CombatScene';
export type { BoardViewContext, HandCardViewData, AbilityViewData, DramaturgiaCardViewData } from './view';
export { cardTileName } from './view';
export type { DefaultCombatSetup } from './default-combat-setup';
// NUEVO H4 spec §5/§6.1 — `apps/shell` necesita estos 2 tipos para `useTargetingPrompt`/
// `TargetingPromptBanner`/`HandCardRow`/`AbilityRow`: `TargetingSignal`/`TargetingPrompt` (lectura de
// estado de targeting, expuesta por `CombatScene.getTargetingSignal()` tras `READY`) y
// `GestureCommandTranslatorHandle` (superficie reducida de `handleCardTap`/`handleAbilityTap`/
// `cancelPending`, expuesta por `CombatScene.getGestureCommandTranslator()`).
export type { TargetingSignal, TargetingPrompt } from './interaction';
// NUEVO H5.2/H5.5 — `apps/shell` necesita estos 4 tipos para `useTurnRevealStage`/`CombatHud`/
// `CombatBoardOverlay` (revelación progresiva de decisiones de turno).
export type { TurnDecisionFlow, TurnDecisionSignal, TurnRevealStage, ActionCategory } from './interaction';
// H4 spec §2.3 — `PANEL_ZONES`/`PanelZone` SÍ se reexportan (excepción puntual, mismo espíritu que
// `isAnyLeaderAbilityActivatable` abajo): `apps/shell` (`CombatBoardOverlay.tsx`) necesita las MISMAS
// coordenadas de zona que `board-layout.ts` ya calcula, para las etiquetas de zona y las líneas de
// rol de la capa HTML sincronizada — nunca duplica un número de posición.
export type { PanelZone } from './view';
export { LEADER_POSITION, ENEMY_POSITION, SCENARIO_POSITION, PANEL_ZONES } from './view';
// NUEVO H4 spec §6 — `HandCardRow.tsx`/`AbilityRow.tsx` (apps/shell) reutilizan literalmente estas
// coordenadas para posicionar `CardTile`/`AbilityTile` HTML — mismo criterio que `PANEL_ZONES`
// arriba, nunca duplicar un número de posición.
export {
  HAND_ROW_POSITION,
  TILE_SEPARATION_PX,
  LEADER_ABILITIES_ROW_Y,
  ENEMY_ABILITIES_ROW_Y,
  ABILITY_ICON_SEPARATION_PX,
  // NUEVO H4.x — `MinionRow.tsx`/`AllyRow.tsx` (apps/shell) reutilizan estas coordenadas, mismo
  // criterio de no duplicar posición (sustituye a `minions-view.ts`/`allies-view.ts`, eliminados).
  MINIONS_ROW_Y,
  ALLIES_ROW_Y,
  MINIONS_ROW_X_ORIGIN,
  ALLIES_ROW_X_ORIGIN,
  // NUEVO H5.1 §1/§7 — ancla raíz de la mesa de Núcleos, reutilizada por H5.5.
  NUCLEO_TABLE_CENTER_Y,
} from './view';
// FIX Reviewer post-H3 (commit `cce72a3`) — `isAnyLeaderAbilityActivatable` SÍ se reexporta
// (excepción puntual a "sin detalles internos" de arriba): `apps/shell` (`CombatHud.tsx`) lo
// necesita para calcular la disponibilidad agregada de "Activar Habilidad" con el mismo criterio
// de coste por color que `gesture-command-translator.ts` (interno) ya usaba.
export { isAnyLeaderAbilityActivatable } from './interaction';
