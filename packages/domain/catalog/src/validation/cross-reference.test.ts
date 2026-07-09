import { describe, it, expect } from 'vitest';
import {
  parseCardDefinition,
  parseLeaderDefinition,
  parseEnemyDefinition,
  parseEvolutionTemplate,
  parseScenarioDefinition,
} from './schema';
import { validateCrossReferences } from './cross-reference';
import type { Catalog } from '../types/catalog';

// -----------------------------------------------------------------------------
// Helpers — mismos literales mínimos que schema.test.ts, construyen Catalog
// directamente (sin pasar por CatalogLoader) para aislar validateCrossReferences.
// -----------------------------------------------------------------------------

function cardRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'card-1', name: 'Carta de Prueba', type: 'EQUIPO', cost: { energy: 1 }, keywords: [], ...overrides };
}

function abilityRaw(id: string, baseCooldown: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, name: id, coreCost: { kind: 'ANY' }, baseCooldown, ...overrides };
}

function leaderRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'leader-1',
    name: 'Líder de Prueba',
    baseAbilities: [
      abilityRaw('leader-1-cd1', 1),
      abilityRaw('leader-1-cd2', 2),
      abilityRaw('leader-1-cd3', 3),
      abilityRaw('leader-1-cd4', 4),
    ],
    cardPoolIds: [],
    levelUpOptions: [],
    maxHealth: 30,
    ...overrides,
  };
}

function enemyRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'enemy-1',
    name: 'Enemigo de Prueba',
    abilities: [
      { ...abilityRaw('enemy-1-attack-basica', 1), aiProfile: { branch: 'ATTACK', tier: 'BASICA' } },
      { ...abilityRaw('enemy-1-plot-basica', 1), aiProfile: { branch: 'PLOT', tier: 'BASICA' } },
    ],
    phases: [{ phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } }],
    maxHealth: 50,
    dramaturgiaDeck: [
      { id: 'dramacard-1', name: 'Carta 1', icon: 'ATTACK' },
      { id: 'dramacard-2', name: 'Carta 2', icon: 'ATTACK' },
      { id: 'dramacard-3', name: 'Carta 3', icon: 'PLOT' },
      { id: 'dramacard-4', name: 'Carta 4', icon: 'PLOT' },
    ],
    ...overrides,
  };
}

function scenarioRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'scenario-1',
    name: 'Escenario de Prueba',
    plotThresholds: [
      { atLeast: 2, description: 'umbral 1' },
      { atLeast: 4, description: 'umbral 2' },
      { atLeast: 6, description: 'umbral 3' },
    ],
    passives: [],
    phases: [{ phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } }],
    dramaturgiaDeck: [
      { id: 'dramacard-s1', name: 'Carta S1', icon: 'ATTACK' },
      { id: 'dramacard-s2', name: 'Carta S2', icon: 'ATTACK' },
      { id: 'dramacard-s3', name: 'Carta S3', icon: 'PLOT' },
      { id: 'dramacard-s4', name: 'Carta S4', icon: 'PLOT' },
    ],
    ...overrides,
  };
}

function evolutionTemplateRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evo-1',
    name: 'Plantilla de Prueba',
    target: { kind: 'CARD_TYPE', cardType: 'EQUIPO' },
    kind: 'TEMPLATE',
    effect: { op: 'REMOVE_BACKLASH' },
    ...overrides,
  };
}

function catalogOf(overrides: Partial<Catalog> = {}): Catalog {
  return {
    cards: new Map(),
    leaders: new Map(),
    enemies: new Map(),
    scenarios: new Map(),
    evolutionTemplates: new Map(),
    ...overrides,
  } as Catalog;
}

function mapOf<T extends { id: unknown }>(...items: T[]): ReadonlyMap<T['id'], T> {
  return new Map(items.map((item) => [item.id, item]));
}

// -----------------------------------------------------------------------------
// 11-17. validateCrossReferences
// -----------------------------------------------------------------------------

describe('validateCrossReferences', () => {
  it('catálogo válido mínimo (1 Líder con cardPoolIds que resuelven, 1 Carta, 1 EvolutionTemplate TEMPLATE) → no lanza', () => {
    const card = parseCardDefinition(cardRaw(), 'cards[0]');
    const leader = parseLeaderDefinition(leaderRaw({ cardPoolIds: ['card-1'] }), 'leaders[0]');
    const template = parseEvolutionTemplate(evolutionTemplateRaw(), 'evolutionTemplates[0]');

    const catalog = catalogOf({
      cards: mapOf(card),
      leaders: mapOf(leader),
      evolutionTemplates: mapOf(template),
    });

    expect(() => validateCrossReferences(catalog)).not.toThrow();
  });

  it('LeaderDefinition.cardPoolIds con un CardId inexistente en cards → lanza mencionando el id roto y el Líder', () => {
    const leader = parseLeaderDefinition(leaderRaw({ cardPoolIds: ['card-no-existe'] }), 'leaders[0]');
    const catalog = catalogOf({ leaders: mapOf(leader) });

    expect(() => validateCrossReferences(catalog)).toThrow(/card-no-existe/);
    expect(() => validateCrossReferences(catalog)).toThrow(/leader-1/);
  });

  it('levelUpOptions[].effect.abilityId que NO existe en absoluto → lanza', () => {
    const leader = parseLeaderDefinition(
      leaderRaw({
        levelUpOptions: [
          { id: 'opt-1', description: 'desc', effect: { op: 'DECREASE_COST', abilityId: 'no-existe' } },
        ],
      }),
      'leaders[0]'
    );
    const catalog = catalogOf({ leaders: mapOf(leader) });

    expect(() => validateCrossReferences(catalog)).toThrow();
  });

  it('levelUpOptions[].effect.abilityId que pertenece a OTRO Líder → lanza', () => {
    const leaderA = parseLeaderDefinition(leaderRaw({ id: 'leader-a' }), 'leaders[0]');
    const leaderB = parseLeaderDefinition(
      leaderRaw({
        id: 'leader-b',
        baseAbilities: [
          abilityRaw('leader-b-cd1', 1),
          abilityRaw('leader-b-cd2', 2),
          abilityRaw('leader-b-cd3', 3),
          abilityRaw('leader-b-cd4', 4),
        ],
        levelUpOptions: [
          // referencia una habilidad real, pero de leaderA, no de leaderB
          { id: 'opt-1', description: 'desc', effect: { op: 'DECREASE_COST', abilityId: 'leader-1-cd2' } },
        ],
      }),
      'leaders[1]'
    );
    const catalog = catalogOf({ leaders: mapOf(leaderA, leaderB) });

    expect(() => validateCrossReferences(catalog)).toThrow();
  });

  it('EvolutionTemplate kind BESPOKE con bespokeCardId inexistente en cards → lanza', () => {
    const template = parseEvolutionTemplate(
      evolutionTemplateRaw({ kind: 'BESPOKE', bespokeCardId: 'card-no-existe' }),
      'evolutionTemplates[0]'
    );
    const catalog = catalogOf({ evolutionTemplates: mapOf(template) });

    expect(() => validateCrossReferences(catalog)).toThrow(/card-no-existe/);
  });

  it('dos Enemigos distintos cuyos abilities comparten el mismo AbilityId → lanza mencionando ambos orígenes', () => {
    const enemyA = parseEnemyDefinition(enemyRaw({ id: 'enemy-a' }), 'enemies[0]');
    const enemyB = parseEnemyDefinition(
      enemyRaw({
        id: 'enemy-b',
        abilities: [
          { ...abilityRaw('enemy-1-attack-basica', 1), aiProfile: { branch: 'ATTACK', tier: 'BASICA' } }, // colisión
          { ...abilityRaw('enemy-b-plot-basica', 1), aiProfile: { branch: 'PLOT', tier: 'BASICA' } },
        ],
      }),
      'enemies[1]'
    );
    const catalog = catalogOf({ enemies: mapOf(enemyA, enemyB) });

    expect(() => validateCrossReferences(catalog)).toThrow(/enemies\["enemy-a"\]\.abilities/);
    expect(() => validateCrossReferences(catalog)).toThrow(/enemies\["enemy-b"\]\.abilities/);
  });

  it('un Líder y un Enemigo cuyos AbilityId colisionan entre sí → lanza', () => {
    const leader = parseLeaderDefinition(
      leaderRaw({
        baseAbilities: [
          abilityRaw('shared-ability-id', 1),
          abilityRaw('leader-1-cd2', 2),
          abilityRaw('leader-1-cd3', 3),
          abilityRaw('leader-1-cd4', 4),
        ],
      }),
      'leaders[0]'
    );
    const enemy = parseEnemyDefinition(
      enemyRaw({
        abilities: [
          { ...abilityRaw('shared-ability-id', 1), aiProfile: { branch: 'ATTACK', tier: 'BASICA' } },
          { ...abilityRaw('enemy-1-plot-basica', 1), aiProfile: { branch: 'PLOT', tier: 'BASICA' } },
        ],
      }),
      'enemies[0]'
    );
    const catalog = catalogOf({ leaders: mapOf(leader), enemies: mapOf(enemy) });

    expect(() => validateCrossReferences(catalog)).toThrow(/shared-ability-id/);
  });

  it('múltiples violaciones simultáneas → lanza en la PRIMERA según el orden de validateCrossReferences (cardPool antes que levelUp)', () => {
    const leader = parseLeaderDefinition(
      leaderRaw({
        cardPoolIds: ['card-no-existe'], // 1ª violación: validateLeaderCardPools
        levelUpOptions: [
          { id: 'opt-1', description: 'desc', effect: { op: 'DECREASE_COST', abilityId: 'no-existe' } }, // 2ª violación
        ],
      }),
      'leaders[0]'
    );
    const catalog = catalogOf({ leaders: mapOf(leader) });

    // la violación de cardPoolIds se detecta primero — el mensaje NO debe mencionar la
    // referencia rota de levelUpOptions (documenta el orden fail-fast).
    expect(() => validateCrossReferences(catalog)).toThrow(/cardPoolIds/);
  });

  // ---------------------------------------------------------------------------
  // NUEVO §3.10.4 — DramaturgiaCardDefinition.summonEffect.minionDefinitionId
  // ---------------------------------------------------------------------------

  it('Enemigo con summonEffect.minionDefinitionId que existe en su propio minions[] → no lanza', () => {
    const enemy = parseEnemyDefinition(
      enemyRaw({
        minions: [
          {
            id: 'minion-1',
            name: 'Secuaz',
            passiveEffect: { kind: 'ATTACK', amount: 1 },
            planoAttackAmount: 1,
            isDefensor: false,
            maxLife: 4,
          },
        ],
        dramaturgiaDeck: [
          { id: 'dramacard-1', name: 'Carta 1', icon: 'ATTACK', summonEffect: { minionDefinitionId: 'minion-1' } },
          { id: 'dramacard-2', name: 'Carta 2', icon: 'ATTACK' },
          { id: 'dramacard-3', name: 'Carta 3', icon: 'PLOT' },
          { id: 'dramacard-4', name: 'Carta 4', icon: 'PLOT' },
        ],
      }),
      'enemies[0]'
    );
    const catalog = catalogOf({ enemies: mapOf(enemy) });

    expect(() => validateCrossReferences(catalog)).not.toThrow();
  });

  it('Enemigo con summonEffect.minionDefinitionId que NO existe en su minions[] → lanza mencionando el id roto y el Enemigo', () => {
    const enemy = parseEnemyDefinition(
      enemyRaw({
        dramaturgiaDeck: [
          {
            id: 'dramacard-1',
            name: 'Carta 1',
            icon: 'ATTACK',
            summonEffect: { minionDefinitionId: 'minion-no-existe' },
          },
          { id: 'dramacard-2', name: 'Carta 2', icon: 'ATTACK' },
          { id: 'dramacard-3', name: 'Carta 3', icon: 'PLOT' },
          { id: 'dramacard-4', name: 'Carta 4', icon: 'PLOT' },
        ],
      }),
      'enemies[0]'
    );
    const catalog = catalogOf({ enemies: mapOf(enemy) });

    expect(() => validateCrossReferences(catalog)).toThrow(/minion-no-existe/);
    expect(() => validateCrossReferences(catalog)).toThrow(/enemy-1/);
  });

  it('Escenario con summonEffect.minionDefinitionId que NO existe en su minions[] → lanza', () => {
    const scenario = parseScenarioDefinition(
      scenarioRaw({
        dramaturgiaDeck: [
          {
            id: 'dramacard-s1',
            name: 'Carta S1',
            icon: 'ATTACK',
            summonEffect: { minionDefinitionId: 'minion-no-existe' },
          },
          { id: 'dramacard-s2', name: 'Carta S2', icon: 'ATTACK' },
          { id: 'dramacard-s3', name: 'Carta S3', icon: 'PLOT' },
          { id: 'dramacard-s4', name: 'Carta S4', icon: 'PLOT' },
        ],
      }),
      'scenarios[0]'
    );
    const catalog = catalogOf({ scenarios: mapOf(scenario) });

    expect(() => validateCrossReferences(catalog)).toThrow(/minion-no-existe/);
  });

  it('un Enemigo no puede resolver summonEffect contra el minions[] de OTRO Enemigo (aislamiento por propietario)', () => {
    const enemyWithMinion = parseEnemyDefinition(
      enemyRaw({
        id: 'enemy-a',
        minions: [
          {
            id: 'minion-1',
            name: 'Secuaz',
            passiveEffect: { kind: 'ATTACK', amount: 1 },
            planoAttackAmount: 1,
            isDefensor: false,
            maxLife: 4,
          },
        ],
      }),
      'enemies[0]'
    );
    const enemyReferencingOthersMinion = parseEnemyDefinition(
      enemyRaw({
        id: 'enemy-b',
        abilities: [
          { ...abilityRaw('enemy-b-attack-basica', 1), aiProfile: { branch: 'ATTACK', tier: 'BASICA' } },
          { ...abilityRaw('enemy-b-plot-basica', 1), aiProfile: { branch: 'PLOT', tier: 'BASICA' } },
        ],
        dramaturgiaDeck: [
          { id: 'dramacard-b1', name: 'Carta B1', icon: 'ATTACK', summonEffect: { minionDefinitionId: 'minion-1' } },
          { id: 'dramacard-b2', name: 'Carta B2', icon: 'ATTACK' },
          { id: 'dramacard-b3', name: 'Carta B3', icon: 'PLOT' },
          { id: 'dramacard-b4', name: 'Carta B4', icon: 'PLOT' },
        ],
      }),
      'enemies[1]'
    );
    const catalog = catalogOf({ enemies: mapOf(enemyWithMinion, enemyReferencingOthersMinion) });

    expect(() => validateCrossReferences(catalog)).toThrow(/enemy-b/);
  });
});
