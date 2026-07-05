import type { CoreCostRequirement, NucleoColor, NucleoInstanceId, AbilityId, Result } from '@collector/domain-shared';
import type { CombatEvent } from './events';
import type { CombatSide } from './turn';

export type CombatCommandError =
  | { readonly code: 'ABILITY_COST_UNKNOWN'; readonly abilityId: AbilityId }
  | { readonly code: 'NOT_YOUR_TURN'; readonly expected: CombatSide; readonly actual: CombatSide }
  | { readonly code: 'NUCLEO_NOT_FOUND'; readonly nucleoInstanceId: NucleoInstanceId }
  | {
      readonly code: 'NUCLEO_COLOR_MISMATCH';
      readonly nucleoInstanceId: NucleoInstanceId;
      readonly requirement: CoreCostRequirement;
      readonly actualColor: NucleoColor;
    };

/**
 * `dispatch()` devuelve, en éxito, la lista ordenada de eventos que ese comando produjo
 * (0 o más). Esos mismos eventos también se emiten por `subscribe()` en el mismo orden —
 * ambos canales coexisten: el valor de retorno es cómodo para tests/lógica síncrona
 * inmediata, `subscribe` es el canal para consumidores desacoplados (Phaser/React vía
 * CombatBridge, architecture_stack.md §2.2-2.3).
 */
export type CombatCommandResult = Result<readonly CombatEvent[], CombatCommandError>;
