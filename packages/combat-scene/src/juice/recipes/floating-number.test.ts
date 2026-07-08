// @vitest-environment node
//
// H2.11 spec §5.1 — `floating-number.test.ts`, mismo patrón `FakeJuiceScene` que `hit-impact.test.ts`/
// `cooldown-ready.test.ts`.
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { CardInstanceId } from '@collector/domain-shared';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { floatingNumber, resolveFloatingNumberEntries } from './floating-number';
import { FOCUS_ID_ENEMY, FOCUS_ID_LEADER, FOCUS_ID_SCENARIO } from '../effects-director';
import type { JuiceTarget } from '../juice-recipe';
import type { CombatEvent } from '@collector/domain-combat';

const ALLY_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-1') as CardInstanceId;

const DAMAGE_COLOR = 0xe74c3c;
const PLOT_INCREASE_COLOR = 0xe67e22;
const PLOT_DECREASE_COLOR = 0x27ae60;

function leaderDamagedEvent(appliedDamage: number): CombatEvent {
  return {
    type: 'LEADER_DAMAGED',
    sourceId: 'enemy-ability-1',
    side: 'ENEMY',
    nucleoSpent: null,
    rawAmount: 5,
    absorbedByShield: 5 - appliedDamage,
    appliedDamage,
    leaderShieldAfter: 0,
    leaderDamageAfter: appliedDamage,
  };
}

describe('resolveFloatingNumberEntries', () => {
  it('LEADER_DAMAGED con appliedDamage > 0: 1 entrada sobre FOCUS_ID_LEADER, texto con signo, color rojo', () => {
    const entries = resolveFloatingNumberEntries(leaderDamagedEvent(4));
    expect(entries).toEqual([{ focusId: FOCUS_ID_LEADER, text: '-4', color: DAMAGE_COLOR }]);
  });

  it('LEADER_DAMAGED con appliedDamage === 0 (Escudo absorbió todo): 0 entradas', () => {
    const entries = resolveFloatingNumberEntries(leaderDamagedEvent(0));
    expect(entries).toEqual([]);
  });

  it('ENEMY_DAMAGED usa rawAmount, NUNCA bonusResolvedValue (regresión del bug ya corregido en screen-shake.ts, H2.5)', () => {
    const entries = resolveFloatingNumberEntries({
      type: 'ENEMY_DAMAGED',
      cardId: createId('CardId', 'card-1'),
      sourceId: 'leader-card-1',
      nucleoSpent: { id: createId('NucleoInstanceId', 'n1'), color: 'AGRESION', value: 5 },
      rawAmount: 5,
      bonusActivated: true,
      bonusResolvedValue: 99,
      enemyDamageAfter: 5,
    });
    expect(entries).toEqual([{ focusId: FOCUS_ID_ENEMY, text: '-5', color: DAMAGE_COLOR }]);
  });

  it('ALLY_DAMAGED sin Arrollar (appliedDamageToLeader: 0): 1 entrada sobre el Aliado, ninguna sobre el Líder', () => {
    const entries = resolveFloatingNumberEntries({
      type: 'ALLY_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: null,
      allyInstanceId: ALLY_INSTANCE_ID,
      rawAmount: 3,
      absorbedByAlly: 3,
      allyLifeBefore: 10,
      allyLifeAfter: 7,
      allyDied: false,
      excess: 0,
      appliedDamageToLeader: 0,
      leaderDamageAfter: 0,
    });
    expect(entries).toEqual([{ focusId: ALLY_INSTANCE_ID, text: '-3', color: DAMAGE_COLOR }]);
  });

  it('ALLY_DAMAGED con Arrollar (exceso > 0): 2 entradas, Aliado y Líder', () => {
    const entries = resolveFloatingNumberEntries({
      type: 'ALLY_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: null,
      allyInstanceId: ALLY_INSTANCE_ID,
      rawAmount: 7,
      absorbedByAlly: 5,
      allyLifeBefore: 5,
      allyLifeAfter: 0,
      allyDied: true,
      excess: 2,
      appliedDamageToLeader: 2,
      leaderDamageAfter: 2,
    });
    expect(entries).toEqual([
      { focusId: ALLY_INSTANCE_ID, text: '-5', color: DAMAGE_COLOR },
      { focusId: FOCUS_ID_LEADER, text: '-2', color: DAMAGE_COLOR },
    ]);
  });

  it('SCENARIO_PLOT_CHANGED con direction INCREASE: texto "+N", color naranja', () => {
    const entries = resolveFloatingNumberEntries({
      type: 'SCENARIO_PLOT_CHANGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      direction: 'INCREASE',
      rawAmount: 2,
      appliedDelta: 2,
      scenarioPlotAfter: 2,
    });
    expect(entries).toEqual([{ focusId: FOCUS_ID_SCENARIO, text: '+2', color: PLOT_INCREASE_COLOR }]);
  });

  it('SCENARIO_PLOT_CHANGED con direction DECREASE: texto "-N", color verde', () => {
    const entries = resolveFloatingNumberEntries({
      type: 'SCENARIO_PLOT_CHANGED',
      sourceId: 'leader-ability-1',
      side: 'LEADER',
      direction: 'DECREASE',
      rawAmount: 3,
      appliedDelta: -3,
      scenarioPlotAfter: 0,
    });
    expect(entries).toEqual([{ focusId: FOCUS_ID_SCENARIO, text: '-3', color: PLOT_DECREASE_COLOR }]);
  });

  it('evento sin mapeo (p.ej. TURN_ENDED): 0 entradas', () => {
    const entries = resolveFloatingNumberEntries({
      type: 'TURN_ENDED',
      previousTurnOwner: 'LEADER',
      nextTurnOwner: 'ENEMY',
      turnNumber: 1,
    });
    expect(entries).toEqual([]);
  });
});

describe('floatingNumber.play()', () => {
  it('resuelve su Promise de forma inmediata, sin esperar el onComplete del tween (spec §1.7)', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = { event: leaderDamagedEvent(4) };

    await expect(floatingNumber.play(fake.scene, target, {})).resolves.toBeUndefined();

    // El tween sigue "pendiente" (autoComplete: false, nunca se disparó completeTween) — la
    // Promise de play() ya resolvió de todos modos.
    expect(fake.recordedTweens).toHaveLength(1);
  });

  it('crea un Text por cada FloatingNumberEntry, en la posición del focusId resuelto', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = { event: leaderDamagedEvent(4) };

    await floatingNumber.play(fake.scene, target, {});

    expect(fake.recordedTexts).toHaveLength(1);
    expect(fake.recordedTexts[0]?.text).toBe('-4');
  });

  it('evento sin mapeo: ninguna llamada a scene.add.text ni scene.tweens.add', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = {
      event: {
        type: 'TURN_ENDED',
        previousTurnOwner: 'LEADER',
        nextTurnOwner: 'ENEMY',
        turnNumber: 1,
      },
    };

    await floatingNumber.play(fake.scene, target, {});

    expect(fake.recordedTexts).toHaveLength(0);
    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('ALLY_DAMAGED con Arrollar: dos Text creados, uno por entrada', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = {
      event: {
        type: 'ALLY_DAMAGED',
        sourceId: 'enemy-ability-1',
        side: 'ENEMY',
        nucleoSpent: null,
        allyInstanceId: ALLY_INSTANCE_ID,
        rawAmount: 7,
        absorbedByAlly: 5,
        allyLifeBefore: 5,
        allyLifeAfter: 0,
        allyDied: true,
        excess: 2,
        appliedDamageToLeader: 2,
        leaderDamageAfter: 2,
      },
    };

    await floatingNumber.play(fake.scene, target, {});

    expect(fake.recordedTexts).toHaveLength(2);
    expect(fake.recordedTexts.map((t) => t.text)).toEqual(['-5', '-2']);
  });
});
