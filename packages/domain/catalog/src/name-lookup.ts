import type { AbilityId, CardId } from '@collector/domain-shared';
import type { Catalog } from './types/catalog';
import type { LeaderDefinition } from './types/leader';
import type { EnemyDefinition } from './types/enemy';

export interface NameLookup {
  abilityName(id: AbilityId): string;
  cardName(id: CardId): string;
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
  readonly catalog: Catalog;
}): NameLookup {
  const abilityNames = new Map<AbilityId, string>();
  for (const ability of params.leader.baseAbilities) {
    abilityNames.set(ability.id, ability.name);
  }
  for (const ability of params.enemy.abilities) {
    abilityNames.set(ability.id, ability.name);
  }

  return {
    abilityName(id: AbilityId): string {
      return abilityNames.get(id) ?? id;
    },
    cardName(id: CardId): string {
      return params.catalog.cards.get(id)?.name ?? id;
    },
  };
}
