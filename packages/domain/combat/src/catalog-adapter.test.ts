import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import type { CatalogRawInput } from '@collector/domain-catalog';
import type { CardDefinition } from '@collector/domain-catalog';
import { CombatEngine } from './combat-engine';
import { buildCombatEngineConfig, cardHasAttackEffect } from './catalog-adapter';

/**
 * Smoke test obligatorio (spec H1.19 §2.3) — mismo patrón de lectura de
 * `packages/data/**` que `packages/data/load-content.test.ts` (duplicado localmente
 * para no crear una dependencia `domain-combat -> data`, prohibida por boundaries).
 */
function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
}

function buildRawInput(): CatalogRawInput {
  const soldadoCards = readJson('../../../data/cards/soldado-base-cards.json') as unknown[];
  const magoCards = readJson('../../../data/cards/mago-base-cards.json') as unknown[];
  const commonCards = readJson('../../../data/cards/common-cards.json') as unknown[];
  const soldado = readJson('../../../data/leaders/soldado-base.json');
  const mago = readJson('../../../data/leaders/mago-base.json');
  const bestia = readJson('../../../data/enemies/bestia-base.json');
  const espectro = readJson('../../../data/enemies/espectro-base.json');
  const bosque = readJson('../../../data/scenarios/bosque-encantado-base.json');
  const templo = readJson('../../../data/scenarios/templo-en-ruinas-base.json');

  return {
    cards: [...soldadoCards, ...magoCards, ...commonCards],
    leaders: [soldado, mago],
    enemies: [bestia, espectro],
    scenarios: [bosque, templo],
    evolutionTemplates: [],
  };
}

describe('buildCombatEngineConfig (H1.19) — smoke test con contenido real de packages/data', () => {
  it('no lanza para leader-soldado-base + enemy-bestia-base + scenario-bosque-encantado-base, y permite construir un CombatEngine', async () => {
    const loader = new CatalogLoader(buildRawInput());
    const catalog = await loader.load();

    const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-soldado-base') as LeaderId);
    const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
    const scenario = loader.getScenario(
      createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
    );

    const config = buildCombatEngineConfig({
      catalog,
      leader,
      enemy,
      scenario,
      randomSource: new SeededRandomSource(1),
    });

    expect(() => new CombatEngine(config)).not.toThrow();
  });

  it.each(['leader-soldado-base', 'leader-mago-base'])(
    '%s: playableCards + allyCards + contratiempoCards suman exactamente 10 (tamaño de cardPoolIds)',
    async (leaderId) => {
      const loader = new CatalogLoader(buildRawInput());
      const catalog = await loader.load();
      const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', leaderId) as LeaderId);
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
      const scenario = loader.getScenario(
        createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
      );

      const config = buildCombatEngineConfig({
        catalog,
        leader,
        enemy,
        scenario,
        randomSource: new SeededRandomSource(1),
      });

      const total = config.playableCards!.size + config.allyCards!.size + config.contratiempoCards!.size;
      expect(total).toBe(10);
    }
  );

  it.each(['leader-soldado-base', 'leader-mago-base'])(
    '%s: al menos una carta resuelve a ATTACK_ENEMY, y jugarla contra el motor sube enemyDamage',
    async (leaderId) => {
      const loader = new CatalogLoader(buildRawInput());
      const catalog = await loader.load();
      const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', leaderId) as LeaderId);
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
      const scenario = loader.getScenario(
        createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
      );

      const config = buildCombatEngineConfig({
        catalog,
        leader,
        enemy,
        scenario,
        randomSource: new SeededRandomSource(1),
      });

      const attackCardEntry = [...config.playableCards!.entries()].find(
        ([, def]) => def.effect?.kind === 'ATTACK_ENEMY'
      );
      expect(attackCardEntry).toBeDefined();
      const [cardId] = attackCardEntry!;

      // NUEVO H3.6 — `leaderDeckCardIds` (10 cartas) se baraja y solo 5 entran a la mano
      // inicial; `initialHandSize: 10` garantiza que la carta de ataque encontrada esté
      // en mano para este smoke test, sin depender de la semilla del shuffle.
      const engine = new CombatEngine({ ...config, initialHandSize: 10 });
      const snapshot = engine.getSnapshot();
      const nucleo = snapshot.nucleoTable.find((d) => d.status === 'AVAILABLE')!;

      const result = engine.dispatch({
        type: 'PLAY_CARD',
        cardId,
        sourceId: 'leader',
        nucleoInstanceId: nucleo.id,
        target: { kind: 'ENEMY' },
      });

      expect(result.ok).toBe(true);
      expect(engine.getSnapshot().enemyDamage).toBeGreaterThan(0);
    }
  );

  it.each([
    ['leader-soldado-base', 'enemy-bestia-base', 'scenario-bosque-encantado-base'],
    ['leader-soldado-base', 'enemy-espectro-base', 'scenario-templo-en-ruinas-base'],
    ['leader-mago-base', 'enemy-bestia-base', 'scenario-bosque-encantado-base'],
    ['leader-mago-base', 'enemy-espectro-base', 'scenario-templo-en-ruinas-base'],
  ] as const)(
    '%s x %s x %s: enemyAbilityAiProfiles/dramaturgiaDeck quedan pobladas y el primer END_TURN dispara la IA sin lanzar',
    async (leaderId, enemyId, scenarioId) => {
      const loader = new CatalogLoader(buildRawInput());
      const catalog = await loader.load();
      const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', leaderId) as LeaderId);
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', enemyId) as EnemyId);
      const scenario = loader.getScenario(createId<'ScenarioId'>('ScenarioId', scenarioId) as ScenarioId);

      const config = buildCombatEngineConfig({
        catalog,
        leader,
        enemy,
        scenario,
        randomSource: new SeededRandomSource(1),
      });

      expect(config.enemyAbilityAiProfiles!.size).toBeGreaterThan(0);
      expect(config.dramaturgiaDeck!.length).toBeGreaterThan(0);

      const engine = new CombatEngine(config);
      const result = engine.dispatch({ type: 'END_TURN' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.some((e) => e.type === 'ABILITY_ACTIVATED' && e.side === 'ENEMY')).toBe(true);
      }
    }
  );
});

describe('buildCombatEngineConfig — §3.10.4: minionDefinitions resuelto desde EnemyDefinition.minions', () => {
  it('enemy-bestia-base declara minion-bestia-base-cachorro, y buildCombatEngineConfig lo resuelve a una MinionDefinition real (no al Map vacío de antes)', async () => {
    const loader = new CatalogLoader(buildRawInput());
    const catalog = await loader.load();
    const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-soldado-base') as LeaderId);
    const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
    const scenario = loader.getScenario(
      createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
    );

    const config = buildCombatEngineConfig({
      catalog,
      leader,
      enemy,
      scenario,
      randomSource: new SeededRandomSource(1),
    });

    expect(config.minionDefinitions!.size).toBeGreaterThan(0);
    const cachorro = config.minionDefinitions!.get('minion-bestia-base-cachorro');
    expect(cachorro).toBeDefined();
    expect(cachorro!.maxLife).toBe(4);
    expect(cachorro!.planoAttackAmount).toBe(1);
    expect(cachorro!.isDefensor).toBe(false);
    expect(cachorro!.passiveEffect).toEqual({ kind: 'ATTACK', amount: 1 });
  });

  it('SUMMON_MINION contra el motor construido con este config resuelve MINION_SUMMONED (no MINION_DEFINITION_UNKNOWN)', async () => {
    const loader = new CatalogLoader(buildRawInput());
    const catalog = await loader.load();
    const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-soldado-base') as LeaderId);
    const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
    const scenario = loader.getScenario(
      createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
    );

    const config = buildCombatEngineConfig({
      catalog,
      leader,
      enemy,
      scenario,
      randomSource: new SeededRandomSource(1),
      initialTurnOwner: 'ENEMY',
    });

    const engine = new CombatEngine({ ...config, enemyAbilityAiProfiles: new Map(), dramaturgiaDeck: [] });
    const result = engine.dispatch({
      type: 'SUMMON_MINION',
      minionDefinitionId: 'minion-bestia-base-cachorro',
      sourceId: 'test',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]!.type).toBe('MINION_SUMMONED');
    }
    expect(engine.getSnapshot().minionsInPlay).toHaveLength(1);
  });
});

describe('cardHasAttackEffect (H2.9 spec §4.2.1)', () => {
  function fakeCard(keywords: CardDefinition['keywords']): CardDefinition {
    return {
      id: createId<'CardId'>('CardId', 'fake-card') as CardDefinition['id'],
      name: 'Fake',
      type: 'EVENTO',
      cost: { energy: 1 },
      keywords,
    };
  }

  it.each(['ATAQUE', 'ATAQUE_MAS_X', 'ATAQUE_POR_X'] as const)(
    '%s → true',
    (keyword) => {
      const amount = keyword === 'ATAQUE' ? undefined : 2;
      const card = fakeCard(amount !== undefined ? [{ keyword, amount }] : [{ keyword }]);
      expect(cardHasAttackEffect(card)).toBe(true);
    }
  );

  it.each(['TRAMA_X', 'DEFENSA_X'] as const)('%s (sin keyword de ataque) → false', (keyword) => {
    const card = fakeCard([{ keyword, amount: 1 }]);
    expect(cardHasAttackEffect(card)).toBe(false);
  });

  it('sin keywords → false', () => {
    expect(cardHasAttackEffect(fakeCard([]))).toBe(false);
  });

  it('resolveKeywordEffect (vía buildCombatEngineConfig) sigue produciendo el mismo effect tras la refactorización (regresión cero)', async () => {
    const loader = new CatalogLoader(buildRawInput());
    const catalog = await loader.load();
    const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-soldado-base') as LeaderId);
    const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', 'enemy-bestia-base') as EnemyId);
    const scenario = loader.getScenario(
      createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base') as ScenarioId
    );

    const config = buildCombatEngineConfig({
      catalog,
      leader,
      enemy,
      scenario,
      randomSource: new SeededRandomSource(1),
    });

    const attackCardEntry = [...config.playableCards!.entries()].find(
      ([, def]) => def.effect?.kind === 'ATTACK_ENEMY'
    );
    expect(attackCardEntry).toBeDefined();
  });
});
