import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CardId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatEngineConfig } from './types/config';
import type { CombatEvent } from './types/events';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { EnemyAbilityAiProfile } from './types/enemy-ai';
import type { PlayableCardDefinition } from './types/playable-card';
import { UMBRAL_BONUS_THRESHOLD } from './types/umbral';
import { LEADER_SHIELD_MAX } from './types/ability-effect';

// -----------------------------------------------------------------------------
// Fixtures — mismo estilo que el resto de combat-engine.*.test.ts.
// -----------------------------------------------------------------------------

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-ability-any');
const ENEMY_ATTACK_BASICA: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack-basica');
const ENEMY_PLOT_BASICA: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot-basica');

const CARD_ATTACK: CardId = createId<'CardId'>('CardId', 'card-attack');
const CARD_ATTACK_UMBRAL: CardId = createId<'CardId'>('CardId', 'card-attack-umbral');
const CARD_SHIELD: CardId = createId<'CardId'>('CardId', 'card-shield');
const CARD_PLOT: CardId = createId<'CardId'>('CardId', 'card-plot');

function costs(extra: [AbilityId, CoreCostRequirement][] = []): Map<AbilityId, CoreCostRequirement> {
  return new Map<AbilityId, CoreCostRequirement>([[ABILITY_ANY, { kind: 'ANY' }], ...extra]);
}

function cooldowns(
  extra: [AbilityId, AbilityCooldownDefinition][] = []
): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map<AbilityId, AbilityCooldownDefinition>([
    [ABILITY_ANY, { side: 'LEADER', baseCooldown: 1 }],
    ...extra,
  ]);
}

function playableCards(entries: [CardId, PlayableCardDefinition][]): Map<CardId, PlayableCardDefinition> {
  return new Map(entries);
}

/** Motor mínimo — sin IA de Enemigo configurada (opt-in, ver spec §0.5). */
function buildEngine(overrides: Partial<CombatEngineConfig> = {}): CombatEngine {
  return new CombatEngine({
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs(),
    abilityCooldowns: cooldowns(),
    leaderMaxHealth: 100,
    enemyMaxHealth: 100,
    scenarioPlotDefeatThreshold: 999,
    ...overrides,
  });
}

/** Motor con IA de Enemigo habilitada — 1 BASICA por rama (ATTACK/PLOT), ambas CD1 ⚫
 *  (GDD §3.4, "CD1 doble"), mismo criterio que `validateEnemyAbilityAiProfiles` (H1.7). */
function buildEngineWithAi(overrides: Partial<CombatEngineConfig> = {}): CombatEngine {
  const enemyAbilityAiProfiles = new Map<AbilityId, EnemyAbilityAiProfile>([
    [ENEMY_ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }],
    [ENEMY_PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }],
  ]);
  return buildEngine({
    abilityCoreCosts: costs([
      [ENEMY_ATTACK_BASICA, { kind: 'ANY' }],
      [ENEMY_PLOT_BASICA, { kind: 'ANY' }],
    ]),
    abilityCooldowns: cooldowns([
      [ENEMY_ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_PLOT_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
    ]),
    abilityEffects: new Map([
      [ENEMY_ATTACK_BASICA, { kind: 'ATTACK' as const, formula: { baseFormula: { kind: 'ADD' as const, amount: 3 } } }],
      [ENEMY_PLOT_BASICA, { kind: 'PLOT' as const, amount: 1 }],
    ]),
    enemyAbilityAiProfiles,
    dramaturgiaDeck: ['ATTACK'],
    ...overrides,
  });
}

function eventTypes(events: readonly CombatEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('CombatEngine — H1.18: PLAY_CARD con efecto ATTACK_ENEMY', () => {
  it('formula VALUE: daña enemyDamage con el valor exacto del Núcleo gastado; consume Núcleo/Energía/acción', () => {
    const engine = buildEngine({
      playableCards: playableCards([
        [CARD_ATTACK, { energyCost: 1, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'VALUE' } } } }],
      ]),
      initialLeaderEnergy: 1,
    });
    const before = engine.getSnapshot();
    const nucleo = before.nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(eventTypes(result.value)).toEqual(['CARD_PLAYED', 'ENEMY_DAMAGED']);
      const dmg = result.value[1] as Extract<CombatEvent, { type: 'ENEMY_DAMAGED' }>;
      expect(dmg.rawAmount).toBe(nucleo.value);
      expect(dmg.enemyDamageAfter).toBe(nucleo.value);
      expect(dmg.bonusActivated).toBe(nucleo.value >= UMBRAL_BONUS_THRESHOLD);
    }

    const after = engine.getSnapshot();
    expect(after.enemyDamage).toBe(nucleo.value);
    expect(after.leaderEnergy).toBe(0);
    expect(after.actions.actionsTaken).toBe(1);
    expect(after.nucleoPool.some((n) => n.id === nucleo.id)).toBe(false);
  });

  it('formula ADD con Núcleo valor >=3: bonusActivated true, sin bonusResolvedValue (sin bonusFormula en el contenido, §0.1.1)', () => {
    const engine = buildEngine({
      playableCards: playableCards([
        [CARD_ATTACK_UMBRAL, { energyCost: 1, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'ADD', amount: 2 } } } }],
      ]),
      initialLeaderEnergy: 1,
      poolSize: 12,
    });
    const nucleo = engine.getSnapshot().nucleoPool.find((n) => n.value >= UMBRAL_BONUS_THRESHOLD)!;
    expect(nucleo).toBeDefined();

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK_UMBRAL, sourceId: 'leader', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const dmg = result.value[1] as Extract<CombatEvent, { type: 'ENEMY_DAMAGED' }>;
      expect(dmg.bonusActivated).toBe(true);
      expect(dmg.bonusResolvedValue).toBeUndefined();
      expect(dmg.rawAmount).toBe(nucleo.value + 2);
    }
  });

  it('sin nucleoInstanceId sobre una carta ATTACK_ENEMY → PLAY_CARD_NUCLEO_REQUIRED, sin mutación', () => {
    const engine = buildEngine({
      playableCards: playableCards([
        [CARD_ATTACK, { energyCost: 1, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'VALUE' } } } }],
      ]),
      initialLeaderEnergy: 1,
    });
    const before = engine.getSnapshot();

    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ code: 'PLAY_CARD_NUCLEO_REQUIRED', cardId: CARD_ATTACK });
    expect(engine.getSnapshot()).toEqual(before);
  });
});

describe('CombatEngine — H1.18: PLAY_CARD con efecto SHIELD (DEFENSA_X, cierra deuda H1.6 §0.1)', () => {
  it('suma a leaderShield, saturado en LEADER_SHIELD_MAX', () => {
    const engine = buildEngine({
      playableCards: playableCards([[CARD_SHIELD, { energyCost: 0, effect: { kind: 'SHIELD', amount: 3 } }]]),
      initialLeaderShield: 4,
    });

    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_SHIELD, sourceId: 'leader' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(eventTypes(result.value)).toEqual(['CARD_PLAYED', 'LEADER_SHIELD_GAINED']);
      const shieldEvent = result.value[1] as Extract<CombatEvent, { type: 'LEADER_SHIELD_GAINED' }>;
      expect(shieldEvent.leaderShieldBefore).toBe(4);
      expect(shieldEvent.leaderShieldAfter).toBe(LEADER_SHIELD_MAX);
    }
    expect(engine.getSnapshot().leaderShield).toBe(LEADER_SHIELD_MAX);
  });
});

describe('CombatEngine — H1.18: PLAY_CARD con efecto PLOT (TRAMA_X, siempre DECREASE)', () => {
  it('scenarioPlot baja, satura en 0', () => {
    const engine = buildEngine({
      playableCards: playableCards([[CARD_PLOT, { energyCost: 0, effect: { kind: 'PLOT', amount: 5 } }]]),
    });

    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_PLOT, sourceId: 'leader' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const plotEvent = result.value[1] as Extract<CombatEvent, { type: 'SCENARIO_PLOT_CHANGED' }>;
      expect(plotEvent.direction).toBe('DECREASE');
      expect(plotEvent.scenarioPlotAfter).toBe(0); // ya arrancaba en 0, satura
      expect(plotEvent.abilityId).toBeUndefined();
    }
    expect(engine.getSnapshot().scenarioPlot).toBe(0);
  });
});

describe('CombatEngine — H1.18: PLAY_CARD, errores sin mutación', () => {
  it('carta desconocida → PLAY_CARD_UNKNOWN', () => {
    const engine = buildEngine();
    const before = engine.getSnapshot();
    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ code: 'PLAY_CARD_UNKNOWN', cardId: CARD_ATTACK });
    expect(engine.getSnapshot()).toEqual(before);
  });

  it('Energía insuficiente → PLAY_CARD_INSUFFICIENT_ENERGY', () => {
    const engine = buildEngine({
      playableCards: playableCards([[CARD_SHIELD, { energyCost: 5, effect: { kind: 'SHIELD', amount: 1 } }]]),
      initialLeaderEnergy: 1,
    });
    const before = engine.getSnapshot();
    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_SHIELD, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({ code: 'PLAY_CARD_INSUFFICIENT_ENERGY', cardId: CARD_SHIELD, required: 5, available: 1 });
    }
    expect(engine.getSnapshot()).toEqual(before);
  });

  it('fuera de turno (ENEMY) → NOT_YOUR_TURN', () => {
    const engine = buildEngine({
      playableCards: playableCards([[CARD_SHIELD, { energyCost: 0, effect: { kind: 'SHIELD', amount: 1 } }]]),
      initialTurnOwner: 'ENEMY',
    });
    const before = engine.getSnapshot();
    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_SHIELD, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: 'ENEMY' });
    expect(engine.getSnapshot()).toEqual(before);
  });

  it('sin acciones restantes → NO_ACTIONS_REMAINING', () => {
    const engine = buildEngine({
      playableCards: playableCards([[CARD_SHIELD, { energyCost: 0, effect: { kind: 'SHIELD', amount: 1 } }]]),
    });
    // Consume las 2 acciones del Líder (GDD §2.1) jugando la carta 2 veces.
    engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_SHIELD, sourceId: 'leader' });
    engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_SHIELD, sourceId: 'leader' });
    const before = engine.getSnapshot();

    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_SHIELD, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        code: 'NO_ACTIONS_REMAINING', side: 'LEADER', actionsTaken: 2, actionsAllowed: 2,
      });
    }
    expect(engine.getSnapshot()).toEqual(before);
  });
});

describe('CombatEngine — H1.18: condición de victoria', () => {
  it('enemyDamage >= enemyMaxHealth tras un PLAY_CARD → COMBAT_ENDED VICTORY, snapshot.status VICTORY', () => {
    const engine = buildEngine({
      enemyMaxHealth: 10,
      playableCards: playableCards([
        [CARD_ATTACK, { energyCost: 0, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'ADD', amount: 10 } } } }],
      ]),
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(eventTypes(result.value)).toContain('COMBAT_ENDED');
      const ended = result.value.find((e) => e.type === 'COMBAT_ENDED') as Extract<CombatEvent, { type: 'COMBAT_ENDED' }>;
      expect(ended.outcome).toBe('VICTORY');
      expect(ended.defeatReason).toBeUndefined();
    }
    expect(engine.getSnapshot().status).toBe('VICTORY');
  });
});

describe('CombatEngine — H1.18: condiciones de derrota', () => {
  it('leaderDamage >= leaderMaxHealth (vía ACTIVATE_ABILITY manual, sin IA) → COMBAT_ENDED DEFEAT LEADER_HEALTH', () => {
    const engine = buildEngine({
      leaderMaxHealth: 5,
      abilityCoreCosts: costs([[ENEMY_ATTACK_BASICA, { kind: 'ANY' }]]),
      abilityCooldowns: cooldowns([[ENEMY_ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: new Map([
        [ENEMY_ATTACK_BASICA, { kind: 'ATTACK' as const, formula: { baseFormula: { kind: 'ADD' as const, amount: 5 } } }],
      ]),
      initialTurnOwner: 'ENEMY',
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK_BASICA, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = result.value.find((e) => e.type === 'COMBAT_ENDED') as Extract<CombatEvent, { type: 'COMBAT_ENDED' }>;
      expect(ended).toBeDefined();
      expect(ended.outcome).toBe('DEFEAT');
      expect(ended.defeatReason).toBe('LEADER_HEALTH');
    }
    expect(engine.getSnapshot().status).toBe('DEFEAT');
    expect(engine.getSnapshot().defeatReason).toBe('LEADER_HEALTH');
  });

  it('scenarioPlot >= scenarioPlotDefeatThreshold → COMBAT_ENDED DEFEAT SCENARIO_PLOT', () => {
    const engine = buildEngine({
      scenarioPlotDefeatThreshold: 4,
      abilityCoreCosts: costs([[ENEMY_PLOT_BASICA, { kind: 'ANY' }]]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT_BASICA, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: new Map([[ENEMY_PLOT_BASICA, { kind: 'PLOT' as const, amount: 4 }]]),
      initialTurnOwner: 'ENEMY',
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT_BASICA, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = result.value.find((e) => e.type === 'COMBAT_ENDED') as Extract<CombatEvent, { type: 'COMBAT_ENDED' }>;
      expect(ended).toBeDefined();
      expect(ended.outcome).toBe('DEFEAT');
      expect(ended.defeatReason).toBe('SCENARIO_PLOT');
    }
    expect(engine.getSnapshot().status).toBe('DEFEAT');
    expect(engine.getSnapshot().defeatReason).toBe('SCENARIO_PLOT');
  });
});

describe('CombatEngine — H1.18: dispatch() rechaza comandos tras estado terminal', () => {
  it('tras VICTORY, END_TURN/ACTIVATE_ABILITY/PLAY_CARD devuelven COMBAT_ALREADY_ENDED sin mutar el snapshot', () => {
    const engine = buildEngine({
      enemyMaxHealth: 10,
      playableCards: playableCards([
        [CARD_ATTACK, { energyCost: 0, effect: { kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'ADD', amount: 10 } } } }],
      ]),
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_ATTACK, sourceId: 'leader', nucleoInstanceId: nucleo.id });
    expect(engine.getSnapshot().status).toBe('VICTORY');

    const before = engine.getSnapshot();

    for (const command of [
      { type: 'END_TURN' as const },
      { type: 'ACTIVATE_ABILITY' as const, abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER' as const, nucleoInstanceId: nucleo.id },
      { type: 'PLAY_CARD' as const, cardId: CARD_ATTACK, sourceId: 'leader' },
    ]) {
      const result = engine.dispatch(command);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error).toEqual({ code: 'COMBAT_ALREADY_ENDED', status: 'VICTORY' });
    }

    expect(engine.getSnapshot()).toEqual(before);
  });
});

describe('CombatEngine — H1.18: turno de IA automático (opt-in, §0.5)', () => {
  it('smoke test end-to-end: un solo dispatch(END_TURN) del Líder resuelve TODO el turno del Enemigo y devuelve el turno al Líder', () => {
    const engine = buildEngineWithAi();

    const result = engine.dispatch({ type: 'END_TURN' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      expect(types).toContain('TURN_ENDED');
      expect(types).toContain('DRAMATURGIA_CARD_DRAWN');
      expect(types).toContain('ABILITY_ACTIVATED');
      expect(types.filter((t) => t === 'TURN_ENDED')).toHaveLength(2);
      expect(types.filter((t) => t === 'COOLDOWNS_TICKED')).toHaveLength(2);

      const drawn = result.value.find((e) => e.type === 'DRAMATURGIA_CARD_DRAWN') as Extract<CombatEvent, { type: 'DRAMATURGIA_CARD_DRAWN' }>;
      expect(drawn.icon).toBe('ATTACK');

      const activated = result.value.find((e) => e.type === 'ABILITY_ACTIVATED') as Extract<CombatEvent, { type: 'ABILITY_ACTIVATED' }>;
      expect(activated.abilityId).toBe(ENEMY_ATTACK_BASICA);
      expect(activated.side).toBe('ENEMY');
    }

    expect(engine.getSnapshot().turn.turnOwner).toBe('LEADER');
  });

  it('con un Secuaz en mesa: la secuencia incluye MINION_ACTION_RESOLVED antes del TURN_ENDED de cierre', () => {
    const MINION_PLANO = 'minion-plano-noop';
    const engine = buildEngineWithAi({
      initialTurnOwner: 'ENEMY', // para poder invocar el Secuaz antes del primer END_TURN
      minionDefinitions: new Map([
        [MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: false }],
      ]),
    });
    const summonResult = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });
    expect(isOk(summonResult)).toBe(true);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER (cierra el turno manual de invocación)
    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY, dispara IA + acción de Secuaz
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      expect(types).toContain('MINION_ACTION_RESOLVED');
      const abilityIdx = types.indexOf('ABILITY_ACTIVATED');
      const minionIdx = types.indexOf('MINION_ACTION_RESOLVED');
      const closingTurnEndedIdx = types.lastIndexOf('TURN_ENDED');
      expect(abilityIdx).toBeGreaterThanOrEqual(0);
      expect(minionIdx).toBeGreaterThan(abilityIdx);
      expect(closingTurnEndedIdx).toBeGreaterThan(minionIdx);
    }
    expect(engine.getSnapshot().turn.turnOwner).toBe('LEADER');
  });
});

describe('CombatEngine — H1.18: turno de IA automático — combate termina a mitad del turno de Enemigo', () => {
  it('leaderMaxHealth bajo + ataque letal del Enemigo: el dispatch(END_TURN) del Líder para en COMBAT_ENDED, sin devolver el turno (turnOwner sigue ENEMY)', () => {
    const engine = buildEngineWithAi({ leaderMaxHealth: 2 });
    // ENEMY_ATTACK_BASICA inflige nucleoValue + 3 (>= 1+3=4 siempre) >= leaderMaxHealth (2).

    const result = engine.dispatch({ type: 'END_TURN' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      expect(types).toContain('COMBAT_ENDED');
      expect(types).not.toContain('MINION_ACTION_RESOLVED');
      expect(types.filter((t) => t === 'TURN_ENDED')).toHaveLength(1); // sin cierre recursivo
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.status).toBe('DEFEAT');
    expect(snapshot.turn.turnOwner).toBe('ENEMY'); // congelado, §0.6
  });
});

describe('CombatEngine — H1.18: compatibilidad hacia atrás — sin IA configurada', () => {
  it('sin enemyAbilityAiProfiles/dramaturgiaDeck: END_TURN + ACTIVATE_ABILITY(ENEMY) manual se comporta exactamente igual que H1.3-H1.17', () => {
    const engine = buildEngine({
      abilityCoreCosts: costs([[ENEMY_ATTACK_BASICA, { kind: 'ANY' }]]),
      abilityCooldowns: cooldowns([[ENEMY_ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }]]),
    });

    const endResult = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(endResult)).toBe(true);
    if (isOk(endResult)) {
      expect(eventTypes(endResult.value)).toEqual(['TURN_ENDED', 'COOLDOWNS_TICKED', 'MINION_PASSIVE_EFFECTS_APPLIED']);
    }
    expect(engine.getSnapshot().turn.turnOwner).toBe('ENEMY'); // NO se devuelve solo — sin IA

    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const abilityResult = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK_BASICA, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(abilityResult)).toBe(true);
    expect(engine.getSnapshot().turn.turnOwner).toBe('ENEMY'); // sigue en ENEMY hasta un END_TURN manual
  });
});

describe('CombatEngine — H1.18: reciclado del mazo de Dramaturgia (§0.5.3)', () => {
  it('con un mazo de 2 cartas, el 3er robo (3er ciclo de turno de Enemigo) dispara DRAMATURGIA_DECK_RESHUFFLED antes de DRAMATURGIA_CARD_DRAWN', () => {
    const engine = buildEngineWithAi({ dramaturgiaDeck: ['ATTACK', 'PLOT'] });

    const drawnIcons: string[] = [];
    let reshuffledCount = 0;
    for (let i = 0; i < 3; i++) {
      const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY (dispara IA) -> LEADER
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        reshuffledCount += eventTypes(result.value).filter((t) => t === 'DRAMATURGIA_DECK_RESHUFFLED').length;
        const drawn = result.value.filter((e) => e.type === 'DRAMATURGIA_CARD_DRAWN') as Extract<CombatEvent, { type: 'DRAMATURGIA_CARD_DRAWN' }>[];
        drawnIcons.push(...drawn.map((d) => d.icon));
      }
    }

    expect(drawnIcons).toHaveLength(3);
    expect(reshuffledCount).toBe(1); // el 3er robo recicla el descarte de los 2 primeros
  });
});

describe('CombatEngine — H1.18: validación de constructor', () => {
  it('enemyAbilityAiProfiles poblado sin dramaturgiaDeck → lanza', () => {
    expect(() =>
      buildEngine({
        abilityCoreCosts: costs([[ENEMY_ATTACK_BASICA, { kind: 'ANY' }]]),
        abilityCooldowns: cooldowns([[ENEMY_ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }]]),
        enemyAbilityAiProfiles: new Map([[ENEMY_ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }]]),
      })
    ).toThrow();
  });

  it('dramaturgiaDeck poblado sin enemyAbilityAiProfiles → lanza', () => {
    expect(() => buildEngine({ dramaturgiaDeck: ['ATTACK'] })).toThrow();
  });

  it('leaderMaxHealth fuera de rango (0) → lanza', () => {
    expect(() => buildEngine({ leaderMaxHealth: 0 })).toThrow();
  });

  it('leaderMaxHealth fuera de rango (>100) → lanza', () => {
    expect(() => buildEngine({ leaderMaxHealth: 101 })).toThrow();
  });

  it('scenarioPlotDefeatThreshold fuera de rango (0) → lanza', () => {
    expect(() => buildEngine({ scenarioPlotDefeatThreshold: 0 })).toThrow();
  });

  it('enemyMaxHealth fuera de rango (0) → lanza', () => {
    expect(() => buildEngine({ enemyMaxHealth: 0 })).toThrow();
  });

  it('playableCards con energyCost negativo → lanza', () => {
    expect(() =>
      buildEngine({
        playableCards: playableCards([[CARD_SHIELD, { energyCost: -1, effect: { kind: 'SHIELD', amount: 1 } }]]),
      })
    ).toThrow();
  });
});
