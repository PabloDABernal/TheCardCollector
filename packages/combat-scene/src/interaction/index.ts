// Barrel interno (H2.9 spec §7) — detalle interno de `CombatScene`, NO reexportado desde el
// barrel público del paquete (`src/index.ts`).
export type { GestureCommandTranslator } from './gesture-command-translator';
export { createGestureCommandTranslator } from './gesture-command-translator';

// NUEVO H4 §5.2 — `TargetingSignal`/`TargetingPrompt` SÍ se reexportan desde el barrel público
// (`src/index.ts`), a diferencia del resto de este barrel interno: `apps/shell` necesita el tipo
// para `useTargetingPrompt`/`TargetingPromptBanner`, aunque la construcción (`createTargetingSignal`)
// siga siendo un detalle interno de `gesture-command-translator.ts`.
export type { TargetingSignal, TargetingPrompt } from './targeting-signal';

// `isAnyLeaderAbilityActivatable`/`findValidDiceForAbility` SÍ se reexportan desde el barrel
// público (`src/index.ts`) — FIX Reviewer post-H3: `apps/shell` (`CombatHud.tsx`) los necesita
// para alinear su indicador de disponibilidad con la validación real de esta misma máquina de
// gestos (`handleAbilityTap`).
export { findValidDiceForAbility, isAnyLeaderAbilityActivatable } from './ability-activation';
