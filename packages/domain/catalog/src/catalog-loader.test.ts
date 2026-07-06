import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import { CatalogLoader } from './catalog-loader';
import type { CatalogRawInput } from './types/catalog';

// -----------------------------------------------------------------------------
// Helpers — datos de PRUEBA mínimos, literales planos (raw), como pide spec §0.5/§6.
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
    cardPoolIds: ['card-1'],
    levelUpOptions: [],
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
    plotThresholds: [{ atLeast: 3, description: 'umbral' }],
    passives: [{ description: 'pasivo' }],
    phases: [{ phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } }],
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

function validRawInput(overrides: Partial<CatalogRawInput> = {}): CatalogRawInput {
  return {
    cards: [cardRaw()],
    leaders: [leaderRaw()],
    enemies: [enemyRaw()],
    scenarios: [scenarioRaw()],
    evolutionTemplates: [evolutionTemplateRaw()],
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// 18-24. CatalogLoader
// -----------------------------------------------------------------------------

describe('CatalogLoader', () => {
  it('load() con un CatalogRawInput completo y válido → resuelve sin lanzar; los accessors devuelven exactamente los objetos esperados', async () => {
    const loader = new CatalogLoader(validRawInput());
    const catalog = await loader.load();

    expect(catalog.cards.size).toBe(1);
    expect(loader.getCard(createId<'CardId'>('CardId', 'card-1')).id).toEqual('card-1');
    expect(loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-1')).id).toEqual('leader-1');
    expect(loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-1')).id).toEqual('enemy-1');
    expect(loader.getScenario(createId<'ScenarioId'>('ScenarioId', 'scenario-1')).id).toEqual('scenario-1');
    expect(loader.getEvolutionTemplate(createId<'EvolutionTemplateId'>('EvolutionTemplateId', 'evo-1')).id).toEqual(
      'evo-1'
    );
  });

  it('llamar a cualquier getX(id) ANTES de load() → lanza', () => {
    const loader = new CatalogLoader(validRawInput());
    expect(() => loader.getCard(createId<'CardId'>('CardId', 'card-1'))).toThrow();
    expect(() => loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-1'))).toThrow();
  });

  it('llamar a getCard(idInexistente) DESPUÉS de load() → lanza mencionando el id y la colección', async () => {
    const loader = new CatalogLoader(validRawInput());
    await loader.load();
    expect(() => loader.getCard(createId<'CardId'>('CardId', 'no-existe'))).toThrow(/no-existe/);
    expect(() => loader.getCard(createId<'CardId'>('CardId', 'no-existe'))).toThrow(/cards/);
  });

  it('duplicado de id DENTRO de la misma colección (dos cartas con el mismo CardId) → load() lanza mencionando el índice del duplicado', async () => {
    const loader = new CatalogLoader(validRawInput({ cards: [cardRaw(), cardRaw()] }));
    await expect(loader.load()).rejects.toThrow(/índice 1/);
  });

  it('load() propaga tal cual el Error de un parse* fallido', async () => {
    const loader = new CatalogLoader(validRawInput({ cards: [cardRaw({ name: undefined })] }));
    await expect(loader.load()).rejects.toThrow(/name/);
  });

  it('load() propaga tal cual el Error de validateCrossReferences (referencia rota end-to-end)', async () => {
    const loader = new CatalogLoader(validRawInput({ leaders: [leaderRaw({ cardPoolIds: ['card-no-existe'] })] }));
    await expect(loader.load()).rejects.toThrow(/card-no-existe/);
  });

  it('load() devuelve una Promise', () => {
    const loader = new CatalogLoader(validRawInput());
    expect(loader.load()).toBeInstanceOf(Promise);
  });
});
