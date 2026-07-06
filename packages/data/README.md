# @collector/data

Contenido de juego en JSON puro (cartas, líderes, enemigos, escenarios), consumido por
`@collector/domain-catalog` a través de `CatalogLoader`. El único código TypeScript de
este paquete es `load-content.test.ts`, que lee los `.json` reales vía `node:fs` y ejerce
el loader real (el resto del dominio nunca toca disco — ver `docs/specs/H1.8_catalog_loader.md`
§0.4 y `docs/specs/H1.9_lideres_prueba.md` §0.2).

## Contenido actual (H1.9 — Líderes de prueba)

- `leaders/soldado-base.json`, `leaders/mago-base.json`: 1 `LeaderDefinition` cada uno,
  con sus 4 `baseAbilities` (CD1-CD4, CD1 siempre `coreCost.kind: 'ANY'`), un pool de 10
  `cardPoolIds` propio y `levelUpOptions`.
- `cards/soldado-base-cards.json`, `cards/mago-base-cards.json`: 10 `CardDefinition` cada
  uno — exactamente las que llenan el pool de su Líder, sin solape entre archivos.

## Namespacing de ids

Todo id (`LeaderId`, `AbilityId`, `CardId`, `LevelUpOption.id`) se prefija con el slug del
Líder que lo posee (`soldado-base`/`mago-base`), p. ej. `ability-soldado-base-guardia-firme`,
`card-mago-base-01`. Esto evita colisiones cuando historias futuras (H1.10 `enemy-*`,
H1.11 `scenario-*`, H1.12 cartas comunes) añadan más contenido a este mismo paquete —
sigue este mismo patrón al añadir nuevos archivos aquí.

Nota: `AbilityId` debe ser único en **todo** el catálogo (Líderes + Enemigos combinados,
`validateGlobalAbilityIdUniqueness` en `domain/catalog`), no solo dentro de un Líder.
