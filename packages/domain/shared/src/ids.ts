export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CardInstanceId = Brand<string, 'CardInstanceId'>;
export type AbilityId = Brand<string, 'AbilityId'>;
export type LeaderId = Brand<string, 'LeaderId'>;
export type EnemyId = Brand<string, 'EnemyId'>;
export type ScenarioId = Brand<string, 'ScenarioId'>;
export type NucleoInstanceId = Brand<string, 'NucleoInstanceId'>;

/** NUEVO H1.8. Id de una CardDefinition de catálogo (contenido) — DISTINTO de
 *  `CardInstanceId` (una copia concreta de una carta en juego, ya usada por
 *  `domain/combat`). No son intercambiables: dos `CardInstanceId` distintos pueden
 *  compartir el mismo `CardId` (llevar 2 copias de la misma carta, GDD §3.2). */
export type CardId = Brand<string, 'CardId'>;

/** NUEVO H1.8. Id de una `EvolutionTemplate` de catálogo (GDD §7.2). */
export type EvolutionTemplateId = Brand<string, 'EvolutionTemplateId'>;

// helper de construcción, evita castear "as" repartido por todo el código
export function createId<B extends string>(brand: B, value: string): Brand<string, B> {
  return value as Brand<string, B>;
}
