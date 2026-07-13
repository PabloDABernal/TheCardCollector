// Barrel interno (H2.9 spec §7) — detalle interno de `CombatScene`, NO reexportado desde el
// barrel público del paquete (`src/index.ts`).
export type { GestureCommandTranslator } from './gesture-command-translator';
export { createGestureCommandTranslator } from './gesture-command-translator';

// NUEVO H4 §5.2 — `TargetingSignal`/`TargetingPrompt` SÍ se reexportan desde el barrel público
// (`src/index.ts`), a diferencia del resto de este barrel interno: `apps/shell` necesita el tipo
// para `useTargetingPrompt`/`TargetingPromptBanner`, aunque la construcción (`createTargetingSignal`)
// siga siendo un detalle interno de `gesture-command-translator.ts`.
export type { TargetingSignal, TargetingPrompt } from './targeting-signal';

// FIX QA (Bug 3) — `RejectionSignal` es un detalle interno de `CombatScene` (conecta
// `gesture-command-translator.ts` con `view/die-rejection-view.ts`, ambos dentro de este paquete):
// a diferencia de `TargetingSignal`, `apps/shell` nunca lo necesita, así que NO se reexporta desde
// el barrel público (`src/index.ts`) — mismo criterio que el resto de este barrel interno.
export type { RejectionSignal, DieRejectionEvent } from './rejection-signal';

// `isAnyLeaderAbilityActivatable`/`findValidDiceForAbility` SÍ se reexportan desde el barrel
// público (`src/index.ts`) — FIX Reviewer post-H3: `apps/shell` (`CombatHud.tsx`) los necesita
// para alinear su indicador de disponibilidad con la validación real de esta misma máquina de
// gestos (`handleAbilityTap`).
export { findValidDiceForAbility, isAnyLeaderAbilityActivatable } from './ability-activation';

// NUEVO H5.2 §1/§6 — `TurnDecisionFlow`/`TurnDecisionSignal`/`TurnRevealStage`/`ActionCategory` SÍ se
// reexportan desde el barrel público (`src/index.ts`): `apps/shell` necesita los tipos para
// `useTurnRevealStage`/`CombatHud`/`CombatBoardOverlay` (H5.5), aunque la construcción
// (`createTurnDecisionFlow`) siga siendo un detalle interno de `CombatScene.create()`.
export type { TurnDecisionFlow, TurnDecisionSignal, TurnRevealStage, ActionCategory, TurnDecisionFlowDeps } from './turn-decision-flow';
export { createTurnDecisionFlow } from './turn-decision-flow';
