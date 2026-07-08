import type { AbilityId, CardId, CardInstanceId, NucleoColor } from '@collector/domain-shared';
import type { NucleoInstance, NucleoDie } from './nucleo';
import type { CombatSide } from './turn';
import type { AbilityCooldownSnapshot } from './cooldown';
import type { ContratiempoUndoScope, UndoableEnemyActionLogEntry } from './contratiempo';
import type { MinionDefinitionId } from './minion';
import type { DramaturgiaCardIcon } from './enemy-ai'; // NUEVO H1.18
import type { CombatOutcome, DefeatReason } from './combat-status'; // NUEVO H1.18
import type { AlternativeVictoryCondition } from './victory-condition'; // NUEVO H1.8+H1.18

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
      /** RENOMBRADO H3.4 de `NUCLEO_POOL_ROLLED` — reroll colectivo de la mesa de dados
       *  (5 fijos + extras), emitido cuando se gasta el último dado AVAILABLE. */
      readonly type: 'NUCLEO_TABLE_REROLLED';
      readonly dice: readonly NucleoDie[];
      /** Regla GDD §2.3: quien tenga el turno en este instante "elige primero" de la mesa. */
      readonly priorityTurnOwner: CombatSide;
    }
  | {
      /** NUEVO H3.4. Un dado EXTRA se añadió a la mesa (`ADD_NUCLEO_DIE`, tope no alcanzado). */
      readonly type: 'NUCLEO_DIE_ADDED';
      readonly color: NucleoColor;
      readonly dieId: NucleoInstance['id'];
      readonly tableSizeAfter: number;
    }
  | {
      /** NUEVO H3.4. Intento de añadir dado EXTRA ignorado — la mesa ya está al tope
       *  (`tableMaxDice`). No es un error de comando (decisions.md: "se ignoran"). */
      readonly type: 'NUCLEO_DIE_ADD_SKIPPED';
      readonly color: NucleoColor;
      readonly reason: 'TABLE_AT_MAX';
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
      /** NUEVO H1.16: ausente cuando el daño viene de un ataque plano/pasivo de Secuaz
       *  (sin habilidad de catálogo detrás, ver spec H1.16 §0.2/§0.7/§4.4) — presente
       *  siempre que este evento provenga de `ACTIVATE_ABILITY`/`RESOLVE_MINION_ACTION`
       *  vía acción especial, exactamente como hasta H1.15. */
      readonly abilityId?: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      /** NUEVO H1.16: `null` cuando el daño viene de un ataque plano/pasivo de Secuaz
       *  (sin Núcleo real involucrado, ver spec H1.16 §0.2/§0.7/§4.4) — todo caller
       *  existente (H1.6-H1.15) sigue pasando un `NucleoInstance` real, nunca `null`. */
      readonly nucleoSpent: NucleoInstance | null;
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
      /** NUEVO H1.18: ausente cuando el cambio de Trama viene de una carta jugada
       *  (`PLAY_CARD` con `PlayableCardEffectDefinition.kind === 'PLOT'`, sin habilidad
       *  de catálogo detrás — ver spec H1.18 §3.5, nota de implementación) — mismo
       *  criterio ya usado por `LEADER_DAMAGED.abilityId` (H1.16). Presente siempre que
       *  este evento provenga de `ACTIVATE_ABILITY`, exactamente como hasta H1.17. */
      readonly abilityId?: AbilityId;
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
      /** NUEVO H1.16: ver comentario equivalente en `LEADER_DAMAGED`. */
      readonly abilityId?: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      /** NUEVO H1.16: ver comentario equivalente en `LEADER_DAMAGED`. */
      readonly nucleoSpent: NucleoInstance | null;
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
    }
  | {
      /** NUEVO H1.16. Único evento de un `SUMMON_MINION` exitoso. */
      readonly type: 'MINION_SUMMONED';
      readonly minionDefinitionId: MinionDefinitionId;
      readonly sourceId: string;
      readonly instanceId: CardInstanceId;
      readonly isDefensor: boolean;
    }
  | {
      /**
       * NUEVO H1.16. Emitido cuando `RESOLVE_MINION_ACTION` ejecuta la acción de un
       * Secuaz — mismo payload semántico que `ABILITY_ACTIVATED` + `LEADER_DAMAGED`/
       * `ALLY_DAMAGED`/`SCENARIO_PLOT_CHANGED` ya emitidos por el camino compartido con
       * `handleActivateAbility` (mecanismo `SPECIAL_ACTION`): no se duplica esa
       * información aquí, este evento solo señala QUÉ Secuaz fue el elegido y por qué
       * mecanismo.
       */
      readonly type: 'MINION_ACTION_RESOLVED';
      readonly instanceId: CardInstanceId;
      readonly mechanism: 'SPECIAL_ACTION' | 'PLANO_ATTACK';
    }
  | {
      /** NUEVO H1.16. `RESOLVE_MINION_ACTION` sin ningún Secuaz que actúe — no es un
       *  error. `NOT_SPECIFIED_BY_DRAMATURGIA` (NUEVO rediseño H1.16) — hay Secuaces en
       *  mesa pero la carta de Dramaturgia de este turno no menciona Secuaces (o su
       *  criterio no resolvió a ninguno). */
      readonly type: 'MINION_ACTION_SKIPPED';
      readonly reason: 'NO_MINIONS_IN_PLAY' | 'NOT_SPECIFIED_BY_DRAMATURGIA';
    }
  | {
      /** NUEVO §3.9.3. Un ataque del jugador (`PLAY_CARD`, `ATTACK_ENEMY`) golpea a un
       *  Secuaz en vez de al Enemigo — mismo patrón que `ALLY_DAMAGED`/`ENEMY_DAMAGED`. */
      readonly type: 'MINION_DAMAGED';
      readonly cardId: CardId;
      readonly sourceId: string;
      readonly nucleoSpent: NucleoInstance;
      readonly minionInstanceId: CardInstanceId;
      readonly rawAmount: number;
      readonly lifeBefore: number;
      readonly lifeAfter: number;
      readonly died: boolean;
      /** Exceso sobre la vida del Secuaz (rawAmount - lifeBefore), ANTES de decidir Arrollar. */
      readonly excess: number;
      /** `excess` si `died && effect.arrollar`, si no 0. */
      readonly appliedDamageToEnemy: number;
      readonly enemyDamageAfter: number;
    }
  | {
      /** NUEVO §3.9.3. Un Secuaz sale de mesa — sin trigger por defecto (decisions.md
       *  punto 3). `cause` deja la puerta abierta a un futuro `'ON_DEATH_EFFECT'`. */
      readonly type: 'MINION_DEFEATED';
      readonly instanceId: CardInstanceId;
      readonly definitionId: MinionDefinitionId;
      readonly cause: 'PLAYER_ATTACK';
    }
  | {
      /**
       * NUEVO H1.16. Emitido en `handleEndTurn` al aplicar la presencia pasiva (GDD
       * §3.8), SIEMPRE que el turno que empieza sea de Enemigo (aunque los montos sean 0).
       */
      readonly type: 'MINION_PASSIVE_EFFECTS_APPLIED';
      readonly minionCount: number;
      readonly attackAmount: number;
      readonly plotAmount: number;
      readonly leaderDamageAfter: number;
      readonly scenarioPlotAfter: number;
    }
  | {
      /**
       * NUEVO H1.17. Emitido cuando la fase ACTUAL de `source` (Enemigo o Escenario)
       * completa su `changeCondition` (GDD §3.4/§3.6; decisions.md "checkpoint de cambio
       * de fase"). Puede emitirse más de una vez en el mismo `dispatch()` para el mismo
       * `source` si una única mutación encadena varias transiciones (contenido de 3+
       * fases, ver spec H1.17 §0.3) y una vez más para el otro `source` si ambos cambian
       * de fase a la vez (spec §0.3, "decisión 2"). Se emite SIEMPRE que la condición se
       * cumple, incluso si el Level-Up correspondiente queda sin efecto por tope (§0.5).
       */
      readonly type: 'PHASE_CHANGED';
      readonly source: 'ENEMY' | 'SCENARIO';
      readonly fromPhaseNumber: number;
      readonly toPhaseNumber: number;
    }
  | {
      /**
       * NUEVO H1.17. Emitido inmediatamente después del `PHASE_CHANGED` que lo disparó,
       * únicamente si `levelUpsSpent < LEADER_LEVEL_UPS_MAX` en ese instante (GDD
       * §4.3/§7.3, decisions.md "contador único por run"). El `LevelUpEffectSpec`
       * concreto (`LeaderDefinition.levelUpOptions`) NO se selecciona ni aplica aquí —
       * ver spec H1.17 §0.4, fuera de alcance explícito de esta historia. Si el tope ya
       * se alcanzó, este evento simplemente no se emite (spec §0.5) — no hay variante de
       * "skipped".
       */
      readonly type: 'LEADER_LEVELED_UP';
      readonly triggeredBy: 'ENEMY' | 'SCENARIO';
      readonly levelAfter: number;
      readonly levelUpsSpentAfter: number;
    }
  | {
      /** NUEVO H1.18. Único evento "envoltorio" de un PLAY_CARD exitoso — igual rol que
       *  ABILITY_ACTIVATED para ACTIVATE_ABILITY. El efecto concreto (si lo hay) se emite
       *  inmediatamente después como ENEMY_DAMAGED | SCENARIO_PLOT_CHANGED | LEADER_SHIELD_GAINED. */
      readonly type: 'CARD_PLAYED';
      readonly cardId: CardId;
      readonly sourceId: string;
      readonly leaderEnergyAfter: number;
    }
  | {
      /** NUEVO H1.18. Análogo a LEADER_DAMAGED/ALLY_DAMAGED pero en la dirección
       *  Líder→Enemigo (§0.1/§0.2: siempre objetivo directo, nunca Secuaz). */
      readonly type: 'ENEMY_DAMAGED';
      readonly cardId: CardId;
      readonly sourceId: string;
      readonly nucleoSpent: NucleoInstance;
      readonly rawAmount: number;
      readonly bonusActivated: boolean;
      readonly bonusResolvedValue?: number;
      readonly enemyDamageAfter: number;
    }
  | {
      /** NUEVO H1.18. Keyword DEFENSA_X de carta (cierra deuda de H1.6 §0.1). */
      readonly type: 'LEADER_SHIELD_GAINED';
      readonly cardId: CardId;
      readonly sourceId: string;
      readonly rawAmount: number;
      readonly leaderShieldBefore: number;
      readonly leaderShieldAfter: number;
    }
  | {
      /** NUEVO H1.18. Robo automático de Dramaturgia al abrir el turno de Enemigo con IA
       *  activada (§0.5). */
      readonly type: 'DRAMATURGIA_CARD_DRAWN';
      readonly icon: DramaturgiaCardIcon;
    }
  | {
      /** NUEVO H1.18. Precede a un DRAMATURGIA_CARD_DRAWN cuando la pila de robo estaba
       *  vacía (§0.5.3). */
      readonly type: 'DRAMATURGIA_DECK_RESHUFFLED';
      readonly deckSize: number;
    }
  | {
      /** NUEVO H1.18. Único evento de un combate que alcanza estado terminal (§0.6). */
      readonly type: 'COMBAT_ENDED';
      readonly outcome: CombatOutcome;
      readonly defeatReason?: DefeatReason;
      /** NUEVO H1.8+H1.18. Presente solo si el desenlace vino de una
       *  `AlternativeVictoryCondition` (§4.4) en vez de la lógica por defecto. */
      readonly alternativeConditionKind?: AlternativeVictoryCondition['kind'];
    }
  | {
      /** NUEVO H3.6. Emitido tras resolver `DRAW_OR_GENERATE` — envuelve el efecto
       *  concreto (`LEADER_HAND_CARD_DRAWN`/`LEADER_HAND_DRAW_SKIPPED`/
       *  `ENERGY_GENERATED`/`ENERGY_GENERATE_SKIPPED`) ya emitido antes que este. */
      readonly type: 'FREE_STEP_RESOLVED';
      readonly action: 'draw' | 'generate';
      readonly outcome: 'APPLIED' | 'SKIPPED';
    }
  | {
      /** NUEVO H3.6. Robo exitoso (paso previo o `DRAW_CARD` pagado). */
      readonly type: 'LEADER_HAND_CARD_DRAWN';
      readonly cardId: CardId;
      readonly handSizeAfter: number;
      readonly deckRemainingAfter: number;
    }
  | {
      /** NUEVO H3.6. Robo no-op — mano llena o mazo vacío (decisions.md: "no ocurre
       *  nada, no se pierde el paso"). */
      readonly type: 'LEADER_HAND_DRAW_SKIPPED';
      readonly reason: 'HAND_FULL' | 'DECK_EMPTY';
    }
  | {
      /** NUEVO H3.6. Generar Energía exitoso — reutilizable desde el paso previo. */
      readonly type: 'ENERGY_GENERATED';
      readonly amount: number;
      readonly leaderEnergyAfter: number;
    }
  | {
      /** NUEVO H3.6. Generar Energía no-op — ya al tope. */
      readonly type: 'ENERGY_GENERATE_SKIPPED';
      readonly reason: 'ENERGY_AT_MAX';
    };
