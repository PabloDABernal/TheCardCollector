import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  SeededRandomSource,
  createId,
  isOk,
  isErr,
  type AbilityId,
  type CoreCostRequirement,
  type LeaderId,
  type EnemyId,
  type ScenarioId,
} from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { MinionDefinition, MinionDefinitionId } from './types/minion';

/**
 * NUEVO H4.x — casos §1.5 de la spec
 * H4_targeting_habilidades_y_ficha_personaje.md: fix del bug de motor donde
 * `ACTIVATE_ABILITY` con `effect.kind: 'ATTACK'` y `side: 'LEADER'` no soportaba
 * targeting (antes de este fix habría dañado al propio Líder/Aliado en vez de al
 * Enemigo/Secuaz). Mismo estilo/helpers que `combat-engine.targeting.test.ts`.
 */

const LEADER_ATTACK_ABILITY: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-attack-ability');
const ENEMY_ATTACK_ABILITY: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack-ability');

const MINION_WEAK: MinionDefinitionId = 'minion-weak'; // maxLife 3
const MINION_DEFENSOR: MinionDefinitionId = 'minion-defensor';

function costs(): Map<AbilityId, CoreCostRequirement> {
  return new Map([
    [LEADER_ATTACK_ABILITY, { kind: 'ANY' } as CoreCostRequirement],
    [ENEMY_ATTACK_ABILITY, { kind: 'ANY' } as CoreCostRequirement],
  ]);
}

function cooldowns(): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map([
    [LEADER_ATTACK_ABILITY, { side: 'LEADER' as const, baseCooldown: 1 }],
    [ENEMY_ATTACK_ABILITY, { side: 'ENEMY' as const, baseCooldown: 1 }],
  ]);
}

function effects(): Map<AbilityId, AbilityEffectDefinition> {
  return new Map([
    [LEADER_ATTACK_ABILITY, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }],
    [ENEMY_ATTACK_ABILITY, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }],
  ]);
}

function minionDefinitions(): Map<MinionDefinitionId, MinionDefinition> {
  return new Map([
    [MINION_WEAK, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: false, maxLife: 3 }],
    [MINION_DEFENSOR, { passiveEffect: { kind: 'PLOT', amount: 0 }, planoAttackAmount: 1, isDefensor: true, maxLife: 5 }],
  ]);
}

function buildEngine(overrides: Partial<CombatEngineConfig> = {}): CombatEngine {
  return new CombatEngine({
    leaderMaxHealth: 100,
    enemyMaxHealth: 100,
    scenarioPlotDefeatThreshold: 999,
    leaderDeckCardIds: [],
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs(),
    abilityCooldowns: cooldowns(),
    abilityEffects: effects(),
    minionDefinitions: minionDefinitions(),
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

describe('CombatEngine — H4.x: targeting de ACTIVATE_ABILITY (fix del bug de motor §1.1)', () => {
  it('caso 1 — ATTACK del LEADER contra ENEMY, sin Secuaces en mesa: daña al Enemigo, Líder intacto', () => {
    const engine = buildEngine();
    const leaderDamageBefore = engine.getSnapshot().leaderDamage;
    const leaderShieldBefore = engine.getSnapshot().leaderShield;
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: LEADER_ATTACK_ABILITY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'ENEMY' },
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.some((e) => e.type === 'ABILITY_ACTIVATED')).toBe(true);
      const dmg = result.value.find((e) => e.type === 'ENEMY_DAMAGED') as Extract<CombatEvent, { type: 'ENEMY_DAMAGED' }>;
      expect(dmg).toBeDefined();
      expect(dmg.abilityId).toBe(LEADER_ATTACK_ABILITY);
      expect(dmg.cardId).toBeUndefined();
      expect(dmg.enemyDamageAfter).toBeGreaterThan(0);
      expect(dmg.enemyDamageAfter).toBe(engine.getSnapshot().enemyDamage);
    }

    // Regresión directa del bug §1.1 — antes del fix, este mismo comando habría dañado
    // al Líder en vez de al Enemigo.
    expect(engine.getSnapshot().leaderDamage).toBe(leaderDamageBefore);
    expect(engine.getSnapshot().leaderShield).toBe(leaderShieldBefore);
  });

  it('caso 2 — ATTACK del LEADER sin target → ABILITY_TARGET_REQUIRED, sin mutación', () => {
    const engine = buildEngine();
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const snapshotBefore = engine.getSnapshot();

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: LEADER_ATTACK_ABILITY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect((result.error as CombatCommandError).code).toBe('ABILITY_TARGET_REQUIRED');

    const snapshotAfter = engine.getSnapshot();
    expect(snapshotAfter.enemyDamage).toBe(snapshotBefore.enemyDamage);
    expect(snapshotAfter.actions.actionsTaken).toBe(snapshotBefore.actions.actionsTaken);
    expect(snapshotAfter.nucleoTable.find((d) => d.id === nucleo.id)?.status).toBe('AVAILABLE');
  });

  it('caso 3 — ATTACK del LEADER contra un Secuaz vivo (sin Defensor): baja su vida; si muere, MINION_DEFEATED + Arrollar pasa el exceso', () => {
    const engine = buildEngine();
    const minionInstanceId = summonAndReturnToLeader(engine, MINION_WEAK); // maxLife 3
    const realId = engine.getSnapshot().minionsInPlay[0]!.instanceId;
    expect(String(realId)).toBe(minionInstanceId);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: LEADER_ATTACK_ABILITY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: realId },
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const dmg = result.value.find((e) => e.type === 'MINION_DAMAGED') as Extract<CombatEvent, { type: 'MINION_DAMAGED' }>;
      expect(dmg).toBeDefined();
      expect(dmg.abilityId).toBe(LEADER_ATTACK_ABILITY);
      expect(dmg.cardId).toBeUndefined();
      expect(dmg.lifeAfter).toBeLessThanOrEqual(3);
      // VALUE puro con dado 1-4: puede matar o no según el valor tirado — ambos casos válidos.
      if (dmg.died) {
        expect(result.value.some((e) => e.type === 'MINION_DEFEATED')).toBe(true);
        expect(engine.getSnapshot().minionsInPlay).toHaveLength(0);
      } else {
        expect(engine.getSnapshot().minionsInPlay).toHaveLength(1);
      }
    }
  });

  it('caso 3b — Arrollar:true en la habilidad pasa el exceso al Enemigo cuando el golpe mata al Secuaz', () => {
    const arrollarAbility: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-attack-arrollar');
    const engine = buildEngine({
      abilityCoreCosts: new Map([[arrollarAbility, { kind: 'ANY' } as CoreCostRequirement]]),
      abilityCooldowns: new Map([[arrollarAbility, { side: 'LEADER' as const, baseCooldown: 1 }]]),
      abilityEffects: new Map([
        [arrollarAbility, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 10 } }, arrollar: true }],
      ]),
    });
    const minionInstanceId = summonAndReturnToLeader(engine, MINION_WEAK); // maxLife 3
    const realId = engine.getSnapshot().minionsInPlay[0]!.instanceId;
    expect(String(realId)).toBe(minionInstanceId);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: arrollarAbility,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: realId },
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const dmg = result.value.find((e) => e.type === 'MINION_DAMAGED') as Extract<CombatEvent, { type: 'MINION_DAMAGED' }>;
      expect(dmg.died).toBe(true);
      expect(dmg.appliedDamageToEnemy).toBe(dmg.excess);
      expect(dmg.appliedDamageToEnemy).toBeGreaterThan(0);
    }
    expect(engine.getSnapshot().enemyDamage).toBeGreaterThan(0);
  });

  it('caso 4 — target MINION con minionInstanceId inexistente → ATTACK_TARGET_NOT_FOUND', () => {
    const engine = buildEngine();
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const fakeId = createId<'CardInstanceId'>('CardInstanceId', 'no-existe');

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: LEADER_ATTACK_ABILITY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: fakeId },
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect((result.error as CombatCommandError).code).toBe('ATTACK_TARGET_NOT_FOUND');
  });

  it('caso 5 — Defensor vivo en mesa, target ENEMY → MUST_TARGET_DEFENSOR (con abilityId, nunca cardId)', () => {
    const engine = buildEngine();
    summonAndReturnToLeader(engine, MINION_DEFENSOR);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: LEADER_ATTACK_ABILITY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'ENEMY' },
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error as CombatCommandError;
      expect(error.code).toBe('MUST_TARGET_DEFENSOR');
      if (error.code === 'MUST_TARGET_DEFENSOR') {
        expect(error.abilityId).toBe(LEADER_ATTACK_ABILITY);
        expect(error.cardId).toBeUndefined();
      }
    }
  });

  it('caso 5b — Defensor vivo, atacarlo directamente SÍ funciona', () => {
    const engine = buildEngine();
    const defensorId = summonAndReturnToLeader(engine, MINION_DEFENSOR);
    const realId = engine.getSnapshot().minionsInPlay[0]!.instanceId;
    expect(String(realId)).toBe(defensorId);
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: LEADER_ATTACK_ABILITY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'MINION', minionInstanceId: realId },
    });

    expect(isOk(result)).toBe(true);
  });

  it('caso 6 — side ENEMY con habilidad ATTACK: comportamiento IDÉNTICO a antes del fix (target ausente/ignorado, golpea Líder)', () => {
    const engine = buildEngine();
    engine.dispatch({ type: 'END_TURN' }); // -> ENEMY
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const leaderDamageBefore = engine.getSnapshot().leaderDamage;
    const enemyDamageBefore = engine.getSnapshot().enemyDamage;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ENEMY_ATTACK_ABILITY,
      sourceId: 'enemy',
      side: 'ENEMY',
      nucleoInstanceId: nucleo.id,
      // Sin target — irrelevante/ignorado para side ENEMY.
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const dmg = result.value.find((e) => e.type === 'LEADER_DAMAGED') as Extract<CombatEvent, { type: 'LEADER_DAMAGED' }>;
      expect(dmg).toBeDefined();
      expect(result.value.some((e) => e.type === 'ENEMY_DAMAGED')).toBe(false);
    }
    expect(engine.getSnapshot().leaderDamage).toBeGreaterThan(leaderDamageBefore);
    expect(engine.getSnapshot().enemyDamage).toBe(enemyDamageBefore);
  });

  it('caso 8/10 — contenido real: "Guardia Firme" (soldado-base.json) carga vía CatalogLoader y daña al Enemigo activándola con target ENEMY', async () => {
    const { CatalogLoader } = await import('@collector/domain-catalog');
    const { buildCombatEngineConfig } = await import('./catalog-adapter');

    function readJson(relativePath: string): unknown {
      return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
    }
    const soldadoCards = readJson('../../../data/cards/soldado-base-cards.json') as unknown[];
    const magoCards = readJson('../../../data/cards/mago-base-cards.json') as unknown[];
    const commonCards = readJson('../../../data/cards/common-cards.json') as unknown[];
    const soldado = readJson('../../../data/leaders/soldado-base.json');
    const mago = readJson('../../../data/leaders/mago-base.json');
    const bestia = readJson('../../../data/enemies/bestia-base.json');
    const espectro = readJson('../../../data/enemies/espectro-base.json');
    const bosque = readJson('../../../data/scenarios/bosque-encantado-base.json');
    const templo = readJson('../../../data/scenarios/templo-en-ruinas-base.json');

    const loader = new CatalogLoader({
      cards: [...soldadoCards, ...magoCards, ...commonCards],
      leaders: [soldado, mago],
      enemies: [bestia, espectro],
      scenarios: [bosque, templo],
      evolutionTemplates: [],
    });
    const catalog = await loader.load();
    const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-soldado-base') as LeaderId);
    const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
    const scenario = loader.getScenario(
      createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
    );

    const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource: new SeededRandomSource(1) });

    // Caso 10 — el constructor de CombatEngine pasa validateAbilityEffectsConfig sin lanzar.
    expect(() => new CombatEngine(config)).not.toThrow();

    const engine = new CombatEngine(config);
    const guardiaFirmeId: AbilityId = createId<'AbilityId'>('AbilityId', 'ability-soldado-base-guardia-firme');
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const enemyDamageBefore = engine.getSnapshot().enemyDamage;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: guardiaFirmeId,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
      target: { kind: 'ENEMY' },
    });

    expect(isOk(result)).toBe(true);
    expect(engine.getSnapshot().enemyDamage).toBeGreaterThan(enemyDamageBefore);
  });
});
