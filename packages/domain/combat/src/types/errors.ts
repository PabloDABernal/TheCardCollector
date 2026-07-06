import type { CoreCostRequirement, NucleoColor, NucleoInstanceId, AbilityId, CardId, Result } from '@collector/domain-shared';
import type { CombatEvent } from './events';
import type { CombatSide } from './turn';

export type CombatCommandError =
  | { readonly code: 'ABILITY_COST_UNKNOWN'; readonly abilityId: AbilityId }
  | { readonly code: 'NOT_YOUR_TURN'; readonly expected: CombatSide; readonly actual: CombatSide }
  | {
      readonly code: 'ABILITY_ON_COOLDOWN';
      readonly abilityId: AbilityId;
      /** CD restante en el momento del rechazo. Siempre > 0 (si fuera 0 no se habría rechazado). */
      readonly remaining: number;
    }
  | { readonly code: 'NUCLEO_NOT_FOUND'; readonly nucleoInstanceId: NucleoInstanceId }
  | {
      readonly code: 'NUCLEO_COLOR_MISMATCH';
      readonly nucleoInstanceId: NucleoInstanceId;
      readonly requirement: CoreCostRequirement;
      readonly actualColor: NucleoColor;
    }
  | {
      /** NUEVO H1.14. GDD §2.1/§3.4: límite de acciones del turno ya alcanzado. */
      readonly code: 'NO_ACTIONS_REMAINING';
      readonly side: CombatSide;
      readonly actionsTaken: number;
      readonly actionsAllowed: number;
    }
  | {
      /** NUEVO H1.14. GDD §2.6: "no puedes repetir la misma habilidad en la misma
       *  cadena". Ver spec §0.3 — en la práctica siempre se dispara ANTES que
       *  ABILITY_ON_COOLDOWN por el nuevo orden de validación. */
      readonly code: 'ABILITY_ALREADY_ACTIVATED_THIS_TURN';
      readonly abilityId: AbilityId;
    }
  | { readonly code: 'CONTRATIEMPO_CARD_UNKNOWN'; readonly cardId: CardId }
  | {
      readonly code: 'CONTRATIEMPO_INSUFFICIENT_ENERGY';
      readonly cardId: CardId;
      readonly required: number;
      readonly available: number;
    }
  | {
      /** NUEVO H1.14. No hay turno de Enemigo previo (todavía) del que deshacer nada,
       *  o la ventana ya se cerró (ver spec §0.4). */
      readonly code: 'CONTRATIEMPO_NOTHING_TO_UNDO';
      readonly cardId: CardId;
    };

/**
 * `dispatch()` devuelve, en éxito, la lista ordenada de eventos que ese comando produjo
 * (0 o más). Esos mismos eventos también se emiten por `subscribe()` en el mismo orden —
 * ambos canales coexisten: el valor de retorno es cómodo para tests/lógica síncrona
 * inmediata, `subscribe` es el canal para consumidores desacoplados (Phaser/React vía
 * CombatBridge, architecture_stack.md §2.2-2.3).
 */
export type CombatCommandResult = Result<readonly CombatEvent[], CombatCommandError>;
