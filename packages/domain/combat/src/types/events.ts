import type { AbilityId, CardId, CardInstanceId } from '@collector/domain-shared';
import type { NucleoInstance } from './nucleo';
import type { CombatSide } from './turn';
import type { AbilityCooldownSnapshot } from './cooldown';
import type { ContratiempoUndoScope, UndoableEnemyActionLogEntry } from './contratiempo';

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
    }
  | {
      /**
       * NUEVO H1.14. Emitido inmediatamente tras el efecto de la activación que lo
       * generó (si lo hay), como ÚLTIMO evento de ese `dispatch()` — GDD §2.6.
       */
      readonly type: 'COMBO_TRIGGERED';
      readonly abilityId: AbilityId;
      readonly side: CombatSide;
      readonly sourceId: string;
      /** `actionsAllowedThisTurn` YA con el bonus aplicado (típicamente 3). */
      readonly actionsAllowedThisTurn: number;
    }
  | {
      /** NUEVO H1.14. Único evento de un `PLAY_CONTRATIEMPO` exitoso. */
      readonly type: 'CONTRATIEMPO_PLAYED';
      readonly cardId: CardId;
      readonly sourceId: string;
      readonly undoScope: ContratiempoUndoScope;
      readonly energySpent: number;
      readonly leaderEnergyAfter: number;
      /** Entradas del turno de Enemigo efectivamente revertidas (antes de vaciar la ventana). */
      readonly revertedEntries: readonly UndoableEnemyActionLogEntry[];
      readonly leaderDamageAfter: number;
      readonly leaderShieldAfter: number;
      readonly scenarioPlotAfter: number;
    }
  | {
      /** NUEVO H1.15. Único evento de un `PLAY_ALLY` exitoso. */
      readonly type: 'ALLY_ENTERED_PLAY';
      readonly cardId: CardId;
      readonly sourceId: string;
      readonly allyInstanceId: CardInstanceId;
      readonly maxLife: number;
      readonly isBerserker: boolean;
      readonly leaderEnergyAfter: number;
    }
  | {
      /**
       * NUEVO H1.15. Emitido en vez de `LEADER_DAMAGED` cuando `resolveDamageTarget`
       * (ver spec H1.15 §0.4) resuelve un Aliado como objetivo del golpe — nunca ambos a
       * la vez para la misma activación (mismo espíritu que H1.6 "una habilidad nunca
       * hace ambas cosas" — aquí, "un golpe nunca golpea a los dos objetivos a la vez").
       */
      readonly type: 'ALLY_DAMAGED';
      readonly abilityId: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      readonly nucleoSpent: NucleoInstance;
      readonly allyInstanceId: CardInstanceId;
      readonly rawAmount: number;
      readonly absorbedByAlly: number;
      readonly allyLifeBefore: number;
      readonly allyLifeAfter: number;
      readonly allyDied: boolean;
      /** Exceso sobre la vida del Aliado (`rawAmount - absorbedByAlly`), ANTES de decidir si pasa al Líder. */
      readonly excess: number;
      /** `excess` si la habilidad tiene `arrollar: true`, si no 0 — mismo criterio que `LEADER_DAMAGED.appliedDamage`. */
      readonly appliedDamageToLeader: number;
      readonly leaderDamageAfter: number;
    }
  | {
      /** NUEVO H1.15. Único evento de un `SET_DAMAGE_REDIRECT` (siempre se acepta o falla, nunca ambos). */
      readonly type: 'DAMAGE_REDIRECT_SET';
      readonly targetAllyInstanceId: CardInstanceId | null;
      /** Informativo: `true` si en este instante hay un Berserker vivo que va a ignorar este valor en la práctica (ver spec H1.15 §0.3/§0.4). */
      readonly forcedByBerserker: boolean;
    };
