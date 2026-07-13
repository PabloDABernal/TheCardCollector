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

// H5.2/H5.5 CORRECCIÓN 2026-07-13 — `TurnDecisionFlow`/`TurnDecisionSignal`/`TurnRevealStage`/
// `ActionCategory` RETIRADOS por completo (gating de categoría sobre-aplicado a PLAY_CARD/
// ACTIVATE_ABILITY, que ya tenían objetivo visual propio en mesa). Ver
// docs/specs/H5.2_revelacion_progresiva.md / docs/specs/H5.5_cableado_flujo_progresivo.md.
