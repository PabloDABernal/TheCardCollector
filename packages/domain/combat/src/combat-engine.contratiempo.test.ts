import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CardId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { ContratiempoCardDefinition } from './types/contratiempo';
import type { AllyCardDefinition } from './types/ally';
import type { MinionDefinition, MinionDefinitionId } from './types/minion'; // NUEVO H1.16

const ENEMY_ATTACK: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack');
const ENEMY_ATTACK_ARROLLAR: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack-arrollar');
const ENEMY_PLOT: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot');
const ENEMY_MINION_PLOT: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-minion-plot'); // NUEVO H1.16

const CARD_DAMAGE_ONLY: CardId = createId<'CardId'>('CardId', 'card-damage-only');
const CARD_FULL_TURN: CardId = createId<'CardId'>('CardId', 'card-full-turn');
const CARD_ALLY_PLAIN: CardId = createId<'CardId'>('CardId', 'card-ally-plain'); // NUEVO H1.15

// NUEVO H1.16
const MINION_PLANO: MinionDefinitionId = 'minion-plano';
const MINION_PLOT_SPECIAL: MinionDefinitionId = 'minion-plot-special';
const MINION_PASSIVE_ATTACK: MinionDefinitionId = 'minion-passive-attack';

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

function allyCards(entries: [CardId, AllyCardDefinition][]): Map<CardId, AllyCardDefinition> {
  return new Map(entries);
}

// NUEVO H1.16
function minionDefinitions(
  entries: [MinionDefinitionId, MinionDefinition][]
): Map<MinionDefinitionId, MinionDefinition> {
  return new Map(entries);
}

/** Fixture recomendada por la spec §5.3: Enemigo con 1 habilidad ATTACK y 1 PLOT, y
 *  contratiempoCards con 1 carta DAMAGE_ONLY y 1 FULL_TURN. Extendida en H1.15 con una
 *  habilidad ATTACK con Arrollar y una carta ALIADO (ver spec H1.15 §5.4). */
function buildEngine(overrides: Partial<CombatEngineConfig> = {}) {
  return new CombatEngine({
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs([ENEMY_ATTACK, ENEMY_ATTACK_ARROLLAR, ENEMY_PLOT, ENEMY_MINION_PLOT]),
    abilityCooldowns: cooldowns([
      [ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_ATTACK_ARROLLAR, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_MINION_PLOT, { side: 'ENEMY', baseCooldown: 1 }], // NUEVO H1.16
    ]),
    abilityEffects: effects([
      [ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }],
      [ENEMY_ATTACK_ARROLLAR, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 6 } }, arrollar: true }],
      [ENEMY_PLOT, { kind: 'PLOT', amount: 3 }],
      [ENEMY_MINION_PLOT, { kind: 'PLOT', amount: 2 }], // NUEVO H1.16
    ]),
    contratiempoCards: contratiempoCards([
      [CARD_DAMAGE_ONLY, { energyCost: 1, undoScope: 'DAMAGE_ONLY' }],
      [CARD_FULL_TURN, { energyCost: 2, undoScope: 'FULL_TURN' }],
    ]),
    allyCards: allyCards([[CARD_ALLY_PLAIN, { energyCost: 1, life: 5, isBerserker: false }]]),
    // NUEVO H1.16 — ver spec H1.16 §6.4: fixture para probar la 2ª fuente de mutación
    // ATTACK/PLOT de side ENEMY por turno (fix del bug #25).
    minionDefinitions: minionDefinitions([
      [MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 2, isDefensor: false }],
      [
        MINION_PLOT_SPECIAL,
        {
          passiveEffect: { kind: 'PLOT', amount: 0 },
          specialActionAbilityId: ENEMY_MINION_PLOT,
          planoAttackAmount: 0,
          isDefensor: false,
        },
      ],
      [MINION_PASSIVE_ATTACK, { passiveEffect: { kind: 'ATTACK', amount: 2 }, planoAttackAmount: 0, isDefensor: false }],
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

// -----------------------------------------------------------------------------
// NUEVO H1.15 — integración Contratiempo + Aliados (ver spec H1.15 §0.7/§5.4)
// -----------------------------------------------------------------------------
describe('CombatEngine — H1.15: Contratiempo revierte un Ataque que golpeó a un Aliado', () => {
  it('DAMAGE_ONLY: restaura la vida del Aliado a su valor previo; leaderDamage no cambia (sin derrame)', () => {
    const engine = buildEngine();

    const playResult = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isOk(playResult)).toBe(true);
    if (!isOk(playResult)) throw new Error('unreachable');
    const entered = playResult.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>;
    const allyId = entered.allyInstanceId;

    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    const lifeAfterAttack = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === allyId)!.life;
    expect(lifeAfterAttack).toBeLessThan(5); // formula VALUE (1-4) siempre < life 5 — no letal

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.alliesInPlay.find((a) => a.instanceId === allyId)!.life).toBe(5);
    expect(snapshot.leaderDamage).toBe(0);
  });

  it('"resucita" un Aliado muerto por Arrollar con derrame: la vida del Aliado vuelve a >0 Y leaderDamage vuelve a su valor previo', () => {
    const engine = buildEngine();

    const playResult = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isOk(playResult)).toBe(true);
    if (!isOk(playResult)) throw new Error('unreachable');
    const entered = playResult.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>;
    const allyId = entered.allyInstanceId;

    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK_ARROLLAR, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });

    const afterAttack = engine.getSnapshot();
    expect(afterAttack.alliesInPlay.find((a) => a.instanceId === allyId)!.life).toBe(0);
    expect(afterAttack.leaderDamage).toBeGreaterThan(0); // derrame de Arrollar

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.alliesInPlay.find((a) => a.instanceId === allyId)!.life).toBe(5);
    expect(snapshot.leaderDamage).toBe(0);
  });

  it('FULL_TURN sobre un Ataque a Aliado también restaura el CD de la habilidad de Enemigo usada', () => {
    const engine = buildEngine();

    const playResult = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isOk(playResult)).toBe(true);
    if (!isOk(playResult)) throw new Error('unreachable');
    const entered = playResult.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>;
    const allyId = entered.allyInstanceId;

    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    const remainingAfterActivation = engine.getSnapshot().cooldowns.find((c) => c.abilityId === ENEMY_ATTACK)!.remaining;
    expect(remainingAfterActivation).toBe(1); // baseCooldown, recién activada

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_FULL_TURN, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.alliesInPlay.find((a) => a.instanceId === allyId)!.life).toBe(5);
    const restoredRemaining = snapshot.cooldowns.find((c) => c.abilityId === ENEMY_ATTACK)!.remaining;
    expect(restoredRemaining).toBe(0);
  });

  it('no reabre el bug latente de handlePlayContratiempo (§0.8): PLAY_ALLY/SET_DAMAGE_REDIRECT nunca aparecen en currentEnemyTurnLog, ni siquiera invocados durante el turno de Enemigo', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });

    // PLAY_ALLY es exclusivo del Líder — rechazado, no muta ni registra nada.
    const playResult = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isErr(playResult)).toBe(true);
    if (isErr(playResult)) {
      expect((playResult.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }

    // SET_DAMAGE_REDIRECT no valida turno (spec §0.3) — se acepta incluso en turno de
    // Enemigo, pero NO empuja nada a currentEnemyTurnLog (solo handleActivateAbility con
    // side ENEMY lo hace).
    const redirectResult = engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: null });
    expect(isOk(redirectResult)).toBe(true);

    // ENEMY_BASE_ACTIONS_PER_TURN sigue en 1 y abilityCombo sigue exigiendo side LEADER
    // (H1.15 no toca ninguna de las dos) — como mucho 1 entrada ATTACK de side ENEMY por
    // turno puede llegar a currentEnemyTurnLog, exactamente igual que en H1.14.
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER: cierra la ventana (vacía)
    expect(engine.getSnapshot().undoableLastEnemyTurn).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// NUEVO H1.16 — el FIX de §0.4/§4.6: RESOLVE_MINION_ACTION introduce la 2ª fuente de
// mutación ATTACK/PLOT de side ENEMY por turno que hace alcanzable el bug #25 (QA
// H1.14). Ver spec H1.16 §6.4.
// -----------------------------------------------------------------------------
describe('CombatEngine — H1.16: fix del bug #25 (Contratiempo revierte TODAS las entradas del turno, no solo la última)', () => {
  it('regresión de bug #25 (QA H1.14, alcanzable por primera vez en H1.16): 2 entradas ATTACK de side ENEMY en el mismo turno (Enemigo + Secuaz vía RESOLVE_MINION_ACTION) — Contratiempo revierte AMBAS, leaderDamage vuelve a 0', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });

    engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const attack = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(attack)).toBe(true);
    const damageAfterEnemyAttack = engine.getSnapshot().leaderDamage;
    expect(damageAfterEnemyAttack).toBeGreaterThan(0);

    const minionAction = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(minionAction)).toBe(true);
    const damageAfterMinionAttack = engine.getSnapshot().leaderDamage;
    // planoAttackAmount 2, sin escudo activo → se suma completo.
    expect(damageAfterMinionAttack).toBe(damageAfterEnemyAttack + 2);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const played = result.value[0] as Extract<CombatEvent, { type: 'CONTRATIEMPO_PLAYED' }>;
      expect(played.revertedEntries).toHaveLength(2);
    }

    // Pre-fix (bug #25), el bucle habría dejado leaderDamage en damageAfterEnemyAttack
    // (el "antes" de la ÚLTIMA entrada) en vez de revertir la ventana completa a 0.
    expect(engine.getSnapshot().leaderDamage).toBe(0);
  });

  it('mismo caso con leaderShield: ambas entradas target LEADER con Escudo parcialmente consumido — tras Contratiempo, leaderShield vuelve al valor de ANTES de la primera, no de la segunda', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY', initialLeaderShield: 5 });

    engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    // Sin fix, el bucle habría restaurado leaderShield al valor "antes" de la SEGUNDA
    // entrada (el Escudo ya parcialmente consumido por la primera) en vez del inicial.
    expect(engine.getSnapshot().leaderShield).toBe(5);
  });

  it('2 entradas PLOT en el mismo turno (Enemigo + Secuaz de rama Trama): mismo fix aplicado a scenarioPlot, alcance FULL_TURN', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });

    engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLOT_SPECIAL, sourceId: 'enemy' });

    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo1.id,
    });
    expect(engine.getSnapshot().scenarioPlot).toBe(3);

    const minionAction = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(minionAction)).toBe(true);
    expect(engine.getSnapshot().scenarioPlot).toBe(5); // ENEMY_MINION_PLOT amount 2, misma dirección INCREASE

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_FULL_TURN, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    // Pre-fix, el bucle habría dejado scenarioPlot en 3 (el "antes" de la ÚLTIMA
    // entrada) en vez de revertir la ventana completa a 0.
    expect(engine.getSnapshot().scenarioPlot).toBe(0);
  });

  it('2 Aliados distintos golpeados en el mismo turno: cada uno revierte a su propia vida "antes", independientemente del orden', () => {
    const engine = buildEngine();

    const play1 = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isOk(play1)).toBe(true);
    if (!isOk(play1)) throw new Error('unreachable');
    const ally1Id = (play1.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>).allyInstanceId;

    const play2 = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isOk(play2)).toBe(true);
    if (!isOk(play2)) throw new Error('unreachable');
    const ally2Id = (play2.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>).allyInstanceId;

    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: ally1Id });
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY

    engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    const ally1LifeAfterFirstHit = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === ally1Id)!.life;
    expect(ally1LifeAfterFirstHit).toBeLessThan(5);

    // Redirige al 2º Aliado ANTES de que actúe el Secuaz.
    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: ally2Id });
    engine.dispatch({ type: 'RESOLVE_MINION_ACTION' }); // MINION_PLANO (amount 2) golpea a ally2
    const ally2LifeAfterSecondHit = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === ally2Id)!.life;
    expect(ally2LifeAfterSecondHit).toBe(3); // 5 - 2

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.alliesInPlay.find((a) => a.instanceId === ally1Id)!.life).toBe(5);
    expect(snapshot.alliesInPlay.find((a) => a.instanceId === ally2Id)!.life).toBe(5);
  });

  it('el mismo Aliado golpeado 2 veces en el mismo turno: revierte a la vida de ANTES del primer golpe (no del segundo) — caso borde de §0.4', () => {
    const engine = buildEngine();

    const play = engine.dispatch({ type: 'PLAY_ALLY', cardId: CARD_ALLY_PLAIN, sourceId: 'leader' });
    expect(isOk(play)).toBe(true);
    if (!isOk(play)) throw new Error('unreachable');
    const allyId = (play.value[0] as Extract<CombatEvent, { type: 'ALLY_ENTERED_PLAY' }>).allyInstanceId;

    engine.dispatch({ type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: allyId });
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY

    engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    const lifeAfterFirstHit = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === allyId)!.life;
    expect(lifeAfterFirstHit).toBeLessThan(5);

    // El mismo Aliado sigue siendo el objetivo de redirección para el Secuaz.
    engine.dispatch({ type: 'RESOLVE_MINION_ACTION' }); // MINION_PLANO (amount 2) golpea al MISMO Aliado
    const lifeAfterSecondHit = engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === allyId)!.life;
    expect(lifeAfterSecondHit).toBeLessThan(lifeAfterFirstHit);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_DAMAGE_ONLY, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    // Revierte a la vida de ANTES del PRIMER golpe (5), no a la de después del primero/
    // antes del segundo (lifeAfterFirstHit).
    expect(engine.getSnapshot().alliesInPlay.find((a) => a.instanceId === allyId)!.life).toBe(5);
  });

  it('entrada MINION_PLANO_ATTACK/MINION_PASSIVE se revierte igual que ABILITY, pero sin tocar remainingCooldowns (guard entry.origin === "ABILITY")', () => {
    const engine = buildEngine();

    // Turno 1 de Enemigo: solo se invoca el Secuaz (sin activar ninguna habilidad, para
    // que leaderDamage siga en 0 al entrar al turno 2 — el pasivo del Secuaz recién
    // invocado NO se aplica retroactivamente este mismo turno, ver spec §0.7).
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY (turno 1)
    engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PASSIVE_ATTACK, sourceId: 'enemy' });
    expect(engine.getSnapshot().leaderDamage).toBe(0);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER (cierra la ventana, vacía, del turno 1)

    // Turno 2 de Enemigo: el pasivo del Secuaz (ya en mesa) se aplica al INICIO de este
    // turno (MINION_PASSIVE, sin abilityId/cooldownBefore) y se activa ENEMY_ATTACK
    // (ABILITY, con CD real) — 2 entradas en la misma ventana de este turno.
    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY (turno 2)
    expect(isOk(result)).toBe(true);
    expect(engine.getSnapshot().leaderDamage).toBe(2); // pasivo ATTACK amount 2, sin escudo/Aliado

    const remainingBeforeActivation = engine.getSnapshot().cooldowns.find((c) => c.abilityId === ENEMY_ATTACK)!.remaining;
    expect(remainingBeforeActivation).toBe(0);

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    const remainingAfterActivation = engine.getSnapshot().cooldowns.find((c) => c.abilityId === ENEMY_ATTACK)!.remaining;
    expect(remainingAfterActivation).toBe(1); // baseCooldown, recién activada
    expect(engine.getSnapshot().leaderDamage).toBeGreaterThan(2);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER (congela turno 2: MINION_PASSIVE + ABILITY)

    // No debe lanzar ni corromper el CD al revertir la entrada MINION_PASSIVE (sin
    // abilityId/cooldownBefore) junto a la entrada ABILITY (con CD real).
    expect(() => engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_FULL_TURN, sourceId: 'leader' })).not.toThrow();

    const snapshot = engine.getSnapshot();
    // Revierte a leaderDamage de ANTES de la PRIMERA entrada de esta ventana (el pasivo,
    // que partió de 0 al empezar el turno 2) — no del valor intermedio tras el pasivo.
    expect(snapshot.leaderDamage).toBe(0);
    // El CD de ENEMY_ATTACK se restaura al "antes" de SU propia activación en esta
    // ventana (turno 2): estaba en 0 antes de activarse.
    expect(snapshot.cooldowns.find((c) => c.abilityId === ENEMY_ATTACK)!.remaining).toBe(0);
  });
});
