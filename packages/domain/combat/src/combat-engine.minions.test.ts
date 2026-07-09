import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { MinionDefinition, MinionDefinitionId, MinionInPlay } from './types/minion';
import type { DramaturgiaCardDefinition } from '@collector/domain-catalog';

const ENEMY_SPECIAL_A: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-minion-special-a');
const ENEMY_SPECIAL_B: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-minion-special-b');
const LEADER_FILLER: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-filler');
// NUEVO H1.16 (rediseño) — `validateEnemyAbilityAiProfiles` exige exactamente 1 BASICA
// por rama (ATTACK/PLOT); las pruebas de selección por Dramaturgia solo necesitan la
// rama ATTACK, pero el motor exige que la rama PLOT también tenga su BASICA registrada.
const ENEMY_PLOT_FILLER: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot-filler');

const MINION_SPECIAL_A: MinionDefinitionId = 'minion-special-a';
const MINION_SPECIAL_B: MinionDefinitionId = 'minion-special-b';
const MINION_PLANO: MinionDefinitionId = 'minion-plano';
const MINION_DEFENSOR: MinionDefinitionId = 'minion-defensor';
const MINION_PASSIVE_PLOT: MinionDefinitionId = 'minion-passive-plot';
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

function minionDefinitions(
  entries: [MinionDefinitionId, MinionDefinition][]
): Map<MinionDefinitionId, MinionDefinition> {
  return new Map(entries);
}

/** NUEVO H1.16 (rediseño) — carta de Dramaturgia completa con `minionBehavior`
 *  explícito, sustituye la vieja selección aleatoria del motor. NUEVO §3.10.1 —
 *  `summonEffect` opcional, independiente de `minionBehavior`. */
function dramaturgiaCard(
  behaviorKind?: 'ALL' | 'RANDOM_ONE' | 'HIGHEST_PLANO_ATTACK' | { specific: MinionDefinitionId },
  summonMinionDefinitionId?: MinionDefinitionId
): DramaturgiaCardDefinition {
  const criterion =
    behaviorKind === undefined
      ? undefined
      : typeof behaviorKind === 'string'
        ? ({ kind: behaviorKind } as const)
        : ({ kind: 'SPECIFIC_DEFINITION' as const, minionDefinitionId: behaviorKind.specific });
  return {
    id: createId<'DramaturgiaCardId'>(
      'DramaturgiaCardId',
      `dramacard-${JSON.stringify(behaviorKind)}-${summonMinionDefinitionId ?? 'none'}`
    ),
    name: 'Carta de prueba',
    icon: 'ATTACK',
    ...(criterion !== undefined ? { minionBehavior: { criterion } } : {}),
    ...(summonMinionDefinitionId !== undefined ? { summonEffect: { minionDefinitionId: summonMinionDefinitionId } } : {}),
  };
}

/** Fixture recomendada por la spec H1.16 §6: 2 habilidades ATTACK de acción especial de
 *  Secuaz (side ENEMY) + varias MinionDefinition cubriendo acción especial/plano/Defensor/pasivo. */
function buildEngine(overrides: Partial<CombatEngineConfig> = {}) {
  return new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs([ENEMY_SPECIAL_A, ENEMY_SPECIAL_B, LEADER_FILLER, ENEMY_PLOT_FILLER]),
    abilityCooldowns: cooldowns([
      [ENEMY_SPECIAL_A, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_SPECIAL_B, { side: 'ENEMY', baseCooldown: 1 }],
      [LEADER_FILLER, { side: 'LEADER', baseCooldown: 1 }],
      [ENEMY_PLOT_FILLER, { side: 'ENEMY', baseCooldown: 1 }],
    ]),
    abilityEffects: effects([
      [ENEMY_SPECIAL_A, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 4 } } }],
      [ENEMY_SPECIAL_B, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 4 } } }],
      [ENEMY_PLOT_FILLER, { kind: 'PLOT', amount: 1 }],
    ]),
    minionDefinitions: minionDefinitions([
      [
        MINION_SPECIAL_A,
        {
          passiveEffect: { kind: 'PLOT', amount: 0 },
          specialActionAbilityId: ENEMY_SPECIAL_A,
          planoAttackAmount: 1,
          isDefensor: false,
          maxLife: 5,
        },
      ],
      [
        MINION_SPECIAL_B,
        {
          passiveEffect: { kind: 'PLOT', amount: 0 },
          specialActionAbilityId: ENEMY_SPECIAL_B,
          planoAttackAmount: 1,
          isDefensor: false,
          maxLife: 5,
        },
      ],
      [
        MINION_PLANO,
        { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 3, isDefensor: false, maxLife: 5 },
      ],
      [
        MINION_DEFENSOR,
        { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true, maxLife: 5 },
      ],
      [
        MINION_PASSIVE_PLOT,
        { passiveEffect: { kind: 'PLOT', amount: 1 }, planoAttackAmount: 0, isDefensor: false, maxLife: 5 },
      ],
      [
        MINION_PASSIVE_ATTACK,
        { passiveEffect: { kind: 'ATTACK', amount: 2 }, planoAttackAmount: 0, isDefensor: false, maxLife: 5 },
      ],
    ]),
    initialTurnOwner: 'LEADER',
    ...overrides,
  });
}

/** Invoca SUMMON_MINION y devuelve el `instanceId` resultante. */
function summonMinion(engine: CombatEngine, minionDefinitionId: MinionDefinitionId, sourceId = 'enemy'): MinionInPlay {
  const result = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId, sourceId });
  expect(isOk(result)).toBe(true);
  if (!isOk(result)) throw new Error('summonMinion falló');
  const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_SUMMONED' }>;
  return engine.getSnapshot().minionsInPlay.find((m) => m.instanceId === event.instanceId) as MinionInPlay;
}

describe('CombatEngine — H1.16: Secuaces del enemigo (GDD §3.8)', () => {
  it('Secuaz entra en mesa con pasivo declarado y vida (maxLife=life=def.maxLife): SUMMON_MINION exitoso, minionsInPlay contiene la instancia, MINION_SUMMONED emitido', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PASSIVE_PLOT, sourceId: 'enemy' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_SUMMONED' }>;
      expect(event.type).toBe('MINION_SUMMONED');
      expect(event.minionDefinitionId).toBe(MINION_PASSIVE_PLOT);
      expect(event.isDefensor).toBe(false);

      const snapshot = engine.getSnapshot();
      expect(snapshot.minionsInPlay).toHaveLength(1);
      expect(snapshot.minionsInPlay[0]!.passiveEffect).toEqual({ kind: 'PLOT', amount: 1 });
      expect(snapshot.minionsInPlay[0]!.maxLife).toBe(5);
      expect(snapshot.minionsInPlay[0]!.life).toBe(5);
    }
  });

  it('pasivo leído cada turno de Enemigo: 2 Secuaces (PLOT amount:1 y ATTACK amount:2) suben scenarioPlot/leaderDamage tras END_TURN, y de nuevo en el siguiente turno de Enemigo (acumulativo)', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_PASSIVE_PLOT);
    summonMinion(engine, MINION_PASSIVE_ATTACK);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER (sin pasivo, turnOwner pasa a LEADER)
    const beforeSecondEnemyTurn = engine.getSnapshot();
    expect(beforeSecondEnemyTurn.scenarioPlot).toBe(0);
    expect(beforeSecondEnemyTurn.leaderDamage).toBe(0);

    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY: pasivo se aplica
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const passiveEvent = result.value.find((e) => e.type === 'MINION_PASSIVE_EFFECTS_APPLIED') as Extract<
        CombatEvent,
        { type: 'MINION_PASSIVE_EFFECTS_APPLIED' }
      >;
      expect(passiveEvent).toBeDefined();
      expect(passiveEvent.minionCount).toBe(2);
      expect(passiveEvent.attackAmount).toBe(2);
      expect(passiveEvent.plotAmount).toBe(1);
    }
    const afterFirstPassive = engine.getSnapshot();
    expect(afterFirstPassive.scenarioPlot).toBe(1);
    expect(afterFirstPassive.leaderDamage).toBe(2);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    const result2 = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY: pasivo se reaplica
    expect(isOk(result2)).toBe(true);
    const afterSecondPassive = engine.getSnapshot();
    expect(afterSecondPassive.scenarioPlot).toBe(2);
    expect(afterSecondPassive.leaderDamage).toBe(4);
  });

  it('sin carta de Dramaturgia robada este turno: RESOLVE_MINION_ACTION con Secuaces en mesa emite MINION_ACTION_SKIPPED NOT_SPECIFIED_BY_DRAMATURGIA (nuevo comportamiento por defecto)', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_PLANO);

    const result = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_ACTION_SKIPPED' }>;
      expect(event.reason).toBe('NOT_SPECIFIED_BY_DRAMATURGIA');
    }
  });

  it('sin Secuaces en mesa: RESOLVE_MINION_ACTION emite MINION_ACTION_SKIPPED NO_MINIONS_IN_PLAY sin error, sin marcar el turno como resuelto', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_ACTION_SKIPPED' }>;
      expect(event.reason).toBe('NO_MINIONS_IN_PLAY');
    }
  });

  it('exclusivo de Enemigo: SUMMON_MINION/RESOLVE_MINION_ACTION con turnOwner LEADER → NOT_YOUR_TURN (expected ENEMY)', () => {
    const engine = buildEngine({ initialTurnOwner: 'LEADER' });

    const summon = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });
    expect(isErr(summon)).toBe(true);
    if (isErr(summon)) {
      const error = summon.error as Extract<CombatCommandError, { code: 'NOT_YOUR_TURN' }>;
      expect(error.code).toBe('NOT_YOUR_TURN');
      expect(error.expected).toBe('ENEMY');
    }

    const resolve = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isErr(resolve)).toBe(true);
    if (isErr(resolve)) {
      const error = resolve.error as Extract<CombatCommandError, { code: 'NOT_YOUR_TURN' }>;
      expect(error.code).toBe('NOT_YOUR_TURN');
      expect(error.expected).toBe('ENEMY');
    }
  });

  it('SUMMON_MINION de definición desconocida → MINION_DEFINITION_UNKNOWN', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: 'unknown-minion', sourceId: 'enemy' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('MINION_DEFINITION_UNKNOWN');
    }
  });

  describe('constructor: validación de minionDefinitions', () => {
    it('lanza si planoAttackAmount no es entero o es negativo', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: -1, isDefensor: false, maxLife: 5 }]]),
      })).toThrow();
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1.5, isDefensor: false, maxLife: 5 }]]),
      })).toThrow();
    });

    it('lanza si maxLife no es un entero >= 1 (§3.9.1 — un Secuaz de 0 vida está muerto por definición)', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: false, maxLife: 0 }]]),
      })).toThrow();
    });

    it('lanza si specialActionAbilityId no existe en abilityCooldowns', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_SPECIAL_A, { passiveEffect: { kind: 'PLOT', amount: 0 }, specialActionAbilityId: ENEMY_SPECIAL_A, planoAttackAmount: 1, isDefensor: false, maxLife: 5 }]]),
      })).toThrow();
    });

    it('lanza si specialActionAbilityId existe con side LEADER', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([ENEMY_SPECIAL_A]),
        abilityCooldowns: cooldowns([[ENEMY_SPECIAL_A, { side: 'LEADER', baseCooldown: 1 }]]),
        minionDefinitions: minionDefinitions([[MINION_SPECIAL_A, { passiveEffect: { kind: 'PLOT', amount: 0 }, specialActionAbilityId: ENEMY_SPECIAL_A, planoAttackAmount: 1, isDefensor: false, maxLife: 5 }]]),
      })).toThrow();
    });
  });
});

describe('CombatEngine — H1.16 (rediseño): selección de Secuaces dictada por minionBehavior de Dramaturgia', () => {
  const enemyAiProfiles = new Map([
    [ENEMY_SPECIAL_A, { branch: 'ATTACK' as const, tier: 'FIRMA' as const }],
    [ENEMY_SPECIAL_B, { branch: 'ATTACK' as const, tier: 'BASICA' as const }],
    [ENEMY_PLOT_FILLER, { branch: 'PLOT' as const, tier: 'BASICA' as const }],
  ]);

  it('ALL: todos los Secuaces en mesa actúan en el mismo dispatch (varios MINION_ACTION_RESOLVED)', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard('ALL')],
    });
    summonMinion(engine, MINION_PLANO);
    summonMinion(engine, MINION_DEFENSOR);

    // ENEMY -> LEADER (cierra el turno manual de invocación) -> ENEMY (dispara IA/Dramaturgia).
    engine.dispatch({ type: 'END_TURN' });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const resolved = result.value.filter((e) => e.type === 'MINION_ACTION_RESOLVED');
      expect(resolved).toHaveLength(2);
    }
  });

  it('SPECIFIC_DEFINITION: solo el/los Secuaz(es) de esa definición actúan', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard({ specific: MINION_PLANO })],
    });
    const plano = summonMinion(engine, MINION_PLANO);
    summonMinion(engine, MINION_DEFENSOR);

    engine.dispatch({ type: 'END_TURN' });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const resolved = result.value.filter(
        (e) => e.type === 'MINION_ACTION_RESOLVED'
      ) as Extract<CombatEvent, { type: 'MINION_ACTION_RESOLVED' }>[];
      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.instanceId).toBe(plano.instanceId);
    }
  });

  it('HIGHEST_PLANO_ATTACK: el Secuaz con mayor planoAttackAmount actúa', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard('HIGHEST_PLANO_ATTACK')],
    });
    summonMinion(engine, MINION_DEFENSOR); // planoAttackAmount 1
    const strongest = summonMinion(engine, MINION_PLANO); // planoAttackAmount 3

    engine.dispatch({ type: 'END_TURN' });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const resolved = result.value.filter(
        (e) => e.type === 'MINION_ACTION_RESOLVED'
      ) as Extract<CombatEvent, { type: 'MINION_ACTION_RESOLVED' }>[];
      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.instanceId).toBe(strongest.instanceId);
    }
  });

  it('acción especial: Secuaz con CD/Núcleo listos usa SPECIAL_ACTION; sin ninguno listo, cae a PLANO_ATTACK', () => {
    // NUEVO H1.16 (rediseño): usa MINION_SPECIAL_B (abilityId ENEMY_SPECIAL_B, tier
    // BASICA) — MINION_SPECIAL_A comparte abilityId (ENEMY_SPECIAL_A, tier FIRMA) con la
    // habilidad que la IA automática del Enemigo YA activa este mismo turno (branch
    // ATTACK prioriza FIRMA), lo que dejaría ese abilityId en CD antes de que el Secuaz
    // pudiera usarlo — no es el escenario que este test quiere ejercitar.
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard({ specific: MINION_SPECIAL_B })],
    });
    summonMinion(engine, MINION_SPECIAL_B);

    engine.dispatch({ type: 'END_TURN' });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const resolved = result.value.find(
        (e) => e.type === 'MINION_ACTION_RESOLVED'
      ) as Extract<CombatEvent, { type: 'MINION_ACTION_RESOLVED' }>;
      expect(resolved.mechanism).toBe('SPECIAL_ACTION');
    }
  });

  it('solo 1 RESOLVE_MINION_ACTION exitoso por turno de Enemigo: un segundo intento manual → MINION_ACTION_ALREADY_RESOLVED_THIS_TURN', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_PLANO);

    const first = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(first)).toBe(true); // NOT_SPECIFIED_BY_DRAMATURGIA, pero SÍ marca el turno como resuelto

    const second = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isErr(second)).toBe(true);
    if (isErr(second)) {
      expect((second.error as CombatCommandError).code).toBe('MINION_ACTION_ALREADY_RESOLVED_THIS_TURN');
    }

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY

    const third = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(third)).toBe(true);
  });
});

describe('CombatEngine — §3.10: SUMMON_MINION disparado automáticamente por DramaturgiaCardDefinition.summonEffect', () => {
  const enemyAiProfiles = new Map([
    [ENEMY_SPECIAL_A, { branch: 'ATTACK' as const, tier: 'FIRMA' as const }],
    [ENEMY_SPECIAL_B, { branch: 'ATTACK' as const, tier: 'BASICA' as const }],
    [ENEMY_PLOT_FILLER, { branch: 'PLOT' as const, tier: 'BASICA' as const }],
  ]);

  it('carta con summonEffect: el turno automático de Enemigo añade 1 MinionInPlay nuevo (MINION_SUMMONED) antes de RESOLVE_MINION_ACTION del mismo turno', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard(undefined, MINION_PLANO)],
    });

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY: dispara IA + summonEffect
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const summoned = result.value.filter((e) => e.type === 'MINION_SUMMONED');
      expect(summoned).toHaveLength(1);
      const summonedEvent = summoned[0] as Extract<CombatEvent, { type: 'MINION_SUMMONED' }>;
      expect(summonedEvent.minionDefinitionId).toBe(MINION_PLANO);

      // El evento MINION_SUMMONED ocurre ANTES que cualquier MINION_ACTION_RESOLVED/
      // MINION_ACTION_SKIPPED de RESOLVE_MINION_ACTION del mismo turno (paso 2.5 antes
      // del paso 4, ver spec §3.10.2).
      const summonIndex = result.value.indexOf(summonedEvent);
      const minionActionIndex = result.value.findIndex(
        (e) => e.type === 'MINION_ACTION_RESOLVED' || e.type === 'MINION_ACTION_SKIPPED'
      );
      expect(minionActionIndex).toBeGreaterThan(summonIndex);
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(1);
  });

  it('el Secuaz recién invocado por summonEffect NO es seleccionado por un minionBehavior: { kind: "ALL" } de la MISMA carta (mesa previa vacía → MINION_ACTION_SKIPPED, no un ataque del recién llegado)', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard('ALL', MINION_PLANO)],
    });

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.some((e) => e.type === 'MINION_SUMMONED')).toBe(true);
      expect(result.value.some((e) => e.type === 'MINION_ACTION_RESOLVED')).toBe(false);
      const skipped = result.value.find((e) => e.type === 'MINION_ACTION_SKIPPED') as Extract<
        CombatEvent,
        { type: 'MINION_ACTION_SKIPPED' }
      >;
      expect(skipped).toBeDefined();
      expect(skipped.reason).toBe('NOT_SPECIFIED_BY_DRAMATURGIA');
    }
    // El Secuaz SÍ quedó en mesa — solo no actuó este turno.
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(1);
  });

  it('tope maxMinionsInPlay alcanzado: summonEffect emite MINION_SUMMON_SKIPPED y minionsInPlay.length no cambia', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard(undefined, MINION_PLANO)],
      maxMinionsInPlay: 1,
    });
    summonMinion(engine, MINION_PLANO); // ya al tope (1) antes de que la IA intente invocar otro

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.some((e) => e.type === 'MINION_SUMMONED')).toBe(false);
      const skipped = result.value.find((e) => e.type === 'MINION_SUMMON_SKIPPED') as Extract<
        CombatEvent,
        { type: 'MINION_SUMMON_SKIPPED' }
      >;
      expect(skipped).toBeDefined();
      expect(skipped.reason).toBe('TABLE_AT_MAX');
      expect(skipped.minionDefinitionId).toBe(MINION_PLANO);
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(1);
  });

  it('carta sin summonEffect no invoca ningún Secuaz nuevo (comportamiento preexistente preservado)', () => {
    const engine = buildEngine({
      initialTurnOwner: 'ENEMY',
      enemyAbilityAiProfiles: enemyAiProfiles,
      dramaturgiaDeck: [dramaturgiaCard('ALL')],
    });
    summonMinion(engine, MINION_PLANO);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.some((e) => e.type === 'MINION_SUMMONED')).toBe(false);
      expect(result.value.some((e) => e.type === 'MINION_SUMMON_SKIPPED')).toBe(false);
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(1); // solo el summonado manualmente antes del turno
  });

  it('SUMMON_MINION directo respeta el tope maxMinionsInPlay (default DEFAULT_MAX_MINIONS_IN_PLAY=3) fuera del flujo automático', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_PLANO);
    summonMinion(engine, MINION_PLANO);
    summonMinion(engine, MINION_PLANO);
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(3);

    const result = engine.dispatch({ type: 'SUMMON_MINION', minionDefinitionId: MINION_PLANO, sourceId: 'enemy' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_SUMMON_SKIPPED' }>;
      expect(event.type).toBe('MINION_SUMMON_SKIPPED');
      expect(event.reason).toBe('TABLE_AT_MAX');
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(3);
  });
});
