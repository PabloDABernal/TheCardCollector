import type { CoreCostRequirement, NucleoColor, NucleoInstanceId, AbilityId, CardId, CardInstanceId, Result } from '@collector/domain-shared';
import type { CombatEvent } from './events';
import type { CombatSide } from './turn';
import type { MinionDefinitionId } from './minion';
import type { CombatOutcome } from './combat-status'; // NUEVO H1.18

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
    }
  | { readonly code: 'ALLY_CARD_UNKNOWN'; readonly cardId: CardId }
  | {
      readonly code: 'ALLY_INSUFFICIENT_ENERGY';
      readonly cardId: CardId;
      readonly required: number;
      readonly available: number;
    }
  | {
      /** NUEVO H1.15. `targetAllyInstanceId` no corresponde a ningún Aliado vivo en mesa ahora mismo. */
      readonly code: 'REDIRECT_TARGET_NOT_FOUND';
      readonly targetAllyInstanceId: CardInstanceId;
    }
  | {
      /** NUEVO H1.16. `minionDefinitionId` no existe en `CombatEngineConfig.minionDefinitions`. */
      readonly code: 'MINION_DEFINITION_UNKNOWN';
      readonly minionDefinitionId: MinionDefinitionId;
    }
  | {
      /** NUEVO H1.16. `RESOLVE_MINION_ACTION` ya se despachó con éxito este turno de
       *  Enemigo (contador propio `minionActionResolvedThisEnemyTurn`, ver spec H1.16 §0.3). */
      readonly code: 'MINION_ACTION_ALREADY_RESOLVED_THIS_TURN';
    }
  | { readonly code: 'PLAY_CARD_UNKNOWN'; readonly cardId: CardId }
  | {
      /** NUEVO H1.18. `PLAY_CARD` no tiene Energía suficiente para pagar `energyCost`. */
      readonly code: 'PLAY_CARD_INSUFFICIENT_ENERGY';
      readonly cardId: CardId;
      readonly required: number;
      readonly available: number;
    }
  | {
      /** NUEVO H1.18. La carta tiene efecto ATTACK_ENEMY pero el comando no incluyó
       *  nucleoInstanceId (ver spec H1.18 §0.1.1/§2.3). */
      readonly code: 'PLAY_CARD_NUCLEO_REQUIRED';
      readonly cardId: CardId;
    }
  | {
      /** NUEVO H1.18. `dispatch()` rechaza cualquier comando una vez `status !== 'IN_PROGRESS'`. */
      readonly code: 'COMBAT_ALREADY_ENDED';
      readonly status: CombatOutcome;
    }
  | {
      /** NUEVO H3.4. El dado existe en `nucleoTable` pero ya está `SPENT` — no puede
       *  volver a gastarse hasta el próximo reroll colectivo. */
      readonly code: 'NUCLEO_ALREADY_SPENT';
      readonly nucleoInstanceId: NucleoInstanceId;
    }
  | {
      /** NUEVO H3.6. `PLAY_CARD`/`PLAY_ALLY`/`PLAY_CONTRATIEMPO` con un `cardId` que no
       *  está en `leaderHand`. */
      readonly code: 'CARD_NOT_IN_HAND';
      readonly cardId: CardId;
    }
  | {
      /** NUEVO H3.6. `DRAW_OR_GENERATE` ya se despachó con éxito este turno de Líder. */
      readonly code: 'FREE_STEP_ALREADY_TAKEN';
    }
  | {
      /** NUEVO §3.9.3. `PLAY_CARD` con `effect.kind === 'ATTACK_ENEMY'` sin `target`. */
      readonly code: 'PLAY_CARD_TARGET_REQUIRED';
      readonly cardId: CardId;
    }
  | {
      /** NUEVO §3.9.3. `target.kind === 'MINION'` con `minionInstanceId` que no existe
       *  en `minionsInPlay` ahora mismo. */
      readonly code: 'ATTACK_TARGET_NOT_FOUND';
      readonly minionInstanceId: CardInstanceId;
    }
  | {
      /** NUEVO §3.9.3. Hay ≥1 Secuaz Defensor vivo y el `target` elegido no es uno de
       *  ellos. */
      readonly code: 'MUST_TARGET_DEFENSOR';
      readonly cardId: CardId;
      readonly defensorInstanceIds: readonly CardInstanceId[];
    };

/**
 * `dispatch()` devuelve, en éxito, la lista ordenada de eventos que ese comando produjo
 * (0 o más). Esos mismos eventos también se emiten por `subscribe()` en el mismo orden —
 * ambos canales coexisten: el valor de retorno es cómodo para tests/lógica síncrona
 * inmediata, `subscribe` es el canal para consumidores desacoplados (Phaser/React vía
 * CombatBridge, architecture_stack.md §2.2-2.3).
 */
export type CombatCommandResult = Result<readonly CombatEvent[], CombatCommandError>;
