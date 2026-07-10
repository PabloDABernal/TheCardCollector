// FIX Reviewer post-H4 — `translate-combat-event.ts` no tenía ningún test propio. Cubre las 33
// variantes reales de `CombatEvent` (`packages/domain/combat/src/types/events.ts`): las 17 que
// generan línea de log (texto + tono exactos) y las 16 que la spec §3.3 marca como ruido/no
// relevante, confirmando que de verdad devuelven `null` (no generan línea).
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { AbilityId, CardId, CardInstanceId, DramaturgiaCardId, NucleoInstanceId } from '@collector/domain-shared';
import type { CombatEvent } from '@collector/domain-combat';
import type { MinionDefinitionId } from '@collector/domain-combat';
import type { BoardViewContext } from '@collector/combat-scene';
import { translateCombatEvent } from './translate-combat-event';
import type { CombatLogTone } from './use-combat-log';

const ABILITY_ID = createId<'AbilityId'>('AbilityId', 'ability-x') as AbilityId;
const CARD_ID = createId<'CardId'>('CardId', 'card-x') as CardId;
const MINION_DEFINITION_ID = createId<'MinionDefinitionId'>('MinionDefinitionId', 'minion-x') as MinionDefinitionId;
const MINION_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'minion-instance-x') as CardInstanceId;
const ALLY_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-instance-x') as CardInstanceId;
const DRAMATURGIA_CARD_ID = createId<'DramaturgiaCardId'>('DramaturgiaCardId', 'dramacard-x') as DramaturgiaCardId;
const NUCLEO_INSTANCE_ID = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-x') as NucleoInstanceId;

const nucleoSpent = { id: NUCLEO_INSTANCE_ID, color: 'CONTROL' as const, value: 3 };

function createMockContext(overrides: Partial<BoardViewContext> = {}): BoardViewContext {
  return {
    nameLookup: {
      abilityName: (id) => `ability:${id}`,
      cardName: (id) => `card:${id}`,
      minionName: (id) => `minion:${id}`,
    },
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: [],
    leaderAbilities: [],
    enemyAbilities: [],
    enemyDramaturgiaDeck: [{ dramaturgiaCardId: DRAMATURGIA_CARD_ID, name: 'Carta X', icon: 'ATTACK', keywords: [] }],
    ...overrides,
  };
}

const ctx = createMockContext();

describe('translateCombatEvent — eventos que SÍ generan línea de log (spec §3.3)', () => {
  const cases: ReadonlyArray<{ name: string; event: CombatEvent; text: string; tone: CombatLogTone }> = [
    {
      name: 'CARD_PLAYED',
      event: { type: 'CARD_PLAYED', cardId: CARD_ID, sourceId: 'src', leaderEnergyAfter: 1 },
      text: `Juegas «card:${CARD_ID}».`,
      tone: 'LEADER_ACTION',
    },
    {
      name: 'ENEMY_DAMAGED sin bonus',
      event: {
        type: 'ENEMY_DAMAGED',
        cardId: CARD_ID,
        sourceId: 'src',
        nucleoSpent,
        rawAmount: 5,
        bonusActivated: false,
        enemyDamageAfter: 5,
      },
      text: 'Infliges 5 de daño al Enemigo.',
      tone: 'DAMAGE',
    },
    {
      name: 'ENEMY_DAMAGED con bonus',
      event: {
        type: 'ENEMY_DAMAGED',
        cardId: CARD_ID,
        sourceId: 'src',
        nucleoSpent,
        rawAmount: 5,
        bonusActivated: true,
        bonusResolvedValue: 2,
        enemyDamageAfter: 7,
      },
      text: 'Infliges 7 de daño al Enemigo.',
      tone: 'DAMAGE',
    },
    {
      name: 'LEADER_DAMAGED sin escudo',
      event: {
        type: 'LEADER_DAMAGED',
        sourceId: 'src',
        side: 'ENEMY',
        nucleoSpent,
        rawAmount: 4,
        absorbedByShield: 0,
        appliedDamage: 4,
        leaderShieldAfter: 0,
        leaderDamageAfter: 4,
      },
      text: 'El Enemigo inflige 4 de daño al Líder.',
      tone: 'DAMAGE',
    },
    {
      name: 'LEADER_DAMAGED con escudo',
      event: {
        type: 'LEADER_DAMAGED',
        sourceId: 'src',
        side: 'ENEMY',
        nucleoSpent,
        rawAmount: 4,
        absorbedByShield: 2,
        appliedDamage: 2,
        leaderShieldAfter: 0,
        leaderDamageAfter: 2,
      },
      text: 'El Enemigo inflige 2 de daño al Líder. (Escudo absorbe 2)',
      tone: 'DAMAGE',
    },
    {
      name: 'MINION_DAMAGED sin muerte',
      event: {
        type: 'MINION_DAMAGED',
        cardId: CARD_ID,
        sourceId: 'src',
        nucleoSpent,
        minionInstanceId: MINION_INSTANCE_ID,
        rawAmount: 3,
        lifeBefore: 5,
        lifeAfter: 2,
        died: false,
        excess: 0,
        appliedDamageToEnemy: 0,
        enemyDamageAfter: 0,
      },
      text: 'Infliges 3 de daño a un Secuaz enemigo.',
      tone: 'DAMAGE',
    },
    {
      name: 'MINION_DAMAGED con muerte',
      event: {
        type: 'MINION_DAMAGED',
        cardId: CARD_ID,
        sourceId: 'src',
        nucleoSpent,
        minionInstanceId: MINION_INSTANCE_ID,
        rawAmount: 5,
        lifeBefore: 5,
        lifeAfter: 0,
        died: true,
        excess: 0,
        appliedDamageToEnemy: 0,
        enemyDamageAfter: 0,
      },
      text: 'Infliges 5 de daño a un Secuaz enemigo, que cae derrotado.',
      tone: 'DAMAGE',
    },
    {
      name: 'ALLY_DAMAGED sin muerte',
      event: {
        type: 'ALLY_DAMAGED',
        sourceId: 'src',
        side: 'ENEMY',
        nucleoSpent,
        allyInstanceId: ALLY_INSTANCE_ID,
        rawAmount: 3,
        absorbedByAlly: 3,
        allyLifeBefore: 5,
        allyLifeAfter: 2,
        allyDied: false,
        excess: 0,
        appliedDamageToLeader: 0,
        leaderDamageAfter: 0,
      },
      text: 'Tu aliado recibe 3 de daño.',
      tone: 'DAMAGE',
    },
    {
      name: 'ALLY_DAMAGED con muerte',
      event: {
        type: 'ALLY_DAMAGED',
        sourceId: 'src',
        side: 'ENEMY',
        nucleoSpent,
        allyInstanceId: ALLY_INSTANCE_ID,
        rawAmount: 5,
        absorbedByAlly: 5,
        allyLifeBefore: 5,
        allyLifeAfter: 0,
        allyDied: true,
        excess: 0,
        appliedDamageToLeader: 0,
        leaderDamageAfter: 0,
      },
      text: 'Tu aliado recibe 5 de daño y cae.',
      tone: 'DAMAGE',
    },
    {
      name: 'ABILITY_ACTIVATED lado LEADER',
      event: { type: 'ABILITY_ACTIVATED', abilityId: ABILITY_ID, sourceId: 'src', side: 'LEADER', nucleoSpent },
      text: `Activas «ability:${ABILITY_ID}».`,
      tone: 'LEADER_ACTION',
    },
    {
      name: 'ABILITY_ACTIVATED lado ENEMY',
      event: { type: 'ABILITY_ACTIVATED', abilityId: ABILITY_ID, sourceId: 'src', side: 'ENEMY', nucleoSpent },
      text: `El Enemigo activa «ability:${ABILITY_ID}».`,
      tone: 'ENEMY_ACTION',
    },
    {
      name: 'DRAMATURGIA_CARD_DRAWN carta conocida',
      event: { type: 'DRAMATURGIA_CARD_DRAWN', icon: 'ATTACK', cardId: DRAMATURGIA_CARD_ID },
      text: 'El Enemigo juega «Carta X».',
      tone: 'ENEMY_ACTION',
    },
    {
      name: 'MINION_SUMMONED',
      event: { type: 'MINION_SUMMONED', minionDefinitionId: MINION_DEFINITION_ID, sourceId: 'src', instanceId: MINION_INSTANCE_ID, isDefensor: false },
      text: `Aparece minion:${MINION_DEFINITION_ID} en mesa.`,
      tone: 'SUMMON',
    },
    {
      name: 'MINION_DEFEATED',
      event: { type: 'MINION_DEFEATED', instanceId: MINION_INSTANCE_ID, definitionId: MINION_DEFINITION_ID, cause: 'PLAYER_ATTACK' },
      text: `minion:${MINION_DEFINITION_ID} es derrotado.`,
      tone: 'SYSTEM',
    },
    {
      name: 'ALLY_ENTERED_PLAY',
      event: { type: 'ALLY_ENTERED_PLAY', cardId: CARD_ID, sourceId: 'src', allyInstanceId: ALLY_INSTANCE_ID, maxLife: 5, isBerserker: false, leaderEnergyAfter: 1 },
      text: `Invocas a tu aliado «card:${CARD_ID}».`,
      tone: 'LEADER_ACTION',
    },
    {
      name: 'CONTRATIEMPO_PLAYED',
      event: {
        type: 'CONTRATIEMPO_PLAYED',
        cardId: CARD_ID,
        sourceId: 'src',
        undoScope: 'FULL_TURN',
        energySpent: 1,
        leaderEnergyAfter: 0,
        revertedEntries: [],
        leaderDamageAfter: 0,
        leaderShieldAfter: 0,
        scenarioPlotAfter: 0,
      },
      text: `Juegas el Contratiempo «card:${CARD_ID}», deshaciendo la última acción del Enemigo.`,
      tone: 'LEADER_ACTION',
    },
    {
      name: 'LEADER_SHIELD_GAINED',
      event: { type: 'LEADER_SHIELD_GAINED', cardId: CARD_ID, sourceId: 'src', rawAmount: 3, leaderShieldBefore: 0, leaderShieldAfter: 3 },
      text: 'Ganas 3 de Escudo.',
      tone: 'HEAL',
    },
    {
      name: 'SCENARIO_PLOT_CHANGED INCREASE',
      event: { type: 'SCENARIO_PLOT_CHANGED', sourceId: 'src', side: 'ENEMY', direction: 'INCREASE', rawAmount: 1, appliedDelta: 1, scenarioPlotAfter: 3 },
      text: 'La Trama del Escenario avanza a 3.',
      tone: 'ENEMY_ACTION',
    },
    {
      name: 'SCENARIO_PLOT_CHANGED DECREASE',
      event: { type: 'SCENARIO_PLOT_CHANGED', sourceId: 'src', side: 'LEADER', direction: 'DECREASE', rawAmount: 1, appliedDelta: -1, scenarioPlotAfter: 2 },
      text: 'Reduces la Trama del Escenario a 2.',
      tone: 'LEADER_ACTION',
    },
    {
      name: 'PHASE_CHANGED ENEMY',
      event: { type: 'PHASE_CHANGED', source: 'ENEMY', fromPhaseNumber: 1, toPhaseNumber: 2 },
      text: 'El Enemigo avanza a la fase 2.',
      tone: 'SYSTEM',
    },
    {
      name: 'PHASE_CHANGED SCENARIO',
      event: { type: 'PHASE_CHANGED', source: 'SCENARIO', fromPhaseNumber: 1, toPhaseNumber: 2 },
      text: 'El Escenario avanza a la fase 2.',
      tone: 'SYSTEM',
    },
    {
      name: 'LEADER_LEVELED_UP',
      event: { type: 'LEADER_LEVELED_UP', triggeredBy: 'ENEMY', levelAfter: 2, levelUpsSpentAfter: 1 },
      text: '¡El Líder sube al nivel 2!',
      tone: 'SYSTEM',
    },
    {
      name: 'TURN_ENDED hacia LEADER',
      event: { type: 'TURN_ENDED', previousTurnOwner: 'ENEMY', nextTurnOwner: 'LEADER', turnNumber: 2 },
      text: '— Turno de Líder —',
      tone: 'SYSTEM',
    },
    {
      name: 'TURN_ENDED hacia ENEMY',
      event: { type: 'TURN_ENDED', previousTurnOwner: 'LEADER', nextTurnOwner: 'ENEMY', turnNumber: 1 },
      text: '— Turno de Enemigo —',
      tone: 'SYSTEM',
    },
    {
      name: 'COMBAT_ENDED VICTORY',
      event: { type: 'COMBAT_ENDED', outcome: 'VICTORY' },
      text: '¡Combate ganado!',
      tone: 'SYSTEM',
    },
    {
      name: 'COMBAT_ENDED DEFEAT',
      event: { type: 'COMBAT_ENDED', outcome: 'DEFEAT' },
      text: 'Combate perdido.',
      tone: 'SYSTEM',
    },
  ];

  it.each(cases)('$name → texto y tono correctos', ({ event, text, tone }) => {
    const result = translateCombatEvent(event, ctx);
    expect(result).toEqual({ text, tone });
  });

  it('DRAMATURGIA_CARD_DRAWN carta desconocida → nombre "???"', () => {
    const unknownCardId = createId<'DramaturgiaCardId'>('DramaturgiaCardId', 'unknown') as DramaturgiaCardId;
    const result = translateCombatEvent({ type: 'DRAMATURGIA_CARD_DRAWN', icon: 'ATTACK', cardId: unknownCardId }, ctx);
    expect(result).toEqual({ text: 'El Enemigo juega «???».', tone: 'ENEMY_ACTION' });
  });
});

describe('translateCombatEvent — eventos EXCLUIDOS del log (ruido/no relevante, spec §3.3): devuelven null', () => {
  const excludedEvents: ReadonlyArray<{ name: string; event: CombatEvent }> = [
    { name: 'NUCLEO_TABLE_REROLLED', event: { type: 'NUCLEO_TABLE_REROLLED', dice: [], priorityTurnOwner: 'LEADER' } },
    { name: 'NUCLEO_DIE_ADDED', event: { type: 'NUCLEO_DIE_ADDED', color: 'CONTROL', dieId: NUCLEO_INSTANCE_ID, tableSizeAfter: 6 } },
    { name: 'NUCLEO_DIE_ADD_SKIPPED', event: { type: 'NUCLEO_DIE_ADD_SKIPPED', color: 'CONTROL', reason: 'TABLE_AT_MAX' } },
    { name: 'COOLDOWNS_TICKED', event: { type: 'COOLDOWNS_TICKED', side: 'LEADER', cooldowns: [] } },
    { name: 'COMBO_TRIGGERED', event: { type: 'COMBO_TRIGGERED', abilityId: ABILITY_ID, side: 'LEADER', sourceId: 'src', actionsAllowedThisTurn: 3 } },
    { name: 'DAMAGE_REDIRECT_SET', event: { type: 'DAMAGE_REDIRECT_SET', targetAllyInstanceId: null, forcedByBerserker: false } },
    { name: 'MINION_SUMMON_SKIPPED', event: { type: 'MINION_SUMMON_SKIPPED', minionDefinitionId: MINION_DEFINITION_ID, sourceId: 'src', reason: 'TABLE_AT_MAX' } },
    { name: 'MINION_ACTION_RESOLVED', event: { type: 'MINION_ACTION_RESOLVED', instanceId: MINION_INSTANCE_ID, mechanism: 'PLANO_ATTACK' } },
    { name: 'MINION_ACTION_SKIPPED', event: { type: 'MINION_ACTION_SKIPPED', reason: 'NO_MINIONS_IN_PLAY' } },
    {
      name: 'MINION_PASSIVE_EFFECTS_APPLIED',
      event: { type: 'MINION_PASSIVE_EFFECTS_APPLIED', minionCount: 1, attackAmount: 1, plotAmount: 0, leaderDamageAfter: 1, scenarioPlotAfter: 0 },
    },
    { name: 'FREE_STEP_RESOLVED', event: { type: 'FREE_STEP_RESOLVED', action: 'draw', outcome: 'APPLIED' } },
    { name: 'LEADER_HAND_CARD_DRAWN', event: { type: 'LEADER_HAND_CARD_DRAWN', cardId: CARD_ID, handSizeAfter: 6, deckRemainingAfter: 10 } },
    { name: 'LEADER_HAND_DRAW_SKIPPED', event: { type: 'LEADER_HAND_DRAW_SKIPPED', reason: 'HAND_FULL' } },
    { name: 'ENERGY_GENERATED', event: { type: 'ENERGY_GENERATED', amount: 1, leaderEnergyAfter: 2 } },
    { name: 'ENERGY_GENERATE_SKIPPED', event: { type: 'ENERGY_GENERATE_SKIPPED', reason: 'ENERGY_AT_MAX' } },
    { name: 'DRAMATURGIA_DECK_RESHUFFLED', event: { type: 'DRAMATURGIA_DECK_RESHUFFLED', deckSize: 5 } },
  ];

  it.each(excludedEvents)('$name → null (no genera línea de log)', ({ event }) => {
    expect(translateCombatEvent(event, ctx)).toBeNull();
  });
});
