# H4.x — Targeting de habilidades ATTACK del Líder, tiles de Aliado/Secuaz reales, ficha de personaje ampliada

> Responde al feedback del Director Creativo jugando `main`@`38515e7` + 1 bug real de motor hallado
> durante la investigación (pieza 1, prioridad máxima). Reutiliza sin modificar: `AttackTarget`
> (`combat-target.ts`), el patrón de targeting ya cerrado en `H3.7`/`H3.8`/`H4_componente_carta.md` §5
> (`gesture-command-translator.ts`, `targeting-signal.ts`, `TargetingPromptBanner`), `CardTile`/
> `AbilityTile` (`H4_componente_carta.md` §1/§2, ya implementados), `NameLookup.minionName`/`cardName`
> (`domain-catalog`, ya implementado, simplemente no usado todavía en `combat-scene/view`).

---

## 1. BUG DE MOTOR — `ACTIVATE_ABILITY` no soporta targeting (prioridad máxima)

### 1.1 Diagnóstico confirmado (sin ambigüedad)

- `applyAttackEffect` (`combat-engine.ts` línea ~756) resuelve SIEMPRE el objetivo con
  `resolveDamageTarget()` (Aliado en Berserker/redirección, o si no, el propio Líder) — es el camino
  correcto cuando quien activa es el `ENEMY` (GDD §3.4/§3.7: el Enemigo solo puede atacar al Líder/su
  Aliado), pero es errado si algún día lo activa el `LEADER`: le haría daño a su propio Líder/Aliado.
- Hoy esto no se manifiesta como bug visible porque una segunda capa lo bloquea aguas arriba:
  `parseLeaderDefinition` (`packages/domain/catalog/src/validation/schema.ts` líneas 258-265) **rechaza
  cualquier `baseAbility` del Líder cuyo `effect.kind === 'ATTACK'`**, con el mensaje literal "H1.6
  exige side ENEMY para ATTACK". Esa validación es exactamente la consecuencia, en la capa de catálogo,
  de la limitación de motor que esta historia corrige — no es una regla de diseño independiente (ver
  §1.6). Es la razón real por la que ninguna habilidad de Líder en el contenido de juguete hoy hace daño
  al Enemigo: el catálogo ni siquiera permite autorarla.
- `validateAbilityEffectsConfig` (`combat-engine.ts` líneas ~360-367) tiene la MISMA restricción a nivel
  de motor: lanza si `abilityEffects[id].kind === 'ATTACK'` y `abilityCooldowns[id].side !== 'ENEMY'`.
- Contraste — `PLAY_CARD` (H1.18/§3.9.2/§3.9.3) ya resuelve esto correctamente para cartas de mano:
  soporta `command.target?: AttackTarget` (`{kind:'ENEMY'}` o `{kind:'MINION', minionInstanceId}`),
  valida Defensor y existencia del Secuaz, y aplica el daño a Enemigo/Secuaz vía
  `applyPlayableCardEffect` (líneas 2122-2224). Este bug es que `ACTIVATE_ABILITY` nunca ganó el mismo
  tratamiento cuando `H1.15`/`H1.16`/`H1.18` lo añadieron a `PLAY_CARD`.

### 1.2 Diseño — 3 capas a tocar, en orden de dependencia

#### (a) `packages/domain/combat/src/types/commands.ts` — nuevo campo `target?`

```ts
| {
    readonly type: 'ACTIVATE_ABILITY';
    readonly abilityId: AbilityId;
    readonly sourceId: string;
    readonly side: CombatSide;
    readonly nucleoInstanceId: NucleoInstanceId;
    /**
     * NUEVO — objetivo explícito del ataque. OBLIGATORIO en runtime (no se puede forzar
     * por tipos, mismo criterio que PLAY_CARD.target) si y solo si:
     *   abilityEffects[abilityId]?.kind === 'ATTACK' && side === 'LEADER'.
     * Irrelevante/ignorado en cualquier otro caso (incluida una ATTACK activada por
     * ENEMY, que sigue resolviendo el objetivo con resolveDamageTarget() sin cambios).
     */
    readonly target?: AttackTarget;
  }
```

Import ya existe en `commands.ts` (`AttackTarget` de `./combat-target`, reutilizado — no se crea un
segundo tipo de targeting).

#### (b) `packages/domain/combat/src/types/errors.ts` — 1 error nuevo, 2 reutilizados

```ts
| {
    /** NUEVO. `ACTIVATE_ABILITY` con `abilityEffects[abilityId].kind === 'ATTACK'`,
     *  `side === 'LEADER'`, sin `target`. Análogo a PLAY_CARD_TARGET_REQUIRED. */
    readonly code: 'ABILITY_TARGET_REQUIRED';
    readonly abilityId: AbilityId;
  }
```

- `ATTACK_TARGET_NOT_FOUND` (ya existe, solo lleva `minionInstanceId`) se reutiliza TAL CUAL — no
  necesita cambio, no referencia `cardId`.
- `MUST_TARGET_DEFENSOR` (ya existe) hoy exige `cardId: CardId` — se generaliza a
  `cardId?: CardId; abilityId?: AbilityId` (exactamente uno presente según el origen, mismo criterio de
  campos opcionales-alternativos ya usado en `LEADER_DAMAGED.abilityId`/`ALLY_DAMAGED.abilityId`, H1.16).
  Ningún caller existente rompe: `handlePlayCard` sigue construyendo `{ code: 'MUST_TARGET_DEFENSOR',
  cardId, defensorInstanceIds }`.

#### (c) `packages/domain/combat/src/types/ability-effect.ts` — retirar la restricción de `side`

Borrar el comentario/uso de "H1.6 solo modela daño Enemigo→Líder" en la doc de `ATTACK`; el `kind:
'ATTACK'` ya no está atado a `side: 'ENEMY'`. Sin cambio de forma del tipo (`formula`/`arrollar` siguen
igual) — el cambio es solo de invariante de validación, en el motor y en el catálogo (puntos d/e).

#### (d) `combat-engine.ts` — 4 cambios

**d.1 — `validateAbilityEffectsConfig` (línea ~360-367): quitar la comprobación `side !== 'ENEMY'`.**
Una habilidad `ATTACK` ahora es válida con cualquier `side`. El resto de la función (validación de
`formula` no-negativa) no cambia.

**d.2 — `applyAttackEffect` (línea ~756): bifurcar por `side` en vez de asumir siempre Enemigo→Líder.**

```ts
private applyAttackEffect(
  source: AbilityActionSource,
  effectDef: Extract<AbilityEffectDefinition, { kind: 'ATTACK' }>,
  nucleo: NucleoInstance,
  target: AttackTarget | undefined, // NUEVO parámetro — undefined siempre que source.side === 'ENEMY'
  events: CombatEvent[] // NUEVO — antes retornaba 1 solo evento; el camino LEADER→MINION puede emitir 2
                          // (MINION_DAMAGED + MINION_DEFEATED), igual que ya hace applyPlayableCardEffect.
                          // El caller (executeAbilityEffect) deja de esperar un único CombatEvent de
                          // retorno — puja directamente sobre `events`, igual patrón que
                          // applyPlayableCardEffect ya usa (ver combat-engine.ts línea 2113 en adelante).
): void {
  const resolution = resolveAbilityUmbral(effectDef.formula, nucleo.value);
  const rawAmount = resolution.baseResolvedValue;

  if (source.side === 'LEADER') {
    // NUEVO — Líder/Aliado ataca al Enemigo/Secuaz, nunca a sí mismo (fix del bug §1.1).
    this.applyAttackToEnemySide(
      { abilityId: source.abilityId as AbilityId, sourceId: source.sourceId },
      nucleo, rawAmount, target as AttackTarget, effectDef.arrollar === true, events
    );
    return;
  }

  // Comportamiento EXISTENTE, SIN CAMBIOS: Enemigo ataca a Líder/Aliado.
  const allyTarget = this.resolveDamageTarget();
  const event = allyTarget
    ? this.applyAttackEffectToAlly(source, effectDef, nucleo, rawAmount, allyTarget)
    : this.applyAttackEffectToLeader(source, effectDef, nucleo, rawAmount);
  events.push(event);
  this.eventBus.emit(event);
}
```

**d.3 — Nuevo método privado `applyAttackToEnemySide`, extraído por REUTILIZACIÓN de la lógica que ya
existe en `applyPlayableCardEffect` (líneas 2122-2224, rama `ATTACK_ENEMY`).** En vez de duplicar la
lógica de "golpear Secuaz (con posible muerte + Arrollar) o Enemigo directo", se extrae a un helper
compartido que ambos callers (`PLAY_CARD` con `ATTACK_ENEMY` y `ACTIVATE_ABILITY` con `ATTACK` +
`side === 'LEADER'`) invocan:

```ts
/** Extraído de applyPlayableCardEffect (rama ATTACK_ENEMY) — único punto de "Líder/Aliado ataca a
 *  Enemigo directo o a un Secuaz concreto ya validado". `origin` distingue el evento resultante
 *  (cardId vs abilityId), mismo criterio de campos opcionales que el resto del motor. */
private applyAttackToEnemySide(
  origin: { readonly cardId?: CardId; readonly abilityId?: AbilityId },
  nucleo: NucleoInstance,
  rawAmount: number,
  target: AttackTarget,
  arrollar: boolean,
  events: CombatEvent[]
): void {
  if (target.kind === 'MINION') {
    const minion = this.minionsInPlay.find((m) => m.instanceId === target.minionInstanceId) as MinionInPlay;
    const lifeBefore = minion.life;
    const lifeAfter = Math.max(0, lifeBefore - rawAmount);
    const excess = Math.max(0, rawAmount - lifeBefore);
    const died = lifeAfter <= 0;
    const appliedDamageToEnemy = died && arrollar ? excess : 0;

    this.minionsInPlay = died
      ? this.minionsInPlay.filter((m) => m.instanceId !== minion.instanceId)
      : this.minionsInPlay.map((m) => (m.instanceId === minion.instanceId ? { ...m, life: lifeAfter } : m));
    this.enemyDamage += appliedDamageToEnemy;

    const dmgEvent: CombatEvent = {
      type: 'MINION_DAMAGED',
      ...origin, sourceId: origin.abilityId ?? '', // ver nota debajo — sourceId real lo pasa el caller
      nucleoSpent: nucleo, minionInstanceId: minion.instanceId, rawAmount, lifeBefore, lifeAfter, died,
      excess, appliedDamageToEnemy, enemyDamageAfter: this.enemyDamage,
    };
    events.push(dmgEvent); this.eventBus.emit(dmgEvent);
    if (died) {
      const defeated: CombatEvent = { type: 'MINION_DEFEATED', instanceId: minion.instanceId, definitionId: minion.definitionId, cause: 'PLAYER_ATTACK' };
      events.push(defeated); this.eventBus.emit(defeated);
    }
    return;
  }

  // target.kind === 'ENEMY'
  this.enemyDamage += rawAmount;
  const dmgEvent: CombatEvent = {
    type: 'ENEMY_DAMAGED', ...origin,
    nucleoSpent: nucleo, rawAmount, bonusActivated: resolution.bonusActivated, /* ...bonusResolvedValue */
    enemyDamageAfter: this.enemyDamage,
  };
  events.push(dmgEvent); this.eventBus.emit(dmgEvent);
}
```

Nota de firma exacta: `sourceId` es un campo real y obligatorio de `MINION_DAMAGED`/`ENEMY_DAMAGED`
hoy (no de `origin`) — Programmer debe pasarlo como parámetro explícito de `applyAttackToEnemySide`
(no meterlo dentro de `origin`), el pseudocódigo de arriba lo simplifica para legibilidad; firma real:

```ts
private applyAttackToEnemySide(
  origin: { readonly cardId?: CardId; readonly abilityId?: AbilityId },
  sourceId: string,
  nucleo: NucleoInstance,
  rawAmount: number,
  target: AttackTarget,
  arrollar: boolean,
  events: CombatEvent[]
): void
```

`applyPlayableCardEffect` (rama `ATTACK_ENEMY`, líneas 2122-2224) se REFACTORIZA para delegar en este
mismo helper (`origin: { cardId: command.cardId }`) — mismo comportamiento observable, cero cambio de
eventos emitidos para el camino `PLAY_CARD` ya cubierto por tests existentes
(`combat-engine.targeting.test.ts`).

**d.4 — Eventos `ENEMY_DAMAGED`/`MINION_DAMAGED` (`types/events.ts`): generalizar `cardId` a opcional
+ `abilityId` opcional**, mismo patrón ya usado en `LEADER_DAMAGED`/`ALLY_DAMAGED` (H1.16, "ausente
cuando..."):

```ts
| {
    readonly type: 'ENEMY_DAMAGED';
    readonly cardId?: CardId;      // MODIFICADO — antes obligatorio; ausente si origen es ACTIVATE_ABILITY
    readonly abilityId?: AbilityId; // NUEVO — presente si origen es ACTIVATE_ABILITY
    readonly sourceId: string;
    readonly nucleoSpent: NucleoInstance;
    readonly rawAmount: number;
    readonly bonusActivated: boolean;
    readonly bonusResolvedValue?: number;
    readonly enemyDamageAfter: number;
  }
| {
    readonly type: 'MINION_DAMAGED';
    readonly cardId?: CardId;      // MODIFICADO — igual criterio
    readonly abilityId?: AbilityId; // NUEVO
    readonly sourceId: string;
    readonly nucleoSpent: NucleoInstance;
    readonly minionInstanceId: CardInstanceId;
    readonly rawAmount: number;
    readonly lifeBefore: number;
    readonly lifeAfter: number;
    readonly died: boolean;
    readonly excess: number;
    readonly appliedDamageToEnemy: number;
    readonly enemyDamageAfter: number;
  }
```

Cambio aditivo/de-required-a-optional — no rompe ningún test que ya construya estos eventos con
`cardId` presente (`toEqual` sigue pasando; tests que hagan destructuring exhaustivo de campos deben
revisarse pero no es una re-arquitectura).

**d.5 — `executeAbilityEffect` (línea ~1067): añadir parámetro `target?: AttackTarget`, pasarlo a
`applyAttackEffect` junto con el array `events` ya existente en su cuerpo** (hoy hace
`events.push(effectEvent)` tras recibir 1 evento de retorno; con el cambio de d.2,
`applyAttackEffect` puja directamente a `events`, así que esa línea desaparece — se sustituye por la
llamada con `events` inyectado):

```ts
private executeAbilityEffect(
  abilityId: AbilityId,
  sourceId: string,
  side: CombatSide,
  nucleo: NucleoInstance,
  target?: AttackTarget // NUEVO
): { events: CombatEvent[]; effectLogEntry?: ...; cooldownBefore: number }
```

Dentro, en la rama `effectDef.kind === 'ATTACK'`: sustituir `const effectEvent = this.applyAttackEffect(...)`
por `this.applyAttackEffect({ abilityId, sourceId, side }, effectDef, nucleo, target, events);` y leer
el último evento de `events` para construir `effectLogEntry` (mismo propósito que hoy, solo cambia de
dónde se lee el evento — el último push a `events` en vez de un valor de retorno directo). Nota: cuando
el target es `MINION` y el Secuaz muere, `events` puede tener 2 entradas nuevas (`MINION_DAMAGED` +
`MINION_DEFEATED`) en vez de 1 — `effectLogEntry` (usado solo por `currentEnemyTurnLog`, exclusivo de
`side === 'ENEMY'`, Contratiempo) nunca se construye para este camino porque el path `LEADER`+`ATTACK`
nunca alimenta `currentEnemyTurnLog` (ese campo es señal de acción DEL Enemigo, no de daño AL Enemigo)
— dejar `effectLogEntry` en `undefined` para esta rama es correcto, no un gap.

**d.6 — `handleActivateAbility` (línea ~1269): validar `target` ANTES de mutar, mismo bloque de
validación que `handlePlayCard` ya tiene para `ATTACK_ENEMY`, insertado después de la validación de
`nucleo`/color y ANTES de "Solo a partir de aquí se muta estado":**

```ts
// NUEVO — targeting explícito, solo si esta activación es un ATTACK del LÍDER (fix §1.1).
const effectDef = this.abilityEffects.get(command.abilityId);
let resolvedTarget: AttackTarget | undefined;
if (effectDef?.kind === 'ATTACK' && command.side === 'LEADER') {
  if (!command.target) {
    return err({ code: 'ABILITY_TARGET_REQUIRED', abilityId: command.abilityId });
  }
  const liveDefensores = this.minionsInPlay.filter((m) => m.isDefensor);
  if (liveDefensores.length > 0) {
    const targetsAllowedDefensor =
      command.target.kind === 'MINION' &&
      liveDefensores.some((m) => m.instanceId === (command.target as Extract<AttackTarget, { kind: 'MINION' }>).minionInstanceId);
    if (!targetsAllowedDefensor) {
      return err({
        code: 'MUST_TARGET_DEFENSOR',
        abilityId: command.abilityId,
        defensorInstanceIds: liveDefensores.map((m) => m.instanceId),
      });
    }
  }
  if (command.target.kind === 'MINION') {
    const minion = this.minionsInPlay.find((m) => m.instanceId === (command.target as Extract<AttackTarget, { kind: 'MINION' }>).minionInstanceId);
    if (!minion) {
      return err({ code: 'ATTACK_TARGET_NOT_FOUND', minionInstanceId: command.target.minionInstanceId });
    }
  }
  resolvedTarget = command.target;
}
```

Y en la llamada ya existente a `executeAbilityEffect` (línea ~1333), añadir `resolvedTarget` como 5º
argumento. El resto de `handleActivateAbility` (acciones, Combo, cooldown, reroll, fases, fin de
combate) no cambia — el fix es puramente de qué lado recibe el daño, no de cuándo/cómo se paga la
habilidad.

Nota de orden de validación: igual que `handlePlayCard`, este bloque va DESPUÉS de validar que el
Núcleo elegido existe/no está gastado/coincide de color (para que `ABILITY_TARGET_REQUIRED` no oculte
un error de Núcleo más fundamental primero) y ANTES de cualquier mutación — coherente con el comentario
ya existente "Solo a partir de aquí se muta estado".

#### (e) `packages/domain/catalog/src/validation/schema.ts` — relajar `parseLeaderDefinition`

Quitar el bloque (líneas 258-265) que rechaza `ability.effect?.kind === 'ATTACK'` en cualquier
`baseAbility` del Líder — era una consecuencia derivada de la limitación de motor que esta historia
corrige, no una regla de diseño propia (su propio mensaje de error lo cita: "H1.6 exige side ENEMY
para ATTACK"). GDD §2.5 solo exige que la habilidad **CD1** sea "siempre puro (sin +X/×X/Umbral)" —
eso ya es una condición sobre `formula.baseFormula.kind` (debe ser `'VALUE'`, nunca `'ADD'`/`'MULTIPLY'`),
no sobre `effect.kind`. Añadir, en su lugar, esta validación más precisa (nueva, sustituye a la
anterior):

```ts
if (cd1Ability?.effect?.kind === 'ATTACK' && cd1Ability.effect.formula.baseFormula.kind !== 'VALUE') {
  fail(
    `${context}.baseAbilities`,
    'la habilidad CD1 con effect ATTACK debe usar formula.baseFormula.kind VALUE (GDD §2.5, "CD1 siempre puro, sin +X/×X")'
  );
}
```

(Este bloque se coloca junto a la validación ya existente de `cd1Ability.coreCost.kind === 'ANY'`, que
no cambia.) Actualizar también `docs/../types/leader.ts` (comentario de `LeaderDefinition.baseAbilities`,
líneas 24-26) para reflejar la regla corregida, y `docs/../types/ability-effect.ts` (comentario de
`ATTACK`, línea ~23-25) para quitar la mención "el Líder nunca es origen de un efecto ATTACK".

Tests a actualizar (no rediseñar, actualización mecánica): `schema.test.ts` líneas 312-334 ("CD1 con
effect.kind ATTACK → lanza", "una habilidad CD2 con effect.kind ATTACK → también lanza") deben pasar a
"CD1 con ATTACK + formula VALUE → ok" / "CD1 con ATTACK + formula ADD → lanza" / "CD2/3/4 con ATTACK →
ok" (ya no hay restricción de `side` sobre CD2-4, ninguna tiene la restricción "siempre puro" — solo
CD1 la tiene).

### 1.3 Contenido de prueba — "Guardia Firme" del Soldado pasa a ser Ataque básico

`packages/data/leaders/soldado-base.json`, `baseAbilities[0]` (CD1, `coreCost.kind: 'ANY'`):

```json
{
  "id": "ability-soldado-base-guardia-firme",
  "name": "Guardia Firme",
  "coreCost": { "kind": "ANY" },
  "baseCooldown": 1,
  "effect": { "kind": "ATTACK", "formula": { "baseFormula": { "kind": "VALUE" } } },
  "ruleText": "Ataque. Golpea al Enemigo (o a un Secuaz elegido) con el valor íntegro del Núcleo gastado. Habilidad básica del Líder, siempre disponible con cualquier dado de Núcleo."
}
```

Formula `VALUE` pura (cumple "CD1 siempre puro", §1.2.e). Análogo directo a la Básica de Ataque que ya
tiene el Enemigo (`packages/data/enemies/*.json` línea 11: `{"kind":"ATTACK","formula":{"baseFormula":{"kind":"VALUE"}}}`)
— mismo patrón de contenido, ahora reflejado también para el Líder. `apps/shell/src/combat/build-combat-setup.ts`
no necesita cambios: `HandCardViewData`/`AbilityViewData` ya exponen `ruleText`/`coreCost` genéricamente,
sin asumir que las habilidades del Líder nunca son ATTACK.

No se toca `mago-base.json` en esta historia — el encargo pide 1 candidato concreto, no reescribir
ambos Líderes; Coordinator puede decidir en backlog si "Canalizar" (CD1 del Mago) recibe el mismo
tratamiento como tarea de contenido separada.

### 1.4 UI — `gesture-command-translator.ts` gana el mismo flujo `AWAITING_ATTACK_TARGET` que las cartas

Hoy `handleAbilityTapInternal` (línea ~127) va directo a `AWAITING_NUCLEO_FOR_ABILITY` (o auto-dispatch
si solo hay 1 dado válido) sin pasar nunca por selección de objetivo — correcto para Trama/CD sin
efecto, incorrecto para una ATTACK. Cambios:

**`PendingSelection`** gana una tercera variante análoga a `AWAITING_NUCLEO_FOR_CARD`:

```ts
type PendingSelection =
  | { readonly stage: 'AWAITING_ATTACK_TARGET_FOR_CARD'; readonly cardId: CardId }   // RENOMBRADA (antes AWAITING_ATTACK_TARGET)
  | { readonly stage: 'AWAITING_ATTACK_TARGET_FOR_ABILITY'; readonly abilityId: AbilityId } // NUEVO
  | { readonly stage: 'AWAITING_NUCLEO_FOR_CARD'; readonly cardId: CardId; readonly target: AttackTarget }
  | { readonly stage: 'AWAITING_NUCLEO_FOR_ABILITY'; readonly abilityId: AbilityId; readonly target?: AttackTarget } // MODIFICADO — +target opcional
  | null;
```

(Alternativa más simple, PREFERIDA para minimizar el diff: en vez de renombrar la variante existente,
añadir solo `AWAITING_ATTACK_TARGET_FOR_ABILITY` y dejar la genérica `AWAITING_ATTACK_TARGET` reutilizada
con un discriminante adicional `origin: 'CARD' | 'ABILITY'` + `id: CardId | AbilityId` — Programmer
elige la forma que menos toque `toPrompt`/`handleKnownTargetId`; el comportamiento observable es
idéntico, es una decisión de forma de tipo, no de flujo.)

**`handleAbilityTapInternal`** se bifurca al principio según si la habilidad es `ATTACK`:

```ts
function handleAbilityTapInternal(ability: AbilityViewData): void {
  if (ability.effectKind === 'ATTACK') { // NUEVO campo, ver AbilityViewData abajo
    const snapshot = bridge.getSnapshot();
    if (snapshot.minionsInPlay.length === 0) {
      // Sin Secuaces en mesa → objetivo trivial, se omite el gesto extra (mismo criterio que
      // handleAttackCardTap, spec H4_componente_carta.md §3.9.2 nota).
      startNucleoSelectionForAbility(ability, { kind: 'ENEMY' });
      return;
    }
    setPending({ stage: 'AWAITING_ATTACK_TARGET_FOR_ABILITY', abilityId: ability.abilityId });
    return;
  }
  // Camino EXISTENTE sin cambios — habilidades PLOT/sin efecto van directo a selección de Núcleo.
  ...
}
```

`startNucleoSelectionForAbility` extrae la lógica ya existente de auto-selección/espera-de-dado de
`handleAbilityTapInternal` (0/1/2+ dados válidos), parametrizada con el `target` ya resuelto (o
`undefined` para habilidades no-ATTACK) — se pasa a `dispatchAbility` que ahora incluye `target` en el
comando:

```ts
function dispatchAbility(ability: AbilityViewData, nucleoInstanceId: NucleoInstanceId, target?: AttackTarget): void {
  bridge.dispatch({
    type: 'ACTIVATE_ABILITY',
    abilityId: ability.abilityId,
    sourceId: 'leader',
    side: 'LEADER',
    nucleoInstanceId,
    ...(target ? { target } : {}),
  });
}
```

`handleKnownTargetId` (línea ~197) gana una rama para `AWAITING_ATTACK_TARGET_FOR_ABILITY`, simétrica
a la ya existente para `AWAITING_ATTACK_TARGET` (cartas): resuelve el tap (rol Enemigo/Secuaz) vía
`resolveAttackTarget` (ya existe, reutilizado tal cual) y transiciona a
`AWAITING_NUCLEO_FOR_ABILITY` con el `target` ya fijado.

**`AbilityViewData`** (`board-view-context.ts`) gana un campo derivado, resuelto una vez en
`build-combat-setup.ts` igual que `requiresNucleoInstance` ya se deriva para `HandCardViewData`:

```ts
export interface AbilityViewData {
  // ...campos existentes...
  /** NUEVO — true si effect.kind === 'ATTACK' (ability-effect.ts). Solo relevante para
   *  abilities del Líder (side LEADER) — determina si activar dispara el flujo de
   *  targeting (AWAITING_ATTACK_TARGET_FOR_ABILITY) antes de pedir Núcleo. */
  readonly effectKind: 'ATTACK' | 'PLOT' | 'NONE';
}
```

`toPrompt` (línea ~81) gana la traducción del nuevo stage a `TargetingPrompt`, reutilizando el mismo
`AWAITING_ATTACK_TARGET` de `targeting-signal.ts` (§5.2 de `H4_componente_carta.md`) — cambia solo qué
nombre expone (`abilityName` en vez de `cardName`; puede unificarse el tipo `TargetingPrompt` a un
campo `label: string` genérico si Programmer prefiere no duplicar la variante, decisión de detalle sin
impacto de reglas). `TargetingPromptBanner`/`promptLabelFor` ganan el caso
`"Elige un objetivo para «{abilityName}»"`.

`targeting-highlight-view.ts` (Phaser, sin cambios de contrato) sigue funcionando sin modificación — ya
resuelve `validTargetIds` desde `TargetingPrompt`, agnóstico de si el origen fue carta o habilidad.

### 1.5 Casos de test que Programmer debe cubrir (motor, nuevo archivo sugerido
`combat-engine.ability-targeting.test.ts`, mismo estilo que `combat-engine.targeting.test.ts` existente)

1. `ACTIVATE_ABILITY` con `effect.kind: 'ATTACK'`, `side: 'LEADER'`, `target: {kind:'ENEMY'}`, sin
   Secuaces en mesa → éxito, emite `ABILITY_ACTIVATED` + `ENEMY_DAMAGED` (con `abilityId` presente,
   `cardId` ausente), `enemyDamageAfter` correcto, `leaderDamage`/`leaderShield` SIN CAMBIOS (regresión
   directa del bug — antes de este fix, este mismo comando habría dañado al Líder).
2. Mismo caso sin `target` → `err({ code: 'ABILITY_TARGET_REQUIRED', abilityId })`, sin mutación
   (Núcleo sigue `AVAILABLE`, acciones sin consumir).
3. `target: {kind:'MINION', minionInstanceId}` apuntando a un Secuaz vivo, sin Defensor en mesa →
   `MINION_DAMAGED` (`abilityId` presente), vida del Secuaz baja correctamente; si el golpe lo mata,
   además `MINION_DEFEATED` y (si `arrollar: true` en la habilidad) el exceso pasa a `enemyDamageAfter`.
4. `target: {kind:'MINION', ...}` apuntando a un `minionInstanceId` inexistente →
   `err({ code: 'ATTACK_TARGET_NOT_FOUND', minionInstanceId })`.
5. Hay ≥1 Secuaz `isDefensor: true` vivo, `target: {kind:'ENEMY'}` → `err({ code:
   'MUST_TARGET_DEFENSOR', abilityId, defensorInstanceIds })` (nunca `cardId`, este caso viene de
   `ACTIVATE_ABILITY`).
6. `side: 'ENEMY'` con una habilidad `ATTACK` (contenido ya existente, `bestia-base`/`espectro-base`) —
   comportamiento IDÉNTICO a antes del fix (regresión de no-ruptura): `command.target` ausente/ignorado,
   sigue golpeando Líder o Aliado en Berserker/redirección vía `resolveDamageTarget()`. Ejecutar el
   suite `combat-engine.damage-plot.test.ts` existente sin modificar sus expectativas.
7. `PLAY_CARD` con `effect.kind: 'ATTACK_ENEMY'` (suite `combat-engine.targeting.test.ts` existente) —
   tras el refactor de extracción de `applyAttackToEnemySide` (§1.2.d.3), TODOS los tests existentes de
   ese archivo deben seguir pasando sin modificar sus expectativas (mismos eventos, mismos campos,
   `cardId` sigue presente/`abilityId` sigue ausente para ese camino).
8. `catalog-adapter.test.ts` — un `LeaderDefinition` de fixture con `baseAbilities[0].effect.kind ===
   'ATTACK'` se carga sin lanzar, y `abilityEffects` resultante contiene la entrada con `side: 'LEADER'`
   implícito (derivado de `abilityCooldowns`, sin cambio de ese mapeo).
9. `schema.test.ts` — casos actualizados de §1.2.e (CD1 ATTACK+VALUE → ok, CD1 ATTACK+ADD → lanza,
   CD2-4 ATTACK → ok).
10. Contenido real — cargar `soldado-base.json` actualizado (§1.3) a través de `CatalogLoader` real (no
    solo fixtures) y verificar que el combate arranca sin lanzar (constructor de `CombatEngine` pasa
    `validateAbilityEffectsConfig`).

---

## 2. Tiles de Aliado/Secuaz — migrar a tratamiento tipo `CardTile`

### 2.1 Diagnóstico (incluye el bug de nombre crudo, confirmado)

`minions-view.ts` línea 78: `entry.text.setText(\`${minion.definitionId}${defensorLabel}\nVida...\`)` —
`minion.definitionId` es el `MinionDefinitionId` crudo (`"minion-bestia-base-cachorro"`), NUNCA
resuelto a nombre legible. `allies-view.ts` línea 60 tiene el mismo defecto con `ally.cardId`. Ambos son
`Rectangle` + `Text` de Phaser sin marco, sin distinción visual de tipo — exactamente el mismo defecto
que `H4_componente_carta.md` §0 ya diagnosticó y resolvió para `card-hand-view.ts`.

**El bug de nombre crudo tiene arreglo trivial ya disponible, sin esperar a la migración a HTML**:
`NameLookup.minionName(id)`/`NameLookup.cardName(id)` (`packages/domain/catalog/src/name-lookup.ts`)
YA EXISTEN y ya resuelven `MinionDefinitionId`/`CardId` a `name` (usados hoy solo por el log de
combate). `BoardViewContext.nameLookup` (`board-view-context.ts` línea 62) ya está disponible en
`combat-scene/view`. Si por priorización el fix de nombre debe salir ANTES que la migración completa a
`CardTile`, es una única línea en cada vista: `ctx.nameLookup.minionName(minion.definitionId)` /
`ctx.nameLookup.cardName(ally.cardId)`. Se documenta aquí como fix aislado posible, pero el diseño de
esta sección asume que ambas vistas se sustituyen por completo (§2.2), lo cual resuelve el bug de nombre
como efecto colateral sin necesitar el parche aislado.

### 2.2 Diseño — mismo patrón que §1/§6 de `H4_componente_carta.md`: retirar de Phaser, migrar a HTML

`minions-view.ts`/`allies-view.ts` (Phaser) **se eliminan por completo**, igual que `card-hand-view.ts`
ya se eliminó. Sustituidos por 2 componentes React nuevos montados en `CombatBoardOverlay.tsx`, junto a
`HandCardRow`/`AbilityRow`/`EnemyDramaturgiaCardSlot` ya existentes:

```
apps/shell/src/combat/card/
  MinionRow.tsx     # NUEVO — mapea snapshot.minionsInPlay a <CardTile size="board">
  AllyRow.tsx        # NUEVO — mapea snapshot.alliesInPlay a <CardTile size="board">
```

### 2.3 `CardTile` gana un tercer tamaño — `'board'`

`CardTileSize` (`CardTile.tsx` línea 20) se extiende: `'hand' | 'featured' | 'board'`. Dimensiones
sugeridas: **96×140px** (más pequeña que `hand`, 132×196 — encaja más tiles en la fila de mesa sin
competir visualmente con la mano, que es donde el jugador toma decisiones activas). Mismo layout
interno que `hand`/`featured` (icono+coste arriba, nombre, regla, keywords) salvo que:

- El icono de tipo (`CardIconKind`) para un tile de mesa NO es 'ATAQUE'/'TRAMA'/etc. (esos describen
  cartas de la mano) — se añade un `CardIconKind` nuevo: `'ALIADO_EN_MESA' | 'SECUAZ_EN_MESA'` (o,
  más simple, reutilizar `'ALIADO'` ya existente para Aliados y añadir solo `'SECUAZ'` para Secuaces —
  Programmer decide, ambos casos necesitan solo 1 glyph nuevo `SECUAZ: '👹'` o similar en
  `CARD_ICON_GLYPH`/`CARD_TYPE_COLORS`).
- El "coste" (`card.cost`) se omite (`null`) — un Aliado/Secuaz ya en mesa no tiene coste visible, ya
  se pagó al entrar.
- En su lugar, en la posición donde `CardTile` hoy pinta el badge de coste (esquina superior derecha),
  se pinta un badge de **vida actual/máxima** (`♥ life/maxLife`), y si `isDefensor`/`isBerserker` es
  `true`, un icono de keyword adicional junto al nombre (reutiliza el sistema de `keywords` pills ya
  existente en `CardTile` — `card.keywords = [{keyword: 'DEFENSOR'}]` / `[{keyword: 'BERSERKER'}]`,
  sin inventar un mecanismo de renderizado nuevo).

Para evitar tocar la forma de `CardTileData` (que hoy asume `cost: {kind:'ENERGY',...} | null` sin
vida), se añade un campo opcional:

```ts
export interface CardTileData {
  // ...campos existentes sin cambio...
  /** NUEVO — solo relevante para size 'board' (Aliado/Secuaz en mesa). Sustituye visualmente al
   *  badge de coste (que para estas entidades siempre es null) por un indicador de vida. */
  readonly boardLife?: { readonly current: number; readonly max: number };
}
```

`CardTile` (línea ~184-193, badge de coste) se extiende: si `size === 'board'` y `card.boardLife`
está presente, pinta el badge de vida en vez del de coste (mismo contenedor visual, contenido
condicional — `card.cost` sigue siendo `null` para estas entidades, así que ambos badges nunca
compiten por el mismo layout).

### 2.4 `MinionRow.tsx`/`AllyRow.tsx` — contrato

```tsx
export interface MinionRowProps {
  readonly snapshot: CombatStateSnapshot;
  readonly ctx: BoardViewContext; // usa ctx.nameLookup.minionName(...) — fix del bug de nombre crudo
}
export function MinionRow({ snapshot, ctx }: MinionRowProps): JSX.Element {
  return (
    <>
      {snapshot.minionsInPlay.map((minion, index) => (
        <CardTile
          key={minion.instanceId}
          card={{
            id: minion.instanceId,
            name: ctx.nameLookup.minionName(minion.definitionId), // FIX del ID crudo
            icon: 'SECUAZ',
            cost: null,
            boardLife: { current: minion.life, max: minion.maxLife },
            keywords: minion.isDefensor ? [{ keyword: 'DEFENSOR' }] : [],
          }}
          size="board"
          style={{ position: 'absolute', left: MINIONS_ROW_X_ORIGIN + index * TILE_SEPARATION_PX, top: MINIONS_ROW_Y }}
        />
      ))}
    </>
  );
}
```

`AllyRow.tsx` es el espejo exacto usando `ally.cardId` + `ctx.nameLookup.cardName(...)` + `isBerserker`
+ `ALLIES_ROW_X_ORIGIN`/`ALLIES_ROW_Y` (constantes ya exportadas de `board-layout.ts`, reutilizadas sin
cambio — la posición NO cambia, solo el elemento que se posiciona).

`CardTile` con `size === 'board'` recibe `onTap` cuando corresponda: durante `AWAITING_ATTACK_TARGET_FOR_CARD`/
`AWAITING_ATTACK_TARGET_FOR_ABILITY` (§1.4), un tap sobre un `CardTile` de Secuaz debe seguir resolviendo
como tap de targeting — esto requiere que `MinionRow` reciba también `gestureHandle` y invoque un nuevo
método corto `handleMinionTap(minionInstanceId)` en `GestureCommandTranslator` (mismo patrón exacto que
`handleCardTap`/`handleAbilityTap`, delegando en la lógica ya existente de `handleKnownTargetId` con
`targetId = minionInstanceId`) — evita que el Secuaz, ahora HTML, deje de ser tocable para targeting tras
la migración (mismo problema de arquitectura de input que `H4_componente_carta.md` §6.1 ya resolvió para
cartas/habilidades). El highlight visual de "Secuaz es objetivo válido" (`targeting-highlight-view.ts`,
Phaser) deja de tener un sprite de Phaser sobre el que aplicar `setStrokeStyle` una vez `minions-view.ts`
se elimina — se sustituye por la misma técnica ya usada en `CardTile` (`selected` prop → borde `--foil`
+ `foil-pulse`), controlada por `useTargetingPrompt` en `MinionRow` (si `minion.instanceId` está en
`prompt.validTargetIds`, pasa `selected: true`/aplica `card-tile--ready`).

El Enemigo (`role-view.ts`) permanece igual (fuera de alcance de esta pieza) — sigue siendo el único
target de Phaser puro para el gesto de ataque; solo Aliado/Secuaz migran.

---

## 3. Ficha de personaje ampliada (Líder/Enemigo) — long-press/hover sobre el tile compacto

### 3.1 Referencia y objetivo

El Director cita explícitamente el patrón de preview al hacer hover en `strawtable.net` (ya referenciado
en `vision.md`/`decisions.md` como referencia de "feel"): pasar el cursor/mantener pulsado sobre una
carta pequeña despliega una vista grande con toda su información. Hoy `RoleBlock` (dentro de
`CombatBoardOverlay.tsx`, líneas 174-206) ya es el tile compacto de Líder/Enemigo/Escenario — nombre +
fila de datos (vida/escudo/energía/nivel para Líder; vida/fase para Enemigo), sin sus habilidades
embebidas (que hoy viven aparte, en `AbilityRow`, debajo). El pedido tiene 2 partes: (a) mostrar
habilidades embebidas en la ficha (aunque sea de forma resumida) y (b) una vista ampliada tipo carta al
mantener pulsado/hover con TODA la información.

### 3.2 Diseño — reutiliza `RoleBlock` + composición de `AbilityTile`s existentes, sin sistema nuevo

**(a) Habilidades embebidas en el tile compacto — cambio mínimo, sin vista nueva.**
`AbilityRow` (línea 155-169 de `CombatBoardOverlay.tsx`) ya se renderiza justo debajo de cada
`RoleBlock` (`LEADER_ABILITIES_ROW_Y`/`ENEMY_ABILITIES_ROW_Y`, definidas en `board-layout.ts` para
quedar visualmente adyacentes). El pedido de "habilidades embebidas dentro de la misma tarjeta" se
resuelve envolviendo `RoleBlock` + su `AbilityRow` correspondiente en un contenedor visual común (un
`<div>` con fondo `COLOR_BINDER`/borde/`RADIUS_PANEL`, mismo lenguaje visual que `CardTile`) en vez de
2 elementos visualmente inconexos como hoy — CAMBIO PURAMENTE DE MAQUETACIÓN, cero componentes nuevos:

```tsx
<div style={{ /* panel con borde CARD_TYPE_COLORS-like, agrupa visualmente RoleBlock + AbilityRow */ }}>
  <RoleBlock ... />
  <AbilityRow abilities={ctx.leaderAbilities} side="LEADER" ... />
</div>
```

**(b) Vista ampliada al long-press/hover — nuevo componente `CharacterSheetPreview.tsx`, composición
literal de `AbilityTile`s dentro de un panel `featured`-like (exactamente lo que pide el encargo: "¿la
vista ampliada puede ser literalmente una composición de AbilityTiles dentro de un panel más grande?" →
sí).**

```tsx
// apps/shell/src/combat/card/CharacterSheetPreview.tsx — NUEVO
export interface CharacterSheetPreviewProps {
  readonly name: string;
  readonly side: 'LEADER' | 'ENEMY';
  readonly life: { readonly current: number; readonly max: number };
  readonly extraStats?: readonly { readonly label: string; readonly value: string }[]; // Escudo/Energía/Nivel (Líder) o Fase (Enemigo)
  readonly abilities: readonly AbilityTileData[]; // TODAS las abilities de ese lado, ruleText SIEMPRE visible (no popover)
}

export function CharacterSheetPreview(props: CharacterSheetPreviewProps): JSX.Element {
  return (
    <div style={{
      width: 320, // más ancho que 'featured' (224) — necesita alojar N AbilityTiles en fila/grid
      background: COLOR_BINDER, border: `2px solid ${COLOR_FOIL}`, borderRadius: RADIUS_PANEL,
      boxShadow: SHADOW_PANEL, padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm,
    }}>
      <span style={{ ...TYPE.displaySm, color: COLOR_TEXT_PRIMARY }}>{props.name}</span>
      <div style={{ display: 'flex', gap: SPACING.md, ...TYPE.dataMd }}>
        <span>♥ {props.life.current}/{props.life.max}</span>
        {props.extraStats?.map((s) => <span key={s.label}>{s.label} {s.value}</span>)}
      </div>
      <div style={{ borderTop: `1px solid ${COLOR_RULE}` }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACING.sm }}>
        {props.abilities.map((a) => (
          <div key={a.abilityId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <AbilityTile ability={a} interactive={false} />
            {/* ruleText SIEMPRE visible aquí (a diferencia del popover long-press de AbilityTile en
                su uso normal) — se renderiza directamente debajo, sin depender del long-press interno
                de AbilityTile (que se desactiva de facto al no dar onTap ni montar el popover propio;
                Programmer puede añadir un prop opcional AbilityTile.forceShowRuleText?: boolean como
                alternativa más limpia que duplicar el texto aquí, decisión de detalle). */}
            {a.ruleText && <p style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY, margin: 0, textAlign: 'center' }}>{a.ruleText}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Reutiliza `AbilityTile` TAL CUAL para el círculo de coste+CD de cada habilidad (cero lógica de
cooldown/color duplicada) — solo añade el texto de regla en línea en vez de tras long-press (porque
aquí la vista YA ES el long-press de un nivel superior, no tiene sentido anidar un segundo long-press
dentro del primero).

**Disparo del long-press/hover**: se añade al contenedor de §3.2(a) (el panel que agrupa `RoleBlock`
+ `AbilityRow`) el mismo mecanismo de `onMouseEnter`/`onMouseLeave` (hover, desktop) +
`onTouchStart`/`onTouchEnd` con umbral `LONG_PRESS_MS` (400ms, ya definido en `AbilityTile.tsx`,
reutilizado como constante compartida en vez de reintroducirlo) que abre/cierra un `useState<boolean>`
local, y renderiza `<CharacterSheetPreview>` en un `position: absolute` anclado al panel (mismo patrón
de popover que `AbilityTile` ya usa en `apps/shell` para su propio tooltip, un nivel de anidación
arriba). `zIndex` por encima de `TargetingPromptBanner` (5) y de cualquier otro overlay — sugerido 20.

### 3.3 Datos — de dónde sale `abilities`/`extraStats`

`ctx.leaderAbilities`/`ctx.enemyAbilities` (`BoardViewContext`, ya existen) más `snapshot.leaderState`/
`snapshot.enemyPhase` (ya existen) son suficientes — SIN gap de datos nuevo, a diferencia de la pieza 1
o de `H4_componente_carta.md` §3.2 (Dramaturgia). El componente que monta `CharacterSheetPreview` para
el Líder pasa:

```ts
abilities: ctx.leaderAbilities.map((a) => ({
  abilityId: a.abilityId, name: a.name, coreCost: a.coreCost,
  baseCooldown: a.baseCooldown,
  remaining: snapshot.leaderCooldowns.find((c) => c.abilityId === a.abilityId)?.remaining ?? 0,
  ruleText: a.ruleText,
}))
extraStats: [
  { label: '🛡', value: String(snapshot.leaderShield) },
  { label: '⚡', value: String(snapshot.leaderEnergy) },
  { label: '✦Nivel', value: String(snapshot.leaderState.level) },
]
```

(nombres exactos de campos de `snapshot`/`AbilityViewData` a confirmar contra el código real por
Programmer — la forma general ya está cerrada por §3.2/§3.3 y por los datos que `RoleBlock` YA consume
hoy en las mismas líneas de `CombatBoardOverlay.tsx`, sin inventar ningún dato nuevo).

### 3.4 Mockup — hover/long-press sobre el tile del Líder

```
Estado normal (tile compacto, sigue en su zona actual):
┌─────────────────────────┐
│  LÍDER                  │
│  Soldado Base           │
│  ♥18/30  🛡2  ⚡3  ✦Nv2  │
│  [●][●][●][●]  ← AbilityRow, 4 AbilityTile pequeños
└─────────────────────────┘
        │ long-press / hover (400ms)
        ▼
┌────────────────────────────────────────┐
│  Soldado Base                            │
│  ♥18/30   🛡2   ⚡3   ✦Nivel 2            │
│ ──────────────────────────────────────── │
│  ┌────┐            ┌────┐                │
│  │ ⚔️3 │            │📜2 │                │
│  └────┘            └────┘                │
│  Guardia Firme      Avance Agresivo       │
│  Ataque. Golpea al  Trama +1 a favor      │
│  Enemigo (o Secuaz) del Líder. Requiere   │
│  con el valor del   Núcleo Agresión.      │
│  Núcleo gastado.                          │
│  ┌────┐            ┌────┐                │
│  │ 3  │            │ 4  │                │
│  └────┘            └────┘                │
│  Línea Defensiva    Grito de Guerra       │
│  Refuerza la        Trama +2 a favor      │
│  posición defensiva.del Líder. Requiere   │
│                     Agresión o Defensa.   │
└────────────────────────────────────────┘
```

### 3.5 Archivos afectados (pieza 3)

```
apps/shell/src/combat/card/CharacterSheetPreview.tsx   # NUEVO §3.2(b)
apps/shell/src/combat/CombatBoardOverlay.tsx            # MODIFICADO — envuelve RoleBlock+AbilityRow en panel
                                                          # común (§3.2a) + hover/long-press → CharacterSheetPreview
apps/shell/src/combat/card/AbilityTile.tsx               # POSIBLE — prop opcional forceShowRuleText?:boolean
                                                          # (alternativa a duplicar el texto en CharacterSheetPreview)
```

---

## 4. Resumen de archivos por pieza

```
# Pieza 1 (bug de motor)
packages/domain/combat/src/types/commands.ts        # +target?: AttackTarget en ACTIVATE_ABILITY
packages/domain/combat/src/types/errors.ts           # +ABILITY_TARGET_REQUIRED, MUST_TARGET_DEFENSOR generalizado
packages/domain/combat/src/types/ability-effect.ts    # doc actualizada, sin restricción de side
packages/domain/combat/src/types/events.ts            # ENEMY_DAMAGED/MINION_DAMAGED: cardId opcional +abilityId
packages/domain/combat/src/combat-engine.ts            # validateAbilityEffectsConfig, applyAttackEffect,
                                                        # applyAttackToEnemySide (nuevo, reutilizado por PLAY_CARD
                                                        # y ACTIVATE_ABILITY), executeAbilityEffect, handleActivateAbility
packages/domain/catalog/src/validation/schema.ts       # parseLeaderDefinition: relajar restricción ATTACK
packages/domain/catalog/src/types/leader.ts            # comentario actualizado
packages/data/leaders/soldado-base.json                # Guardia Firme → effect ATTACK/VALUE + ruleText
packages/combat-scene/src/view/board-view-context.ts   # AbilityViewData +effectKind
apps/shell/src/combat/build-combat-setup.ts             # deriva effectKind
packages/combat-scene/src/interaction/gesture-command-translator.ts # AWAITING_ATTACK_TARGET_FOR_ABILITY,
                                                        # dispatchAbility +target
packages/combat-scene/src/interaction/targeting-signal.ts # TargetingPrompt: caso ability
apps/shell/src/combat/card/TargetingPromptBanner.tsx     # label caso ability
packages/domain/combat/src/combat-engine.ability-targeting.test.ts # NUEVO — casos §1.5
packages/domain/catalog/src/validation/schema.test.ts     # casos actualizados §1.2.e

# Pieza 2 (tiles Aliado/Secuaz)
packages/combat-scene/src/view/minions-view.ts   # ELIMINADO
packages/combat-scene/src/view/allies-view.ts    # ELIMINADO
apps/shell/src/combat/card/CardTile.tsx           # +size 'board', +boardLife, +icon SECUAZ
apps/shell/src/combat/card/MinionRow.tsx          # NUEVO
apps/shell/src/combat/card/AllyRow.tsx            # NUEVO
apps/shell/src/combat/CombatBoardOverlay.tsx       # monta MinionRow/AllyRow
packages/combat-scene/src/interaction/gesture-command-translator.ts # +handleMinionTap
packages/combat-scene/src/view/targeting-highlight-view.ts # deja de aplicar setStrokeStyle a Secuaz/Aliado
                                                            # (ahora resuelto vía CardTile `selected`)

# Pieza 3 (ficha ampliada)
apps/shell/src/combat/card/CharacterSheetPreview.tsx # NUEVO
apps/shell/src/combat/CombatBoardOverlay.tsx          # panel agrupador + hover/long-press
apps/shell/src/combat/card/AbilityTile.tsx             # posible prop forceShowRuleText
```

---

## 5. Orden de implementación recomendado

1. **Pieza 1 completa** — es el bug real de reglas de juego, bloquea que cualquier contenido futuro de
   Líder con ATTACK funcione; además desbloquea que el Director pueda validar visualmente el fix con el
   contenido de prueba (§1.3) sin depender de las piezas 2/3.
2. **Pieza 2** — el fix de nombre crudo (§2.1) es la parte de mayor impacto/menor esfuerzo; puede salir
   primero como parche aislado si Coordinator quiere trocear el trabajo, pero el diseño completo (§2.2-2.4)
   ya lo resuelve como efecto colateral.
3. **Pieza 3** — depende de que `AbilityTile`/`RoleBlock` ya existan (sí, ya implementados) y de que
   `handleMinionTap` (pieza 2) no sea un prerequisito real — piezas 2 y 3 son independientes entre sí,
   pueden ir en paralelo.
