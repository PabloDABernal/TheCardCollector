import { createId, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CatalogLoader, buildNameLookup } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig, cardHasAttackEffect } from '@collector/domain-combat';
import { createCombatBridge } from '@collector/combat-bridge';
import type {
  BoardViewContext,
  HandCardViewData,
  AbilityViewData,
  DramaturgiaCardViewData,
  DefaultCombatSetup,
} from '@collector/combat-scene';
import { loadRawContent } from './load-raw-content';
import { DEFAULT_LEADER_OPTION } from './leader-options';

// Enemigo/Escenario del contenido 2×2×2 que `build-default-combat-bridge.ts` (retirado, H2.9 spec
// §1.3) ya usaba — sin cambio de contenido, decisions.md "2026-07-06" fija reutilizar el 2×2×2 de
// H1. El Líder ya no es una constante fija aquí (H2.14): ahora es parámetro opcional, ver
// `BuildCombatSetupParams` abajo. NUEVO H4.x — Enemigo/Escenario siguen el mismo patrón: parámetros
// opcionales con estos valores como fallback (selector de testeo, no el sorteo 3+3 real de H4).
const DEFAULT_ENEMY_ID = 'enemy-bestia-base';
const DEFAULT_SCENARIO_ID = 'scenario-bosque-encantado-base';
const SHELL_SEED = 1;

export interface BuildCombatSetupParams {
  /** ID de `LeaderDefinition` a cargar — NUEVO H2.14. Si se omite, usa el mismo Líder por defecto que
   *  `apps/shell` ya jugaba antes de esta historia (`DEFAULT_LEADER_OPTION.leaderId`). */
  readonly leaderId?: string;
  /** ID de `EnemyDefinition` a cargar — NUEVO H4.x. Si se omite, usa `DEFAULT_ENEMY_ID` (mismo
   *  Enemigo que `apps/shell` ya jugaba antes de esta historia). */
  readonly enemyId?: string;
  /** ID de `ScenarioDefinition` a cargar — NUEVO H4.x. Si se omite, usa `DEFAULT_SCENARIO_ID` (mismo
   *  Escenario que `apps/shell` ya jugaba antes de esta historia). */
  readonly scenarioId?: string;
}

/**
 * Reemplaza a `buildDefaultCombatBridge` de `combat-scene` (retirada, H2.9 spec §1.3) — mismo
 * contrato de retorno (`DefaultCombatSetup`, tipo reexportado desde `@collector/combat-scene`)
 * para que `CombatScreen` no tenga que conocer su forma interna, solo pasarlo tal cual a
 * `game.scene.start(...)`. Único punto de construcción de producción del `CombatEngine` →
 * `CombatBridge` → `BoardViewContext` (`architecture_stack.md` §2.3: "el CombatEngine se crea en
 * React/factory de apps/shell").
 */
export async function buildCombatSetup(params: BuildCombatSetupParams = {}): Promise<DefaultCombatSetup> {
  const leaderId = params.leaderId ?? DEFAULT_LEADER_OPTION.leaderId;
  const enemyId = params.enemyId ?? DEFAULT_ENEMY_ID;
  const scenarioId = params.scenarioId ?? DEFAULT_SCENARIO_ID;

  const rawInput = await loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();

  const leader = catalog.leaders.get(createId<'LeaderId'>('LeaderId', leaderId) as LeaderId)!;
  const enemy = catalog.enemies.get(createId<'EnemyId'>('EnemyId', enemyId) as EnemyId)!;
  const scenario = catalog.scenarios.get(createId<'ScenarioId'>('ScenarioId', scenarioId) as ScenarioId)!;

  const randomSource = new SeededRandomSource(SHELL_SEED);
  const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource });
  const engine = new CombatEngine(config);
  const bridge = createCombatBridge(engine);

  const nameLookup = buildNameLookup({ leader, enemy, scenario, catalog });
  const leaderCardPool: HandCardViewData[] = leader.cardPoolIds.map((cardId) => {
    const card = catalog.cards.get(cardId)!; // garantizado por CatalogLoader
    return {
      cardId,
      name: card.name,
      energyCost: card.cost.energy,
      cardType: card.type,
      requiresNucleoInstance: cardHasAttackEffect(card), // NUEVO H2.9 spec §4.2
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

  // NUEVO H4 spec §3.3 — todo el `dramaturgiaDeck` del Enemigo activo, resuelto una vez, para que
  // `EnemyDramaturgiaCardSlot` pueda resolver `snapshot.enemyActiveDramaturgiaCardId` a sus datos
  // completos sin acoplar `apps/shell` al catálogo crudo.
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
    leaderAbilities, // NUEVO H2.10
    enemyAbilities, // NUEVO H2.10
    enemyDramaturgiaDeck, // NUEVO H4 spec §3.3
  };

  return { bridge, boardContext };
}
