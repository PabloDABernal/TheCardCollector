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

function buildRawInput(): CatalogRawInput {
  const soldadoCards = readJson('./cards/soldado-base-cards.json') as unknown[];
  const magoCards = readJson('./cards/mago-base-cards.json') as unknown[];
  const soldado = readJson('./leaders/soldado-base.json');
  const mago = readJson('./leaders/mago-base.json');

  return {
    cards: [...soldadoCards, ...magoCards],
    leaders: [soldado, mago],
    enemies: readEnemies(),
    scenarios: [],
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
