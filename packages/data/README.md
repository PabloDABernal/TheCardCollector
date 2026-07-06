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

## Contenido actual (H1.10 — Enemigos de prueba)

- `enemies/bestia-base.json`, `enemies/espectro-base.json`: 1 `EnemyDefinition` cada uno,
  con 4 `abilities` (BASICA+FIRMA en rama Ataque ⚔️, BASICA+STANDARD en rama Trama 📜; CD1
  doble ⚫ en ambas ramas), 2 `phases` (una por vida, otra por turnos, para variedad de
  `changeCondition`) y un `dramaturgiaDeck` propio de 6 cartas (mínimo exigido: 4, al menos
  1 `ATTACK` y 1 `PLOT` — ver `docs/specs/H1.10_enemigos_prueba.md` §0.2/§0.5).
- `load-content.test.ts` ejerce, además de la carga vía `CatalogLoader`, la función real
  `decideEnemyAbility` (`@collector/domain-combat`, H1.7) sobre las `EnemyAbilityCandidate`
  construidas a partir de este contenido — demuestra que el dato producido aquí es
  compatible con el motor de IA ya existente sin ningún adaptador.

## Namespacing de ids

Todo id (`LeaderId`, `AbilityId`, `CardId`, `LevelUpOption.id`, `EnemyId`,
`DramaturgiaCardId`) se prefija con el slug de la entidad que lo posee
(`soldado-base`/`mago-base`/`bestia-base`/`espectro-base`), p. ej.
`ability-soldado-base-guardia-firme`, `card-mago-base-01`,
`ability-bestia-base-zarpazo`, `dramacard-espectro-base-01`. Esto evita colisiones
cuando historias futuras (H1.11 `scenario-*`, H1.12 cartas comunes) añadan más
contenido a este mismo paquete — sigue este mismo patrón al añadir nuevos archivos aquí.

Nota: `AbilityId` debe ser único en **todo** el catálogo (Líderes + Enemigos combinados,
`validateGlobalAbilityIdUniqueness` en `domain/catalog`), no solo dentro de un Líder.
