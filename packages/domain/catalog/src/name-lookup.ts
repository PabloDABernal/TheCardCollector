import type { AbilityId, CardId } from '@collector/domain-shared';
import type { Catalog } from './types/catalog';
import type { LeaderDefinition } from './types/leader';
import type { EnemyDefinition } from './types/enemy';
import type { ScenarioDefinition } from './types/scenario'; // NUEVO H4.y
import type { MinionDefinitionId } from './types/minion-behavior'; // NUEVO H4.y

export interface NameLookup {
  abilityName(id: AbilityId): string;
  cardName(id: CardId): string;
  /** NUEVO H4.y — resuelve el nombre de un Secuaz (Enemigo o Escenario) a partir de su
   *  `MinionDefinitionId`, para el log de combate (`MINION_SUMMONED`/`MINION_DEFEATED`). */
  minionName(id: MinionDefinitionId): string;
}

/**
 * Construido una vez al arrancar, a partir del Líder/Enemigo/catálogo ya seleccionados
 * (main.ts) — combina `leader.baseAbilities` + `enemy.abilities` (nombre de habilidad) y
 * `catalog.cards` (nombre de carta). Puramente de presentación — el motor nunca ve
 * nombres, solo ids.
 *
 * Movido desde `packages/cli/src/name-lookup.ts` en H2.8 (§2.3 de la spec técnica) — sin
 * cambio de comportamiento, solo de ubicación, para que `packages/combat-scene` lo reutilice
 * sin duplicar esta lógica de resolución de nombres.
 */
export function buildNameLookup(params: {
  readonly leader: LeaderDefinition;
  readonly enemy: EnemyDefinition;
  readonly scenario: ScenarioDefinition; // NUEVO H4.y — antes no se recibía
  readonly catalog: Catalog;
}): NameLookup {
  const abilityNames = new Map<AbilityId, string>();
  for (const ability of params.leader.baseAbilities) {
    abilityNames.set(ability.id, ability.name);
  }
  for (const ability of params.enemy.abilities) {
    abilityNames.set(ability.id, ability.name);
  }

  // NUEVO H4.y — los Secuaces viven en `EnemyDefinition.minions`/`ScenarioDefinition.minions`
  // (ambos `readonly MinionDefinition[]` opcionales), nunca en un mapa central del catálogo.
  const minionNames = new Map<MinionDefinitionId, string>();
  for (const minion of params.enemy.minions ?? []) {
    minionNames.set(minion.id, minion.name);
  }
  for (const minion of params.scenario.minions ?? []) {
    minionNames.set(minion.id, minion.name);
  }

  return {
    abilityName(id: AbilityId): string {
      return abilityNames.get(id) ?? id;
    },
    cardName(id: CardId): string {
      return params.catalog.cards.get(id)?.name ?? id;
    },
    minionName(id: MinionDefinitionId): string {
      return minionNames.get(id) ?? id;
    },
  };
}
