// H2.8 spec §2.3 — `NameLookup`/`buildNameLookup` se movieron a `packages/domain/catalog/src/name-lookup.ts`
// para que `packages/combat-scene` los reutilice sin duplicar lógica de resolución de nombres. Este archivo
// queda como re-export puro, sin cambio de comportamiento, para no romper los imports relativos existentes
// de `packages/cli`.
export type { NameLookup } from '@collector/domain-catalog';
export { buildNameLookup } from '@collector/domain-catalog';
