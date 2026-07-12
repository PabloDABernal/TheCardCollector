// @vitest-environment node
//
// H5.3 spec §5 — casos de test de `big-moment-classifier.test.ts`. Mismo criterio de aislamiento que
// `effects-director.test.ts`: `CombatBridge`/`BoardViewContext` fakes mínimos, sin `CombatEngine` real.
import { describe, it, expect } from 'vitest';
import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { createId } from '@collector/domain-shared';
import type { CardInstanceId, NucleoInstanceId } from '@collector/domain-shared';
import type { BoardViewContext } from '../view';
import { createBigMomentClassifier } from './big-moment-classifier';

const NUCLEO_ID = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-1') as NucleoInstanceId;
const MINION_ID = createId<'CardInstanceId'>('CardInstanceId', 'minion-1') as CardInstanceId;
const ALLY_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-1') as CardInstanceId;

function createCtx(overrides: Partial<BoardViewContext> = {}): BoardViewContext {
  return {
    leaderMaxHealth: 20,
    enemyMaxHealth: 20,
    scenarioPlotDefeatThreshold: 10,
    ...overrides,
  } as BoardViewContext;
}

function createBridge(snapshotOverrides: Partial<CombatStateSnapshot> = {}): CombatBridge {
  const snapshot = { minionsInPlay: [], alliesInPlay: [], ...snapshotOverrides } as unknown as CombatStateSnapshot;
  return { getSnapshot: () => snapshot } as unknown as CombatBridge;
}

describe('createBigMomentClassifier (H5.3 §5)', () => {
  it('1. ABILITY_ACTIVATED/PHASE_CHANGED/MINION_DEFEATED siempre false (fuera de TRAMA_O_VIDA_EVENT_TYPES)', () => {
    const classifier = createBigMomentClassifier(createCtx(), createBridge());

    const abilityActivated: CombatEvent = {
      type: 'ABILITY_ACTIVATED',
      abilityId: createId('AbilityId', 'ability-1'),
      sourceId: 'leader',
      side: 'LEADER',
      nucleoSpent: { id: NUCLEO_ID, color: 'AGRESION', value: 3 },
    };
    const phaseChanged: CombatEvent = { type: 'PHASE_CHANGED', source: 'ENEMY', fromPhaseNumber: 1, toPhaseNumber: 2 };
    const minionDefeated: CombatEvent = {
      type: 'MINION_DEFEATED',
      instanceId: MINION_ID,
      definitionId: 'minion-def-1',
      cause: 'PLAYER_ATTACK',
    };

    expect(classifier.classify(abilityActivated)).toBe(false);
    expect(classifier.classify(phaseChanged)).toBe(false);
    expect(classifier.classify(minionDefeated)).toBe(false);
  });

  it('2. SCENARIO_PLOT_CHANGED que cruza el umbral de derrota → true; sin cruzarlo → false', () => {
    const classifier = createBigMomentClassifier(createCtx({ scenarioPlotDefeatThreshold: 10 }), createBridge());

    const crossing: CombatEvent = {
      type: 'SCENARIO_PLOT_CHANGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      direction: 'INCREASE',
      rawAmount: 3,
      appliedDelta: 3,
      scenarioPlotAfter: 11, // before = 11-3 = 8 < 10 <= 11
    };
    const notCrossing: CombatEvent = {
      ...crossing,
      appliedDelta: 1,
      scenarioPlotAfter: 3, // before = 3-1 = 2, ambos por debajo de 10
    };

    expect(classifier.classify(crossing)).toBe(true);
    expect(classifier.classify(notCrossing)).toBe(false);
  });

  it('3. LEADER_DAMAGED que cruza 0.3 (35%→25%) → true; que no cruza ningún umbral (60%→40%) → false', () => {
    const classifier = createBigMomentClassifier(createCtx({ leaderMaxHealth: 20 }), createBridge());

    // 35% de 20 = 7 (damage before), 25% de 20 = 5 (damage after) — vida restante baja de 65% a 75%?
    // Se construye directamente desde leaderDamageAfter/appliedDamage: queremos before=0.35, after=0.25.
    // leaderDamageAfter = (1-after)*max = 0.75*20=15; appliedDamage tal que before=(1-(15-applied)/20)=0.35
    // => (15-applied)/20 = 0.65 => 15-applied=13 => applied=2.
    const crossing: CombatEvent = {
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: { id: NUCLEO_ID, color: 'AGRESION', value: 2 },
      rawAmount: 2,
      absorbedByShield: 0,
      appliedDamage: 2,
      leaderShieldAfter: 0,
      leaderDamageAfter: 15,
    };
    // before=60%→after=40%: leaderDamageAfter=(1-0.4)*20=12, applied tal que (12-applied)/20=0.4 => applied=4
    const notCrossing: CombatEvent = { ...crossing, appliedDamage: 4, leaderDamageAfter: 12 };

    expect(classifier.classify(crossing)).toBe(true);
    expect(classifier.classify(notCrossing)).toBe(false);
  });

  it('4. ENEMY_DAMAGED análogo a (3)', () => {
    const classifier = createBigMomentClassifier(createCtx({ enemyMaxHealth: 20 }), createBridge());

    const crossing: CombatEvent = {
      type: 'ENEMY_DAMAGED',
      sourceId: 'card-1',
      nucleoSpent: { id: NUCLEO_ID, color: 'AGRESION', value: 2 },
      rawAmount: 2,
      bonusActivated: false,
      enemyDamageAfter: 15, // before=(15-2)/20=0.65 → after=0.75 remaining=0.25, cruza 0.3
    };
    const notCrossing: CombatEvent = { ...crossing, rawAmount: 4, enemyDamageAfter: 12 };

    expect(classifier.classify(crossing)).toBe(true);
    expect(classifier.classify(notCrossing)).toBe(false);
  });

  it('5. MINION_DAMAGED/ALLY_DAMAGED usando lifeBefore/lifeAfter directos — cruce de 0.1 → true', () => {
    const bridge = createBridge({
      minionsInPlay: [{ instanceId: MINION_ID, maxLife: 10 } as CombatStateSnapshot['minionsInPlay'][number]],
      alliesInPlay: [{ instanceId: ALLY_ID, maxLife: 10 } as CombatStateSnapshot['alliesInPlay'][number]],
    });
    const classifier = createBigMomentClassifier(createCtx(), bridge);

    const minionDamaged: CombatEvent = {
      type: 'MINION_DAMAGED',
      sourceId: 'card-1',
      nucleoSpent: { id: NUCLEO_ID, color: 'AGRESION', value: 2 },
      minionInstanceId: MINION_ID,
      rawAmount: 2,
      lifeBefore: 2, // 20%
      lifeAfter: 0, // 0%, cruza 0.1
      died: true,
      excess: 0,
      appliedDamageToEnemy: 0,
      enemyDamageAfter: 0,
    };
    const allyDamaged: CombatEvent = {
      type: 'ALLY_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: { id: NUCLEO_ID, color: 'AGRESION', value: 2 },
      allyInstanceId: ALLY_ID,
      rawAmount: 2,
      absorbedByAlly: 2,
      allyLifeBefore: 2,
      allyLifeAfter: 0,
      allyDied: true,
      excess: 0,
      appliedDamageToLeader: 0,
      leaderDamageAfter: 0,
    };

    expect(classifier.classify(minionDamaged)).toBe(true);
    expect(classifier.classify(allyDamaged)).toBe(true);
  });

  it('6. evento fuera de TRAMA_O_VIDA_EVENT_TYPES (ENERGY_GENERATED) siempre false', () => {
    const classifier = createBigMomentClassifier(createCtx(), createBridge());
    const event: CombatEvent = { type: 'ENERGY_GENERATED', amount: 1, leaderEnergyAfter: 2 };

    expect(classifier.classify(event)).toBe(false);
  });
});
