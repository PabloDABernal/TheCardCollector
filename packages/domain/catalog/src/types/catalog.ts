import type { CardId, EnemyId, EvolutionTemplateId, LeaderId, ScenarioId } from '@collector/domain-shared';
import type { CardDefinition } from './card';
import type { LeaderDefinition } from './leader';
import type { EnemyDefinition } from './enemy';
import type { ScenarioDefinition } from './scenario';
import type { EvolutionTemplate } from './evolution-template';

/**
 * Input de `CatalogLoader` — colecciones ya parseadas de JSON (`unknown[]`, ver spec
 * §0.4). Cada elemento se valida individualmente en `parse*` (§3) antes de construir
 * `Catalog`.
 */
export interface CatalogRawInput {
  readonly cards: readonly unknown[];
  readonly leaders: readonly unknown[];
  readonly enemies: readonly unknown[];
  readonly scenarios: readonly unknown[];
  readonly evolutionTemplates: readonly unknown[];
}

/** Resultado validado y resuelto de `CatalogLoader.load()` — una vez construido, se
 *  garantiza (por `validateCrossReferences`, §4) que toda referencia por id dentro de
 *  estos mapas es válida. */
export interface Catalog {
  readonly cards: ReadonlyMap<CardId, CardDefinition>;
  readonly leaders: ReadonlyMap<LeaderId, LeaderDefinition>;
  readonly enemies: ReadonlyMap<EnemyId, EnemyDefinition>;
  readonly scenarios: ReadonlyMap<ScenarioId, ScenarioDefinition>;
  readonly evolutionTemplates: ReadonlyMap<EvolutionTemplateId, EvolutionTemplate>;
}
