import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CardId, type CardInstanceId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { AllyCardDefinition } from './types/ally';

const ENEMY_ATTACK: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack');
const ENEMY_ATTACK_ARROLLAR: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack-arrollar');
const LEADER_FILLER: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-filler');
const ALLY_OWN_ABILITY: AbilityId = createId<'AbilityId'>('AbilityId', 'ally-own-ability');

const CARD_ALLY_PLAIN: CardId = createId<'CardId'>('CardId', 'card-ally-plain');
const CARD_ALLY_BERSERKER: CardId = createId<'CardId'>('CardId', 'card-ally-berserker');
const CARD_ALLY_WITH_ABILITY: CardId = createId<'CardId'>('CardId', 'card-ally-with-ability');

function costs(ids: AbilityId[]): Map<AbilityId, CoreCostRequirement> {
  return new Map(ids.map((id) => [id, { kind: 'ANY' } as CoreCostRequirement]));
}

function cooldowns(entries: [AbilityId, AbilityCooldownDefinition][]): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map(entries);
}

function effects(entries: [AbilityId, AbilityEffectDefinition][]): Map<AbilityId, AbilityEffectDefinition> {
  return new Map(entries);
}

function allyCards(entries: [CardId, AllyCardDefinition][]): Map<CardId, AllyCardDefinition> {
  return new Map(entries);
}

/** Fixture recomendada por la spec H1.15 §5: 1 habilidad ATTACK de Enemigo (sin
 *  Arrollar) + 1 variante con Arrollar; allyCards con 1 Aliado plano (life 5) y 1
 *  Berserker (life 20). */
function buildEngine(overrides: Partial<CombatEngineConfig> = {}) {
  return new CombatEngine({
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs([ENEMY_ATTACK, ENEMY_ATTACK_ARROLLAR, LEADER_FILLER]),
    abilityCooldowns: cooldowns([
      [ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_ATTACK_ARROLLAR, { side: 'ENEMY', baseCooldown: 1 }],
      [LEADER_FILLER, { side: 'LEADER', baseCooldown: 1 }],
    ]),
    abilityEffects: effects([
      [ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 6 } } }],
      [ENEMY_ATTACK_ARROLLAR, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 6 } }, arrollar: true }],
    ]),
    allyCards: allyCards([
      [CARD_ALLY_PLAIN, { energyCost: 1, life: 5, isBerserker: false }],
      [CARD_ALLY_BERSERKER, { energyCost: 2, life: 20, isBerserker: true }],
    ]),
    initialLeaderEnergy: 5,
    initialTurnOwner: 'LEADER',
    poolSize: 6,
    ...overrides,
  });
}

/** Juega un Aliado y devuelve su `CardInstanceId`. */
function playAlly(engine: CombatEngine, cardId: CardId): CardInstanceId {
  const result = engine.dispatch({ type: 'PLAY_ALLY', cardId, sourceId: 'leader' });
  expect(isOk(result)).toBe(true);
  if (!isOk(result)) throw new Error('playAlly falló');
  const entered = result.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>;
  return entered.allyInstanceId;
}

describe('CombatEngine — H1.15: Aliados en mesa (GDD §2.2/§2.5)', () => {
  it('entra en mesa sin CD en su bloqueo: PLAY_ALLY exitoso + SET_DAMAGE_REDIRECT bloquea daño sin consultar ningún cooldown del Aliado', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);

    const redirect = engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });
    expect(isOk(redirect)).toBe(true);

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const attack = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(attack)).toBe(true);

    const ally = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === allyId)!;
    expect(ally.life).toBeLessThan(5);
  });

  it('redirección no consume acción: tras PLAY_ALLY (1 acción), SET_DAMAGE_REDIRECT no cambia actionsTaken y queda acción disponible', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    const actionsAfterPlay = engine.getSnapshot().actions.actionsTaken;
    expect(actionsAfterPlay).toBe(1);

    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });
    expect(engine.getSnapshot().actions.actionsTaken).toBe(actionsAfterPlay);
    expect(engine.getSnapshot().actions.actionsTaken).toBeLessThan(engine.getSnapshot().actions.actionsAllowed);

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const activate = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: LEADER_FILLER, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(activate)).toBe(true);
  });

  it('daño mayor que la vida del Aliado, sin Arrollar: el Aliado muere y el exceso se pierde (leaderDamage no sube)', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const damaged = result.value.find((e) => e.type === 'ALLY_DAMAGED') as Extract<CombatEvent, { type: 'ALLY_DAMAGED' }>;
      expect(damaged.allyLifeAfter).toBe(0);
      expect(damaged.allyDied).toBe(true);
      expect(damaged.excess).toBe(damaged.rawAmount - 5);
      expect(damaged.appliedDamageToLeader).toBe(0);
    }
    expect(engine.getSnapshot().leaderDamage).toBe(0);
  });

  it('daño mayor que la vida del Aliado, con Arrollar: el Aliado muere y el exceso pasa al Líder', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK_ARROLLAR, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const damaged = result.value.find((e) => e.type === 'ALLY_DAMAGED') as Extract<CombatEvent, { type: 'ALLY_DAMAGED' }>;
      expect(damaged.allyLifeAfter).toBe(0);
      const expectedExcess = damaged.rawAmount - 5;
      expect(damaged.appliedDamageToLeader).toBe(expectedExcess);
      expect(engine.getSnapshot().leaderDamage).toBe(expectedExcess);
    }
  });

  it('Berserker fuerza la absorción: con Berserker y Aliado plano vivos, un Ataque golpea al Berserker aunque la redirección apunte al Aliado plano', () => {
    const engine = buildEngine();
    const plainId = playAlly(engine, CARD_ALLY_PLAIN);
    // 2ª acción del mismo turno: jugar también al Berserker.
    const berserkerId = playAlly(engine, CARD_ALLY_BERSERKER);

    const redirect = engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: plainId });
    expect(isOk(redirect)).toBe(true);
    if (isOk(redirect)) {
      const event = redirect.value[0] as Extract<CombatEvent, { type: 'DAMAGE_REDIRECT_SET' }>;
      expect(event.forcedByBerserker).toBe(true);
    }

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const damaged = result.value.find((e) => e.type === 'ALLY_DAMAGED') as Extract<CombatEvent, { type: 'ALLY_DAMAGED' }>;
      expect(damaged.allyInstanceId).toBe(berserkerId);
    }
    // El Aliado plano, redirigido "de postura" pero ignorado, no recibió daño.
    const plainAfter = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === plainId)!;
    expect(plainAfter.life).toBe(5);
  });

  it('sin Berserker ni redirección activa: el Ataque golpea al Líder exactamente como en H1.6 (LEADER_DAMAGED, no ALLY_DAMAGED)', () => {
    const engine = buildEngine();
    playAlly(engine, CARD_ALLY_PLAIN); // en mesa, pero sin redirección activa

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toContain('LEADER_DAMAGED');
      expect(result.value.some((e) => e.type === 'ALLY_DAMAGED')).toBe(false);
    }
  });

  it('objetivo de redirección inválido: CardInstanceId inexistente → REDIRECT_TARGET_NOT_FOUND', () => {
    const engine = buildEngine();
    const FAKE: CardInstanceId = createId<'CardInstanceId'>('CardInstanceId', 'fake-instance');
    const result = engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: FAKE });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('REDIRECT_TARGET_NOT_FOUND');
    }
  });

  it('objetivo de redirección inválido: Aliado ya muerto (life 0) → REDIRECT_TARGET_NOT_FOUND', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === allyId)!.life).toBe(0);

    const result = engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('REDIRECT_TARGET_NOT_FOUND');
    }
  });

  it('referencia obsoleta se limpia sola: tras un golpe letal al Aliado redirigido, un segundo Ataque golpea al Líder y activeDamageRedirectTargetId queda null', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo1.id,
    });
    expect(engine.getSnapshot().activeDamageRedirectTargetId).toBeNull();

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo2 = engine.getSnapshot().nucleoPool[0]!;
    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo2.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toContain('LEADER_DAMAGED');
    }
  });

  it('PLAY_ALLY consume acción + Energía: NO_ACTIONS_REMAINING con acciones agotadas', () => {
    const engine = buildEngine();
    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_FILLER, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo1.id });
    engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });

    const result = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NO_ACTIONS_REMAINING');
    }
  });

  it('PLAY_ALLY consume acción + Energía: ALLY_INSUFFICIENT_ENERGY con Energía insuficiente', () => {
    const engine = buildEngine({ initialLeaderEnergy: 0 });
    const result = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error as Extract<CombatCommandError, { code: 'ALLY_INSUFFICIENT_ENERGY' }>;
      expect(error.code).toBe('ALLY_INSUFFICIENT_ENERGY');
      expect(error.required).toBe(1);
      expect(error.available).toBe(0);
    }
  });

  it('PLAY_ALLY camino feliz: descuenta leaderEnergy y emite ALLY_ENTERED_PLAY con un allyInstanceId usable en comandos posteriores', () => {
    const engine = buildEngine();
    const energyBefore = engine.getSnapshot().leaderEnergy;
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    expect(engine.getSnapshot().leaderEnergy).toBe(energyBefore - 1);

    const redirect = engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });
    expect(isOk(redirect)).toBe(true);
  });

  it('PLAY_ALLY solo del Líder: con initialTurnOwner ENEMY → NOT_YOUR_TURN', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error as Extract<CombatCommandError, { code: 'NOT_YOUR_TURN' }>;
      expect(error.code).toBe('NOT_YOUR_TURN');
      expect(error.expected).toBe('LEADER');
    }
  });

  it('PLAY_ALLY de carta desconocida → ALLY_CARD_UNKNOWN', () => {
    const engine = buildEngine();
    const UNKNOWN: CardId = createId<'CardId'>('CardId', 'card-unknown');
    const result = engine.dispatch({ type: 'PLAY_ALLY', cardId: UNKNOWN, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('ALLY_CARD_UNKNOWN');
    }
  });

  it('calentamiento de habilidad propia: al jugar el Aliado, su abilityId vuelve a baseCooldown completo', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([ALLY_OWN_ABILITY]),
      abilityCooldowns: cooldowns([[ALLY_OWN_ABILITY, { side: 'LEADER', baseCooldown: 3 }]]),
      allyCards: allyCards([[CARD_ALLY_WITH_ABILITY, { energyCost: 1, life: 5, isBerserker: false, abilityIds: [ALLY_OWN_ABILITY] }]]),
      initialLeaderEnergy: 5,
      poolSize: 6,
    });
    // Recién construido, ALLY_OWN_ABILITY ya está en calentamiento completo (CD3) porque
    // aún no se ha jugado el Aliado dueño — se fuerza a un valor intermedio simulando
    // que ya bajó parcialmente, para verificar que PLAY_ALLY lo resetea a baseCooldown.
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER (tick de LEADER: CD3 -> CD2)
    const remainingBefore = engine.getSnapshot().cooldowns.find((c) => c.abilityId === ALLY_OWN_ABILITY)!.remaining;
    expect(remainingBefore).toBeLessThan(3);

    const result = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_WITH_ABILITY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const remainingAfter = engine.getSnapshot().cooldowns.find((c) => c.abilityId === ALLY_OWN_ABILITY)!.remaining;
    expect(remainingAfter).toBe(3);
  });

  it('constructor: lanza si allyCards tiene life no entero o < 1', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      allyCards: allyCards([[CARD_ALLY_PLAIN, { energyCost: 1, life: 0, isBerserker: false }]]),
    })).toThrow();
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      allyCards: allyCards([[CARD_ALLY_PLAIN, { energyCost: 1, life: 1.5, isBerserker: false }]]),
    })).toThrow();
  });

  it('constructor: lanza si allyCards tiene energyCost negativo o no entero', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      allyCards: allyCards([[CARD_ALLY_PLAIN, { energyCost: -1, life: 5, isBerserker: false }]]),
    })).toThrow();
  });

  it('constructor: lanza si abilityIds referencia un abilityId inexistente en abilityCooldowns', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      allyCards: allyCards([[CARD_ALLY_WITH_ABILITY, { energyCost: 1, life: 5, isBerserker: false, abilityIds: [ALLY_OWN_ABILITY] }]]),
    })).toThrow();
  });

  it('constructor: lanza si abilityIds referencia un abilityId con side ENEMY', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([ALLY_OWN_ABILITY]),
      abilityCooldowns: cooldowns([[ALLY_OWN_ABILITY, { side: 'ENEMY', baseCooldown: 1 }]]),
      allyCards: allyCards([[CARD_ALLY_WITH_ABILITY, { energyCost: 1, life: 5, isBerserker: false, abilityIds: [ALLY_OWN_ABILITY] }]]),
    })).toThrow();
  });

  it('muerto no desaparece del array: tras un Ataque letal, alliesInPlay sigue conteniendo la entrada con life 0', () => {
    const engine = buildEngine();
    const allyId = playAlly(engine, CARD_ALLY_PLAIN);
    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    const alliesInPlay = engine.getSnapshot().alliesInPlay;
    expect(alliesInPlay).toHaveLength(1);
    expect(alliesInPlay[0]!.life).toBe(0);
  });
});
