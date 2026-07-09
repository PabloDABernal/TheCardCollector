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
export type { CombatSceneInitData } from './scenes/CombatScene';
export type { BoardViewContext, HandCardViewData, AbilityViewData } from './view';
export type { DefaultCombatSetup } from './default-combat-setup';
// H4 spec §2.3 — `PANEL_ZONES`/`PanelZone` SÍ se reexportan (excepción puntual, mismo espíritu que
// `isAnyLeaderAbilityActivatable` abajo): `apps/shell` (`CombatBoardOverlay.tsx`) necesita las MISMAS
// coordenadas de zona que `board-layout.ts` ya calcula, para las etiquetas de zona y las líneas de
// rol de la capa HTML sincronizada — nunca duplica un número de posición.
export type { PanelZone } from './view';
export { LEADER_POSITION, ENEMY_POSITION, SCENARIO_POSITION, PANEL_ZONES } from './view';
// FIX Reviewer post-H3 (commit `cce72a3`) — `isAnyLeaderAbilityActivatable` SÍ se reexporta
// (excepción puntual a "sin detalles internos" de arriba): `apps/shell` (`CombatHud.tsx`) lo
// necesita para calcular la disponibilidad agregada de "Activar Habilidad" con el mismo criterio
// de coste por color que `gesture-command-translator.ts` (interno) ya usaba.
export { isAnyLeaderAbilityActivatable } from './interaction';
