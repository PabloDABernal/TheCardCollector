import type { CombatEvent } from '@collector/domain-combat';
import type { BoardViewContext } from '@collector/combat-scene';
import type { CombatLogTone } from './use-combat-log';

/** Resultado de traducir un `CombatEvent` a texto de log — sin `id`/`turnNumber` (spec §3.1: esos 2
 *  campos dependen de CUÁNDO ocurrió el evento respecto al resto del log, responsabilidad de
 *  `useCombatLog`, no de esta función pura). */
export interface TranslatedLogLine {
  readonly text: string;
  readonly tone: CombatLogTone;
}

/**
 * H4 spec §3.3 — tabla de traducción completa (39 tipos de `CombatEvent`). Función pura: no lee
 * `bridge.getSnapshot()` ni ningún estado externo salvo `ctx` (resuelto una vez al construir el
 * combate). `null` = evento no traducible a línea de log (ruido/no relevante, ver justificación
 * por bloque en la spec).
 */
export function translateCombatEvent(event: CombatEvent, ctx: BoardViewContext): TranslatedLogLine | null {
  switch (event.type) {
    case 'CARD_PLAYED':
      return { text: `Juegas «${ctx.nameLookup.cardName(event.cardId)}».`, tone: 'LEADER_ACTION' };

    case 'ENEMY_DAMAGED':
      return {
        text: `Infliges ${event.rawAmount + (event.bonusResolvedValue ?? 0)} de daño al Enemigo.`,
        tone: 'DAMAGE',
      };

    case 'LEADER_DAMAGED': {
      const amount = event.appliedDamage > 0 ? event.appliedDamage : event.rawAmount;
      const shieldSuffix = event.absorbedByShield > 0 ? ` (Escudo absorbe ${event.absorbedByShield})` : '';
      return { text: `El Enemigo inflige ${amount} de daño al Líder.${shieldSuffix}`, tone: 'DAMAGE' };
    }

    case 'MINION_DAMAGED':
      return {
        text: `Infliges ${event.rawAmount} de daño a un Secuaz enemigo${event.died ? ', que cae derrotado' : ''}.`,
        tone: 'DAMAGE',
      };

    case 'ALLY_DAMAGED':
      return {
        text: `Tu aliado recibe ${event.rawAmount} de daño${event.allyDied ? ' y cae' : ''}.`,
        tone: 'DAMAGE',
      };

    case 'ABILITY_ACTIVATED':
      return event.side === 'LEADER'
        ? { text: `Activas «${ctx.nameLookup.abilityName(event.abilityId)}».`, tone: 'LEADER_ACTION' }
        : { text: `El Enemigo activa «${ctx.nameLookup.abilityName(event.abilityId)}».`, tone: 'ENEMY_ACTION' };

    case 'DRAMATURGIA_CARD_DRAWN': {
      const name = ctx.enemyDramaturgiaDeck.find((c) => c.dramaturgiaCardId === event.cardId)?.name ?? '???';
      return { text: `El Enemigo juega «${name}».`, tone: 'ENEMY_ACTION' };
    }

    case 'MINION_SUMMONED':
      return { text: `Aparece ${ctx.nameLookup.minionName(event.minionDefinitionId)} en mesa.`, tone: 'SUMMON' };

    case 'MINION_DEFEATED':
      return { text: `${ctx.nameLookup.minionName(event.definitionId)} es derrotado.`, tone: 'SYSTEM' };

    case 'ALLY_ENTERED_PLAY':
      return { text: `Invocas a tu aliado «${ctx.nameLookup.cardName(event.cardId)}».`, tone: 'LEADER_ACTION' };

    case 'CONTRATIEMPO_PLAYED':
      return {
        text: `Juegas el Contratiempo «${ctx.nameLookup.cardName(event.cardId)}», deshaciendo la última acción del Enemigo.`,
        tone: 'LEADER_ACTION',
      };

    case 'LEADER_SHIELD_GAINED':
      return { text: `Ganas ${event.rawAmount} de Escudo.`, tone: 'HEAL' };

    case 'SCENARIO_PLOT_CHANGED':
      return event.direction === 'INCREASE'
        ? { text: `La Trama del Escenario avanza a ${event.scenarioPlotAfter}.`, tone: 'ENEMY_ACTION' }
        : { text: `Reduces la Trama del Escenario a ${event.scenarioPlotAfter}.`, tone: 'LEADER_ACTION' };

    case 'PHASE_CHANGED':
      return {
        text: `${event.source === 'ENEMY' ? 'El Enemigo' : 'El Escenario'} avanza a la fase ${event.toPhaseNumber}.`,
        tone: 'SYSTEM',
      };

    case 'LEADER_LEVELED_UP':
      return { text: `¡El Líder sube al nivel ${event.levelAfter}!`, tone: 'SYSTEM' };

    case 'TURN_ENDED':
      return {
        text: `— Turno de ${event.nextTurnOwner === 'LEADER' ? 'Líder' : 'Enemigo'} —`,
        tone: 'SYSTEM',
      };

    case 'COMBAT_ENDED':
      return event.outcome === 'VICTORY'
        ? { text: '¡Combate ganado!', tone: 'SYSTEM' }
        : { text: 'Combate perdido.', tone: 'SYSTEM' };

    // H4 spec §3.3 — resto de eventos: ruido/no relevante para el jugador, se ignoran.
    case 'NUCLEO_TABLE_REROLLED':
    case 'NUCLEO_DIE_ADDED':
    case 'NUCLEO_DIE_ADD_SKIPPED':
    case 'COOLDOWNS_TICKED':
    case 'COMBO_TRIGGERED':
    case 'DAMAGE_REDIRECT_SET':
    case 'MINION_SUMMON_SKIPPED':
    case 'MINION_ACTION_RESOLVED':
    case 'MINION_ACTION_SKIPPED':
    case 'MINION_PASSIVE_EFFECTS_APPLIED':
    case 'FREE_STEP_RESOLVED':
    case 'LEADER_HAND_CARD_DRAWN':
    case 'LEADER_HAND_DRAW_SKIPPED':
    case 'ENERGY_GENERATED':
    case 'ENERGY_GENERATE_SKIPPED':
    case 'DRAMATURGIA_DECK_RESHUFFLED':
      return null;

    default:
      return null;
  }
}
