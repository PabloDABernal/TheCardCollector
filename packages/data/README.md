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

## Contenido actual (H1.11 — Escenarios de prueba)

- `scenarios/bosque-encantado-base.json`, `scenarios/templo-en-ruinas-base.json`: 1
  `ScenarioDefinition` cada uno, con 5 `plotThresholds` escalonados (`atLeast`
  estrictamente ascendente, mínimo exigido 3 — `validatePlotThresholdEscalation`,
  `domain/catalog`), 2 `phases` (variedad de `changeCondition`: uno por turnos
  `TURN_COUNT_AT_LEAST`, el otro por Trama acumulada `SCENARIO_PLOT_AT_LEAST` — nunca
  `HEALTH_BELOW_PERCENT`, el Escenario no tiene vida) y un `dramaturgiaDeck` propio de 6
  cartas (4 propias del Escenario + 2 "comunes" `dramacard-common-*`).
- Las cartas `dramacard-common-*` se modelan como entradas normales de
  `dramaturgiaDeck` (reutilizando `DramaturgiaCardDefinition` de H1.10 sin ningún tipo
  nuevo) y se **duplican literalmente** (mismo `id`/`name`/`icon`) en los 2 archivos de
  Escenario de esta historia — no existe todavía una colección propia de "cartas
  comunes" en `Catalog` (deuda de diseño explícita, ver `docs/specs/H1.11_escenarios_prueba.md`
  §0.1/§0.4).
- `load-content.test.ts` extiende el bloque de H1.10: además de cargar los 2 Escenarios
  vía `CatalogLoader`, verifica que las 2 cartas comunes sean idénticas entre archivos y
  ejercita `decideEnemyAbility` (`@collector/domain-combat`, H1.7) con el `icon` de cada
  carta del `dramaturgiaDeck` del Escenario contra las `abilities` reales de un Enemigo
  real (H1.10) — demuestra que la Dramaturgia del Escenario es "jugable con combate"
  junto a Enemigos, sin ningún adaptador.

## Contenido actual (H1.12 — Cartas comunes base)

- `cards/common-cards.json`: 6 `CardDefinition` bajo el namespace `card-common-*`, **sin**
  ningún `cardPoolIds` de Líder que las referencie — la primera colección de cartas
  "huérfanas" del catálogo (`validateLeaderCardPools`, `domain/catalog`, solo valida la
  dirección pool→cards, nunca cards→algún pool, así que el loader ya las soporta sin
  ningún cambio de código). Modelan un pequeño subconjunto simbólico del "Pool de
  Comunes de jugador" del GDD §4.1 (independiente de las cartas propias de cada Líder) —
  no las 50 cartas de lanzamiento, y sin ningún `DeckDefinition`/validación de mazo de 30
  (fuera de alcance de la Épica E1, ver `docs/specs/H1.12_cartas_base.md` §5).
  - `card-common-01`/`02` instancian la keyword `ATAQUE` sin sufijo (gap detectado en
    H1.12: nunca se instanciaba en las 20 cartas de H1.9, que solo usan
    `ATAQUE_MAS_X`/`ATAQUE_POR_X`).
  - `card-common-03`/`04` son `CONTRATIEMPO` con keywords (`DEFENSA_X`, `TRAMA_X`)
    distintas entre sí y de las 2 ya existentes en H1.9 (`Contragolpe`/`Contrahechizo`,
    ambas `ATAQUE_MAS_X`), dando variedad real de datos para H1.13/H1.14.
  - `card-common-05`/`06` completan la representación de tipos `ALIADO`/`EQUIPO` en el
    pool de comunes.
- `load-content.test.ts` extiende `buildRawInput()` con `common-cards.json` y verifica
  que el catálogo cargue las 26 `CardDefinition` (20 de H1.9 + 6 comunes), que los 4
  `CardType` y las keywords citadas por el backlog estén instanciadas, y que las 6
  cartas comunes no aparezcan en ningún `cardPoolIds` de Líder.

## Namespacing de ids

Todo id (`LeaderId`, `AbilityId`, `CardId`, `LevelUpOption.id`, `EnemyId`,
`DramaturgiaCardId`, `ScenarioId`) se prefija con el slug de la entidad que lo posee
(`soldado-base`/`mago-base`/`bestia-base`/`espectro-base`/`bosque-encantado-base`/
`templo-en-ruinas-base`), p. ej. `ability-soldado-base-guardia-firme`,
`card-mago-base-01`, `ability-bestia-base-zarpazo`, `dramacard-espectro-base-01`,
`dramacard-bosque-encantado-base-01`. Excepción deliberada: las cartas "comunes"
(`dramacard-common-*`, H1.11; `card-common-*`, H1.12) no llevan el slug de ningún
Escenario/Enemigo/Líder concreto — por convención de contenido representan cartas
compartidas, no ligadas a una única entidad de contenido (ver §H1.11 y §H1.12 arriba).
Esto evita colisiones cuando historias futuras añadan más contenido a este mismo
paquete — sigue este mismo patrón al añadir nuevos archivos aquí.

Nota: `AbilityId` debe ser único en **todo** el catálogo (Líderes + Enemigos combinados,
`validateGlobalAbilityIdUniqueness` en `domain/catalog`), no solo dentro de un Líder.
