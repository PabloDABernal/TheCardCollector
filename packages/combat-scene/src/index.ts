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
export type { BoardViewContext, HandCardViewData } from './view';
export type { DefaultCombatSetup } from './default-combat-setup';
