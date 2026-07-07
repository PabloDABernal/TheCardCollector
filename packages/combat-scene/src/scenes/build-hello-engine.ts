import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig } from '@collector/domain-combat';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { loadRawContent } from '../load-raw-content';

const DEFAULT_LEADER_ID = 'leader-soldado-base';
const DEFAULT_ENEMY_ID = 'enemy-bestia-base';
const DEFAULT_SCENARIO_ID = 'scenario-bosque-encantado-base';
const HELLO_SEED = 1;

/**
 * `engine.getSnapshot()` no lleva `leaderMaxHealth`/`enemyMaxHealth` (son dato de
 * `LeaderDefinition`/`EnemyDefinition`, ver `CombatStateSnapshot` en `domain-combat`) —
 * se exponen aquí junto al snapshot, mismo patrón que `RenderContext` de
 * `packages/cli/src/renderer.ts`, para que la escena pueda pintar "vida" (maxHealth -
 * damage) sin volver a resolver el catálogo.
 */
export interface HelloCombatResult {
  readonly snapshot: CombatStateSnapshot;
  readonly leaderMaxHealth: number;
  readonly enemyMaxHealth: number;
}

/**
 * Lógica pura extraída de `HelloCombatScene` (spec H2.1 §4.2) para poder testearla sin
 * depender del ciclo de vida completo de `Phaser.Scene`. Construye un `CombatEngine`
 * real (mismo patrón que `packages/cli/src/main.ts`, H1.19) contra el contenido real
 * 2×2×2 de `packages/data`, con un `SeededRandomSource` de semilla fija para
 * reproducibilidad determinista.
 */
export async function buildHelloCombatResult(): Promise<HelloCombatResult> {
  const rawInput = await loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();

  const leader = catalog.leaders.get(createId<'LeaderId'>('LeaderId', DEFAULT_LEADER_ID) as LeaderId)!;
  const enemy = catalog.enemies.get(createId<'EnemyId'>('EnemyId', DEFAULT_ENEMY_ID) as EnemyId)!;
  const scenario = catalog.scenarios.get(createId<'ScenarioId'>('ScenarioId', DEFAULT_SCENARIO_ID) as ScenarioId)!;

  const randomSource = new SeededRandomSource(HELLO_SEED);
  const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource });
  const engine = new CombatEngine(config);

  return {
    snapshot: engine.getSnapshot(),
    leaderMaxHealth: leader.maxHealth,
    enemyMaxHealth: enemy.maxHealth,
  };
}
