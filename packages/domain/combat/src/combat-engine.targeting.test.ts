import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CardId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { PlayableCardDefinition } from './types/playable-card';
import type { MinionDefinition, MinionDefinitionId } from './types/minion';

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-ability-any');
const CARD_ATTACK: CardId = createId<'CardId'>('CardId', 'card-attack');
const CARD_ATTACK_ARROLLAR: CardId = createId<'CardId'>('CardId', 'card-attack-arrollar');

const MINION_WEAK: MinionDefinitionId = 'minion-weak'; // maxLife 3
const MINION_DEFENSOR: MinionDefinitionId = 'minion-defensor';

function costs(): Map<AbilityId, CoreCostRequirement> {
  return new Map([[ABILITY_ANY, { kind: 'ANY' } as CoreCostRequirement]]);
}

function cooldowns(): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map([[ABILITY_ANY, { side: 'LEADER' as const, baseCooldown: 1 }]]);
}

function playableCards(entries: [CardId, PlayableCardDefinition][]): Map<CardId, PlayableCardDefinition> {
  return new Map(entries);
}

function minionDefinitions(entries: [MinionDefinitionId, MinionDefinition][]): Map<MinionDefinitionId, MinionDefinition> {
  return new Map(entries);
}

function buildEngine(overrides: Partial<CombatEngineConfig> = {}): CombatEngine {
  return new CombatEngine({
    leaderMaxHealth: 100,
    enemyMaxHealth: 100,
    scenarioPlotDefeatThreshold: 999,
    leaderDeckCardIds: [CARD_ATTACK, CARD_ATTACK_ARROLLAR],
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs(),
    abilityCooldowns: cooldowns(),
    playableCards: playableCards([
      [CARD_ATTACK, { energyCost: 0, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'ADD', amount: 4 } } } }],
      [CARD_ATTACK_ARROLLAR, { energyCost: 0, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'ADD', amount: 10 } }, arrollar: true } }],
    ]),
    minionDefinitions: minionDefinitions([
      [MINION_WEAK, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: false, maxLife: 3 }],
      [MINION_DEFENSOR, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true, maxLife: 5 }],
    ]),
    ...overrides,
  });
}

/** Invoca un Secuaz (turno ENEMY) y devuelve a LEADER para poder atacarlo. */
function summonAndReturnToLeader(engine: CombatEngine, minionDefinitionId: MinionDefinitionId): string {
  const before = engine.getSnapshot();
  if (before.turn.turnOwner === 'LEADER') {
    engine.dispatch({ type: 'END_TURN' }); // -> ENEMY
  }
  const result = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId, sourceId: 'enemy' });
  if (!isOk(result)) throw new Error('summon falló');
  const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_SUMMONED' }>;
  engine.dispatch({ type: 'END_TURN' }); // -> LEADER
  return event.instanceId;
}

describe('CombatEngine — §3.9: targeting explícito de ataque del jugador (ENEMY/MINION)', () => {
  it('atacar directamente al Enemigo con Secuaces vivos en mesa (sin Defensor) sigue funcionando sin bloqueo', () => {
    const engine = buildEngine();
    summonAndReturnToLeader(engine, MINION_WEAK);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id, target: { kind: 'ENEMY' },
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.some((e) => e.type === 'ENEMY_DAMAGED')).toBe(true);
    }
  });

  it('atacar a un Secuaz sin matarlo reduce su life, sin emitir MINION_DEFEATED', () => {
    const engine = buildEngine({
      playableCards: playableCards([[CARD_ATTACK, { energyCost: 0, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'ADD', amount: 1 } } } }]]),
    });
    const minionId = summonAndReturnToLeader(engine, MINION_WEAK); // maxLife 3
    const minionInstanceId = engine.getSnapshot().minionsInPlay[0]!.instanceId;
    expect(String(minionInstanceId)).toBe(minionId);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId },
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const dmg = result.value.find((e) => e.type === 'MINION_DAMAGED') as Extract<CombatEvent, { type: 'MINION_DAMAGED' }>;
      expect(dmg).toBeDefined();
      expect(dmg.died).toBe(false);
      expect(dmg.lifeAfter).toBeLessThan(3);
      expect(result.value.some((e) => e.type === 'MINION_DEFEATED')).toBe(false);
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(1);
  });

  it('atacar a un Secuaz y matarlo lo elimina de minionsInPlay, emite MINION_DEFEATED', () => {
    const engine = buildEngine();
    const minionInstanceId = engine.getSnapshot().minionsInPlay.length; // placeholder, se recalcula abajo
    void minionInstanceId;
    summonAndReturnToLeader(engine, MINION_WEAK); // maxLife 3
    const realMinionInstanceId = engine.getSnapshot().minionsInPlay[0]!.instanceId;
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id, // ADD amount 4 >= maxLife 3
      target: { kind: 'MINION', minionInstanceId: realMinionInstanceId },
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const dmg = result.value.find((e) => e.type === 'MINION_DAMAGED') as Extract<CombatEvent, { type: 'MINION_DAMAGED' }>;
      expect(dmg.died).toBe(true);
      const defeated = result.value.find((e) => e.type === 'MINION_DEFEATED') as Extract<CombatEvent, { type: 'MINION_DEFEATED' }>;
      expect(defeated).toBeDefined();
      expect(defeated.instanceId).toBe(realMinionInstanceId);
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(0);
  });

  it('exceso de daño con arrollar:true pasa a enemyDamage; sin arrollar, se pierde', () => {
    const engineArrollar = buildEngine();
    const minionInstanceId = summonAndReturnToLeader(engineArrollar, MINION_WEAK); // maxLife 3
    const nucleoArrollar = engineArrollar.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const resultArrollar = engineArrollar.dispatch({
      // ADD amount 10 → rawAmount = nucleo.value + 10, exceso >= 10 - 3 = 7+
      type: 'PLAY_CARD', cardId: CARD_ATTACK_ARROLLAR, sourceId: 'leader', nucleoInstanceId: nucleoArrollar.id,
      target: { kind: 'MINION', minionInstanceId: createId<'CardInstanceId'>('CardInstanceId', minionInstanceId) },
    });
    expect(isOk(resultArrollar)).toBe(true);
    if (isOk(resultArrollar)) {
      const dmg = resultArrollar.value.find((e) => e.type === 'MINION_DAMAGED') as Extract<CombatEvent, { type: 'MINION_DAMAGED' }>;
      expect(dmg.died).toBe(true);
      expect(dmg.appliedDamageToEnemy).toBe(dmg.excess);
      expect(dmg.appliedDamageToEnemy).toBeGreaterThan(0);
    }
    expect(engineArrollar.getSnapshot().enemyDamage).toBeGreaterThan(0);

    const engineNoArrollar = buildEngine();
    const minionInstanceId2 = summonAndReturnToLeader(engineNoArrollar, MINION_WEAK);
    const nucleo2 = engineNoArrollar.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const resultNoArrollar = engineNoArrollar.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo2.id, // sin arrollar, ADD 4
      target: { kind: 'MINION', minionInstanceId: createId<'CardInstanceId'>('CardInstanceId', minionInstanceId2) },
    });
    expect(isOk(resultNoArrollar)).toBe(true);
    if (isOk(resultNoArrollar)) {
      const dmg = resultNoArrollar.value.find((e) => e.type === 'MINION_DAMAGED') as Extract<CombatEvent, { type: 'MINION_DAMAGED' }>;
      expect(dmg.appliedDamageToEnemy).toBe(0);
    }
    expect(engineNoArrollar.getSnapshot().enemyDamage).toBe(0);
  });

  it('con Defensor vivo, atacar al Enemigo o a un Secuaz no-Defensor → MUST_TARGET_DEFENSOR', () => {
    const engine = buildEngine();
    summonAndReturnToLeader(engine, MINION_DEFENSOR);
    const weakId = summonAndReturnToLeader(engine, MINION_WEAK);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const toEnemy = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id, target: { kind: 'ENEMY' },
    });
    expect(isErr(toEnemy)).toBe(true);
    if (isErr(toEnemy)) expect((toEnemy.error as CombatCommandError).code).toBe('MUST_TARGET_DEFENSOR');

    const toNonDefensor = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: createId<'CardInstanceId'>('CardInstanceId', weakId) },
    });
    expect(isErr(toNonDefensor)).toBe(true);
    if (isErr(toNonDefensor)) expect((toNonDefensor.error as CombatCommandError).code).toBe('MUST_TARGET_DEFENSOR');
  });

  it('con Defensor vivo, atacarlo directamente SÍ funciona', () => {
    const engine = buildEngine();
    const defensorId = summonAndReturnToLeader(engine, MINION_DEFENSOR);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: createId<'CardInstanceId'>('CardInstanceId', defensorId) },
    });
    expect(isOk(result)).toBe(true);
  });

  it('target ausente en una carta ATTACK_ENEMY → PLAY_CARD_TARGET_REQUIRED', () => {
    const engine = buildEngine();
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect((result.error as CombatCommandError).code).toBe('PLAY_CARD_TARGET_REQUIRED');
  });

  it('minionInstanceId que no existe en mesa → ATTACK_TARGET_NOT_FOUND', () => {
    const engine = buildEngine();
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const fakeId = createId<'CardInstanceId'>('CardInstanceId', 'no-existe');
    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: fakeId },
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect((result.error as CombatCommandError).code).toBe('ATTACK_TARGET_NOT_FOUND');
  });

  it('SUMMON_MINION valida maxLife > 0 e inicializa life = maxLife', () => {
    const engine = buildEngine();
    const minionId = summonAndReturnToLeader(engine, MINION_WEAK);
    const minion = engine.getSnapshot().minionsInPlay.find((m) => String(m.instanceId) === minionId)!;
    expect(minion.maxLife).toBe(3);
    expect(minion.life).toBe(3);
  });
});
