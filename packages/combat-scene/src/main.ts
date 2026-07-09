import Phaser from 'phaser';
import type { CatalogRawInput } from '@collector/domain-catalog';
import { CatalogLoader, buildNameLookup } from '@collector/domain-catalog';
import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CombatEngine, buildCombatEngineConfig, cardHasAttackEffect } from '@collector/domain-combat';
import { createCombatBridge } from '@collector/combat-bridge';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from './scenes/CombatScene';
import type { DefaultCombatSetup } from './default-combat-setup';
import type { BoardViewContext, HandCardViewData, AbilityViewData, DramaturgiaCardViewData } from './view';

// H2.9 spec §1.4 — `main.ts` (harness standalone de `combat-scene`, playground de iteración
// rápida sin levantar `apps/shell` completo) pierde su import de `buildDefaultCombatBridge`
// (retirada, migrada a `apps/shell/src/combat/build-combat-setup.ts`) y reconstruye AQUÍ una
// versión reducida de esa misma lógica, con contenido de prueba real (mismo 2×2×2 de H1) — se
// copia deliberadamente (no se reexporta, para no crear una dependencia inversa
// `combat-scene → apps/shell`), mismo criterio que `e2e/combat-scene-smoke-main.ts` ya usa.

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
      keywords: card.keywords, // NUEVO H4 spec §1
      ...(card.ruleText !== undefined ? { ruleText: card.ruleText } : {}), // NUEVO H4 spec §3.2 Gap B
    };
  });

  const leaderAbilities: AbilityViewData[] = leader.baseAbilities.map((ability) => ({
    abilityId: ability.id,
    name: ability.name,
    baseCooldown: ability.baseCooldown,
    coreCost: ability.coreCost, // NUEVO H3 (spec §5.4)
    ...(ability.ruleText !== undefined ? { ruleText: ability.ruleText } : {}), // NUEVO H4 spec §3.2 Gap B
  }));
  const enemyAbilities: AbilityViewData[] = enemy.abilities.map((ability) => ({
    abilityId: ability.id,
    name: ability.name,
    baseCooldown: ability.baseCooldown,
    coreCost: ability.coreCost, // NUEVO H3 (spec §5.4)
    ...(ability.ruleText !== undefined ? { ruleText: ability.ruleText } : {}), // NUEVO H4 spec §3.2 Gap B
  }));

  const enemyDramaturgiaDeck: DramaturgiaCardViewData[] = enemy.dramaturgiaDeck.map((card) => ({
    dramaturgiaCardId: card.id,
    name: card.name,
    icon: card.icon,
    ...(card.effectDescription !== undefined ? { ruleText: card.effectDescription } : {}),
    keywords: [],
  }));

  const boardContext: BoardViewContext = {
    nameLookup,
    leaderMaxHealth: config.leaderMaxHealth,
    enemyMaxHealth: config.enemyMaxHealth,
    scenarioPlotDefeatThreshold: config.scenarioPlotDefeatThreshold,
    leaderCardPool,
    leaderAbilities,
    enemyAbilities,
    enemyDramaturgiaDeck, // NUEVO H4 spec §3.3
  };

  return { bridge, boardContext };
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: COMBAT_SCENE_VIEWPORT.width,
  height: COMBAT_SCENE_VIEWPORT.height,
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: COMBAT_SCENE_VIEWPORT.width,
    height: COMBAT_SCENE_VIEWPORT.height,
  },
  scene: [], // deliberadamente vacío: CombatScene se añade/arranca a mano abajo, para poder pasarle
             // `CombatSceneInitData` en el `start()` (Phaser no permite inyectar `data` de init a una
             // escena listada directamente en `scene: [...]` de la config del Game).
});

// H2.7 QA — `game.scene.add()` puede devolver `null` si se llama antes de que Phaser termine su
// arranque interno (asíncrono pese a que `new Phaser.Game(...)` parezca síncrono). Hay que esperar
// el evento READY del propio Game antes de tocar el SceneManager.
game.events.once(Phaser.Core.Events.READY, () => {
  const scene = game.scene.add('CombatScene', CombatScene, false);
  if (!scene) {
    throw new Error('main.ts: game.scene.add() no devolvió la escena "CombatScene" recién añadida');
  }

  void buildHarnessCombatSetup().then(({ bridge, boardContext }) => {
    game.scene.start('CombatScene', { bridge, boardContext });
  });
});
