import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import { resolveDefenderMinion } from './minion-ai';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { MinionDefinition, MinionDefinitionId, MinionInPlay } from './types/minion';

const ENEMY_SPECIAL_A: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-minion-special-a');
const ENEMY_SPECIAL_B: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-minion-special-b');
const LEADER_FILLER: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-filler');

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

/** Fixture recomendada por la spec H1.16 §6: 2 habilidades ATTACK de acción especial de
 *  Secuaz (side ENEMY) + varias MinionDefinition cubriendo acción especial/plano/Defensor/pasivo. */
function buildEngine(overrides: Partial<CombatEngineConfig> = {}) {
  return new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999,
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs([ENEMY_SPECIAL_A, ENEMY_SPECIAL_B, LEADER_FILLER]),
    abilityCooldowns: cooldowns([
      [ENEMY_SPECIAL_A, { side: 'ENEMY', baseCooldown: 1 }],
      [ENEMY_SPECIAL_B, { side: 'ENEMY', baseCooldown: 1 }],
      [LEADER_FILLER, { side: 'LEADER', baseCooldown: 1 }],
    ]),
    abilityEffects: effects([
      [ENEMY_SPECIAL_A, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 4 } } }],
      [ENEMY_SPECIAL_B, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 4 } } }],
    ]),
    minionDefinitions: minionDefinitions([
      [
        MINION_SPECIAL_A,
        {
          passiveEffect: { kind: 'PLOT', amount: 0 },
          specialActionAbilityId: ENEMY_SPECIAL_A,
          planoAttackAmount: 1,
          isDefensor: false,
        },
      ],
      [
        MINION_SPECIAL_B,
        {
          passiveEffect: { kind: 'PLOT', amount: 0 },
          specialActionAbilityId: ENEMY_SPECIAL_B,
          planoAttackAmount: 1,
          isDefensor: false,
        },
      ],
      [
        MINION_PLANO,
        { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 3, isDefensor: false },
      ],
      [
        MINION_DEFENSOR,
        { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true },
      ],
      [
        MINION_PASSIVE_PLOT,
        { passiveEffect: { kind: 'PLOT', amount: 1 }, planoAttackAmount: 0, isDefensor: false },
      ],
      [
        MINION_PASSIVE_ATTACK,
        { passiveEffect: { kind: 'ATTACK', amount: 2 }, planoAttackAmount: 0, isDefensor: false },
      ],
    ]),
    initialTurnOwner: 'LEADER',
    poolSize: 6,
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
  it('Secuaz entra en mesa con pasivo declarado: SUMMON_MINION exitoso, minionsInPlay contiene la instancia, MINION_SUMMONED emitido', () => {
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

  it('selección aleatoria con filtro de validez (acción especial): con 2 Secuaces listos, RESOLVE_MINION_ACTION elige uno; el NO elegido no muta CD/log', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const minionA = summonMinion(engine, MINION_SPECIAL_A);
    const minionB = summonMinion(engine, MINION_SPECIAL_B);

    const result = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) throw new Error('unreachable');

    const resolvedEvent = result.value.find((e) => e.type === 'MINION_ACTION_RESOLVED') as Extract<
      CombatEvent,
      { type: 'MINION_ACTION_RESOLVED' }
    >;
    expect(resolvedEvent.mechanism).toBe('SPECIAL_ACTION');
    expect([minionA.instanceId, minionB.instanceId]).toContain(resolvedEvent.instanceId);

    const chosenAbilityId = resolvedEvent.instanceId === minionA.instanceId ? ENEMY_SPECIAL_A : ENEMY_SPECIAL_B;
    const otherAbilityId = resolvedEvent.instanceId === minionA.instanceId ? ENEMY_SPECIAL_B : ENEMY_SPECIAL_A;

    const cooldowns = engine.getSnapshot().cooldowns;
    expect(cooldowns.find((c) => c.abilityId === chosenAbilityId)!.remaining).toBe(1); // baseCooldown, recién activada
    expect(cooldowns.find((c) => c.abilityId === otherAbilityId)!.remaining).toBe(0); // sin tocar

    expect(engine.getSnapshot().leaderDamage).toBeGreaterThan(0);
  });

  it('filtro de validez excluye CD no disponible: con 1 Secuaz en CD>0 y otro Secuaz solo plano, cae a ataque plano', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_SPECIAL_A);
    // Consume la acción especial del Enemigo mismo con la misma habilidad para dejarla en CD.
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const activation = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_SPECIAL_A, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(activation)).toBe(true);
    expect(engine.getSnapshot().cooldowns.find((c) => c.abilityId === ENEMY_SPECIAL_A)!.remaining).toBe(1);

    const result = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const resolvedEvent = result.value.find((e) => e.type === 'MINION_ACTION_RESOLVED') as Extract<
        CombatEvent,
        { type: 'MINION_ACTION_RESOLVED' }
      >;
      expect(resolvedEvent.mechanism).toBe('PLANO_ATTACK');
    }
  });

  it('fallback a ataque plano: sin ninguna acción especial lista, aplica planoAttackAmount con nucleoSpent null', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_PLANO);

    const result = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) throw new Error('unreachable');

    const damaged = result.value.find((e) => e.type === 'LEADER_DAMAGED') as Extract<CombatEvent, { type: 'LEADER_DAMAGED' }>;
    expect(damaged).toBeDefined();
    expect(damaged.nucleoSpent).toBeNull();
    expect(damaged.abilityId).toBeUndefined();
    expect(engine.getSnapshot().leaderDamage).toBe(3);
  });

  it('solo 1 actúa por turno: un segundo RESOLVE_MINION_ACTION en el mismo turno de Enemigo → MINION_ACTION_ALREADY_RESOLVED_THIS_TURN; tras END_TURN vuelve a funcionar', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    summonMinion(engine, MINION_PLANO);

    const first = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(first)).toBe(true);

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

  it('sin Secuaces en mesa: RESOLVE_MINION_ACTION emite MINION_ACTION_SKIPPED sin error, sin marcar el turno como resuelto', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      const event = result.value[0] as Extract<CombatEvent, { type: 'MINION_ACTION_SKIPPED' }>;
      expect(event.reason).toBe('NO_MINIONS_IN_PLAY');
    }

    // Al no haberse "resuelto" el turno, un SUMMON_MINION + RESOLVE_MINION_ACTION inmediato después sigue funcionando.
    summonMinion(engine, MINION_PLANO);
    const afterSummon = engine.dispatch({ type: 'RESOLVE_MINION_ACTION' });
    expect(isOk(afterSummon)).toBe(true);
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

  describe('resolveDefenderMinion (pura, sin integración — ver spec §0.5)', () => {
    it('0 Secuaces isDefensor → null', () => {
      const minions: MinionInPlay[] = [
        { instanceId: createId('CardInstanceId', 'm1'), definitionId: 'a', passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: false },
      ];
      expect(resolveDefenderMinion(minions)).toBeNull();
    });

    it('1 Secuaz isDefensor → esa instancia', () => {
      const defensor: MinionInPlay = {
        instanceId: createId('CardInstanceId', 'm2'), definitionId: 'b', passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true,
      };
      const minions: MinionInPlay[] = [
        { instanceId: createId('CardInstanceId', 'm1'), definitionId: 'a', passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: false },
        defensor,
      ];
      expect(resolveDefenderMinion(minions)).toBe(defensor);
    });

    it('2 Secuaces isDefensor → el primero por orden de entrada', () => {
      const firstDefensor: MinionInPlay = {
        instanceId: createId('CardInstanceId', 'm1'), definitionId: 'a', passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true,
      };
      const secondDefensor: MinionInPlay = {
        instanceId: createId('CardInstanceId', 'm2'), definitionId: 'b', passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true,
      };
      expect(resolveDefenderMinion([firstDefensor, secondDefensor])).toBe(firstDefensor);
    });
  });

  describe('constructor: validación de minionDefinitions', () => {
    it('lanza si planoAttackAmount no es entero o es negativo', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999,
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: -1, isDefensor: false }]]),
      })).toThrow();
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999,
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_PLANO, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1.5, isDefensor: false }]]),
      })).toThrow();
    });

    it('lanza si specialActionAbilityId no existe en abilityCooldowns', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999,
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([]),
        abilityCooldowns: cooldowns([]),
        minionDefinitions: minionDefinitions([[MINION_SPECIAL_A, { passiveEffect: { kind: 'PLOT', amount: 0 }, specialActionAbilityId: ENEMY_SPECIAL_A, planoAttackAmount: 1, isDefensor: false }]]),
      })).toThrow();
    });

    it('lanza si specialActionAbilityId existe con side LEADER', () => {
      expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999,
        randomSource: new SeededRandomSource(1),
        abilityCoreCosts: costs([ENEMY_SPECIAL_A]),
        abilityCooldowns: cooldowns([[ENEMY_SPECIAL_A, { side: 'LEADER', baseCooldown: 1 }]]),
        minionDefinitions: minionDefinitions([[MINION_SPECIAL_A, { passiveEffect: { kind: 'PLOT', amount: 0 }, specialActionAbilityId: ENEMY_SPECIAL_A, planoAttackAmount: 1, isDefensor: false }]]),
      })).toThrow();
    });
  });
});
