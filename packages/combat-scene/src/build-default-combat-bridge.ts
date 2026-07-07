import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig } from '@collector/domain-combat';
import { createCombatBridge } from '@collector/combat-bridge';
import type { CombatBridge } from '@collector/combat-bridge';
import { loadRawContent } from './load-raw-content';

// Mismos 3 ids de contenido 2×2×2 que `build-hello-engine.ts` (H2.1) usaba — sin cambio de contenido,
// decisions.md "2026-07-06" ya fija reutilizar el 2×2×2 de H1 para H2.8-H2.9; este harness hace lo mismo
// desde antes, sin crear contenido nuevo.
const DEFAULT_LEADER_ID = 'leader-soldado-base';
const DEFAULT_ENEMY_ID = 'enemy-bestia-base';
const DEFAULT_SCENARIO_ID = 'scenario-bosque-encantado-base';
const HARNESS_SEED = 1;

/**
 * Construye un `CombatBridge` real (motor + puente, sin snapshot expuesto por separado — quien lo necesite
 * llama a `bridge.getSnapshot()`) contra el contenido real 2×2×2. Sustituye la responsabilidad de
 * `build-hello-engine.ts` (H2.1, eliminado en H2.6): migra su lógica de construcción de catálogo/engine,
 * pero devuelve un `CombatBridge` (H2.3) en vez de un `CombatEngine` crudo + snapshot. Único consumidor hoy:
 * `main.ts` (harness standalone de `combat-scene`) — H2.9 sustituirá esta función por la construcción
 * equivalente que viva en `apps/shell` (mismo patrón, catálogo real vía `loadRawContent`/fetch en vez de
 * duplicar aquí).
 */
export async function buildDefaultCombatBridge(): Promise<CombatBridge> {
  const rawInput = await loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();

  const leader = catalog.leaders.get(createId<'LeaderId'>('LeaderId', DEFAULT_LEADER_ID) as LeaderId)!;
  const enemy = catalog.enemies.get(createId<'EnemyId'>('EnemyId', DEFAULT_ENEMY_ID) as EnemyId)!;
  const scenario = catalog.scenarios.get(createId<'ScenarioId'>('ScenarioId', DEFAULT_SCENARIO_ID) as ScenarioId)!;

  const randomSource = new SeededRandomSource(HARNESS_SEED);
  const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource });
  const engine = new CombatEngine(config);

  return createCombatBridge(engine);
}
