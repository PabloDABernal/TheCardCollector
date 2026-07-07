import Phaser from 'phaser';
import type { CatalogRawInput } from '@collector/domain-catalog';
import { CatalogLoader, buildNameLookup } from '@collector/domain-catalog';
import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CombatEngine, buildCombatEngineConfig, cardHasAttackEffect } from '@collector/domain-combat';
import { createCombatBridge } from '@collector/combat-bridge';
import type { CombatBridge } from '@collector/combat-bridge';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from '../src/scenes/CombatScene';
import type { DefaultCombatSetup } from '../src/default-combat-setup';
import type { BoardViewContext, HandCardViewData } from '../src/view';

declare global {
  interface Window {
    __combatBridge?: CombatBridge;
  }
}

/**
 * H2.6 spec §5.3 — bootstrap standalone de `combat-scene-smoke.html`, deliberadamente separado de
 * `src/main.ts` (mismo criterio que `juice-smoke-main.ts`, H2.5): reusa la `CombatScene` real de
 * producción (a diferencia de `juice-smoke-scene.ts`, que usaba una escena mínima ad-hoc), pero
 * expone temporalmente `window.__combatBridge` — SOLO en este harness de verificación visual
 * manual, nunca en `src/main.ts` — para que `combat-scene-smoke.spec.ts` pueda disparar comandos
 * reales contra el `CombatBridge` (drenar el pool de Núcleos hasta forzar un reroll) sin necesitar
 * un `InputAdapter` real (H2.7, todavía no existe).
 *
 * H2.9 fix — `buildDefaultCombatBridge` (retirada, migrada a
 * `apps/shell/src/combat/build-combat-setup.ts`) ya no existe en `combat-scene`. Este harness
 * reconstruye la misma versión reducida de esa lógica que `src/main.ts` ya reconstruyó (mismo
 * contenido de prueba real 2×2×2 de H1), copiada deliberadamente (no reexportada, para no crear
 * una dependencia inversa `combat-scene → apps/shell` ni entre harnesses).
 */

const DEFAULT_LEADER_ID = 'leader-soldado-base';
const DEFAULT_ENEMY_ID = 'enemy-bestia-base';
const DEFAULT_SCENARIO_ID = 'scenario-bosque-encantado-base';
const HARNESS_SEED = 1;

const isNodeRuntime = typeof process !== 'undefined' && !!process.versions?.node;

async function loadRawContent(): Promise<CatalogRawInput> {
  const [soldadoCards, magoCards, commonCards, soldado, mago, bestia, espectro, bosque, templo] = await Promise.all([
    readContent('cards/soldado-base-cards.json'),
    readContent('cards/mago-base-cards.json'),
    readContent('cards/common-cards.json'),
    readContent('leaders/soldado-base.json'),
    readContent('leaders/mago-base.json'),
    readContent('enemies/bestia-base.json'),
    readContent('enemies/espectro-base.json'),
    readContent('scenarios/bosque-encantado-base.json'),
    readContent('scenarios/templo-en-ruinas-base.json'),
  ]);

  return {
    cards: [...(soldadoCards as unknown[]), ...(magoCards as unknown[]), ...(commonCards as unknown[])],
    leaders: [soldado, mago],
    enemies: [bestia, espectro],
    scenarios: [bosque, templo],
    evolutionTemplates: [],
  };
}

async function readContent(relativePath: string): Promise<unknown> {
  if (isNodeRuntime) {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = fileURLToPath(import.meta.url);
    const dataDir = join(dirname(here), '..', '..', 'data');
    return JSON.parse(readFileSync(join(dataDir, relativePath), 'utf-8'));
  }
  const response = await fetch(`/data/${relativePath}`);
  return response.json() as Promise<unknown>;
}

async function buildHarnessCombatSetup(): Promise<DefaultCombatSetup> {
  const rawInput = await loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();

  const leader = catalog.leaders.get(createId<'LeaderId'>('LeaderId', DEFAULT_LEADER_ID) as LeaderId)!;
  const enemy = catalog.enemies.get(createId<'EnemyId'>('EnemyId', DEFAULT_ENEMY_ID) as EnemyId)!;
  const scenario = catalog.scenarios.get(createId<'ScenarioId'>('ScenarioId', DEFAULT_SCENARIO_ID) as ScenarioId)!;

  const randomSource = new SeededRandomSource(HARNESS_SEED);
  const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource });
  const engine = new CombatEngine(config);
  const bridge = createCombatBridge(engine);

  const nameLookup = buildNameLookup({ leader, enemy, catalog });
  const leaderCardPool: HandCardViewData[] = leader.cardPoolIds.map((cardId) => {
    const card = catalog.cards.get(cardId)!;
    return {
      cardId,
      name: card.name,
      energyCost: card.cost.energy,
      cardType: card.type,
      requiresNucleoInstance: cardHasAttackEffect(card),
    };
  });

  const boardContext: BoardViewContext = {
    nameLookup,
    leaderMaxHealth: config.leaderMaxHealth,
    enemyMaxHealth: config.enemyMaxHealth,
    scenarioPlotDefeatThreshold: config.scenarioPlotDefeatThreshold,
    leaderCardPool,
  };

  return { bridge, boardContext };
}

const game = new Phaser.Game({
  // CANVAS (no WebGL/AUTO) — lectura de píxeles fiable en el sandbox de verificación visual (evita
  // "GPU stall due to ReadPixels" con el Chromium headless preinstalado del entorno, mismo criterio que
  // `juice-smoke-main.ts`, H2.5).
  type: Phaser.CANVAS,
  width: COMBAT_SCENE_VIEWPORT.width,
  height: COMBAT_SCENE_VIEWPORT.height,
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: COMBAT_SCENE_VIEWPORT.width,
    height: COMBAT_SCENE_VIEWPORT.height,
  },
  scene: [],
});

game.scene.add('CombatScene', CombatScene);

void buildHarnessCombatSetup().then(({ bridge, boardContext }) => {
  window.__combatBridge = bridge;
  game.scene.start('CombatScene', { bridge, boardContext });
});
