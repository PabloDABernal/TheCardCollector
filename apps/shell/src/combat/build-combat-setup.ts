import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CatalogLoader, buildNameLookup } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig, cardHasAttackEffect } from '@collector/domain-combat';
import { createCombatBridge } from '@collector/combat-bridge';
import type { BoardViewContext, HandCardViewData, AbilityViewData, DefaultCombatSetup } from '@collector/combat-scene';
import { loadRawContent } from './load-raw-content';

// Mismos 3 ids de contenido 2×2×2 que `build-default-combat-bridge.ts` (retirado, H2.9 spec §1.3)
// ya usaba — sin cambio de contenido, decisions.md "2026-07-06" fija reutilizar el 2×2×2 de H1.
const DEFAULT_LEADER_ID = 'leader-soldado-base';
const DEFAULT_ENEMY_ID = 'enemy-bestia-base';
const DEFAULT_SCENARIO_ID = 'scenario-bosque-encantado-base';
const SHELL_SEED = 1;

/**
 * Reemplaza a `buildDefaultCombatBridge` de `combat-scene` (retirada, H2.9 spec §1.3) — mismo
 * contrato de retorno (`DefaultCombatSetup`, tipo reexportado desde `@collector/combat-scene`)
 * para que `CombatScreen` no tenga que conocer su forma interna, solo pasarlo tal cual a
 * `game.scene.start(...)`. Único punto de construcción de producción del `CombatEngine` →
 * `CombatBridge` → `BoardViewContext` (`architecture_stack.md` §2.3: "el CombatEngine se crea en
 * React/factory de apps/shell").
 */
export async function buildCombatSetup(): Promise<DefaultCombatSetup> {
  const rawInput = await loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();

  const leader = catalog.leaders.get(createId<'LeaderId'>('LeaderId', DEFAULT_LEADER_ID) as LeaderId)!;
  const enemy = catalog.enemies.get(createId<'EnemyId'>('EnemyId', DEFAULT_ENEMY_ID) as EnemyId)!;
  const scenario = catalog.scenarios.get(createId<'ScenarioId'>('ScenarioId', DEFAULT_SCENARIO_ID) as ScenarioId)!;

  const randomSource = new SeededRandomSource(SHELL_SEED);
  const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource });
  const engine = new CombatEngine(config);
  const bridge = createCombatBridge(engine);

  const nameLookup = buildNameLookup({ leader, enemy, catalog });
  const leaderCardPool: HandCardViewData[] = leader.cardPoolIds.map((cardId) => {
    const card = catalog.cards.get(cardId)!; // garantizado por CatalogLoader
    return {
      cardId,
      name: card.name,
      energyCost: card.cost.energy,
      cardType: card.type,
      requiresNucleoInstance: cardHasAttackEffect(card), // NUEVO H2.9 spec §4.2
    };
  });

  const leaderAbilities: AbilityViewData[] = leader.baseAbilities.map((ability) => ({
    abilityId: ability.id,
    name: ability.name,
    baseCooldown: ability.baseCooldown,
  }));
  const enemyAbilities: AbilityViewData[] = enemy.abilities.map((ability) => ({
    abilityId: ability.id,
    name: ability.name,
    baseCooldown: ability.baseCooldown,
  }));

  const boardContext: BoardViewContext = {
    nameLookup,
    leaderMaxHealth: config.leaderMaxHealth,
    enemyMaxHealth: config.enemyMaxHealth,
    scenarioPlotDefeatThreshold: config.scenarioPlotDefeatThreshold,
    leaderCardPool,
    leaderAbilities, // NUEVO H2.10
    enemyAbilities, // NUEVO H2.10
  };

  return { bridge, boardContext };
}
