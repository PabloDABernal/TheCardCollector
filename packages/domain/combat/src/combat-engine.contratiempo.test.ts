import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CardId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { ContratiempoCardDefinition } from './types/contratiempo';

const ENEMY_ATTACK: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack');
const ENEMY_PLOT: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot');

const CARD_DAMAGE_ONLY: CardId = createId<'CardId'>('CardId', 'card-damage-only');
const CARD_FULL_TURN: CardId = createId<'CardId'>('CardId', 'card-full-turn');

function costs(ids: AbilityId[]): Map<AbilityId, CoreCostRequirement> {
  return new Map(ids.map((id) => [id, { kind: 'ANY' } as CoreCostRequirement]));
}

function cooldowns(entries: [AbilityId, AbilityCooldownDefinition][]): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map(entries);
}

function effects(entries: [AbilityId, AbilityEffectDefinition][]): Map<AbilityId, AbilityEffectDefinition> {
  return new Map(entries);
}

function contratiempoCards(
  entries: [CardId, ContratiempoCardDefinition][]
): Map<CardId, ContratiempoCardDefinition> {
  return new Map(entries);
}

/** Fixture recomendada por la spec §5.3: Enemigo con 1 habilidad ATTACK y 1 PLOT, y
 *  contratiempoCards con 1 carta DAMAGE_ONLY y 1 FULL_TURN. */
function buildEngine(overrides: Partial<CombatEngineConfig> = {}) {
  return new CombatEngine({
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs([ENEMY_ATTACK, ENEMY_PLOT]),
    abilityCooldowns: cooldowns([
      [ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }],
    ]),
    abilityEffects: effects([
      [ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }],
      [ENEMY_PLOT, { kind: 'PLOT', amount: 3 }],
    ]),
    contratiempoCards: contratiempoCards([
      [CARD_DAMAGE_ONLY, { energyCost: 1, undoScope: 'DAMAGE_ONLY' }],
      [CARD_FULL_TURN, { energyCost: 2, undoScope: 'FULL_TURN' }],
    ]),
    initialLeaderEnergy: 5,
    initialTurnOwner: 'LEADER',
    poolSize: 6,
    ...overrides,
  });
}

describe('CombatEngine — H1.14: Contratiempo (GDD §2.7)', () => {
  it('sin turno de Enemigo previo: PLAY_CONTRATIEMPO en el primer turno de Líder es rechazado con CONTRATIEMPO_NOTHING_TO_UNDO', () => {
    const engine = buildEngine();
    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('CONTRATIEMPO_NOTHING_TO_UNDO');
    }
  });

  it('camino feliz DAMAGE_ONLY: revierte leaderDamage/leaderShield, gasta Energía, emite CONTRATIEMPO_PLAYED con 1 entrada revertida', () => {
    const engine = buildEngine();

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    const damageAfterAttack = engine.getSnapshot().leaderDamage;
    expect(damageAfterAttack).toBeGreaterThan(0);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const energyBefore = engine.getSnapshot().leaderEnergy;
    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      const played = result.value[0] as Extract<CombatEvent, { type: 'CONTRATIEMPO_PLAYED' }>;
      expect(played.undoScope).toBe('DAMAGE_ONLY');
      expect(played.revertedEntries).toHaveLength(1);
      expect(played.leaderDamageAfter).toBe(0);
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderDamage).toBe(0);
    expect(snapshot.leaderShield).toBe(0);
    expect(snapshot.leaderEnergy).toBe(energyBefore - 1);
  });

  it('camino feliz FULL_TURN con PLOT: revierte scenarioPlot Y restaura el CD de la habilidad de Enemigo usada', () => {
    const engine = buildEngine();

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    expect(engine.getSnapshot().scenarioPlot).toBe(3);
    const remainingAfterActivation = engine.getSnapshot().cooldowns.find((c) => c.abilityId === ENEMY_PLOT)!.remaining;
    expect(remainingAfterActivation).toBe(1); // baseCooldown, recién activada

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_FULL_TURN, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.scenarioPlot).toBe(0);
    // CD restaurado a su valor ANTES de la activación (calentamiento inicial, sin tick
    // adicional aplicado en este escenario mínimo).
    const restoredRemaining = snapshot.cooldowns.find((c) => c.abilityId === ENEMY_PLOT)!.remaining;
    expect(restoredRemaining).toBe(0);
  });

  it('DAMAGE_ONLY nunca toca Trama: revertir un turno de Enemigo que jugó PLOT con carta DAMAGE_ONLY no cambia scenarioPlot', () => {
    const engine = buildEngine();

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    expect(engine.getSnapshot().scenarioPlot).toBe(3);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    // scenarioPlot queda en el valor post-turno-de-Enemigo — DAMAGE_ONLY no lo revierte.
    expect(engine.getSnapshot().scenarioPlot).toBe(3);
  });

  it('no restaura el pool de Núcleos: el nucleoPool tras jugar Contratiempo es exactamente igual al de justo antes', () => {
    const engine = buildEngine();

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    // El Núcleo gastado por el Enemigo ya no está en el pool.
    expect(engine.getSnapshot().nucleoPool.find((n) => n.id === nucleo.id)).toBeUndefined();

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const poolBeforeContratiempo = engine.getSnapshot().nucleoPool;
    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const poolAfterContratiempo = engine.getSnapshot().nucleoPool;
    expect(poolAfterContratiempo).toEqual(poolBeforeContratiempo);
    // El Núcleo gastado por el Enemigo en su ataque sigue sin estar en el pool.
    expect(poolAfterContratiempo.find((n) => n.id === nucleo.id)).toBeUndefined();
  });

  it('ventana de "1 turno atrás": solo puede revertir el turno de Enemigo MÁS RECIENTE, nunca uno anterior', () => {
    const engine = buildEngine();

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY (turno de Enemigo 1)
    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo1.id });
    const damageAfterFirstAttack = engine.getSnapshot().leaderDamage;
    expect(damageAfterFirstAttack).toBeGreaterThan(0);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER (sin jugar Contratiempo)
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY (turno de Enemigo 2)
    const nucleo2 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo2.id });
    const damageAfterSecondAttack = engine.getSnapshot().leaderDamage;
    expect(damageAfterSecondAttack).toBeGreaterThan(damageAfterFirstAttack);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    // Solo se revierte el ataque del turno de Enemigo 2 (el más reciente); el daño del
    // turno de Enemigo 1 permanece — la ventana de esa activación ya se cerró.
    expect(engine.getSnapshot().leaderDamage).toBe(damageAfterFirstAttack);
  });

  it('un solo uso: tras un PLAY_CONTRATIEMPO exitoso, un segundo intento inmediato es rechazado con CONTRATIEMPO_NOTHING_TO_UNDO', () => {
    const engine = buildEngine();

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const first = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(first)).toBe(true);

    const second = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isErr(second)).toBe(true);
    if (isErr(second)) {
      expect((second.error as CombatCommandError).code).toBe('CONTRATIEMPO_NOTHING_TO_UNDO');
    }
  });

  it('energía insuficiente: initialLeaderEnergy 0 con una carta energyCost 1 → CONTRATIEMPO_INSUFFICIENT_ENERGY', () => {
    const engine = buildEngine({ initialLeaderEnergy: 0 });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error as Extract<CombatCommandError, { code: 'CONTRATIEMPO_INSUFFICIENT_ENERGY' }>;
      expect(error.code).toBe('CONTRATIEMPO_INSUFFICIENT_ENERGY');
      expect(error.required).toBe(1);
      expect(error.available).toBe(0);
    }
  });

  it('solo el Líder puede jugarlo: con initialTurnOwner ENEMY, PLAY_CONTRATIEMPO es rechazado con NOT_YOUR_TURN', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error as Extract<CombatCommandError, { code: 'NOT_YOUR_TURN' }>;
      expect(error.code).toBe('NOT_YOUR_TURN');
      expect(error.expected).toBe('LEADER');
    }
  });

  it('consume una acción: jugarlo cuando actionsTakenThisTurn === actionsAllowedThisTurn es rechazado con NO_ACTIONS_REMAINING', () => {
    const LEADER_FILLER_1: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-filler-1');
    const LEADER_FILLER_2: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-filler-2');
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([ENEMY_ATTACK, LEADER_FILLER_1, LEADER_FILLER_2]),
      abilityCooldowns: cooldowns([
        [ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 2 }],
        [LEADER_FILLER_1, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_FILLER_2, { side: 'LEADER', baseCooldown: 1 }],
      ]),
      abilityEffects: effects([[ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }]]),
      contratiempoCards: contratiempoCards([[CARD_DAMAGE_ONLY, { energyCost: 1, undoScope: 'DAMAGE_ONLY' }]]),
      initialLeaderEnergy: 5,
      poolSize: 6,
    });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    // Agota las 2 acciones del turno de Líder con habilidades de relleno.
    const n1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_FILLER_1, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n1.id });
    const n2 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_FILLER_2, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n2.id });

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NO_ACTIONS_REMAINING');
    }
  });

  it('constructor: lanza si contratiempoCards tiene energyCost negativo', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      contratiempoCards: contratiempoCards([[CARD_DAMAGE_ONLY, { energyCost: -1, undoScope: 'DAMAGE_ONLY' }]]),
    })).toThrow();
  });

  it('constructor: lanza si contratiempoCards tiene energyCost no entero', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      contratiempoCards: contratiempoCards([[CARD_DAMAGE_ONLY, { energyCost: 1.5, undoScope: 'DAMAGE_ONLY' }]]),
    })).toThrow();
  });

  it('constructor: lanza si initialLeaderEnergy está fuera de [0, 5]', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      initialLeaderEnergy: 6,
    })).toThrow();
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      initialLeaderEnergy: -1,
    })).toThrow();
  });

  it('CONTRATIEMPO_CARD_UNKNOWN: cardId no registrado en contratiempoCards', () => {
    const engine = buildEngine();
    const UNKNOWN: CardId = createId<'CardId'>('CardId', 'card-unknown');
    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: UNKNOWN, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('CONTRATIEMPO_CARD_UNKNOWN');
    }
  });
});
