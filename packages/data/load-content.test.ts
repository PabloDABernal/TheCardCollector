import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createId, SeededRandomSource } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import type { CatalogRawInput } from '@collector/domain-catalog';
import { decideEnemyAbility } from '@collector/domain-combat';
import type { EnemyAbilityCandidate } from '@collector/domain-combat';
import type { NucleoInstance } from '@collector/domain-combat';

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
}

function readEnemies(): unknown[] {
  return [readJson('./enemies/bestia-base.json'), readJson('./enemies/espectro-base.json')];
}

function readScenarios(): unknown[] {
  return [readJson('./scenarios/bosque-encantado-base.json'), readJson('./scenarios/templo-en-ruinas-base.json')];
}

function buildRawInput(): CatalogRawInput {
  const soldadoCards = readJson('./cards/soldado-base-cards.json') as unknown[];
  const magoCards = readJson('./cards/mago-base-cards.json') as unknown[];
  const commonCards = readJson('./cards/common-cards.json') as unknown[];
  const soldado = readJson('./leaders/soldado-base.json');
  const mago = readJson('./leaders/mago-base.json');

  return {
    cards: [...soldadoCards, ...magoCards, ...commonCards],
    leaders: [soldado, mago],
    enemies: readEnemies(),
    scenarios: readScenarios(),
    evolutionTemplates: [],
  };
}

describe('Contenido de juguete — Líderes (H1.9)', () => {
  it('CatalogLoader.load() resuelve sin lanzar con el contenido real de packages/data', async () => {
    const loader = new CatalogLoader(buildRawInput());
    await expect(loader.load()).resolves.toBeDefined();
  });

  it.each([
    ['leader-soldado-base', 4],
    ['leader-mago-base', 4],
  ])('%s tiene exactamente 4 baseAbilities, con CD1 siempre coreCost ANY (⚫)', async (leaderId) => {
    const loader = new CatalogLoader(buildRawInput());
    await loader.load();
    const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', leaderId));

    expect(leader.baseAbilities).toHaveLength(4);
    const cd1 = leader.baseAbilities.find((a) => a.baseCooldown === 1);
    expect(cd1?.coreCost.kind).toBe('ANY');
    expect(new Set(leader.baseAbilities.map((a) => a.baseCooldown))).toEqual(new Set([1, 2, 3, 4]));
  });

  it.each(['leader-soldado-base', 'leader-mago-base'])(
    '%s tiene un pool de exactamente 10 cartas, y cada CardId resuelve contra la colección "cards"',
    async (leaderId) => {
      const loader = new CatalogLoader(buildRawInput());
      const catalog = await loader.load();
      const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', leaderId));

      expect(leader.cardPoolIds).toHaveLength(10);
      for (const cardId of leader.cardPoolIds) {
        expect(catalog.cards.has(cardId)).toBe(true);
      }
    }
  );

  it('los dos Líderes tienen levelUpOptions cuyo abilityId referencia una de sus propias 4 baseAbilities', async () => {
    const loader = new CatalogLoader(buildRawInput());
    await loader.load();
    for (const leaderId of ['leader-soldado-base', 'leader-mago-base'] as const) {
      const leader = loader.getLeader(createId<'LeaderId'>('LeaderId', leaderId));
      const ownIds = new Set(leader.baseAbilities.map((a) => a.id));
      expect(leader.levelUpOptions.length).toBeGreaterThan(0);
      for (const option of leader.levelUpOptions) {
        expect(ownIds.has(option.effect.abilityId)).toBe(true);
      }
    }
  });
});

describe('Contenido de juguete — Cartas base (H1.12)', () => {
  it('CatalogLoader.load() resuelve sin lanzar con las 26 CardDefinition reales (20 de H1.9 + 6 comunes)', async () => {
    const loader = new CatalogLoader(buildRawInput());
    const catalog = await loader.load();
    expect(catalog.cards.size).toBe(26);
  });

  it.each(['EQUIPO', 'ALIADO', 'EVENTO', 'CONTRATIEMPO'] as const)(
    'el catálogo contiene al menos una CardDefinition de tipo %s',
    async (cardType) => {
      const loader = new CatalogLoader(buildRawInput());
      const catalog = await loader.load();
      const anyOfType = [...catalog.cards.values()].some((c) => c.type === cardType);
      expect(anyOfType).toBe(true);
    }
  );

  it.each([
    'ATAQUE', 'ATAQUE_MAS_X', 'ATAQUE_POR_X', 'DEFENSA_X', 'TRAMA_X', 'UMBRAL', 'ARROLLAR',
    'DESHACER_DANO', 'DESHACER_TURNO', // NUEVO H1.14 — ver spec §7
  ] as const)('el catálogo instancia al menos una vez la keyword %s', async (keyword) => {
    const loader = new CatalogLoader(buildRawInput());
    const catalog = await loader.load();
    const anyWithKeyword = [...catalog.cards.values()].some((c) =>
      c.keywords.some((k) => k.keyword === keyword)
    );
    expect(anyWithKeyword).toBe(true);
  });

  it('las 6 cartas comunes NO están referenciadas por ningún cardPoolIds de Líder', async () => {
    const loader = new CatalogLoader(buildRawInput());
    await loader.load();
    const referenced = new Set([
      ...loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-soldado-base')).cardPoolIds,
      ...loader.getLeader(createId<'LeaderId'>('LeaderId', 'leader-mago-base')).cardPoolIds,
    ] as string[]);
    for (let i = 1; i <= 6; i++) {
      expect(referenced.has(`card-common-0${i}`)).toBe(false);
    }
  });

  // Heredado de H1.9, sigue en verde sin cambios: pools de 10 por Líder resuelven contra
  // el catálogo (ahora de 26 cartas en vez de 20) — ver §1.1, no se repite aquí.
});

describe('Contenido de juguete — Enemigos (H1.10)', () => {
  it('CatalogLoader.load() resuelve sin lanzar con los 2 Enemigos reales', async () => {
    const loader = new CatalogLoader(buildRawInput());
    await expect(loader.load()).resolves.toBeDefined();
  });

  it.each(['enemy-bestia-base', 'enemy-espectro-base'])(
    '%s tiene exactamente 1 BASICA por rama (ATTACK/PLOT), CD1 siempre ANY (⚫)',
    async (enemyId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', enemyId));

      const basicaAttack = enemy.abilities.filter((a) => a.aiProfile.branch === 'ATTACK' && a.aiProfile.tier === 'BASICA');
      const basicaPlot = enemy.abilities.filter((a) => a.aiProfile.branch === 'PLOT' && a.aiProfile.tier === 'BASICA');
      expect(basicaAttack).toHaveLength(1);
      expect(basicaPlot).toHaveLength(1);
      expect(basicaAttack[0]?.coreCost.kind).toBe('ANY');
      expect(basicaPlot[0]?.coreCost.kind).toBe('ANY');
    }
  );

  it.each(['enemy-bestia-base', 'enemy-espectro-base'])(
    '%s define exactamente 2 fases numeradas 1-2, cada una con changeCondition válida',
    async (enemyId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', enemyId));
      expect(enemy.phases.map((p) => p.phaseNumber)).toEqual([1, 2]);
    }
  );

  it.each(['enemy-bestia-base', 'enemy-espectro-base'])(
    '%s tiene un dramaturgiaDeck con al menos 1 carta ATTACK y 1 PLOT',
    async (enemyId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', enemyId));
      const icons = enemy.dramaturgiaDeck.map((c) => c.icon);
      expect(icons).toContain('ATTACK');
      expect(icons).toContain('PLOT');
    }
  );

  it.each([
    ['enemy-bestia-base', 'ability-bestia-base-zarpazo', 'ability-bestia-base-rugido'],
    ['enemy-espectro-base', 'ability-espectro-base-toque-gelido', 'ability-espectro-base-susurro'],
  ] as const)(
    '%s: decideEnemyAbility (domain/combat, H1.7) elige la BASICA de cada rama sin lanzar, usando el contenido real',
    async (enemyId, expectedAttackAbilityId, expectedPlotAbilityId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', enemyId));

      const candidates: EnemyAbilityCandidate[] = enemy.abilities.map((a) => ({
        abilityId: a.id,
        coreCost: a.coreCost,
        baseCooldown: a.baseCooldown,
        remainingCooldown: 0, // todas listas — smoke test de compatibilidad de datos, no de reglas de CD
        aiProfile: a.aiProfile,
      }));
      // Pool vacío: no satisface ningún coreCost 'COLOR' de las FIRMA/STANDARD de
      // ninguno de los dos enemigos (AGRESION/CAOS en bestia-base, CONTROL/CAOS en
      // espectro-base), forzando el fallback real a BASICA en ambos casos.
      const pool: NucleoInstance[] = [];
      const randomSource = new SeededRandomSource(1);

      const attackDecision = decideEnemyAbility('ATTACK', candidates, pool, randomSource);
      const plotDecision = decideEnemyAbility('PLOT', candidates, pool, randomSource);
      expect(attackDecision.branch).toBe('ATTACK');
      expect(attackDecision.tier).toBe('BASICA');
      expect(attackDecision.abilityId).toBe(expectedAttackAbilityId);
      expect(plotDecision.branch).toBe('PLOT');
      expect(plotDecision.tier).toBe('BASICA');
      expect(plotDecision.abilityId).toBe(expectedPlotAbilityId);
    }
  );
});

describe('Contenido de juguete — Escenarios (H1.11)', () => {
  it('CatalogLoader.load() resuelve sin lanzar con los 2 Escenarios reales', async () => {
    const loader = new CatalogLoader(buildRawInput());
    await expect(loader.load()).resolves.toBeDefined();
  });

  it.each(['scenario-bosque-encantado-base', 'scenario-templo-en-ruinas-base'])(
    '%s define exactamente 2 fases numeradas 1-2, ninguna con changeCondition HEALTH_BELOW_PERCENT',
    async (scenarioId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const scenario = loader.getScenario(createId<'ScenarioId'>('ScenarioId', scenarioId));
      expect(scenario.phases.map((p) => p.phaseNumber)).toEqual([1, 2]);
      for (const phase of scenario.phases) {
        expect(phase.changeCondition.kind).not.toBe('HEALTH_BELOW_PERCENT');
      }
    }
  );

  it.each(['scenario-bosque-encantado-base', 'scenario-templo-en-ruinas-base'])(
    '%s define al menos 3 plotThresholds con "atLeast" estrictamente ascendente',
    async (scenarioId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const scenario = loader.getScenario(createId<'ScenarioId'>('ScenarioId', scenarioId));
      expect(scenario.plotThresholds.length).toBeGreaterThanOrEqual(3);
      const atLeasts = scenario.plotThresholds.map((t) => t.atLeast);
      const sorted = [...atLeasts].sort((a, b) => a - b);
      expect(atLeasts).toEqual(sorted);
      expect(new Set(atLeasts).size).toBe(atLeasts.length); // sin repetidos
    }
  );

  it.each(['scenario-bosque-encantado-base', 'scenario-templo-en-ruinas-base'])(
    '%s tiene un dramaturgiaDeck con al menos 1 carta ATTACK y 1 PLOT',
    async (scenarioId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const scenario = loader.getScenario(createId<'ScenarioId'>('ScenarioId', scenarioId));
      const icons = scenario.dramaturgiaDeck.map((c) => c.icon);
      expect(icons).toContain('ATTACK');
      expect(icons).toContain('PLOT');
    }
  );

  it('las 2 cartas comunes (dramacard-common-*) son idénticas en ambos Escenarios', async () => {
    const loader = new CatalogLoader(buildRawInput());
    await loader.load();
    const bosque = loader.getScenario(createId<'ScenarioId'>('ScenarioId', 'scenario-bosque-encantado-base'));
    const templo = loader.getScenario(createId<'ScenarioId'>('ScenarioId', 'scenario-templo-en-ruinas-base'));
    const commonIn = (deck: typeof bosque.dramaturgiaDeck) =>
      deck.filter((c) => String(c.id).startsWith('dramacard-common-'));
    expect(commonIn(bosque.dramaturgiaDeck)).toEqual(commonIn(templo.dramaturgiaDeck));
  });

  it.each([
    ['scenario-bosque-encantado-base', 'enemy-bestia-base'],
    ['scenario-templo-en-ruinas-base', 'enemy-espectro-base'],
  ] as const)(
    '%s: cada icon de su dramaturgiaDeck es consumible por decideEnemyAbility (domain/combat, H1.7) del Enemigo %s, sin adaptador',
    async (scenarioId, enemyId) => {
      const loader = new CatalogLoader(buildRawInput());
      await loader.load();
      const scenario = loader.getScenario(createId<'ScenarioId'>('ScenarioId', scenarioId));
      const enemy = loader.getEnemy(createId<'EnemyId'>('EnemyId', enemyId));

      const candidates: EnemyAbilityCandidate[] = enemy.abilities.map((a) => ({
        abilityId: a.id,
        coreCost: a.coreCost,
        baseCooldown: a.baseCooldown,
        remainingCooldown: 0,
        aiProfile: a.aiProfile,
      }));
      const pool: NucleoInstance[] = [];
      const randomSource = new SeededRandomSource(1);

      for (const card of scenario.dramaturgiaDeck) {
        const decision = decideEnemyAbility(card.icon, candidates, pool, randomSource);
        expect(decision.branch).toBe(card.icon);
      }
    }
  );
});
