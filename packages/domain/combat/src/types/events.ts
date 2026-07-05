import type { AbilityId } from '@collector/domain-shared';
import type { NucleoInstance } from './nucleo';
import type { CombatSide } from './turn';
import type { AbilityCooldownSnapshot } from './cooldown';

/**
 * Slice de H1.3 del union completo esbozado en architecture_stack.md §2.2. Ese
 * sketch usaba `CORE_ROLLED` (inglés, sin distinguir tirada inicial de relanzado);
 * esta historia lo cierra en términos de dominio (Núcleo, no "Core") como
 * `NUCLEO_POOL_ROLLED`, emitido únicamente en relanzados automáticos — la tirada
 * inicial al construir el motor NO emite evento (no puede haber subscriptores
 * todavía en ese instante), solo se refleja en `getSnapshot()` (ver §6.1).
 *
 * Historias futuras añaden más variantes (DAMAGE_DEALT, COOLDOWN_TICKED, PLOT_CHANGED,
 * CARD_EVOLVED, LEADER_LEVELED_UP, COMBAT_ENDED...) a este mismo union.
 */
export type CombatEvent =
  | {
      readonly type: 'NUCLEO_POOL_ROLLED';
      readonly pool: readonly NucleoInstance[];
      /** Regla GDD §2.3: quien tenga el turno en este instante "elige primero" del nuevo pool. */
      readonly priorityTurnOwner: CombatSide;
    }
  | {
      readonly type: 'ABILITY_ACTIVATED';
      readonly abilityId: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      readonly nucleoSpent: NucleoInstance;
    }
  | {
      readonly type: 'TURN_ENDED';
      readonly previousTurnOwner: CombatSide;
      readonly nextTurnOwner: CombatSide;
      readonly turnNumber: number;
    }
  | {
      readonly type: 'COOLDOWNS_TICKED';
      /**
       * El lado cuyo inicio de turno disparó este descuento — SOLO las habilidades de
       * este lado bajan CD (GDD §2.2 paso 2, "cooldowns propios"; ver §0.2 de esta spec
       * para la justificación completa frente a la lectura alternativa descartada,
       * "todas las habilidades de ambos lados en cada END_TURN").
       */
      readonly side: CombatSide;
      /**
       * Estado de CD de las habilidades de `side`, ya post-tick — subconjunto de
       * `CombatStateSnapshot.cooldowns` filtrado por `side`.
       */
      readonly cooldowns: readonly AbilityCooldownSnapshot[];
    }
  | {
      /**
       * NUEVO en H1.6. Emitido cuando una habilidad `ATTACK` (§2.1) se activa vía
       * `ACTIVATE_ABILITY` con una entrada en `abilityEffects`. Emitido SIEMPRE
       * inmediatamente después del `ABILITY_ACTIVATED` correspondiente, en el mismo
       * `dispatch()` (antes de un eventual `NUCLEO_POOL_ROLLED` si el gasto vació el
       * pool — ver §3.3).
       */
      readonly type: 'LEADER_DAMAGED';
      readonly abilityId: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      readonly nucleoSpent: NucleoInstance;
      /** `baseResolvedValue` de `resolveAbilityUmbral` — el daño ANTES de aplicar Escudo. */
      readonly rawAmount: number;
      /** Fichas de `leaderShield` consumidas por este golpe (`min(shieldAntes, rawAmount)`). */
      readonly absorbedByShield: number;
      /** Daño que realmente se sumó a `leaderDamage` (0 salvo Arrollar con exceso, ver §3.2). */
      readonly appliedDamage: number;
      readonly leaderShieldAfter: number;
      readonly leaderDamageAfter: number;
    }
  | {
      /**
       * NUEVO en H1.6. Emitido cuando una habilidad `PLOT` (§2.1) se activa vía
       * `ACTIVATE_ABILITY` con una entrada en `abilityEffects`. Mismo orden relativo
       * que `LEADER_DAMAGED` (justo después de `ABILITY_ACTIVATED`).
       */
      readonly type: 'SCENARIO_PLOT_CHANGED';
      readonly abilityId: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      /** `'INCREASE'` si `side === 'ENEMY'`, `'DECREASE'` si `side === 'LEADER'` (GDD §12). */
      readonly direction: 'INCREASE' | 'DECREASE';
      /** `AbilityEffectDefinition['amount']` de la habilidad — siempre positivo. */
      readonly rawAmount: number;
      /** `rawAmount` con signo aplicado, ANTES del piso en 0 (puede ser negativo). */
      readonly appliedDelta: number;
      /** Valor de `scenarioPlot` tras aplicar `appliedDelta` y saturar en 0. */
      readonly scenarioPlotAfter: number;
    };
