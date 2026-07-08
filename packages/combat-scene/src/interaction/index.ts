// Barrel interno (H2.9 spec §7) — detalle interno de `CombatScene`, NO reexportado desde el
// barrel público del paquete (`src/index.ts`).
export type { GestureCommandTranslator } from './gesture-command-translator';
export { createGestureCommandTranslator } from './gesture-command-translator';

// `isAnyLeaderAbilityActivatable`/`findValidDiceForAbility` SÍ se reexportan desde el barrel
// público (`src/index.ts`) — FIX Reviewer post-H3: `apps/shell` (`CombatHud.tsx`) los necesita
// para alinear su indicador de disponibilidad con la validación real de esta misma máquina de
// gestos (`handleAbilityTap`).
export { findValidDiceForAbility, isAnyLeaderAbilityActivatable } from './ability-activation';
