# Cierre del loop jugable de batalla — spec técnica consolidada

> Spec del Architect que traduce a diseño técnico la decisión de Director Creativo +
> Director del Estudio registrada en `.ai-studio/memory/decisions.md` (2026-07-08,
> "Cierre del loop jugable de batalla") y `.ai-studio/memory/glossary.md` (mismo día).
> Cubre el rediseño del modelo de Núcleos, el nuevo paso previo de turno, el nuevo
> comportamiento de Secuaces, las condiciones de victoria/derrota alternativas, y su
> conexión con la capa visual de H2. Sin código de producto — firmas, contratos,
> pseudocódigo de algoritmo y diagramas de flujo en texto. El Programmer implementa
> contra esto.
>
> **Actualización 2026-07-08 (misma fecha, entrada posterior de decisions.md — "Vida de
> Secuaz: mecánica mínima para HP propia"):** el Game Designer cerró el vacío que §3.2.1
> de esta spec había dejado documentado como "gap, fuera de alcance" (Secuaces sin vida,
> `HIGHEST_LIFE` no implementable). **§3.2, §3.2.1 y §3.8 quedan sustituidos** por el
> nuevo §3.9 de esta misma sección, que añade vida a `MinionDefinition`/`MinionInPlay`
> (paralelo directo a `AllyCardDefinition`/`AllyInPlay`, H1.15), un flujo de targeting
> explícito de ataque del jugador (Enemigo o Secuaz, sin bloqueo automático salvo
> Defensor) y `HIGHEST_LIFE`/`LOWEST_LIFE` en `MinionSelectionCriterion`. No se borra
> texto antiguo (mismo criterio de todo este documento) — §3.2.1 se marca inline como
> sustituida en vez de eliminarse.
>
> **Historias que esta spec cierra/reabre** (ver `.ai-studio/memory/backlog.md`):
> H1.3 (reescrita), H1.13 (tests a reescribir contra el nuevo modelo), H1.16 (rediseño
> de comportamiento de Secuaces **+ vida de Secuaz y targeting de ataque, §3.9 — amplía
> el alcance/criterios de aceptación de H1.16 en backlog.md; Coordinator debe ampliarlos
> en su próxima pasada, ver nota en §3.9.7**), H1.8 (nuevo campo de catálogo), H1.18
> (nueva evaluación de fin de combate + paso previo de turno), H3.4 (implementación
> completa del nuevo modelo de Núcleos), H3.6 (implementación completa del paso previo de
> turno). Valida sin cambios de contrato: H3.1, H3.2, H3.3 (con una nota de UI en H3.5).
>
> **Convención de documento:** esta spec es deliberadamente un único documento porque
> las 7 historias afectadas comparten una sola raíz de diseño (el `CombatEngine` y su
> `CombatStateSnapshot`) y deben implementarse en el orden descrito en §7 sin
> fragmentarse en PRs que se pisen entre sí. Los documentos `docs/specs/H1.3_*.md` y
> `docs/specs/H1.16_*.md` existentes **quedan supersedidos por completo** por §1 y §3 de
// aquí respectivamente — se conservan como archivo histórico, no se borran (mismo
> criterio que decisions.md, "nunca se borra texto antiguo").

Estado del repo al momento de escribir esta spec: H1-H1.19 y H2.1-H2.15 implementados
(361+ tests). `CombatEngine` (`packages/domain/combat/src/combat-engine.ts`, ~1963
líneas) ya modela turnos, pool de Núcleos homogéneo (`NucleoInstance[]`, tamaño
configurable, vaciado-y-relanzado), cooldowns, Umbral, Trama/daño, Combo/Contratiempo,
Aliados, Secuaces (selección aleatoria — a sustituir), fases/Level-Up, condiciones de
victoria/derrota por defecto, IA de Enemigo dirigida por Dramaturgia (solo icono
ATTACK/PLOT). **No existe ningún concepto de mano/mazo del Líder** — `PLAY_CARD`/
`PLAY_ALLY`/`PLAY_CONTRATIEMPO` hoy resuelven directamente contra
`cardPoolIds`/mapas de config, sin validar pertenencia a una "mano". Esto se cierra en
§2.

---

## 0. Resumen de cambios por archivo (vista de pájaro)

```
packages/domain/shared/src/
  nucleo-color.ts            # SIN CAMBIOS — NucleoColor (5 valores), CoreCostRequirement, satisfiesCoreCost

packages/domain/combat/src/
  types/nucleo.ts             # MODIFICADO — añade NucleoDie (extiende NucleoInstance)
  nucleo-pool.ts               # RENOMBRADO → nucleo-table.ts — modelo de mesa fija + reroll
  nucleo-pool.test.ts          # RENOMBRADO → nucleo-table.test.ts — reescrito contra el nuevo modelo
  types/turn-phase.ts          # NUEVO — estado del paso previo gratuito del turno del Líder
  types/hand.ts                # NUEVO — mano/mazo de robo del Líder
  types/minion.ts              # MODIFICADO — +maxLife/life en MinionDefinition/MinionInPlay (§3.9.1)
  types/minion-behavior.ts     # NUEVO/MODIFICADO — MinionBehaviorSpec, MinionSelectionCriterion +HIGHEST_LIFE/LOWEST_LIFE (§3.9.4)
  types/combat-target.ts       # NUEVO — AttackTarget (targeting explícito Enemigo/Secuaz, §3.9.2)
  minion-ai.ts                 # NUEVO/MODIFICADO — selectActingMinions (pura), sustituye lógica ad-hoc; +HIGHEST_LIFE/LOWEST_LIFE (§3.9.4)
  types/victory-condition.ts   # NUEVO — AlternativeVictoryCondition (mirror de domain/catalog)
  types/config.ts              # MODIFICADO — tableMaxDice, leaderDeckCardIds, alternativeVictoryConditions, dramaturgiaDeck pasa a full DramaturgiaCardDefinition
  types/snapshot.ts            # MODIFICADO — nucleoTable reemplaza nucleoPool; +leaderHand, +freeStepState
  types/commands.ts            # MODIFICADO — +DRAW_OR_GENERATE, +DRAW_CARD, +ADD_EXTRA_NUCLEO_DIE (interno); PLAY_CARD +target?: AttackTarget (§3.9.2)
  types/playable-card.ts       # MODIFICADO — ATTACK_ENEMY effect +arrollar?: boolean (§3.9.3)
  types/events.ts              # MODIFICADO — NUCLEO_TABLE_REROLLED reemplaza NUCLEO_POOL_ROLLED, +NUCLEO_DIE_ADDED, +LEADER_HAND_CARD_DRAWN, +LEADER_HAND_DRAW_SKIPPED, +ENERGY_GENERATE_SKIPPED, +FREE_STEP_RESOLVED, +MINION_ACTION_RESOLVED (repetible), +MINION_DAMAGED, +MINION_DEFEATED (§3.9.3), COMBAT_ENDED +alternativeConditionKind; ENEMY_DAMAGED pierde la restricción "nunca Secuaz"
  types/errors.ts              # MODIFICADO — +NUCLEO_ALREADY_SPENT, +CARD_NOT_IN_HAND, +FREE_STEP_ALREADY_TAKEN, +PLAY_CARD_TARGET_REQUIRED, +ATTACK_TARGET_NOT_FOUND, +MUST_TARGET_DEFENSOR (§3.9.2)
  combat-engine.ts             # MODIFICADO — ver §1.4, §2.4, §3.3, §3.9, §4.3
  catalog-adapter.ts           # MODIFICADO — dramaturgiaDeck pasa objetos completos; alternativeVictoryConditions; leaderDeckCardIds; minionDefinitions +maxLife

packages/domain/catalog/src/
  types/dramaturgia-card.ts    # MODIFICADO — +minionBehavior?: MinionBehaviorSpec
  types/minion-behavior.ts     # NUEVO/MODIFICADO — mirror estructural (catalog no importa combat, mismo patrón que enemy-ai.ts); +HIGHEST_LIFE/LOWEST_LIFE
  types/enemy.ts               # MODIFICADO — +alternativeVictoryConditions?
  types/scenario.ts            # MODIFICADO — +alternativeVictoryConditions?
  types/victory-condition.ts   # NUEVO — mirror estructural
  types/minion.ts              # MODIFICADO (si existe definición de catálogo propia del Secuaz — ver nota §3.9.1) — +maxLife
  validation/schema.ts         # MODIFICADO — valida minionBehavior, alternativeVictoryConditions, maxLife de Secuaz

packages/combat-scene/view/    # MODIFICADO — ver §5
packages/combat-scene/juice/   # MODIFICADO (JuiceConfig, fuera de alcance de esta spec en detalle) — ver §5
packages/combat-scene/input/   # MODIFICADO — ver §5.4
```

---

## 1. Modelo de Núcleos: 5 dados fijos + extras + tope + reroll al vaciar (H3.4, cierra H1.3/H1.13)

### 1.1 Decisión de modelo: "mesa persistente con estado gastado/disponible", no "pool que se vacía por remoción"

El modelo viejo (H1.3) **eliminaba** una `NucleoInstance` del array al gastarse (el pool
encogía hasta 0, luego se regeneraba entero). El modelo nuevo NO puede funcionar así:
decisions.md exige que **siempre haya exactamente 5 dados fijos en mesa** (uno por
color) más los extras — un dado nunca desaparece de la mesa al gastarse, solo queda
"gastado" hasta el próximo reroll colectivo.

**Decisión (Architect):** los dados viven en un array `dice: NucleoDie[]` que **nunca
cambia de longitud** salvo cuando se añade un dado EXTRA (`ADD_EXTRA_NUCLEO_DIE`,
ver §1.5). Gastar un dado cambia su `status` de `'AVAILABLE'` a `'SPENT'` sin tocar su
`value`/`color`/`id`. El reroll (cuando el último `'AVAILABLE'` se gasta) genera un
`value` nuevo para **todos** los dados y pone `status = 'AVAILABLE'` en todos —
manteniendo `id`/`color`/`kind` estables (un dado extra Rojo sigue siendo el mismo dado
extra Rojo tras 50 rerolls, solo cambia su valor).

### 1.2 Tipos nuevos/modificados

`packages/domain/combat/src/types/nucleo.ts` (MODIFICADO — añade, no quita nada de lo
existente que otras historias consumen: `NucleoInstance`, `NucleoValue` se mantienen
tal cual porque `ABILITY_ACTIVATED.nucleoSpent`, `LEADER_DAMAGED.nucleoSpent`, etc. —
eventos de H1.5/H1.6/H1.15/H1.16 — siguen usando `NucleoInstance` como snapshot de
"qué dado se gastó en este instante", sin `status`/`kind`; ningún event payload
existente cambia de forma):

```ts
import type { NucleoColor, NucleoInstanceId } from '@collector/domain-shared';

export type NucleoValue = number; // sin cambios (H1.3 §3.1) — 1-4 en generación, 0 posible por debuff futuro

export interface NucleoInstance {
  readonly id: NucleoInstanceId;
  readonly color: NucleoColor;
  readonly value: NucleoValue;
}

/** NUEVO H3.4. `'FIXED'` = uno de los 5 dados permanentes (uno por color, nunca se
 *  elimina de la mesa). `'EXTRA'` = añadido por una carta/equipo; tampoco se elimina
 *  una vez añadido en esta historia (no hay mecanismo de "quitar" un extra — fuera de
 *  alcance, contenido futuro). */
export type NucleoDieKind = 'FIXED' | 'EXTRA';

/** NUEVO H3.4. `'AVAILABLE'` = puede gastarse. `'SPENT'` = ya gastado en este ciclo,
 *  vuelve a `'AVAILABLE'` únicamente cuando ocurre un reroll colectivo (§1.4). */
export type NucleoDieStatus = 'AVAILABLE' | 'SPENT';

/** Extiende `NucleoInstance` (mismos 3 campos, mismo significado) con el estado de
 *  mesa. Es el tipo de `CombatStateSnapshot.nucleoTable` (§1.3) — NUNCA el tipo de
 *  `CombatEvent.nucleoSpent` (que sigue siendo `NucleoInstance` puro, ver nota arriba). */
export interface NucleoDie extends NucleoInstance {
  readonly kind: NucleoDieKind;
  readonly status: NucleoDieStatus;
}
```

### 1.3 `CombatStateSnapshot` — renombrado de campo (breaking, intencional)

```ts
// snapshot.ts — reemplaza el campo H1.3 `nucleoPool: readonly NucleoInstance[]`
readonly nucleoTable: readonly NucleoDie[];
```

Orden estable: los 5 `FIXED` primero (en el orden de `ALL_NUCLEO_COLORS`:
`AGRESION, CONTROL, DEFENSA, RECURSO, CAOS`), luego los `EXTRA` por orden de creación.
Este orden es lo que consume `createNucleoTable` en la vista (§5.2) para posicionar
cada color siempre en el mismo lugar de mesa.

### 1.4 `packages/domain/combat/src/nucleo-table.ts` (RENOMBRADO de `nucleo-pool.ts`)

```ts
import type { RandomSource, NucleoColor, NucleoInstanceId } from '@collector/domain-shared';
import { ALL_NUCLEO_COLORS } from '@collector/domain-shared';
import type { NucleoDie, NucleoValue } from './types/nucleo';

export const NUCLEO_VALUE_MIN = 1;
export const NUCLEO_VALUE_MAX = 4;

/** GDD/decisions.md: exactamente 5 dados fijos, uno por color — ya no es "tamaño de
 *  pool" configurable (DEFAULT_NUCLEO_POOL_SIZE desaparece). */
export const FIXED_NUCLEO_DICE_COUNT = 5; // === ALL_NUCLEO_COLORS.length, documentado explícito

/** Tope duro de dados simultáneos en mesa — valor de diseño sugerido, confirmado por
 *  Director Creativo en decisions.md (2026-07-08) como "sugerido: 10, a confirmar en
 *  balanceo". Configurable vía CombatEngineConfig.tableMaxDice (§1.7). */
export const DEFAULT_NUCLEO_TABLE_MAX_DICE = 10;

function rollValue(rng: RandomSource): NucleoValue {
  return rng.nextInt(NUCLEO_VALUE_MIN, NUCLEO_VALUE_MAX + 1);
}

/** Genera los 5 dados FIXED iniciales, uno por cada color de ALL_NUCLEO_COLORS, en ese
 *  orden — todos AVAILABLE. Usado solo en el constructor de CombatEngine. */
export function rollFixedDice(rng: RandomSource, nextId: () => NucleoInstanceId): NucleoDie[] {
  return ALL_NUCLEO_COLORS.map((color) => ({
    id: nextId(),
    color,
    value: rollValue(rng),
    kind: 'FIXED' as const,
    status: 'AVAILABLE' as const,
  }));
}

/** Genera un dado EXTRA nuevo de `color`, AVAILABLE. Usado por
 *  `CombatEngine.addExtraNucleoDie` (§1.5). */
export function rollExtraDie(color: NucleoColor, rng: RandomSource, nextId: () => NucleoInstanceId): NucleoDie {
  return { id: nextId(), color, value: rollValue(rng), kind: 'EXTRA', status: 'AVAILABLE' };
}

/** Reroll colectivo (GDD/decisions.md: "en cuanto se gasta el ÚLTIMO dado disponible,
 *  se re-tiran TODOS"). Conserva `id`/`color`/`kind` de cada dado, genera `value` nuevo,
 *  fuerza `status: 'AVAILABLE'` en todos — incluidos los que ya estaban disponibles
 *  (decisions.md no distingue "solo los gastados se re-tiran"; el texto es explícito:
 *  "se re-tiran TODOS los dados en mesa a la vez"). */
export function rerollAllDice(dice: readonly NucleoDie[], rng: RandomSource): NucleoDie[] {
  return dice.map((d) => ({ ...d, value: rollValue(rng), status: 'AVAILABLE' as const }));
}

export function countAvailableDice(dice: readonly NucleoDie[]): number {
  return dice.filter((d) => d.status === 'AVAILABLE').length;
}
```

Test file `nucleo-table.test.ts` reescribe TODO `nucleo-pool.test.ts` (H1.3 §4.1) contra
estas 4 funciones: cobertura mínima —
- `rollFixedDice`: siempre 5 dados, un color de cada uno de `ALL_NUCLEO_COLORS`
  (`toEqual(ALL_NUCLEO_COLORS)` sobre `dice.map(d => d.color)`, orden incluido), valor en
  `[1,4]`, todos `AVAILABLE`/`FIXED`.
- `rollExtraDie`: color = el pedido, `kind: 'EXTRA'`, `AVAILABLE`.
- `rerollAllDice`: mismos ids/colores/kinds antes y después, valores pueden cambiar,
  todos `AVAILABLE` después (incluir un caso donde antes había una mezcla
  AVAILABLE/SPENT).
- `countAvailableDice`: caso con mezcla.
- Reproducibilidad con semilla fija (mismo patrón que H1.3 §4.1).

### 1.5 `CombatEngine` — estado y comandos nuevos

**Estado interno** (reemplaza `nucleoPool: NucleoInstance[]`):

```ts
private nucleoTable: NucleoDie[];      // longitud >= 5, crece solo por dados EXTRA
private readonly tableMaxDice: number; // default DEFAULT_NUCLEO_TABLE_MAX_DICE
```

**Constructor** (reemplaza `this.nucleoPool = this.rollNewPool();`):

```ts
this.tableMaxDice = config.tableMaxDice ?? DEFAULT_NUCLEO_TABLE_MAX_DICE;
this.nucleoTable = rollFixedDice(this.randomSource, () => this.nextNucleoId());
// Sin dados EXTRA iniciales en el contenido de juguete — CombatEngineConfig NO expone
// un "initialExtraDice": si contenido futuro necesita un Escenario que arranque con un
// dado extra ya en mesa, se añade ahí explícitamente (fuera de alcance MVP).
```

**Gasto de dado** (reemplaza el bloque de `handleActivateAbility`/`executeAbilityEffect`
que hacía `this.nucleoPool = [...slice sin el gastado...]`):

```ts
// Validación (handleActivateAbility, mismo orden relativo que H1.3/H1.4 ya establecido,
// insertada donde antes estaba la búsqueda en nucleoPool):
const die = this.nucleoTable.find((d) => d.id === command.nucleoInstanceId);
if (!die) {
  return err({ code: 'NUCLEO_NOT_FOUND', nucleoInstanceId: command.nucleoInstanceId });
}
if (die.status === 'SPENT') {
  return err({ code: 'NUCLEO_ALREADY_SPENT', nucleoInstanceId: command.nucleoInstanceId });
}
if (!satisfiesCoreCost(requirement, die.color)) {
  return err({ code: 'NUCLEO_COLOR_MISMATCH', nucleoInstanceId: command.nucleoInstanceId, requirement, actualColor: die.color });
}

// Mutación (dentro de executeAbilityEffect, reemplaza el slice-removal):
this.nucleoTable = this.nucleoTable.map((d) =>
  d.id === die.id ? { ...d, status: 'SPENT' as const } : d
);
// nucleoSpent en ABILITY_ACTIVATED/LEADER_DAMAGED/etc. sigue siendo `{ id, color, value }`
// (NucleoInstance puro, tal como estaba el `die` ANTES de marcarlo SPENT) — sin cambio
// de forma en esos eventos.

// Reroll — reemplaza `if (this.nucleoPool.length === 0)`:
if (countAvailableDice(this.nucleoTable) === 0) {
  this.nucleoTable = rerollAllDice(this.nucleoTable, this.randomSource);
  const rerolled: CombatEvent = {
    type: 'NUCLEO_TABLE_REROLLED', // renombrado de NUCLEO_POOL_ROLLED
    dice: this.nucleoTable,
    priorityTurnOwner: this.turnOwner, // mismo razonamiento que H1.3 §5.8, sin cambios
  };
  events.push(rerolled);
  this.eventBus.emit(rerolled);
}
```

La regla "quien tenga turno tras el vaciado elige primero" (H1.3 §5.8) es **exactamente
la misma prueba lógica** que antes: la única puerta de entrada para gastar sigue siendo
`command.side !== this.turnOwner → NOT_YOUR_TURN`, y ese gate no cambia con este
refactor. Los 2 tests de "Escenario A/B" de H1.3 §7.2 se migran literalmente, solo
cambiando `nucleoPool`→`nucleoTable` y `NUCLEO_POOL_ROLLED`→`NUCLEO_TABLE_REROLLED`.

**Nuevo comando interno `ADD_EXTRA_NUCLEO_DIE`** — no es un `CombatCommand` público
despachable por el jugador (nunca aparece en el union `CombatCommand`); es un efecto de
resolución de carta, igual que `SHIELD`/`PLOT` en `PlayableCardEffectDefinition`
(H1.18). Se extiende esa unión:

```ts
// types/playable-card.ts — añade una 4ª variante
export type PlayableCardEffectDefinition =
  | { readonly kind: 'ATTACK_ENEMY'; /* ... */ }
  | { readonly kind: 'PLOT'; readonly amount: number }
  | { readonly kind: 'SHIELD'; readonly amount: number }
  | { readonly kind: 'ADD_NUCLEO_DIE'; readonly color: NucleoColor }; // NUEVO H3.4
```

`CombatEngine` privado, invocado desde `handlePlayCard` en la misma rama `switch` que ya
resuelve `SHIELD`/`PLOT`:

```ts
private addExtraNucleoDie(color: NucleoColor): CombatEvent {
  if (this.nucleoTable.length >= this.tableMaxDice) {
    return { type: 'NUCLEO_DIE_ADD_SKIPPED', color, reason: 'TABLE_AT_MAX' }; // no lanza, no es error de comando
  }
  const die = rollExtraDie(color, this.randomSource, () => this.nextNucleoId());
  this.nucleoTable = [...this.nucleoTable, die];
  return { type: 'NUCLEO_DIE_ADDED', color, dieId: die.id, tableSizeAfter: this.nucleoTable.length };
}
```

Nota de diseño (decisions.md): *"Intentos de añadir dados que exceden el tope se
ignoran"* — por eso `NUCLEO_DIE_ADD_SKIPPED` es un evento informativo, no un
`CombatCommandError`; `PLAY_CARD` sigue teniendo éxito completo (la carta se juega,
paga Energía, consume acción) aunque su efecto de añadir dado se ignore por tope. Mismo
patrón que "Si ya está al tope de la opción elegida, no ocurre nada" del paso previo
(§2).

### 1.6 Validación de coste de habilidad — sin cambios de comportamiento

`satisfiesCoreCost(requirement, color)` (domain/shared, H1.3 §2.2) es agnóstico de si el
dado es FIXED o EXTRA — un coste `{ kind: 'COLOR', colors: ['AGRESION'] }` acepta
cualquier dado AGRESION disponible, fijo o extra; un coste `{ kind: 'ANY' }` acepta
cualquiera de los `AVAILABLE` en mesa. Ninguna lógica de Umbral (H1.5), Trama/daño
(H1.6) ni Aliados (H1.15) cambia — todas consumen `nucleo.value`/`nucleo.color` de un
`NucleoInstance`, forma que no cambia.

### 1.7 `CombatEngineConfig` — cambios

```ts
// config.ts
// ELIMINADO: readonly poolSize?: number;  (ya no hay "tamaño de pool" — son 5 fijos + extras)
readonly tableMaxDice?: number; // NUEVO H3.4, default DEFAULT_NUCLEO_TABLE_MAX_DICE (10)
```

### 1.8 Impacto en `enemy-ai.ts` (H1.7/H1.16) — firma de función cambia de tipo de colección, no de algoritmo

`poolHasValidNucleo`/`decideEnemyNucleoToSpend` reciben hoy `pool: readonly
NucleoInstance[]` ya pre-filtrado por el caller. Se mantiene igual, pero el caller
(`CombatEngine`) ahora debe filtrar `this.nucleoTable` a solo `status === 'AVAILABLE'`
antes de pasarlo:

```ts
const availableDice = this.nucleoTable.filter((d) => d.status === 'AVAILABLE');
const nucleoDecision = decideEnemyNucleoToSpend(requirement, availableDice, playerColors, this.randomSource);
```

Sin cambio de firma en `enemy-ai.ts` — `NucleoDie` es estructuralmente compatible con
`NucleoInstance` (lo extiende), así que `readonly NucleoInstance[]` sigue aceptando un
`readonly NucleoDie[]` sin cast. Cero cambios de código en `enemy-ai.ts`.

### 1.9 Definition of Done de H3.4 (+ cierre de H1.3/H1.13)

- [ ] `types/nucleo.ts` añade `NucleoDieKind`, `NucleoDieStatus`, `NucleoDie` (§1.2).
- [ ] `nucleo-pool.ts`/`nucleo-pool.test.ts` renombrados a `nucleo-table.ts`/
      `nucleo-table.test.ts`, contenido reemplazado según §1.4.
- [ ] `CombatStateSnapshot.nucleoPool` renombrado a `nucleoTable: readonly NucleoDie[]`.
- [ ] `CombatEvent` — `NUCLEO_POOL_ROLLED` renombrado a `NUCLEO_TABLE_REROLLED` (payload
      `dice` en vez de `pool`); nuevo `NUCLEO_DIE_ADDED`, nuevo `NUCLEO_DIE_ADD_SKIPPED`.
- [ ] `CombatCommandError` añade `NUCLEO_ALREADY_SPENT`.
- [ ] `CombatEngineConfig.poolSize` eliminado, `tableMaxDice?` añadido.
- [ ] `PlayableCardEffectDefinition` añade `ADD_NUCLEO_DIE`.
- [ ] `combat-engine.ts`: constructor, `handleActivateAbility`/`executeAbilityEffect`,
      `handlePlayCard`, y el punto de uso en `handleResolveMinionAction`/turno de IA
      migrados a `nucleoTable` (§1.5/§1.8) — ningún otro sistema (cooldowns, Umbral,
      Trama/daño, Aliados, fases/Level-Up, victoria/derrota) cambia de comportamiento.
- [ ] Todos los tests de `combat-engine.test.ts`/`combat-engine.*.test.ts` que referencian
      `nucleoPool`/`NUCLEO_POOL_ROLLED`/`poolSize` se migran a los nuevos nombres —
      ningún test de mecánicas NO relacionadas con Núcleos (Umbral, cooldowns, Trama,
      Aliados, Combo, fases) cambia su aserción de fondo, solo el vocabulario de mesa.
- [ ] Nuevos tests: dado EXTRA se puede añadir hasta el tope, tope se ignora
      silenciosamente por encima; reroll afecta a TODOS los dados (fijos + extras) a la
      vez; un dado ya `SPENT` no puede volver a gastarse hasta el próximo reroll.

---

## 2. Paso previo gratis de turno + mano/mazo del Líder (H3.6, cierra parcialmente H1.18)

### 2.1 Gap previo: no existe mano/mazo en el motor — se cierra aquí

Ninguna historia anterior modeló `hand`/`deck` — `PLAY_CARD`/`PLAY_ALLY`/
`PLAY_CONTRATIEMPO` resuelven directamente contra `cardId` sin comprobar que esa carta
esté "en mano". Esto era aceptable mientras no existía la mecánica de robo; ahora que
H3.6 introduce robo de verdad, dejarlo así vaciaría de sentido la mecánica (el jugador
podría jugar cualquier carta de su pool sin haberla robado nunca). **Esta spec extiende
el alcance de H3.6** para cerrar esa deuda: añade el concepto de mano/mazo y hace que
`PLAY_CARD`/`PLAY_ALLY`/`PLAY_CONTRATIEMPO` validen pertenencia a la mano.

### 2.2 Tipos nuevos

`packages/domain/combat/src/types/hand.ts` (NUEVO):

```ts
export const LEADER_INITIAL_HAND_SIZE = 5; // decisions.md: "Mano inicial de combate: 5 cartas"
export const LEADER_HAND_SIZE_MAX = 7;     // decisions.md: "Tope de mano: 7"
```

`packages/domain/combat/src/types/turn-phase.ts` (NUEVO):

```ts
/** Estado del paso previo gratuito del turno actual del Líder (decisions.md, "Estructura
 *  del turno del jugador: paso previo gratis + 2 acciones"). Se resetea a `false` en
 *  cada `handleEndTurn` que entrega el turno al Líder — NUNCA aplica al turno de
 *  Enemigo (el paso previo es EXCLUSIVO del Líder, la IA no lo usa). */
export type LeaderFreeStepState = { readonly takenThisTurn: boolean };
```

### 2.3 `CombatStateSnapshot` — campos nuevos

```ts
readonly leaderHand: readonly CardId[];       // orden estable = orden de robo
readonly leaderDeckRemaining: number;         // solo el conteo — evita filtrar info de orden a la UI/Phaser innecesariamente
readonly leaderFreeStep: LeaderFreeStepState; // { takenThisTurn: boolean }
```

### 2.4 Comandos nuevos

```ts
// commands.ts — añade 2 variantes
| {
    /** NUEVO H3.6. Paso previo GRATIS del turno del Líder — no consume
     *  actionsTakenThisTurn. Válido como máximo 1 vez por turno de Líder. */
    readonly type: 'DRAW_OR_GENERATE';
    readonly action: 'draw' | 'generate';
  }
| {
    /**
     * NUEVO H3.6 (extensión de alcance sobre H3.2 — decisions.md exige que "Robar
     * Carta" también exista como acción PAGADA, simétrica a GENERATE_ENERGY que H3.2 ya
     * implementó). Consume 1 de las 2 acciones del turno. Mismo efecto que
     * `DRAW_OR_GENERATE { action: 'draw' }`, solo cambia el coste.
     */
    readonly type: 'DRAW_CARD';
  }
```

`GENERATE_ENERGY` (H3.2, ya implementada/especificada) no cambia de contrato — sigue
siendo la versión pagada de generar energía. `DRAW_CARD` es su análogo para robar carta,
que faltaba en el backlog original y esta spec añade explícitamente para que decisions.md
quede completamente implementado (las 4 opciones de la lista de 2 acciones: Jugar Carta,
Generar Energía, Robar Carta, Activar Habilidad).

### 2.5 Lógica compartida — helpers privados de `CombatEngine`

```ts
/** Ejecuta el efecto "robar" (§0 de decisions.md: "roba 1 carta, tope de mano: 7").
 *  Si el mazo está vacío O la mano ya está al tope, NO ES UN ERROR — decisions.md:
 *  "Si ya está al tope de la opción elegida, no ocurre nada (no se pierde el paso,
 *  simplemente no tiene efecto)". Esta misma regla de "no-op sin error" se extiende a
 *  la versión PAGADA (decisions.md: "no hay ninguna diferencia de efecto entre la
 *  versión gratis y la versión que cuesta acción — la única diferencia es el coste").
 *  Devuelve el evento a emitir (drawn o skipped). */
private executeDrawCard(): CombatEvent {
  if (this.leaderHand.length >= LEADER_HAND_SIZE_MAX) {
    return { type: 'LEADER_HAND_DRAW_SKIPPED', reason: 'HAND_FULL' };
  }
  if (this.leaderDeckDrawPile.length === 0) {
    return { type: 'LEADER_HAND_DRAW_SKIPPED', reason: 'DECK_EMPTY' };
  }
  const cardId = this.leaderDeckDrawPile.pop() as CardId;
  this.leaderHand = [...this.leaderHand, cardId];
  return {
    type: 'LEADER_HAND_CARD_DRAWN',
    cardId,
    handSizeAfter: this.leaderHand.length,
    deckRemainingAfter: this.leaderDeckDrawPile.length,
  };
}

/** Ejecuta el efecto "generar energía" (tope 5). Reutilizable desde
 *  DRAW_OR_GENERATE/GENERATE_ENERGY — mismo criterio de no-op sin error si ya al tope. */
private executeGenerateEnergy(): CombatEvent {
  if (this.leaderEnergy >= LEADER_ENERGY_MAX) {
    return { type: 'ENERGY_GENERATE_SKIPPED', reason: 'ENERGY_AT_MAX' };
  }
  this.leaderEnergy += 1;
  return { type: 'ENERGY_GENERATED', amount: 1, leaderEnergyAfter: this.leaderEnergy }; // nombre de evento tal como lo fija H3.2
}
```

### 2.6 `handleDrawOrGenerate` (comando `DRAW_OR_GENERATE`)

```ts
private handleDrawOrGenerate(
  command: Extract<CombatCommand, { type: 'DRAW_OR_GENERATE' }>
): CombatCommandResult {
  if (this.turnOwner !== 'LEADER') {
    return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
  }
  if (this.leaderFreeStepTakenThisTurn) {
    return err({ code: 'FREE_STEP_ALREADY_TAKEN' });
  }

  this.leaderFreeStepTakenThisTurn = true; // se consume SIEMPRE, incluso si el efecto es no-op
  const effectEvent = command.action === 'draw' ? this.executeDrawCard() : this.executeGenerateEnergy();

  const wrapperEvent: CombatEvent = {
    type: 'FREE_STEP_RESOLVED',
    action: command.action,
    outcome: effectEvent.type.endsWith('SKIPPED') ? 'SKIPPED' : 'APPLIED',
  };

  const events = [effectEvent, wrapperEvent];
  for (const e of events) this.eventBus.emit(e);
  return ok(events);
}
```

**Nota de diseño explícita (resuelve un conflicto de fuente):** el criterio de
aceptación *original* de H3.6 en `backlog.md` (escrito antes de la decisión de diseño
del mismo día) pedía errores duros (`CANNOT_DRAW_EMPTY_DECK`, `ENERGY_AT_MAX` como
`CombatCommandError`). La decisión de decisions.md del mismo día, posterior, es
explícita: *"Si ya está al tope de la opción elegida, no ocurre nada"*. Esta spec sigue
decisions.md (fuente de mayor autoridad y más reciente) y **sustituye** el criterio de
error duro del backlog por el comportamiento no-op-sin-error de §2.5/§2.6 — se señala
aquí para que Coordinator actualice el texto de H3.6 en `backlog.md` en su próxima
pasada, sin que Programmer tenga que reconciliar la contradicción por su cuenta.

`DRAW_CARD` (paga 1 acción) reutiliza el mismo patrón que `handleGenerateEnergy` (H3.2):
valida turno, acciones disponibles, gasta 1 acción, llama `executeDrawCard()`, emite
evento. No requiere el chequeo `FREE_STEP_ALREADY_TAKEN` — es independiente del paso
previo, puede usarse aunque el paso previo ya se haya tomado (o no).

**Orden entre paso previo y las 2 acciones:** decisions.md describe una secuencia
("1. paso previo. 2. luego, 2 acciones") pero esta spec **NO impone un gate estricto**
que bloquee `ACTIVATE_ABILITY`/`PLAY_CARD`/etc. hasta que `DRAW_OR_GENERATE` se haya
invocado — el jugador puede optar por no tomarlo (perdiendo el valor gratis) o tomarlo
en cualquier momento de su turno antes de `END_TURN`, siempre que sea antes de la
primera vez o simplemente no lo tome. Se documenta como decisión explícita: forzar el
orden añadiría una validación de "fase de turno" nueva sin que decisions.md pida
explícitamente que sea bloqueante — el único requisito duro es "una vez por turno", ya
cubierto por `FREE_STEP_ALREADY_TAKEN`.

### 2.7 Hand-gating de `PLAY_CARD`/`PLAY_ALLY`/`PLAY_CONTRATIEMPO` (cierra el gap de §2.1)

Los 3 handlers ganan una validación nueva, en la posición donde ya validan
`turnOwner`/existencia del `cardId` en su mapa de config respectivo:

```ts
if (!this.leaderHand.includes(command.cardId)) {
  return err({ code: 'CARD_NOT_IN_HAND', cardId: command.cardId });
}
// ... resto de validaciones sin cambios ...
// Al mutar (éxito): elimina la carta de la mano.
this.leaderHand = this.leaderHand.filter((id) => id !== command.cardId);
```

**Impacto en tests existentes de H1.14/H1.15/H1.18:** todo test que hoy construye un
`CombatEngine` y despacha `PLAY_CARD`/`PLAY_ALLY`/`PLAY_CONTRATIEMPO` directamente sin
pasar por `DRAW_OR_GENERATE`/mano inicial fallará con `CARD_NOT_IN_HAND` tras este
cambio — Programmer debe actualizar esos tests para que la carta bajo prueba esté en
`leaderDeckCardIds` (§2.8) de forma que la mano inicial (5 cartas robadas del mazo
barajado) la contenga, o bien inyectar semillas de `SeededRandomSource` ya verificadas
en el nuevo test suite. Se lista explícitamente en la Definition of Done (§2.10).

### 2.8 `CombatEngineConfig` — campos nuevos

```ts
// config.ts
/** NUEVO H3.6. IDs de TODAS las cartas jugables del Líder (unión de playableCards +
 *  allyCards + contratiempoCards, en el orden que Programmer decida al ensamblar —
 *  ver catalog-adapter.ts §2.9) de las que se compone el mazo de robo de este combate.
 *  Se baraja UNA VEZ en el constructor (mismo `shuffle` Fisher-Yates ya usado para
 *  dramaturgiaDeck, H1.18). OBLIGATORIO — sin mazo no hay mano inicial. */
readonly leaderDeckCardIds: readonly CardId[];

/** Default LEADER_INITIAL_HAND_SIZE (5). */
readonly initialHandSize?: number;

/** Default LEADER_HAND_SIZE_MAX (7). */
readonly handSizeMax?: number;
```

### 2.9 `catalog-adapter.ts` — ensamblaje del mazo

```ts
// buildCombatEngineConfig — nuevo bloque
const leaderDeckCardIds: CardId[] = leader.cardPoolIds; // MVP: el mazo de combate = el pool completo de 10
// ...
return {
  // ...campos existentes...
  leaderDeckCardIds,
};
```

Nota: en el MVP el "mazo de combate" es simplemente `leader.cardPoolIds` (las 10 cartas
propias del Líder, H1.9) — no hay todavía un mazo de 30 cartas de la run (eso es
`domain/run`, fuera de alcance de `domain/combat`). Cuando `domain/run` exista, este
adaptador es el único punto que cambia: en vez de `leader.cardPoolIds` recibirá el mazo
ya construido de la run (30 cartas con evoluciones aplicadas). `CombatEngine` no sabe ni
le importa de dónde viene la lista.

### 2.10 Definition of Done de H3.6

- [ ] `types/hand.ts`, `types/turn-phase.ts` nuevos (§2.2).
- [ ] `CombatStateSnapshot` añade `leaderHand`, `leaderDeckRemaining`, `leaderFreeStep`.
- [ ] `CombatCommand` añade `DRAW_OR_GENERATE`, `DRAW_CARD`.
- [ ] `CombatEvent` añade `FREE_STEP_RESOLVED`, `LEADER_HAND_CARD_DRAWN`,
      `LEADER_HAND_DRAW_SKIPPED`, `ENERGY_GENERATE_SKIPPED` (más `ENERGY_GENERATED` si
      H3.2 no lo dejó ya cerrado con ese nombre exacto — verificar contra el spec/PR real
      de H3.2 antes de implementar, evitar duplicar el evento con otro nombre).
- [ ] `CombatCommandError` añade `FREE_STEP_ALREADY_TAKEN`, `CARD_NOT_IN_HAND`.
- [ ] `CombatEngineConfig` añade `leaderDeckCardIds` (obligatorio), `initialHandSize?`,
      `handSizeMax?`.
- [ ] Constructor: baraja `leaderDeckCardIds`, reparte mano inicial (5, o menos si el
      mazo tiene menos de 5), sin emitir evento (mismo criterio "constructor no emite").
- [ ] `handleDrawOrGenerate`, `handleDrawCard` implementados según §2.6.
- [ ] `handlePlayCard`/`handlePlayAlly`/`handlePlayContratiempo` ganan el gate de §2.7.
- [ ] `handleEndTurn` resetea `leaderFreeStepTakenThisTurn = false` únicamente cuando el
      turno entrante es `'LEADER'` (nunca para `'ENEMY'`).
- [ ] Tests parametrizados de §2.6/H3.6 backlog (adaptados a no-op-sin-error): mano llena
      → `LEADER_HAND_DRAW_SKIPPED`; mazo vacío → `LEADER_HAND_DRAW_SKIPPED`; energía al
      tope → `ENERGY_GENERATE_SKIPPED`; segunda llamada a `DRAW_OR_GENERATE` en el mismo
      turno → `FREE_STEP_ALREADY_TAKEN`; turno de Enemigo → `NOT_YOUR_TURN`;
      `DRAW_CARD` paga 1 acción y tiene el mismo efecto que la versión gratis.
- [ ] Tests existentes de H1.14/H1.15/H1.18 que despachan `PLAY_CARD`/`PLAY_ALLY`/
      `PLAY_CONTRATIEMPO` se actualizan para que la carta esté en mano (§2.7 nota de
      impacto) — se listan explícitamente los archivos afectados en el PR.

---

## 3. Secuaces: comportamiento dictado por Dramaturgia, no selección aleatoria (H1.16, rediseño)

### 3.1 Qué cambia exactamente

Hoy `handleResolveMinionAction` (combat-engine.ts ~L1553) elige un único Secuaz al azar
entre los que tienen acción especial válida (CD=0 + Núcleo disponible), o cae a un
"plano attack" de un Secuaz aleatorio si ninguno tiene acción especial lista. **Este
algoritmo desaparece.** La nueva fuente de verdad es el `minionBehavior` de la carta de
Dramaturgia que el Enemigo robó ESE turno — el motor ya no decide, solo interpreta y
valida.

### 3.2 Tipos nuevos — `MinionBehaviorSpec` (mirror `catalog`/`combat`, mismo patrón que `EnemyAbilityAiProfile`)

`packages/domain/catalog/src/types/minion-behavior.ts` (NUEVO):

```ts
import type { MinionDefinitionId } from './minion'; // si no existe ya un tipo de catálogo equivalente, usar string — ver nota

/**
 * GDD/decisions.md 2026-07-08: "el comportamiento está escrito en el TEXTO de la carta
 * de Dramaturgia". Vocabulario CERRADO de criterios ejecutables por el motor —
 * cualquier matiz narrativo adicional sigue viviendo en
 * `DramaturgiaCardDefinition.effectDescription` (texto libre, no ejecutable, sin
 * cambios respecto a H1.10).
 */
export type MinionSelectionCriterion =
  | { readonly kind: 'ALL' }                                            // "Tus secuaces atacan"
  | { readonly kind: 'RANDOM_ONE' }                                     // azar EXPLÍCITO de contenido, no del motor por defecto
  | { readonly kind: 'HIGHEST_PLANO_ATTACK' }                           // "el más fuerte" (ataque plano más alto)
  | { readonly kind: 'HIGHEST_LIFE' }                                   // NUEVO §3.9.4 — "el secuaz con más vida ACTUAL"
  | { readonly kind: 'LOWEST_LIFE' }                                    // NUEVO §3.9.4 — "el secuaz con menos vida ACTUAL" (rematar al debilitado)
  | { readonly kind: 'SPECIFIC_DEFINITION'; readonly minionDefinitionId: MinionDefinitionId }; // "el Secuaz X actúa"

export interface MinionBehaviorSpec {
  readonly criterion: MinionSelectionCriterion;
}
```

`packages/domain/combat/src/types/minion-behavior.ts` (NUEVO) — mismo contenido,
re-exportado tal cual dentro de `domain/combat` (mismo patrón de duplicación
estructural intencional que `EnemyAbilityBranch`/`EnemyAbilityTier` entre
`domain/catalog/types/enemy.ts` y `domain/combat/types/enemy-ai.ts`, documentado en
`enemy.ts` como *"catalog no puede importar ese validador"* — aquí aplica la misma regla
de dirección de dependencia, `catalog` nunca importa `combat`).

#### 3.2.1 ⚠️ SUSTITUIDA por §3.9 — `HIGHEST_LIFE` ya es implementable

Esta subsección documentaba el gap: *"Ataca el secuaz con más vida"* no era
implementable porque `MinionInPlay`/`MinionDefinition` (H1.16 original) no tenían campo
de vida, y proponía sustituir ese ejemplo por `HIGHEST_PLANO_ATTACK` como proxy
temporal. **Se conserva el texto original abajo como archivo histórico (nunca se borra
texto antiguo), pero queda sustituida por completo**: el Game Designer cerró el vacío el
mismo día (decisions.md, "Vida de Secuaz: mecánica mínima para HP propia") y confirmó
vida propia para los Secuaces. §3.9 añade `maxLife`/`life` a `MinionDefinition`/
`MinionInPlay` (paralelo a Aliados, H1.15) y `HIGHEST_LIFE`/`LOWEST_LIFE` ya están en el
union de §3.2 arriba, operando sobre vida ACTUAL. `HIGHEST_PLANO_ATTACK` NO se elimina
del vocabulario — sigue siendo un criterio válido e independiente (el Enemigo puede
querer "el que más pega" en vez de "el que más vida tiene"); ambos coexisten.

> Texto original (histórico, ya no aplica): *"El ejemplo textual de decisions.md es
> 'Ataca el secuaz con más vida' — pero `MinionInPlay`/`MinionDefinition` (H1.16
> original) no tienen campo de vida (...). Añadir vida a los Secuaces es una historia de
> contenido/sistema propia (fuera de alcance de este cierre de loop...). Esta spec NO
> añade vida a los Secuaces y sustituye ese ejemplo por `HIGHEST_PLANO_ATTACK` (...) — no
> bloquea el cierre del loop jugable actual."*

### 3.3 `DramaturgiaCardDefinition` — campo nuevo

```ts
// packages/domain/catalog/src/types/dramaturgia-card.ts
export interface DramaturgiaCardDefinition {
  readonly id: DramaturgiaCardId;
  readonly name: string;
  readonly icon: EnemyAbilityBranch;
  readonly effectDescription?: string;
  /** NUEVO H1.16 (rediseño). Ausente = esta carta NO dicta comportamiento de Secuaz —
   *  ningún Secuaz actúa el turno en que sale esta carta (ver §3.5, nuevo
   *  MINION_ACTION_SKIPPED.reason). Presente = el motor resuelve exactamente este
   *  criterio, sin azar propio salvo que el criterio sea RANDOM_ONE (decisión de
   *  contenido explícita, no del motor). */
  readonly minionBehavior?: MinionBehaviorSpec;
}
```

`validation/schema.ts` (H1.8/H1.10) gana el parseo/validación de `minionBehavior`:
`kind: 'SPECIFIC_DEFINITION'` requiere que `minionDefinitionId` sea no-vacío (la
validación de que ese id exista realmente entre los Secuaces invocables del Enemigo es
responsabilidad de `validation/cross-reference.ts`, mismo patrón que otras referencias
cruzadas de H1.8 §4).

### 3.4 `CombatEngineConfig`/estado interno — Dramaturgia pasa de icono a carta completa

**Cambio de forma (breaking, documentado):** hasta ahora `dramaturgiaDeck:
readonly DramaturgiaCardIcon[]` (solo el icono, H1.18 §0.5) y el motor descartaba el
resto de la carta. Para que `RESOLVE_MINION_ACTION` pueda leer `minionBehavior`
necesita la carta COMPLETA en el momento de resolución, no solo su icono.

```ts
// config.ts
// ELIMINADO: readonly dramaturgiaDeck?: readonly DramaturgiaCardIcon[];
readonly dramaturgiaDeck?: readonly DramaturgiaCardDefinition[]; // NUEVO tipo de elemento
```

```ts
// combat-engine.ts — estado interno
private dramaturgiaDrawPile: DramaturgiaCardDefinition[]; // antes: DramaturgiaCardIcon[]
private dramaturgiaDiscardPile: DramaturgiaCardDefinition[];
private currentEnemyDramaturgiaCard: DramaturgiaCardDefinition | undefined; // NUEVO
```

`drawDramaturgiaCard` (H1.18 §0.5.3) se reescribe para operar sobre
`DramaturgiaCardDefinition` en vez de solo el icono, y **además** guarda la carta
robada en `this.currentEnemyDramaturgiaCard` antes de devolver su icono (el resto de la
función — reciclado de pila, eventos `DRAMATURGIA_DECK_RESHUFFLED`/
`DRAMATURGIA_CARD_DRAWN` — no cambia de comportamiento, solo el tipo que maneja
internamente):

```ts
private drawDramaturgiaCard(events: CombatEvent[]): DramaturgiaCardIcon {
  if (this.dramaturgiaDrawPile.length === 0) {
    this.dramaturgiaDrawPile = this.shuffle(this.dramaturgiaDiscardPile);
    this.dramaturgiaDiscardPile = [];
    // ...evento DRAMATURGIA_DECK_RESHUFFLED sin cambios...
  }
  const card = this.dramaturgiaDrawPile.pop() as DramaturgiaCardDefinition;
  this.dramaturgiaDiscardPile.push(card);
  this.currentEnemyDramaturgiaCard = card; // NUEVO — disponible para RESOLVE_MINION_ACTION este turno
  const drawn: CombatEvent = { type: 'DRAMATURGIA_CARD_DRAWN', icon: card.icon };
  events.push(drawn);
  this.eventBus.emit(drawn);
  return card.icon;
}
```

`this.currentEnemyDramaturgiaCard` se limpia (`undefined`) al inicio de cada nuevo turno
de Enemigo, antes de robar la siguiente carta — evita que una llamada tardía a
`RESOLVE_MINION_ACTION` fuera de secuencia lea la carta de un turno anterior (defensivo,
mismo estilo que `minionActionResolvedThisEnemyTurn`).

### 3.5 `packages/domain/combat/src/minion-ai.ts` (NUEVO) — selección pura

Sustituye la lógica ad-hoc inline de `handleResolveMinionAction` (H1.16 original
L1566-1579, selección de `specialCandidates` + `randomSource.pick`).

```ts
import type { RandomSource } from '@collector/domain-shared';
import type { MinionInPlay } from './types/minion';
import type { MinionBehaviorSpec } from './types/minion-behavior';

/**
 * Resuelve QUÉ instancias de Secuaz actúan este turno, dado el `minionBehavior` de la
 * carta de Dramaturgia robada (§3.3/§3.4). Pura respecto al estado del motor — no
 * valida CD/Núcleo (eso sigue en `CombatEngine`, §3.6, porque depende de
 * abilityCoreCosts/remainingCooldowns/nucleoTable que esta función no conoce).
 *
 * - `undefined` (la carta no menciona Secuaces) → [] siempre, sin importar cuántos
 *   Secuaces haya en mesa (§3.3, nuevo comportamiento por defecto: "no actúa nadie" en
 *   vez de "azar del motor").
 * - `ALL` → todas las instancias en mesa (mesa vacía → []).
 * - `RANDOM_ONE` → 1 instancia elegida por `randomSource.pick` (mesa vacía → []).
 * - `SPECIFIC_DEFINITION` → todas las instancias en mesa cuyo `definitionId` coincida
 *   (0, 1 o más si hay duplicados invocados).
 * - `HIGHEST_PLANO_ATTACK` → la(s) instancia(s) con `planoAttackAmount` máximo; empate
 *   se resuelve a UNA sola vía `randomSource.pick` (criterio singular "el más fuerte").
 */
export function selectActingMinions(
  behavior: MinionBehaviorSpec | undefined,
  minionsInPlay: readonly MinionInPlay[],
  randomSource: RandomSource
): readonly MinionInPlay[] {
  if (!behavior || minionsInPlay.length === 0) return [];

  switch (behavior.criterion.kind) {
    case 'ALL':
      return minionsInPlay;
    case 'RANDOM_ONE':
      return [randomSource.pick(minionsInPlay)];
    case 'SPECIFIC_DEFINITION':
      return minionsInPlay.filter((m) => m.definitionId === behavior.criterion.minionDefinitionId);
    case 'HIGHEST_PLANO_ATTACK': {
      const max = Math.max(...minionsInPlay.map((m) => m.planoAttackAmount));
      const top = minionsInPlay.filter((m) => m.planoAttackAmount === max);
      return [top.length === 1 ? (top[0] as MinionInPlay) : randomSource.pick(top)];
    }
  }
}
```

Tests dedicados en `minion-ai.test.ts` (nuevo archivo): 1 caso por `kind`, incluyendo
mesa vacía y `undefined` behavior, y el caso de empate en `HIGHEST_PLANO_ATTACK`.

### 3.6 `handleResolveMinionAction` — reescritura del cuerpo

```ts
private handleResolveMinionAction(
  command: Extract<CombatCommand, { type: 'RESOLVE_MINION_ACTION' }>
): CombatCommandResult {
  void command;
  if (this.turnOwner !== 'ENEMY') {
    return err({ code: 'NOT_YOUR_TURN', expected: 'ENEMY', actual: this.turnOwner });
  }
  if (this.minionActionResolvedThisEnemyTurn) {
    return err({ code: 'MINION_ACTION_ALREADY_RESOLVED_THIS_TURN' });
  }
  this.minionActionResolvedThisEnemyTurn = true;

  if (this.minionsInPlay.length === 0) {
    const event: CombatEvent = { type: 'MINION_ACTION_SKIPPED', reason: 'NO_MINIONS_IN_PLAY' };
    this.eventBus.emit(event);
    return ok([event]);
  }

  const behavior = this.currentEnemyDramaturgiaCard?.minionBehavior;
  const actors = selectActingMinions(behavior, this.minionsInPlay, this.randomSource);

  if (actors.length === 0) {
    // NUEVO reason — la carta de Dramaturgia de este turno no menciona Secuaces.
    const event: CombatEvent = { type: 'MINION_ACTION_SKIPPED', reason: 'NOT_SPECIFIED_BY_DRAMATURGIA' };
    this.eventBus.emit(event);
    return ok([event]);
  }

  const events: CombatEvent[] = [];
  for (const minion of actors) {
    events.push(...this.resolveOneMinionAction(minion)); // extrae el cuerpo H1.16 original
                                                            // (acción especial si CD/Núcleo listos,
                                                            // si no plano attack) SIN el pick aleatorio —
                                                            // ahora actúa sobre `minion` ya elegido.
  }
  return ok(events);
}
```

`resolveOneMinionAction(minion)` es exactamente el cuerpo que hoy tiene
`handleResolveMinionAction` para UN Secuaz ya elegido (acción especial si
`specialActionAbilityId` está listo con Núcleo disponible; si no, plano attack) —
extraído tal cual a un helper privado reutilizable en el `for`, sin cambio de
comportamiento por Secuaz individual. Cada Secuaz que actúa emite su propio
`MINION_ACTION_RESOLVED` (el tipo de evento ya admite repetirse en el mismo `dispatch`,
mismo patrón que `PHASE_CHANGED` en H1.17).

### 3.7 `CombatEvent`/`CombatCommandError` — cambios

```ts
// events.ts — MINION_ACTION_SKIPPED gana un 2º valor de `reason`
readonly type: 'MINION_ACTION_SKIPPED';
readonly reason: 'NO_MINIONS_IN_PLAY' | 'NOT_SPECIFIED_BY_DRAMATURGIA'; // NUEVO 2º valor
```

Ningún `CombatCommandError` nuevo — `RESOLVE_MINION_ACTION` sigue sin payload y sus
únicos rechazos (`NOT_YOUR_TURN`, `MINION_ACTION_ALREADY_RESOLVED_THIS_TURN`) no cambian.

### 3.8 Definition of Done de H1.16 (rediseño)

- [ ] `catalog/types/minion-behavior.ts`, `combat/types/minion-behavior.ts` nuevos.
- [ ] `DramaturgiaCardDefinition.minionBehavior?` añadido + validado en schema.ts.
- [ ] `CombatEngineConfig.dramaturgiaDeck` cambia de `DramaturgiaCardIcon[]` a
      `DramaturgiaCardDefinition[]`.
- [ ] `combat-engine.ts`: `currentEnemyDramaturgiaCard`, `drawDramaturgiaCard`
      reescrita, `handleResolveMinionAction` reescrita según §3.6, `resolveOneMinionAction`
      extraído.
- [ ] `minion-ai.ts` nuevo con `selectActingMinions` + tests dedicados (§3.5).
- [ ] `MINION_ACTION_SKIPPED.reason` gana `'NOT_SPECIFIED_BY_DRAMATURGIA'`.
- [ ] Tests existentes de `combat-engine.minions.test.ts` que asumían selección aleatoria
      del motor se reescriben para construir cartas de Dramaturgia con `minionBehavior`
      explícito y verificar que el criterio se respeta determinísticamente (`ALL`,
      `SPECIFIC_DEFINITION`, `HIGHEST_PLANO_ATTACK` con semilla fija para verificar
      reproducibilidad del desempate, `RANDOM_ONE`, y el caso `undefined` → ningún Secuaz
      actúa).
- [ ] `catalog-adapter.ts` actualizado para pasar `DramaturgiaCardDefinition[]` completo
      en vez de mapear a solo `.icon` (§3.4).
- [ ] Ver §3.9 para la Definition of Done completa de vida de Secuaz + targeting de
      ataque + `HIGHEST_LIFE`/`LOWEST_LIFE` (§3.9.7) — es una extensión de esta misma
      historia H1.16, no una historia aparte.

---

## 3.9 Vida de Secuaz y targeting explícito de ataque del jugador (extiende H1.16)

> Cierra en diseño técnico la decisión de Game Designer registrada en
> `.ai-studio/memory/decisions.md` (2026-07-08, "Vida de Secuaz: mecánica mínima para HP
> propia") y `.ai-studio/memory/glossary.md` (términos "Vida de Secuaz" y
> `minionBehavior` actualizado). Sustituye §3.2.1 (marcada arriba). Depende de §3.9.1-2
> existiendo antes de que §3.2/§3.6 (`selectActingMinions`, `HIGHEST_LIFE`/`LOWEST_LIFE`)
> tengan datos que leer — implementar en el orden 3.9.1 → 3.9.2 → 3.9.3 → 3.9.4.

### 3.9.1 `MinionDefinition`/`MinionInPlay` — vida, paralelo directo a Aliado (H1.15)

Mismo patrón exacto que `AllyCardDefinition.life`/`AllyInPlay.maxLife`/`AllyInPlay.life`
(`packages/domain/combat/src/types/ally.ts`, citado arriba en este documento) — un campo
fijo de vida máxima en la definición de catálogo, denormalizado a la instancia en mesa
junto con la vida actual:

```ts
// packages/domain/combat/src/types/minion.ts — MODIFICADO
export interface MinionDefinition {
  readonly passiveEffect: MinionPassiveEffectDefinition;
  readonly specialActionAbilityId?: AbilityId;
  readonly planoAttackAmount: number;
  readonly isDefensor: boolean;
  /** NUEVO §3.9.1. Vida máxima del Secuaz — campo fijo de catálogo, igual patrón que
   *  `AllyCardDefinition.life` (H1.15). Entero > 0 (un Secuaz sin vida no tiene sentido
   *  de existir; a diferencia de `NucleoValue`, aquí NO se permite 0 como piso — un
   *  Secuaz de 0 de vida está muerto por definición y `SUMMON_MINION` debe rechazarlo,
   *  ver §3.9.3). No se calcula a partir de la vida del Enemigo ni es un valor global
   *  compartido — decisions.md, punto 2. */
  readonly maxLife: number;
}

export interface MinionInPlay {
  readonly instanceId: CardInstanceId;
  readonly definitionId: MinionDefinitionId;
  readonly passiveEffect: MinionPassiveEffectDefinition;
  readonly specialActionAbilityId?: AbilityId;
  readonly planoAttackAmount: number;
  readonly isDefensor: boolean;
  /** NUEVO §3.9.1. Denormalizado de `MinionDefinition.maxLife` al invocar (mismo
   *  patrón que `AllyInPlay.maxLife`). */
  readonly maxLife: number;
  /** NUEVO §3.9.1. Vida ACTUAL — es el campo que consumen `HIGHEST_LIFE`/`LOWEST_LIFE`
   *  (§3.9.4), NO `maxLife` (decisions.md punto 4, explícito: "operan sobre vida
   *  actual, no vida máxima"). */
  readonly life: number;
}
```

**Diferencia deliberada con `AllyInPlay` en el manejo de la muerte (ver §3.9.3):** un
Aliado con `life === 0` permanece en `alliesInPlay` (H1.15 §0.6, "nunca se elimina...
toda lectura de 'vivos' filtra explícitamente por `life > 0`"). Un Secuaz con `life`
llegando a `<= 0` se **elimina de `minionsInPlay` de inmediato** (decisions.md punto 3:
"sale de mesa de inmediato"). Esto significa que, a diferencia de Aliados,
`minionsInPlay` nunca necesita el filtro `life > 0` — su sola presencia en el array ya
implica `life > 0`. `selectActingMinions`/`MinionSelectionCriterion` (§3.2/§3.6) pueden
asumir esto sin defensas adicionales.

### 3.9.2 Targeting explícito: `AttackTarget` — nuevo tipo compartido

```ts
// packages/domain/combat/src/types/combat-target.ts (NUEVO)
import type { CardInstanceId } from '@collector/domain-shared';

/**
 * decisions.md 2026-07-08 punto 1: el jugador elige explícitamente el objetivo de un
 * ataque de un solo objetivo — Enemigo o cualquier Secuaz válido en mesa (referencia
 * explícita: Marvel Champions). Tipo compartido — hoy solo lo usa
 * `PlayableCardEffectDefinition.ATTACK_ENEMY` vía `PLAY_CARD` (§3.9.3), porque es el
 * único efecto de daño de un solo objetivo que el Líder puede originar en el motor
 * actual (`AbilityEffectDefinition.ATTACK` sigue restringido a `side: 'ENEMY'`,
 * `ability-effect.ts` — ninguna habilidad de Líder tiene hoy un efecto ATTACK). Si una
 * historia de contenido futura añade una "habilidad de Ataque" del Líder
 * (`ACTIVATE_ABILITY` con un efecto de daño a un solo objetivo), debe reutilizar este
 * mismo tipo y el mismo flujo de validación de §3.9.3 — no inventar un segundo
 * mecanismo de targeting.
 */
export type AttackTarget =
  | { readonly kind: 'ENEMY' }
  | { readonly kind: 'MINION'; readonly minionInstanceId: CardInstanceId };
```

### 3.9.3 `PLAY_CARD` — target explícito, validación de Defensor, resolución de daño

**Comando** (`types/commands.ts`, extiende la variante `PLAY_CARD` ya definida arriba en
este documento):

```ts
| {
    readonly type: 'PLAY_CARD';
    readonly cardId: CardId;
    readonly sourceId: string;
    readonly nucleoInstanceId?: NucleoInstanceId;
    /**
     * NUEVO §3.9.2/§3.9.3. Objetivo explícito del ataque — OBLIGATORIO en tiempo de
     * ejecución (no se puede forzar por tipos, igual que `nucleoInstanceId`, porque
     * depende de `def.effect.kind` en runtime) si y solo si
     * `PlayableCardEffectDefinition.effect.kind === 'ATTACK_ENEMY'`. Ausente/irrelevante
     * para cualquier otro `effect.kind` (`PLOT`, `SHIELD`, ausente).
     */
    readonly target?: AttackTarget;
  }
```

**`PlayableCardEffectDefinition.ATTACK_ENEMY`** gana `arrollar` (reutiliza la keyword ya
definida para Aliados/Enemigo, `AbilityEffectDefinition.ATTACK.arrollar` — mismo
significado, mismo patrón, decisions.md punto 3: *"se reutiliza la misma keyword
Arrollar ya definida para Aliados en vez de inventar una nueva"*):

```ts
// types/playable-card.ts — MODIFICADO
| {
    readonly kind: 'ATTACK_ENEMY';
    readonly formula: { readonly baseFormula: UmbralFormula; readonly bonusFormula?: UmbralFormula };
    /** NUEVO §3.9.3. Solo tiene efecto cuando el `target` resuelto en tiempo de comando
     *  es `MINION` y el golpe mata al Secuaz con exceso de daño — ver `applyPlayableCardEffect`
     *  abajo. Sin efecto cuando el target es `ENEMY` (no hay "escudo" del Enemigo que
     *  arrollar en el motor actual). Default false/ausente, mismo criterio que el resto
     *  de usos de Arrollar. */
    readonly arrollar?: boolean;
  }
```

**Validación en `handlePlayCard`** (inserción en la cadena de validaciones ya descrita
en este documento, después de resolver `nucleo` y antes de mutar estado):

```ts
let resolvedTarget: AttackTarget | undefined;
if (def.effect?.kind === 'ATTACK_ENEMY') {
  if (!command.target) {
    return err({ code: 'PLAY_CARD_TARGET_REQUIRED', cardId: command.cardId });
  }

  // decisions.md punto 1, excepción Defensor: "fuerza prioridad de ser el objetivo
  // cuando está en mesa". Si hay >=1 Secuaz Defensor vivo, CUALQUIER target que no sea
  // uno de esos Defensores se rechaza — el jugador puede elegir ENTRE los Defensores si
  // hay varios, pero no puede saltárselos.
  const liveDefensores = this.minionsInPlay.filter((m) => m.isDefensor);
  if (liveDefensores.length > 0) {
    const targetsAllowedDefensor =
      command.target.kind === 'MINION' &&
      liveDefensores.some((m) => m.instanceId === command.target!.minionInstanceId);
    if (!targetsAllowedDefensor) {
      return err({
        code: 'MUST_TARGET_DEFENSOR',
        cardId: command.cardId,
        defensorInstanceIds: liveDefensores.map((m) => m.instanceId),
      });
    }
  }

  if (command.target.kind === 'MINION') {
    const minion = this.minionsInPlay.find((m) => m.instanceId === command.target!.minionInstanceId);
    if (!minion) {
      return err({ code: 'ATTACK_TARGET_NOT_FOUND', minionInstanceId: command.target.minionInstanceId });
    }
  }

  resolvedTarget = command.target;
}
```

**Resolución de daño** — `applyPlayableCardEffect` (ya definida arriba en este
documento para el `effect.kind === 'ATTACK_ENEMY'`) se ramifica por `resolvedTarget.kind`
en vez de asumir siempre Enemigo:

```ts
if (effect.kind === 'ATTACK_ENEMY') {
  const resolution = resolveAbilityUmbral(effect.formula, (nucleo as NucleoInstance).value);
  const rawAmount = resolution.baseResolvedValue; // sin cambios respecto al cálculo ya descrito

  if (resolvedTarget.kind === 'ENEMY') {
    // Camino EXISTENTE, sin cambios de comportamiento — ver bloque ya documentado
    // arriba en este documento (this.enemyDamage += rawAmount; ENEMY_DAMAGED).
  } else {
    // NUEVO §3.9.3 — camino Secuaz.
    const minion = this.minionsInPlay.find((m) => m.instanceId === resolvedTarget.minionInstanceId)!;
    const lifeBefore = minion.life;
    const lifeAfter = Math.max(0, lifeBefore - rawAmount);
    const excess = Math.max(0, rawAmount - lifeBefore);
    const died = lifeAfter <= 0;
    const appliedDamageToEnemy = died && effect.arrollar ? excess : 0;

    if (died) {
      // decisions.md punto 3: "sale de mesa de inmediato" — a diferencia de Aliado
      // (H1.15), NO se conserva en minionsInPlay con life=0.
      this.minionsInPlay = this.minionsInPlay.filter((m) => m.instanceId !== minion.instanceId);
    } else {
      this.minionsInPlay = this.minionsInPlay.map((m) =>
        m.instanceId === minion.instanceId ? { ...m, life: lifeAfter } : m
      );
    }
    this.enemyDamage += appliedDamageToEnemy;

    const dmgEvent: CombatEvent = {
      type: 'MINION_DAMAGED',
      cardId: command.cardId,
      sourceId: command.sourceId,
      nucleoSpent: nucleo as NucleoInstance,
      minionInstanceId: minion.instanceId,
      rawAmount,
      lifeBefore,
      lifeAfter,
      died,
      excess,
      appliedDamageToEnemy,
      enemyDamageAfter: this.enemyDamage,
    };
    events.push(dmgEvent);
    this.eventBus.emit(dmgEvent);

    if (died) {
      const defeatedEvent: CombatEvent = {
        type: 'MINION_DEFEATED',
        instanceId: minion.instanceId,
        definitionId: minion.definitionId,
        cause: 'PLAYER_ATTACK',
      };
      events.push(defeatedEvent);
      this.eventBus.emit(defeatedEvent);
    }
  }
}
```

**`SUMMON_MINION`** gana una validación de constructor/comando (mismo estilo que otras
validaciones de referencia cruzada de este documento): `MinionDefinition.maxLife` debe
ser un entero `> 0`; el motor inicializa `MinionInPlay.life = maxLife` al invocar (no
hay Secuaces que entren a mesa ya heridos en el MVP — puerta abierta a contenido futuro,
mismo criterio que "efecto al morir" de decisions.md punto 3).

### 3.9.4 `CombatEvent`/`CombatCommandError` — nuevos tipos

```ts
// types/events.ts — NUEVOS, mismo patrón que ALLY_DAMAGED (H1.15)/ENEMY_DAMAGED (H1.18)
| {
    readonly type: 'MINION_DAMAGED';
    readonly cardId: CardId;
    readonly sourceId: string;
    readonly nucleoSpent: NucleoInstance;
    readonly minionInstanceId: CardInstanceId;
    readonly rawAmount: number;
    readonly lifeBefore: number;
    readonly lifeAfter: number;
    readonly died: boolean;
    /** Exceso sobre la vida del Secuaz (rawAmount - lifeBefore), ANTES de decidir Arrollar. */
    readonly excess: number;
    /** `excess` si `died && effect.arrollar`, si no 0 — mismo criterio que `ALLY_DAMAGED.appliedDamageToLeader`. */
    readonly appliedDamageToEnemy: number;
    readonly enemyDamageAfter: number;
  }
| {
    /** NUEVO §3.9.3. Un Secuaz sale de mesa — sin trigger por defecto (decisions.md
     *  punto 3). `cause` deja la puerta abierta a un futuro `'ON_DEATH_EFFECT'` u otras
     *  fuentes de daño a Secuaz sin ampliar el tipo hoy más allá de lo que el motor
     *  produce (solo `PLAYER_ATTACK` en esta historia). */
    readonly type: 'MINION_DEFEATED';
    readonly instanceId: CardInstanceId;
    readonly definitionId: MinionDefinitionId;
    readonly cause: 'PLAYER_ATTACK';
  }
```

```ts
// types/errors.ts — NUEVOS
| { readonly code: 'PLAY_CARD_TARGET_REQUIRED'; readonly cardId: CardId }
| { readonly code: 'ATTACK_TARGET_NOT_FOUND'; readonly minionInstanceId: CardInstanceId }
| { readonly code: 'MUST_TARGET_DEFENSOR'; readonly cardId: CardId; readonly defensorInstanceIds: readonly CardInstanceId[] }
```

`ENEMY_DAMAGED` (ya definido en este documento para H1.18) pierde la restricción de
comentario *"siempre objetivo directo, nunca Secuaz"* — sigue siendo el evento correcto
para `resolvedTarget.kind === 'ENEMY'`, simplemente ya no es la única rama posible.

### 3.9.5 `MinionSelectionCriterion.HIGHEST_LIFE`/`LOWEST_LIFE` — `selectActingMinions`

Extiende el `switch` de `selectActingMinions` (§3.6, ya definida en este documento) con
2 casos nuevos, mismo patrón de desempate que `HIGHEST_PLANO_ATTACK` (empate → 1 sola
vía `randomSource.pick`):

```ts
case 'HIGHEST_LIFE': {
  const max = Math.max(...minionsInPlay.map((m) => m.life));
  const top = minionsInPlay.filter((m) => m.life === max);
  return [top.length === 1 ? (top[0] as MinionInPlay) : randomSource.pick(top)];
}
case 'LOWEST_LIFE': {
  const min = Math.min(...minionsInPlay.map((m) => m.life));
  const bottom = minionsInPlay.filter((m) => m.life === min);
  return [bottom.length === 1 ? (bottom[0] as MinionInPlay) : randomSource.pick(bottom)];
}
```

Como `minionsInPlay` nunca contiene un Secuaz con `life <= 0` (§3.9.1, eliminación
inmediata), no hace falta filtrar "vivos" aquí — a diferencia de un hipotético criterio
sobre Aliados, donde sí habría que filtrar `life > 0` explícitamente.

### 3.9.6 Impacto en la capa visual (H2) — extiende §5.3

Se añaden 2 filas a la tabla de §5.3 (mismo criterio: sin recetas `JuiceConfig`
concretas, solo qué debe ocurrir):

| Evento (`CombatEvent.type`) | Qué debe pasar visualmente |
|---|---|
| `MINION_DAMAGED` | El sprite del Secuaz (mismo layout de mesa que ya usa H1.16/H2 para Secuaces) reproduce la receta `hitImpact` (H2.5) y actualiza su barra/indicador de vida a `lifeAfter`. |
| `MINION_DEFEATED` | El sprite del Secuaz sale de mesa (animación de salida — reutilizar el lenguaje visual ya definido para muerte de Aliado en H1.15/H2 si existe, o una variante simple de fade/shrink si no). |

`InputAdapter` (§5.4) gana, en la misma familia que `SELECT_NUCLEO_DIE`, un intent para
targeting de ataque:

```ts
| { type: 'SELECT_ATTACK_TARGET', target: AttackTarget }
```

Emitido cuando el jugador, tras elegir jugar una carta con efecto `ATTACK_ENEMY`, hace
tap en el sprite del Enemigo o en el sprite de un Secuaz — antes de que
`CombatBridge.dispatch(PLAY_CARD)` incluya `target` en el comando final. Si hay un
Defensor vivo en mesa, el HUD debe reflejar visualmente qué sprites son objetivo válido
(mismo lenguaje que "solo puedes tocar esto"), aunque el motor sea la fuente de verdad
del rechazo (`MUST_TARGET_DEFENSOR`) — decisión de UX de detalle, no de este documento.

### 3.9.7 Definition of Done de §3.9 (extensión de H1.16)

- [ ] `MinionDefinition.maxLife`, `MinionInPlay.maxLife`/`life` añadidos (§3.9.1).
- [ ] `types/combat-target.ts` nuevo con `AttackTarget` (§3.9.2).
- [ ] `PLAY_CARD` command gana `target?: AttackTarget`; `PlayableCardEffectDefinition.ATTACK_ENEMY`
      gana `arrollar?: boolean` (§3.9.3).
- [ ] `handlePlayCard`: validación `PLAY_CARD_TARGET_REQUIRED`, validación de Defensor
      (`MUST_TARGET_DEFENSOR`), validación `ATTACK_TARGET_NOT_FOUND`, y la rama de
      resolución de daño a Secuaz en `applyPlayableCardEffect` (§3.9.3).
- [ ] `SUMMON_MINION` valida `maxLife > 0` e inicializa `life = maxLife`.
- [ ] `CombatEvent` añade `MINION_DAMAGED`, `MINION_DEFEATED`; `CombatCommandError` añade
      `PLAY_CARD_TARGET_REQUIRED`, `ATTACK_TARGET_NOT_FOUND`, `MUST_TARGET_DEFENSOR`
      (§3.9.4).
- [ ] `MinionSelectionCriterion` gana `HIGHEST_LIFE`/`LOWEST_LIFE`; `selectActingMinions`
      implementa ambos casos con el mismo desempate por `randomSource.pick` que
      `HIGHEST_PLANO_ATTACK` (§3.9.5).
- [ ] Tests nuevos: atacar al Enemigo directamente con Secuaces vivos en mesa (sin
      Defensor) sigue funcionando sin bloqueo; atacar a un Secuaz sin matarlo reduce
      `life`; atacar a un Secuaz y matarlo lo elimina de `minionsInPlay`; exceso de daño
      con `arrollar: true` pasa a `enemyDamage`, sin `arrollar` se pierde; con Defensor
      vivo, intentar atacar al Enemigo o a un Secuaz no-Defensor devuelve
      `MUST_TARGET_DEFENSOR`; `target` ausente en una carta `ATTACK_ENEMY` devuelve
      `PLAY_CARD_TARGET_REQUIRED`; `HIGHEST_LIFE`/`LOWEST_LIFE` con semilla fija para
      verificar reproducibilidad del desempate, incluyendo el caso de mesa con un único
      Secuaz (ambos criterios deben devolverlo trivialmente).
- [ ] **Nota para Coordinator (no se toca `backlog.md` desde esta spec):** el criterio de
      aceptación de H1.16 en `backlog.md` debe ampliarse para cubrir (a) targeting
      explícito de ataque del jugador Enemigo/Secuaz sin bloqueo automático, (b) la
      keyword Defensor forzando prioridad de objetivo, (c) vida de Secuaz como campo de
      catálogo y su consumo en muerte/Arrollar, y (d) `HIGHEST_LIFE`/`LOWEST_LIFE` como
      criterios de Dramaturgia disponibles para contenido — hoy el texto de H1.16 en
      backlog.md solo cubre la selección determinista por Dramaturgia sin estos 4 puntos.

---

## 4. Condiciones de victoria/derrota alternativas (H1.8 + H1.18)

### 4.1 Vocabulario cerrado de condiciones — MVP evaluable hoy

El motor solo puede evaluar condiciones sobre datos que YA mantiene en estado interno:
`scenarioPlot`, `turnNumber`, `enemyDamage`, `leaderDamage`. **No** incluye
`ALL_MINIONS_DEFEATED` (el ejemplo textual de decisions.md) — el motivo original (los
Secuaces no tenían vida ni mecanismo de derrota, mismo gap que documentaba §3.2.1) queda
**parcialmente resuelto por §3.9**: los Secuaces ya tienen vida y salen de mesa al
morir, así que `minionsInPlay.length === 0` es ahora una señal evaluable en principio.
**Sigue fuera de alcance de esta spec, deliberadamente**: `ALL_MINIONS_DEFEATED` no se
añade al vocabulario cerrado de `AlternativeVictoryCondition` en este documento —
añadirlo exige decidir matices que ni decisions.md ni el Game Designer han cerrado (¿se
evalúa solo si el Enemigo llegó a invocar al menos 1 Secuaz? ¿es un evento puntual o un
estado sostenido?). Se deja como vocabulario futuro explícito, no soportado en el schema
del catálogo todavía — señalado a Coordinator/Game Designer para una decisión de diseño
propia si se quiere cerrar, no bloquea nada de lo ya especificado aquí.

```ts
// packages/domain/catalog/src/types/victory-condition.ts (NUEVO)
// packages/domain/combat/src/types/victory-condition.ts (NUEVO, mirror estructural — mismo
// patrón de duplicación por dirección de dependencia que minion-behavior.ts, §3.2)

export type AlternativeVictoryCondition =
  | { readonly kind: 'SCENARIO_PLOT_AT_MOST'; readonly amount: number; readonly outcome: 'VICTORY' | 'DEFEAT' }
  | { readonly kind: 'TURN_COUNT_AT_LEAST'; readonly turn: number; readonly outcome: 'VICTORY' | 'DEFEAT' }
  | { readonly kind: 'ENEMY_DAMAGE_AT_LEAST'; readonly amount: number; readonly outcome: 'VICTORY' | 'DEFEAT' };
  // Vocabulario CERRADO para el MVP — extender esta unión (y su evaluación en §4.4) es
  // la única forma de añadir un nuevo `kind`; nunca texto libre interpretado en runtime.
```

Ejemplo del backlog *"Perdedor: el contador de Trama llega a -5"* se modela como
`{ kind: 'SCENARIO_PLOT_AT_MOST', amount: -5, outcome: 'DEFEAT' }` — nota: `scenarioPlot`
hoy está saturado en 0 por abajo (H1.6 §0.4, "Piso en 0"), así que un umbral negativo
**nunca se cumplirá con el motor actual**. Se señala explícitamente: si Game
Designer/Director quiere una condición de derrota por Trama negativa, hace falta
además una historia que permita a `scenarioPlot` bajar de 0 (cambio de invariante de
H1.6, fuera de alcance de esta spec) — el tipo de dato ya lo modela, pero el motor no lo
producirá todavía. No bloquea el cierre del loop porque el contenido de juguete puede
usar umbrales `>= 0` sin problema.

### 4.2 `EnemyDefinition`/`ScenarioDefinition` — campo nuevo (H1.8)

```ts
// catalog/types/enemy.ts
export interface EnemyDefinition {
  // ...campos existentes...
  readonly alternativeVictoryConditions?: readonly AlternativeVictoryCondition[];
}

// catalog/types/scenario.ts
export interface ScenarioDefinition {
  // ...campos existentes...
  readonly alternativeVictoryConditions?: readonly AlternativeVictoryCondition[];
}
```

`validation/schema.ts` valida cada entrada según su `kind` (mismo estilo que
`parsePhaseChangeCondition`, H1.17): `amount`/`turn` son enteros, `SCENARIO_PLOT_AT_MOST`
no exige `amount >= 0` (a diferencia de otros campos numéricos del catálogo, este SÍ
puede ser negativo por diseño — ver nota §4.1).

### 4.3 `CombatEngineConfig`/estado — merge de Enemigo + Escenario

```ts
// config.ts
readonly alternativeVictoryConditions?: readonly AlternativeVictoryCondition[];
```

`catalog-adapter.ts`:
```ts
alternativeVictoryConditions: [
  ...(enemy.alternativeVictoryConditions ?? []),
  ...(scenario.alternativeVictoryConditions ?? []),
],
```

### 4.4 `evaluateAndApplyCombatEnd` — precedencia (H1.18, reescritura)

**Decisión de precedencia (Architect, no especificada por decisions.md — se cierra
aquí):** las condiciones alternativas se evalúan **antes** que las condiciones por
defecto, en el orden en que aparecen en el array (Enemigo primero, luego Escenario, tal
como se ensamblan en §4.3); dentro de las alternativas, la primera que se cumple gana.
Si ninguna alternativa se cumple, se cae a la lógica por defecto ya existente (H1.18
§0.6, sin cambios: derrota por vida del Líder > derrota por Trama > victoria por vida
del Enemigo, en ese orden). *Por qué esta precedencia:* una condición alternativa es
más específica al contenido (Enemigo/Escenario concretos) que la genérica del motor —
debe poder "adelantarse" a un desenlace por defecto que de otro modo tardaría más
turnos en cumplirse, que es precisamente el caso de uso que decisions.md describe
("permite Enemigos/Escenarios con identidad mecánica propia").

```ts
private evaluateAndApplyCombatEnd(events: CombatEvent[]): void {
  if (this.combatStatus !== 'IN_PROGRESS') return;

  for (const condition of this.alternativeVictoryConditions) {
    if (this.isAlternativeConditionMet(condition)) {
      this.finalizeCombat(condition.outcome, events, condition.kind);
      return;
    }
  }

  // Lógica por defecto — SIN CAMBIOS respecto a H1.18 §0.6.
  let outcome: CombatOutcome;
  let defeatReason: DefeatReason | undefined;
  if (this.leaderDamage >= this.leaderMaxHealth) {
    outcome = 'DEFEAT'; defeatReason = 'LEADER_HEALTH';
  } else if (this.scenarioPlot >= this.scenarioPlotDefeatThreshold) {
    outcome = 'DEFEAT'; defeatReason = 'SCENARIO_PLOT';
  } else if (this.enemyDamage >= this.enemyMaxHealth) {
    outcome = 'VICTORY';
  } else {
    return;
  }
  this.finalizeCombat(outcome, events, undefined, defeatReason);
}

private isAlternativeConditionMet(condition: AlternativeVictoryCondition): boolean {
  switch (condition.kind) {
    case 'SCENARIO_PLOT_AT_MOST': return this.scenarioPlot <= condition.amount;
    case 'TURN_COUNT_AT_LEAST': return this.turnNumber >= condition.turn;
    case 'ENEMY_DAMAGE_AT_LEAST': return this.enemyDamage >= condition.amount;
  }
}

/** Extraído de la cola final de evaluateAndApplyCombatEnd (H1.18) — centraliza la
 *  mutación de combatStatus/defeatReason y la emisión de COMBAT_ENDED, ahora
 *  parametrizado por si el desenlace vino de una condición alternativa. */
private finalizeCombat(
  outcome: CombatOutcome,
  events: CombatEvent[],
  alternativeConditionKind?: AlternativeVictoryCondition['kind'],
  defeatReason?: DefeatReason
): void {
  this.combatStatus = outcome;
  this.defeatReason = alternativeConditionKind ? 'ALTERNATIVE' : defeatReason;
  const event: CombatEvent = {
    type: 'COMBAT_ENDED',
    outcome,
    ...(this.defeatReason !== undefined ? { defeatReason: this.defeatReason } : {}),
    ...(alternativeConditionKind !== undefined ? { alternativeConditionKind } : {}),
  };
  events.push(event);
  this.eventBus.emit(event);
}
```

`DefeatReason` (`types/combat-status.ts`) gana un 3er valor:
```ts
export type DefeatReason = 'LEADER_HEALTH' | 'SCENARIO_PLOT' | 'ALTERNATIVE'; // NUEVO
```

`COMBAT_ENDED` gana un campo opcional:
```ts
readonly alternativeConditionKind?: AlternativeVictoryCondition['kind'];
```

### 4.5 Definition of Done de H1.8 (parcial) + H1.18 (parcial)

- [ ] `catalog/types/victory-condition.ts`, `combat/types/victory-condition.ts` nuevos.
- [ ] `EnemyDefinition`/`ScenarioDefinition.alternativeVictoryConditions?` añadidos +
      validados en schema.ts.
- [ ] `CombatEngineConfig.alternativeVictoryConditions?` añadido; `catalog-adapter.ts`
      hace el merge Enemigo+Escenario.
- [ ] `evaluateAndApplyCombatEnd` reescrita según §4.4 (extracción de `finalizeCombat`);
      `DefeatReason` gana `'ALTERNATIVE'`; `COMBAT_ENDED` gana `alternativeConditionKind?`.
- [ ] Tests: cada `kind` de `AlternativeVictoryCondition` con al menos 1 caso VICTORY y 1
      DEFEAT; caso de precedencia (una condición alternativa se cumple en el mismo tick
      que una condición por defecto — la alternativa gana); caso sin alternativas
      configuradas (`alternativeVictoryConditions` vacío/omitido) se comporta EXACTAMENTE
      igual que el H1.18 original (test de regresión explícito).

---

## 5. Capa visual H2 — nuevos game objects y eventos de dominio a consumir

> No se especifican recetas `JuiceConfig` (fuera de alcance del rol de Architect para
> feel de arte, según el encargo) — sí se especifica QUÉ game objects/estado nuevo
> necesita `combat-scene` y a qué eventos de dominio nuevos debe suscribirse
> `EffectsDirector`/`view` para que Programmer conecte las recetas ya existentes de H2.5
> (`diceRoll`, etc.) sin inventar mecánica de dominio nueva en la capa visual.

### 5.1 Qué se retira de la vista actual (H2.8)

`createCorePool(scene)` (H2.8 §criterio: *"crea visuales de los 5+1 Núcleos... como
dados animables"*) asumía el modelo viejo (pool homogéneo de fichas que se eliminan al
gastarse). Se **retira su semántica de "5+1 fichas homogéneas que desaparecen"** y se
sustituye por §5.2. El nombre de función puede conservarse o renombrarse a
`createNucleoTable(scene)` — se recomienda el renombre para reflejar el nuevo dominio
(mesa persistente, no pool).

### 5.2 `createNucleoTable(scene, snapshot)` — nuevo layout por color

Contrato (firma, no implementación):

```ts
// packages/combat-scene/view/nucleo-table-view.ts (NUEVO, sustituye a la porción de
// core-pool-view.ts responsable del layout — nombre exacto de archivo a discreción de
// Programmer, manteniendo la separación por "view" ya establecida en H2.8)
export function createNucleoTable(scene: Phaser.Scene, table: readonly NucleoDie[]): NucleoTableView;

export interface NucleoTableView {
  /** Un game object por dado en `table`, indexado por NucleoInstanceId — usado tanto
   *  para animar (diceRoll/dim) como para que InputAdapter (§5.4) resuelva taps. */
  getDieObject(id: NucleoInstanceId): Phaser.GameObjects.GameObject | undefined;
  /** Reconstruye/reposiciona cuando `table.length` cambia (dado EXTRA añadido) —
   *  invocado al recibir NUCLEO_DIE_ADDED. */
  addDie(die: NucleoDie): void;
  /** Actualiza el sprite de un dado ya existente tras spend/reroll (valor, tinte de
   *  estado SPENT/AVAILABLE) sin recrearlo — invocado al recibir ABILITY_ACTIVATED
   *  (dado pasa a SPENT) o NUCLEO_TABLE_REROLLED (todos vuelven a AVAILABLE con valor
   *  nuevo). */
  updateDie(die: NucleoDie): void;
}
```

**Layout requerido (para el pedido de "que se vea bien" del Director Creativo):** 5
posiciones fijas de mesa, una por color de `ALL_NUCLEO_COLORS`, cada una con su propio
color de fondo/borde/icono identificable (mismo mapeo funcional GDD §11.3 ya usado por
`domain/combat`: Agresión=rojo, Control=azul, Defensa=verde, Recurso=amarillo,
Caos=púrpura — la vista es la primera capa que traduce estos IDs internos a color visual
real, `domain` nunca conoce el hex). Los dados EXTRA de un color se posicionan
apilados/adyacentes a la posición fija de ese mismo color (agrupación visual por color,
requisito explícito del encargo: "agrupados/identificables por color").

### 5.3 Eventos de dominio nuevos que `EffectsDirector`/vista deben mapear

| Evento (`CombatEvent.type`)     | Qué debe pasar visualmente (sin recetas concretas) |
|---|---|
| `NUCLEO_TABLE_REROLLED`         | TODOS los game objects de dado (fijos + extras) reproducen la receta `diceRoll` (H2.5) en paralelo, terminando con su nuevo valor visible. Sustituye la vieja interpretación de H2.12 ("Núcleo gastado desaparece / pool vacío → no hay Núcleos en tablero") — **ya no aplica**: los dados nunca desaparecen de mesa. |
| `NUCLEO_DIE_ADDED`               | Aparece un nuevo game object de dado en la posición agrupada de su color (entrada con receta tipo `diceRoll` o una variante de "spawn"), la mesa no se recoloca de golpe — animación de entrada individual. |
| `NUCLEO_DIE_ADD_SKIPPED`         | Feedback negativo breve (mismo lenguaje visual que un comando rechazado, ej. shake rojo en la carta que lo intentó) — informativo, sin animación de dado (no hay dado que animar). |
| `ABILITY_ACTIVATED` (con `nucleoSpent`) | El dado con `id === nucleoSpent.id` cambia a estado visual "gastado" (dim/greyscale/opacidad reducida) — NO desaparece (cambio de comportamiento respecto a H2.12 original, que asumía remoción). |
| `LEADER_HAND_CARD_DRAWN`         | Una carta nueva aparece en la mano (animación desde un mazo/pila visual hacia el abanico de mano — reutilizable con una variante de `cardFlip`, H2.5). |
| `LEADER_HAND_DRAW_SKIPPED` / `ENERGY_GENERATE_SKIPPED` | Feedback informativo no bloqueante (ej. toast breve "mano llena"/"energía al máximo"), sin animación de juice pesada. |
| `FREE_STEP_RESOLVED`             | Marca visual de que el paso previo del turno ya se gastó (ej. deshabilitar/atenuar el control de paso previo en el HUD hasta el próximo turno del Líder). |
| `MINION_ACTION_RESOLVED` (repetible) | Sin cambio de contrato respecto a H1.16 original — pero ahora puede llegar más de una vez en el mismo `dispatch()` (criterio `ALL`/`SPECIFIC_DEFINITION`); la vista debe animar cada instancia de Secuaz independientemente, no asumir "como mucho 1 por turno". |
| `COMBAT_ENDED` (con `alternativeConditionKind`) | Sin cambio de contrato visual respecto a H1.18 (modal de resultado) — el campo nuevo es opcional/informativo, útil solo si se quiere un texto de resultado distinto para victorias/derrotas "especiales" (no bloqueante, decisión de copy fuera de esta spec). |

### 5.4 `InputAdapter` — nuevo intent semántico

```ts
// packages/combat-scene/input — extiende PlayerIntent (arquitectura ya establecida en
// architecture_stack.md §4.3, refinada en H2.7/H3.1)
| { type: 'SELECT_NUCLEO_DIE', dieId: NucleoInstanceId, color: NucleoColor, kind: 'FIXED' | 'EXTRA' }
```

Necesario porque, a diferencia del modelo viejo (donde `ACTIVATE_ABILITY` podía
auto-elegir "cualquier ficha válida" sin que el jugador tuviera que fijarse en cuál era
cuál, ya que las fichas eran fungibles dentro de un mismo color/coste), el nuevo modelo
de mesa persistente con dados identificables por color hace que el jugador **vea** los 5
colores en todo momento y pueda **elegir explícitamente** con qué dado pagar cuando
varios son válidos (p. ej. una habilidad Neutra con 2 dados AGRESION disponibles de
distinto valor — elegir el de mayor valor es una decisión táctica real gracias a
Umbral). El flujo de H3.1 (tap en habilidad → `ACTIVATE_ABILITY`) se extiende: tras
`SELECT_ABILITY`, si hay más de un dado válido en mesa, el `InputAdapter`/HUD debe
recoger un `SELECT_NUCLEO_DIE` antes de despachar `ACTIVATE_ABILITY` con el
`nucleoInstanceId` concreto (si solo hay un dado válido, se puede auto-seleccionar sin
pedir el gesto extra — decisión de UX de detalle para H3.5, no de este documento).

### 5.5 Impacto en H2.10/H2.12 (specs existentes, no se reabren formalmente pero se anotan aquí)

- **H2.10 (Cooldowns visuales):** sin cambios de contrato — sigue operando sobre
  `AbilityCooldownSnapshot`/`COOLDOWNS_TICKED`, ninguno de los cuales cambia en esta spec.
- **H2.12 (Animaciones de Núcleos gastados y pool nuevo rolleado):** su interpretación
  de "Núcleo gastado → desaparece" y "pool vacío → no hay Núcleos en tablero" queda
  **obsoleta** por el nuevo modelo de mesa persistente (§5.3, filas `ABILITY_ACTIVATED`/
  `NUCLEO_TABLE_REROLLED`) — se señala explícitamente para que Coordinator anote esta
  historia como parcialmente reabierta si Programmer ya la había implementado contra el
  modelo viejo antes de este cierre de loop.

---

## 6. Validación de H3.1/H3.2/H3.3/H3.5 frente al nuevo modelo

- **H3.1 (tap habilidad → `ACTIVATE_ABILITY`):** su contrato (`SELECT_ABILITY` →
  `CombatBridge.dispatch(ACTIVATE_ABILITY)`) sigue siendo coherente — `ACTIVATE_ABILITY`
  no cambia de forma (§1.6). Único ajuste: como se detalla en §5.4, el flujo de
  selección de Núcleo puede necesitar un paso intermedio (`SELECT_NUCLEO_DIE`) que H3.1
  no contemplaba porque asumía Núcleos fungibles. **No es una ruptura de contrato**,
  es una extensión de flujo — H3.1 sigue siendo un prerequisito válido de H3.4/§5.4, no
  al revés.
- **H3.2 (`GENERATE_ENERGY`):** sin cambios de contrato. §2.5 reutiliza literalmente su
  lógica (`executeGenerateEnergy`) para no duplicar la regla de tope 5 en dos sitios —
  Programmer debe factorizar el cuerpo ya implementado de `handleGenerateEnergy` (H3.2)
  hacia el helper compartido en vez de reescribirlo desde cero.
- **H3.3 (integración `GENERATE_ENERGY` en `CombatBridge`/`InputAdapter`):** sin cambios
  de contrato — el patrón que establece (intent → dispatch → evento a ambos canales) es
  exactamente el que `DRAW_OR_GENERATE`/`DRAW_CARD` (§2) deben replicar.
- **H3.5 (UI de decisión de turno):** su alcance crece de 3 a **5** controles visibles:
  "Jugar Carta", "Activar Habilidad", "Generar Energía" (acción pagada), "Robar Carta"
  (acción pagada, NUEVO por §2.4), más el paso previo gratuito ("Robar" / "Energía
  gratis", una sola vez por turno, visualmente distinto de los 2 controles de acción
  pagada — no comparte el mismo estado de "gastado" que `actionsTakenThisTurn`). Se
  señala explícitamente a Coordinator para actualizar el criterio de aceptación de H3.5
  en `backlog.md` (pasa de 3 botones a 5 + 1 paso previo).

---

## 7. Orden de implementación recomendado para Programmer

El objetivo es una batalla completa jugable en pocos días — el orden prioriza lo que
bloquea el ciclo end-to-end sobre pulido no esencial, y respeta las dependencias reales
entre los cambios de este documento.

```mermaid
graph TD
  H34["H3.4 — Núcleos: 5 dados + extras + reroll<br/>(cierra H1.3/H1.13)"] --> H36["H3.6 — paso previo + mano/mazo<br/>(cierra gap PLAY_CARD sin mano)"]
  H34 --> H116["H1.16 — Secuaces vía Dramaturgia"]
  H36 --> H31["H3.1 — tap habilidad → ACTIVATE_ABILITY<br/>(ya válido, solo revalidar flujo §5.4/§6)"]
  H34 --> H31
  H31 --> H32["H3.2 — GENERATE_ENERGY (ya especificada)"]
  H32 --> H33["H3.3 — integración Bridge/InputAdapter"]
  H36 --> H33
  H18alt["H1.8 + H1.18 — condiciones alternativas<br/>(bajo riesgo, independiente)"]
  H34 --> H18alt
  H33 --> H35["H3.5 — UI de decisión de turno (5 controles + paso previo)"]
  H116 --> H35
  H35 --> H28["H2.8/H2.12 — vista: mesa de dados por color + reroll"]
  H18alt --> BATALLA["Batalla completa jugable end-to-end"]
  H28 --> BATALLA
```

**Justificación del orden:**

1. **H3.4 primero, sin excepción.** Es el único cambio que toca la estructura interna
   del `CombatEngine` (constructor, `handleActivateAbility`, `executeAbilityEffect`,
   `CombatStateSnapshot`) de forma que CUALQUIER otro trabajo hecho antes tendría que
   rehacerse. Incluye migrar H1.3/H1.13 como parte del mismo PR (backlog ya lo señala:
   "debe revisarse ANTES de que Architect diseñe el nuevo modelo" — el diseño ya está
   hecho aquí, ahora Programmer implementa ambos juntos).
2. **H3.6 justo después.** Depende de H3.4 solo en el sentido de que ambos tocan
   `combat-engine.ts` y conviene no tener 2 PRs grandes en paralelo sobre el mismo
   archivo — no hay dependencia de datos real entre dados y mano/mazo. Es la pieza que
   hace que "jugar una carta" tenga sentido real (mano) y cierra el paso previo gratuito
   que decisions.md pide como parte central del nuevo ritmo de turno.
3. **H1.16 (Secuaces) en paralelo a H3.6** si hay más de un Programmer disponible — solo
   depende de H3.4 (para el filtrado de dados AVAILABLE en la selección de Núcleo del
   Secuaz, §1.8) y de la extensión de `DramaturgiaCardDefinition` (catálogo, sin
   dependencia de `hand`/mesa). Es contenido crítico para que un combate contra un
   Enemigo con Secuaces se sienta como decisiones de contenido, no de motor.
4. **H1.8 + H1.18 (condiciones alternativas) es la pieza de menor riesgo y más
   aislada** — puede hacerse en cualquier momento después de H3.4 (solo depende de que
   `evaluateAndApplyCombatEnd` exista, que ya existe desde H1.18 original). Se recomienda
   intercalarla donde haya hueco, no bloquea nada del resto.
5. **H3.1/H3.2/H3.3 se revalidan (no se reimplementan) después de H3.4/H3.6** porque su
   contrato de comando no cambia, pero si ya estaban implementadas contra el modelo
   viejo, sus tests de integración con `CombatBridge` deben volver a pasar contra los
   nuevos nombres de evento (`NUCLEO_TABLE_REROLLED`, etc.) — trabajo de "arreglar
   referencias", no de rediseño.
6. **H3.5 (UI de decisión) al final de la capa de dominio**, porque su alcance (5
   controles) depende de que `DRAW_CARD`/`DRAW_OR_GENERATE` (H3.6) y el flujo de
   selección de Núcleo (H3.4/§5.4) ya existan para poder mostrar su estado real.
7. **H2.8/H2.12 (vista de mesa de dados) es lo último que bloquea "verse bien"** — puede
   empezar en paralelo tan pronto H3.4 emita los eventos nuevos (`NUCLEO_TABLE_REROLLED`,
   `NUCLEO_DIE_ADDED`), pero su terminación real depende de que H3.1/H3.5 ya definan qué
   intents/controles dispara la interacción con la mesa. Es la pieza de "feel chulo" que
   el Director Creativo pidió explícitamente — no se debe recortar, pero tampoco debe
   bloquear que el resto del loop (reglas) esté jugable antes por CLI/HUD mínimo si el
   tiempo aprieta.

**Camino crítico mínimo para "batalla completa jugable" (aunque no luzca aún el feel
final):** H3.4 → H3.6 → H1.16 → (H1.8+H1.18 en paralelo) → H3.1/H3.2/H3.3 revalidados →
harness CLI de H1.19 actualizado como humo rápido de regresión end-to-end antes de
invertir en H3.5/H2.8/H2.12 (la capa visual). Esto permite validar con Game
Designer/Director Creativo que el LOOP DE REGLAS completo (dados, paso previo,
secuaces, condiciones alternativas) funciona de principio a fin antes de gastar tiempo
de "feel", que es más caro de iterar.
