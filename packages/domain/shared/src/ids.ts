export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CardInstanceId = Brand<string, 'CardInstanceId'>;
export type AbilityId = Brand<string, 'AbilityId'>;
export type LeaderId = Brand<string, 'LeaderId'>;
export type EnemyId = Brand<string, 'EnemyId'>;
export type ScenarioId = Brand<string, 'ScenarioId'>;
export type NucleoInstanceId = Brand<string, 'NucleoInstanceId'>;

// helper de construcción, evita castear "as" repartido por todo el código
export function createId<B extends string>(brand: B, value: string): Brand<string, B> {
  return value as Brand<string, B>;
}
