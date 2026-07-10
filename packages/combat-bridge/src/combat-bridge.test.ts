import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId, NucleoInstanceId } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import type { CatalogRawInput } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig } from '@collector/domain-combat';
import type { CombatEvent } from '@collector/domain-combat';
import { createCombatBridge } from './combat-bridge';

/**
 * Test de aislamiento (spec H2.3 §4) — sin React, sin Phaser, sin DOM. Mismo patrón de
 * lectura de `packages/data/**` que `catalog-adapter.test.ts` (H1.19), duplicado
 * localmente para no crear una dependencia `combat-bridge -> data` prohibida por
 * boundaries (spec §5).
 */
function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
}

function buildRawInput(): CatalogRawInput {
  const soldadoCards = readJson('../../data/cards/soldado-base-cards.json') as unknown[];
  const magoCards = readJson('../../data/cards/mago-base-cards.json') as unknown[];
  const commonCards = readJson('../../data/cards/common-cards.json') as unknown[];
  const soldado = readJson('../../data/leaders/soldado-base.json');
  const mago = readJson('../../data/leaders/mago-base.json');
  const bestia = readJson('../../data/enemies/bestia-base.json');
  const espectro = readJson('../../data/enemies/espectro-base.json');
  const bosque = readJson('../../data/scenarios/bosque-encantado-base.json');
  const templo = readJson('../../data/scenarios/templo-en-ruinas-base.json');

  return {
    cards: [...soldadoCards, ...magoCards, ...commonCards],
    leaders: [soldado, mago],
    enemies: [bestia, espectro],
    scenarios: [bosque, templo],
    evolutionTemplates: [],
  };
}

async function buildEngine(): Promise<CombatEngine> {
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

  return new CombatEngine(config);
}

describe('createCombatBridge (H2.3) — pub/sub en aislamiento contra CombatEngine real', () => {
  it('dispatch reenvía al engine y ambos canales reciben exactamente los mismos eventos, una vez cada uno', async () => {
    const engine = await buildEngine();
    const bridge = createCombatBridge(engine);

    const hudEvents: CombatEvent[] = [];
    const sceneEvents: CombatEvent[] = [];
    const hudListener = vi.fn((e: CombatEvent) => hudEvents.push(e));
    const sceneListener = vi.fn((e: CombatEvent) => sceneEvents.push(e));

    bridge.subscribeHudEvents(hudListener);
    bridge.subscribeSceneEvents(sceneListener);

    const snapshot = bridge.getSnapshot();
    const nucleo = snapshot.nucleoTable[0]!;

    // CD1 del Líder soldado-base ("Guardia Firme") acepta cualquier Núcleo (coreCost
    // ANY). MODIFICADO H4.x — "Guardia Firme" es ahora una habilidad ATTACK real (fix
    // del bug de motor, ver spec H4_targeting_habilidades_y_ficha_personaje.md §1.3);
    // requiere `target` explícito.
    const result = bridge.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: createId<'AbilityId'>('AbilityId', 'ability-soldado-base-guardia-firme'),
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id as NucleoInstanceId,
      target: { kind: 'ENEMY' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeGreaterThan(0);
    expect(result.value.some((e) => e.type === 'ABILITY_ACTIVATED')).toBe(true);

    expect(hudListener).toHaveBeenCalledTimes(result.value.length);
    expect(sceneListener).toHaveBeenCalledTimes(result.value.length);
    expect(hudEvents).toEqual(result.value);
    expect(sceneEvents).toEqual(result.value);
  });

  it('Unsubscribe funciona por canal, no globalmente', async () => {
    const engine = await buildEngine();
    const bridge = createCombatBridge(engine);

    const hudEvents: CombatEvent[] = [];
    const sceneEvents: CombatEvent[] = [];
    const hudUnsubscribe = bridge.subscribeHudEvents((e) => hudEvents.push(e));
    bridge.subscribeSceneEvents((e) => sceneEvents.push(e));

    const snapshot = bridge.getSnapshot();
    const nucleo = snapshot.nucleoTable[0]!;

    hudUnsubscribe();

    const result = bridge.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: createId<'AbilityId'>('AbilityId', 'ability-soldado-base-guardia-firme'),
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id as NucleoInstanceId,
      target: { kind: 'ENEMY' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeGreaterThan(0);

    expect(hudEvents).toEqual([]);
    expect(sceneEvents).toEqual(result.value);
  });

  it('getSnapshot() refleja el mismo estado que engine.getSnapshot() tras un dispatch', async () => {
    const engine = await buildEngine();
    const bridge = createCombatBridge(engine);

    const snapshot = bridge.getSnapshot();
    const nucleo = snapshot.nucleoTable[0]!;

    bridge.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: createId<'AbilityId'>('AbilityId', 'ability-soldado-base-guardia-firme'),
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: nucleo.id as NucleoInstanceId,
      target: { kind: 'ENEMY' },
    });

    expect(bridge.getSnapshot()).toEqual(engine.getSnapshot());
  });

  it('un comando rechazado no invoca a ningún listener de ningún canal', async () => {
    const engine = await buildEngine();
    const bridge = createCombatBridge(engine);

    const hudListener = vi.fn();
    const sceneListener = vi.fn();
    bridge.subscribeHudEvents(hudListener);
    bridge.subscribeSceneEvents(sceneListener);

    const result = bridge.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: createId<'AbilityId'>('AbilityId', 'ability-soldado-base-guardia-firme'),
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-inexistente') as NucleoInstanceId,
    });

    expect(result.ok).toBe(false);
    expect(hudListener).not.toHaveBeenCalled();
    expect(sceneListener).not.toHaveBeenCalled();
  });
});
