import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import type { CatalogRawInput } from '@collector/domain-catalog';

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
}

function buildRawInput(): CatalogRawInput {
  const soldadoCards = readJson('./cards/soldado-base-cards.json') as unknown[];
  const magoCards = readJson('./cards/mago-base-cards.json') as unknown[];
  const soldado = readJson('./leaders/soldado-base.json');
  const mago = readJson('./leaders/mago-base.json');

  return {
    cards: [...soldadoCards, ...magoCards],
    leaders: [soldado, mago],
    enemies: [],
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
