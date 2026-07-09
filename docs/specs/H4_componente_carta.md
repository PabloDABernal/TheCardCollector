# H4 — Componente de Carta real (`CardTile`/`AbilityTile`) + feedback de targeting

> **Complementa a `docs/specs/H4_diseno_real_ui.md`, no lo sustituye.** Esa pasada resolvió el marco
> exterior, el sistema de tokens (`tokens.css`/`design-tokens.ts`), la migración de texto de rol a
> `CombatBoardOverlay.tsx` y el rediseño de `RunStartModal`/`CombatHud`. Esta pasada ataca lo que el
> Director Creativo señaló como el problema real tras verla en producción: **nunca se ha construido
> una carta como componente visual de TCG** — hoy `card-hand-view.ts` pinta un `Rectangle` de color
> plano + un `Text` de una sola línea (`${name}\n(${energyCost})`), sin marco, sin icono, sin texto de
> regla, y la carta de Dramaturgia activa del Enemigo ni siquiera se muestra. Reutiliza sin
> modificación: paleta `--ink/--binder/--rule/--parchment/--foil`, tipografías
> Staatliches/Manrope/JetBrains Mono, `CombatBoardOverlay.tsx`/`usePhaserViewportTransform`
> (patrón de overlay HTML sincronizado ya validado).
>
> Sin cambios de mecánicas — opera sobre `CombatStateSnapshot`/`CombatEvent` ya cerrados, salvo la
> extensión mínima de datos documentada en §3 (necesaria para que la carta de Dramaturgia del Enemigo
> sea representable, no un cambio de regla de juego).

---

## 0. Diagnóstico y alcance

`card-hand-view.ts` (mano del jugador), `ability-cooldown-view.ts` (habilidades Líder/Enemigo) y
`role-view.ts` (donde hoy NO se muestra ninguna carta de Dramaturgia, solo el `Rectangle` de rol del
Enemigo) son los 3 puntos de renderizado que el encargo señala. Los 3 comparten el mismo defecto:
texto de una sola familia/tamaño superpuesto a una `Rectangle` de color sólido, sin gramática visual
de carta.

**Decisión de arquitectura — las 3 piezas migran a HTML** (extendiendo el patrón de
`CombatBoardOverlay.tsx`), no permanecen en Phaser. Esto es una ampliación deliberada del criterio ya
cerrado en `H4_diseno_real_ui.md` §2.2 ("texto co-localizado con un sprite que se anima se queda en
Phaser"): una carta real necesita layout DOM (texto que envuelve, múltiples pesos de fuente, badges) —
imposible con calidad en `Phaser.GameObjects.Text`/`Rectangle`. La objeción original a mover contenido
a HTML era "sincronizar dos sistemas de animación (tween Phaser + reposicionado CSS)" — se resuelve en
§4 moviendo también la animación de jugar carta a CSS, no dejándola partida entre dos sistemas.

**Qué seguirá en Phaser:** el `nucleo-table-view.ts` (dados), `minions-view.ts`/`allies-view.ts`
(tiles de Secuaz/Aliado en mesa, sin cambio en esta pasada — no son "cartas", son fichas de mesa) y el
`Rectangle` de rol de Líder/Enemigo/Escenario (`role-view.ts`, ya reducido a solo el tile por H4
anterior). El único juice que sigue en Phaser relacionado con cartas es el **destino** del gesto de
ataque (highlight de Secuaz/Enemigo válido, §5) — es un highlight sobre un sprite de mesa que YA vive
en Phaser, no sobre la carta en sí.

---

## 1. `CardTile` — contrato de props

Nuevo archivo `apps/shell/src/combat/card/CardTile.tsx`.

```tsx
export type CardTileSize = 'hand' | 'featured';

export interface CardTileData {
  readonly id: string; // CardId o DramaturgiaCardId — solo se usa como React key/data-id, opaco aquí
  readonly name: string;
  readonly icon: CardIconKind; // 'ATAQUE' | 'TRAMA' | 'EQUIPO' | 'ALIADO' | 'CONTRATIEMPO'
  readonly cost: { readonly kind: 'ENERGY'; readonly amount: number } | null; // null = sin coste visible (Dramaturgia)
  readonly ruleText?: string; // ver §3.2 — gap de datos, texto libre nuevo en catálogo
  readonly keywords: readonly { readonly keyword: string; readonly amount?: number }[];
}

export interface CardTileProps {
  readonly card: CardTileData;
  readonly size: CardTileSize; // 'hand' = 132×196, 'featured' = 224×332 (§1.3)
  readonly affordable?: boolean; // default true — atenúa igual que ALPHA_UNAFFORDABLE hoy (§1.5)
  readonly selected?: boolean; // borde/halo --foil, mismo criterio que SelectionCard (H4 anterior §3.2)
  readonly onTap?: () => void; // hand-tap real; featured (Dramaturgia) nunca lo recibe
  readonly style?: CSSProperties; // posicionamiento absoluto lo inyecta el padre (§2), CardTile no se posiciona a sí misma
}

export function CardTile(props: CardTileProps): JSX.Element;
```

`CardIconKind` vive en un nuevo módulo puro `apps/shell/src/combat/card/card-icon.ts`:

```ts
export type CardIconKind = 'ATAQUE' | 'TRAMA' | 'EQUIPO' | 'ALIADO' | 'CONTRATIEMPO';

const ATTACK_KEYWORDS = ['ATAQUE', 'ATAQUE_MAS_X', 'ATAQUE_POR_X'] as const;
const PLOT_KEYWORDS = ['TRAMA_X'] as const;

/** Deriva el icono de tipo de una carta EVENTO/EQUIPO/ALIADO/CONTRATIEMPO a partir de `cardType` +
 *  `keywords` — el dominio NO tiene un `CardType` 'ATAQUE'/'TRAMA' propio (`catalog/types/card.ts`
 *  fija `CardType = 'EQUIPO'|'ALIADO'|'EVENTO'|'CONTRATIEMPO'`); Ataque/Trama son sub-clasificaciones
 *  de EVENTO derivadas de sus keywords (ver §3.1 para la justificación completa). EQUIPO/ALIADO/
 *  CONTRATIEMPO se resuelven directo por `cardType`, sin mirar keywords. */
export function cardIconFor(
  cardType: 'EQUIPO' | 'ALIADO' | 'EVENTO' | 'CONTRATIEMPO',
  keywords: readonly { readonly keyword: string }[],
): CardIconKind;

export const CARD_ICON_GLYPH: Record<CardIconKind, string> = {
  ATAQUE: '⚔️',
  TRAMA: '📜',
  EQUIPO: '🛡️',
  ALIADO: '🤝',
  CONTRATIEMPO: '⏪',
};
```

### 1.1 Nota de precisión sobre el coste — corrige una asunción del encargo

El encargo pide "reutiliza `NUCLEO_COLOR_HEX` para cartas con coste de color". **El dominio hoy no
tiene ninguna carta con coste de Núcleo** — `CardDefinition.cost = { energy: number }` es el ÚNICO
coste de jugar una carta (`catalog/types/card.ts` línea 9-14, decisión ya cerrada
"Coste de Energía de las habilidades... solo bajar una carta a mesa paga Energía"). El coste de
Núcleo por color pertenece a las **habilidades** (`AbilityDefinition.coreCost`), no a las cartas. Por
tanto:

- `CardTile.cost` siempre es `{ kind: 'ENERGY', amount }` o `null` (Dramaturgia, que no se "juega" con
  Energía — es la carta que el Enemigo robó/resolvió automáticamente, sin coste visible al jugador).
- `NUCLEO_COLOR_HEX` se reserva para el badge de coste de **`AbilityTile`** (§2), donde sí aplica
  literalmente — es la única pieza de esta spec donde ese mapeo de color tiene sentido de dominio.
- El borde/color de tipo de `CardTile` usa una paleta nueva y propia (`CARD_TYPE_COLORS`, §1.4), NUNCA
  `NUCLEO_COLOR_HEX` — mismo criterio ya fijado en H4 anterior de "familias de color separadas, el
  foil/tipo de UI no se mezcla con la semántica de dado" (`H4_diseno_real_ui.md` §1.2, nota sobre
  `NUCLEO_ACCENT_COLORS`).

### 1.2 Nueva paleta — `CARD_TYPE_COLORS` (añadir a `apps/shell/src/ui/design-tokens.ts`)

```ts
// Color de borde/acento por tipo de carta — familia propia, nunca NUCLEO_COLOR_HEX (§1.1).
// Elegidos por contraste entre sí y legibilidad sobre --binder, sin pisar --foil (reservado a
// selección/acento de acción) ni --success/--danger (reservados a semántica de sistema).
export const CARD_TYPE_COLORS: Record<CardIconKind, string> = {
  ATAQUE: '#b5482f', // terracota — cálido, distinto de --danger (#d1495b) para no leerse como alerta
  TRAMA: '#6a5a8c', // violeta apagado
  EQUIPO: '#4c7a8c', // acero azulado
  ALIADO: '#5c8c5a', // verde apagado, distinto de --success
  CONTRATIEMPO: '#8c7a4c', // ocre
};
```

### 1.3 Dimensiones

| Tamaño | Uso | Ancho × Alto | Notas |
|---|---|---|---|
| `hand` | Mano del jugador (5-7 cartas) | **132 × 196px** | Sustituye `CARD_WIDTH`/`CARD_HEIGHT` (120×180) de `card-hand-view.ts`, +12/+16px para dar sitio a marco+badges sin comprimir el cuerpo de texto. Con 7 cartas a `HAND_ROW_POSITION` (ancho de panel real ~1040px, `PANEL_ZONES` `panel-hand`), 7×132 = 924px + gaps caben con margen. |
| `featured` | Carta de Dramaturgia activa del Enemigo (§3) | **224 × 332px** | Escala ×1.7 de `hand`, una sola carta destacada — mismo criterio que pide el encargo ("puede ser más grande, es una sola carta"). |

Layout interno (ambos tamaños, proporcional):

```
┌──────────────────────────────┐
│ ⚔️                      [⚡3] │  ← icono (esquina sup. izq.) + badge de coste (esquina sup. der.)
│                                │
│   Golpe Certero               │  ← banner de nombre, TYPE.bodyMd bold (hand) / TYPE.displaySm (featured)
│  ──────────────────────────   │  ← rule divisor, 1px --rule
│                                │
│  Ataque +2. Si el objetivo    │  ← cuerpo de texto de regla, TYPE.bodySm, wrap real (DOM)
│  tiene menos de 5 de vida,    │
│  Arrollar.                    │
│                                │
│  [Umbral] [Arrollar]          │  ← keyword badges, TYPE.labelUpper 10px, pill --rule
└──────────────────────────────┘
   borde 2px CARD_TYPE_COLORS[icon], radius RADIUS_PANEL (12px), fondo --binder, sombra --shadow-panel
```

### 1.4 Estructura DOM (spec exacta de estilos, tokens ya existentes de `H4_diseno_real_ui.md` §1.2/§1.3)

```tsx
<div
  data-card-id={card.id}
  onClick={onTap}
  style={{
    width: size === 'hand' ? 132 : 224,
    height: size === 'hand' ? 196 : 332,
    display: 'flex',
    flexDirection: 'column',
    background: COLOR_BINDER,
    border: `2px solid ${selected ? COLOR_FOIL : CARD_TYPE_COLORS[card.icon]}`,
    borderRadius: RADIUS_PANEL,
    boxShadow: selected
      ? `0 0 0 3px rgba(212, 162, 76, 0.25), ${SHADOW_PANEL}`
      : SHADOW_PANEL,
    opacity: affordable ? 1 : 0.4, // = ALPHA_UNAFFORDABLE actual, mismo valor
    padding: size === 'hand' ? SPACING.xs : SPACING.sm,
    gap: SPACING.xs,
    pointerEvents: onTap ? 'auto' : 'none', // featured (Dramaturgia) nunca es tocable
    cursor: onTap ? 'pointer' : 'default',
    boxSizing: 'border-box',
  }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <span style={{ fontSize: size === 'hand' ? 16 : 22 }}>{CARD_ICON_GLYPH[card.icon]}</span>
    {card.cost && (
      <span style={{
        ...TYPE.dataMd, minWidth: 22, height: 22, borderRadius: '50%',
        background: COLOR_INK, color: COLOR_FOIL, display: 'flex',
        alignItems: 'center', justifyContent: 'center', border: `1px solid ${COLOR_RULE}`,
      }}>
        {card.cost.amount}
      </span>
    )}
  </div>

  <span style={{ ...(size === 'hand' ? TYPE.bodyMd : TYPE.displaySm), fontWeight: 700, color: COLOR_TEXT_PRIMARY }}>
    {card.name}
  </span>
  <div style={{ borderTop: `1px solid ${COLOR_RULE}` }} />

  {card.ruleText && (
    <p style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY, margin: 0, flex: 1, overflow: 'hidden' }}>
      {card.ruleText}
    </p>
  )}

  {card.keywords.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {card.keywords.map((k) => (
        <span key={k.keyword} style={{
          ...TYPE.labelUpper, fontSize: 10, padding: '2px 6px', borderRadius: RADIUS_CHIP,
          background: COLOR_INK, border: `1px solid ${COLOR_RULE}`, color: COLOR_TEXT_SECONDARY,
        }}>
          {keywordLabel(k)} {/* helper puro: 'ARROLLAR' → 'Arrollar', 'TRAMA_X' amount=2 → 'Trama +2' */}
        </span>
      ))}
    </div>
  )}
</div>
```

`keywordLabel` — nuevo helper puro `apps/shell/src/combat/card/keyword-label.ts`, tabla de traducción
`KeywordId → string` legible (reutiliza el vocabulario cerrado de `catalog/types/keyword.ts`
`KeywordId`), testeable en aislamiento sin DOM.

---

## 2. `AbilityTile`

Nuevo archivo `apps/shell/src/combat/card/AbilityTile.tsx`. Sustituye el icono de
`ability-cooldown-view.ts` (barra de progreso + `Text` superpuesto) por un tile HTML con la misma
gramática que `CardTile` pero adaptado a habilidad: sin cuerpo de texto permanente (el encargo pide no
ocupar espacio permanente para la descripción).

```tsx
export interface AbilityTileData {
  readonly abilityId: string;
  readonly name: string;
  readonly coreCost: CoreCostRequirement; // { kind: 'COLOR'; color: NucleoColor } | { kind: 'ANY' }
  readonly baseCooldown: number;
  readonly remaining: number; // 0 = lista
  readonly ruleText?: string; // gap de datos, §3.2 — mismo campo nuevo que CardTile
}

export interface AbilityTileProps {
  readonly ability: AbilityTileData;
  readonly interactive: boolean; // solo las del Líder reciben onTap real
  readonly onTap?: () => void;
}

export function AbilityTile(props: AbilityTileProps): JSX.Element;
```

Estructura — círculo de color de coste (60×60px) + anillo de progreso de cooldown (SVG `<circle>`
`stroke-dasharray`, DOM puro, sin dependencia nueva) + nombre debajo en `TYPE.labelUpper`:

```
   ┌────────┐
  ╱          ╲
 │    ⚡3      │   ← círculo relleno NUCLEO_COLOR_HEX[color] (o gris neutro si coreCost.kind === 'ANY'),
  ╲          ╱      anillo SVG externo (--rule de fondo, --success progresivo hasta completarse el CD)
   └────────┘
   Golpe Rápido        ← TYPE.labelUpper, 11px, debajo del círculo
```

- Color de relleno del círculo: `NUCLEO_COLOR_HEX[coreCost.color]` si `coreCost.kind === 'COLOR'`
  (aquí SÍ aplica el mapeo de Núcleo — es una habilidad real con coste de color), `COLOR_RULE` (gris
  neutro) si `coreCost.kind === 'ANY'`.
- Anillo de progreso: `remaining === 0` → anillo completo en `--success`, borde adicional `--foil`
  pulsante (reutiliza la misma animación CSS que §4.3 define para "listo para jugar"). `remaining > 0`
  → arco proporcional a `(baseCooldown - remaining) / baseCooldown` en `--rule`, número `remaining`
  superpuesto en `TYPE.dataMd` centrado en el círculo en vez del icono de coste (o combinado: icono
  arriba pequeño, número de CD abajo pequeño — decisión de detalle de Programmer, ambos caben en
  60px con `TYPE` de 11-13px).
- **Descripción sin ocupar espacio permanente**: atributo `title={ability.ruleText}` (tooltip nativo,
  gratis en desktop/hover) + `onTouchStart` con `long-press` (400ms, mismo umbral que
  `InputAdapter`/`PointerGesture` ya usa para `LONG_PRESS` en Phaser — coherencia de umbral entre las
  dos capas de gesto) que abre un popover CSS-only anclado bajo el tile (`position: absolute`,
  `translateY(8px)`, fondo `--ink`, borde `--rule`, `max-width: 220px`, se cierra al soltar o al tocar
  fuera). Decisión de UX táctil: **long-press sobre tap-toggle** — el tap ya está ocupado por
  `ACTIVATE_ABILITY` real (Líder) o es puramente informativo (Enemigo, sin `onTap`); mantener pulsado
  es el gesto estándar de "más información" en TCG digitales móviles (Hearthstone/MTG Arena) y no
  compite con el gesto de activar.

---

## 3. Carta de Dramaturgia activa del Enemigo — gap de datos (bloqueante para Programmer)

### 3.1 Estado actual — confirmado por lectura de código, no supuesto

`combat-engine.ts` línea 2298: al robarse una carta de Dramaturgia, el motor SÍ tiene el objeto
`DramaturgiaCardDefinition` completo en memoria (`card`), pero el evento emitido solo expone el icono:

```ts
const drawn: CombatEvent = { type: 'DRAMATURGIA_CARD_DRAWN', icon: card.icon };
```

Y `CombatStateSnapshot` (`snapshot.ts`) **no tiene ningún campo** que persista "qué carta de
Dramaturgia está activa/fue la última jugada" — no hay `activeDramaturgiaCardId` ni equivalente. Hoy
es literalmente imposible pintar la carta real del Enemigo porque el snapshot no la referencia; la
única superficie visual actual de esta información es indirecta (el `icon` alimenta
`decideEnemyAbility`, invisible al jugador).

### 3.2 Extensión de datos requerida (2 gaps, ambos de bajo riesgo — aditivos, sin tocar reglas)

**Gap A — snapshot debe recordar la última carta de Dramaturgia robada:**

```ts
// packages/domain/combat/src/types/snapshot.ts — AÑADIR a CombatStateSnapshot
/** NUEVO H4.x — id de la carta de Dramaturgia robada más recientemente por el Enemigo (persiste
 *  entre snapshots hasta el siguiente robo, incluye durante el turno del Líder para que la UI pueda
 *  mostrar "lo último que jugó el Enemigo" en todo momento, no solo durante su turno). `null` antes
 *  del primer robo de la run/combate o si `enemyAiEnabled` es `false` (sin Dramaturgia, ver
 *  `combat-engine.ts` línea 282). */
readonly enemyActiveDramaturgiaCardId: DramaturgiaCardId | null;
```

Implementación (para Programmer, no Architect): `combat-engine.ts` guarda `this.activeDramaturgiaCardId`
como campo privado, se asigna en el mismo punto donde hoy se construye el evento
`DRAMATURGIA_CARD_DRAWN` (línea ~2298, `this.activeDramaturgiaCardId = card.id`), y `getSnapshot()` lo
expone. Cambio aditivo puro — ningún test existente de `combat-engine.turn-loop.test.ts` puede romperse
por añadir un campo nuevo a un objeto ya cerrado por `toEqual` salvo que esos tests usen
`toEqual` exacto sobre el snapshot completo (verificar; si es el caso, es una actualización mecánica
de fixture, no un rediseño).

**Gap B — ni `CardDefinition` (jugador) ni `DramaturgiaCardDefinition`/`AbilityDefinition` tienen texto
de regla libre para cartas de jugador y habilidades** (`DramaturgiaCardDefinition.effectDescription` sí
existe, es el único de los 3 que ya tiene texto libre). Sin esto, `CardTile.ruleText`/
`AbilityTile.ruleText` no tienen fuente de dato — el dominio modela `keywords`/`effect` como datos
ESTRUCTURADOS ejecutables, nunca como prosa. Generar la prosa por composición automática de keywords
(ej. `ATAQUE_MAS_X amount=2` → "Ataque +2") es frágil y no es el patrón que el proyecto ya usa dos
veces (`DramaturgiaCardDefinition.effectDescription`, `ScenarioPlotThreshold`/`ScenarioPassiveEffect`
en `catalog/types/scenario.ts`) para "mecánica descrita pero no siempre completamente ejecutable".

**Decisión: añadir `ruleText?: string` a `CardDefinition` (catalog/types/card.ts) y a
`AbilityDefinition` (catalog/types/ability.ts)**, mismo patrón exacto que `effectDescription` — campo
opcional, texto libre autorado en el catálogo (JSON de contenido), sin validación cruzada contra
`keywords`/`effect` (igual que `effectDescription` no se valida contra `icon`). Ausente = `CardTile`
omite el bloque de cuerpo de texto (layout se comprime, keywords badges siguen mostrándose solos).
Contenido MVP (2×2×2, 26 cartas + habilidades) requiere rellenar este campo para las cartas ya
existentes — tarea de contenido, no de motor, fuera del scope de Architect/Programmer de esta historia
pero debe quedar anotada en el backlog de Coordinator como deuda de datos antes de que QA la marque
como "cartas sin texto".

### 3.3 Resolución del nombre/datos completos de la carta activa en `apps/shell`

`BoardViewContext` se extiende con un mapa resuelto una vez (mismo patrón que `leaderCardPool`):

```ts
// packages/combat-scene/src/view/board-view-context.ts — AÑADIR
export interface DramaturgiaCardViewData {
  readonly dramaturgiaCardId: string; // DramaturgiaCardId
  readonly name: string;
  readonly icon: 'ATTACK' | 'PLOT'; // EnemyAbilityBranch — mapea a CardIconKind 'ATAQUE'|'TRAMA' en apps/shell
  readonly ruleText?: string; // = effectDescription (Gap B ya cubierto para Dramaturgia, no hace falta añadir nada aquí)
  readonly keywords: readonly []; // Dramaturgia no tiene keywords propias hoy — array vacío estable, no undefined
}

export interface BoardViewContext {
  // ...campos existentes...
  /** NUEVO H4.x — todo el `dramaturgiaDeck` del Enemigo activo, resuelto una vez, para que
   *  `apps/shell` pueda resolver `snapshot.enemyActiveDramaturgiaCardId` a sus datos completos sin
   *  acoplar `combat-scene`/`apps/shell` al catálogo crudo (mismo criterio que `leaderCardPool`). */
  readonly enemyDramaturgiaDeck: readonly DramaturgiaCardViewData[];
}
```

`build-combat-setup.ts` añade, junto al bloque de `leaderCardPool`:

```ts
const enemyDramaturgiaDeck: DramaturgiaCardViewData[] = enemy.dramaturgiaDeck.map((card) => ({
  dramaturgiaCardId: card.id,
  name: card.name,
  icon: card.icon,
  ruleText: card.effectDescription,
  keywords: [],
}));
```

`CombatBoardOverlay.tsx` (o un componente hijo nuevo `EnemyDramaturgiaCardSlot.tsx` para no inflar el
overlay ya existente) resuelve:

```ts
const activeCard = snapshot.enemyActiveDramaturgiaCardId
  ? ctx.enemyDramaturgiaDeck.find((c) => c.dramaturgiaCardId === snapshot.enemyActiveDramaturgiaCardId)
  : null;
```

y renderiza `<CardTile card={toCardTileData(activeCard)} size="featured" />` posicionada bajo la
etiqueta "Enemigo" (dentro de `panel-enemy`, dato de posición reutilizado: `ENEMY_POSITION.x`, `y`
calculado con offset propio bajo `ROLE_TEXT_OFFSET_Y` + altura de la fila de datos — Programmer ajusta
el número exacto contra `panel-enemy`'s `PanelZone.height`, que puede necesitar crecer en
`board-layout.ts` si 332px de carta `featured` no cabe hoy en el bounding box de `ENEMY_CONTENT`; ver
§6 para el impacto en `board-layout.ts`). Si `activeCard` es `null` (aún no robó ninguna carta, o IA
deshabilitada) se omite el slot por completo — no se pinta un placeholder vacío.

---

## 4. Animación de jugar carta — reconciliación DOM/Phaser

### 4.1 Decisión

**Las animaciones de jugar carta se implementan en CSS/DOM (transiciones + `@keyframes`), no en
`Phaser.Tweens`.** Esto es la ampliación necesaria del criterio de H4 anterior: aquella pasada asumía
que nada de lo que se anima migra a HTML; ahora una carta SÍ se anima al jugarse Y SÍ vive en HTML —
la resolución es que la animación misma se mueve con el contenido, no que el contenido vuelva a
Phaser. CSS Transitions/`@keyframes` sobre `transform`/`opacity` en un elemento `position: absolute`
dentro de `CombatBoardOverlay` da paridad de calidad con un tween de Phaser (GPU-compositado, sin
jank) para los 2 gestos que hacen falta aquí — no es una degradación.

### 4.2 Ciclo de vida de un `CardTile` de mano al jugarse

1. **Estado normal**: `CardTile` renderizado en su posición de fila (mismo layout de abanico que
   `card-hand-view.ts` ya calculaba con `tileX`/`TILE_SEPARATION_PX` — la lógica de posición NO
   cambia, solo el elemento que se posiciona pasa de `Rectangle`+`Text` de Phaser a un `<div>` HTML
   con `left`/`top` absolutos dentro del mismo sistema de coordenadas virtual de
   `CombatBoardOverlay`).
2. **Tap → comando despachado, motor confirma la jugada** (evento de dominio recibido, ej.
   `CARD_PLAYED`/equivalente ya existente): el `<div>` de esa carta recibe una clase CSS
   `card-tile--playing` que dispara una transición de 280ms (`transform: translateY(-40px) scale(1.08)`
   seguido de `scale(0.85) translateY(120px) opacity(0)`, dos fases vía `@keyframes` con
   `animation-timing-function` tipo `ease-out`) — imita el "elevar y descartar hacia el centro del
   tablero" que un tween de Phaser haría, sin depender de Phaser.
3. **`onAnimationEnd`** (evento nativo DOM, no requiere librería) → el componente padre (el que
   mapea `snapshot.leaderHand` a una lista de `<CardTile>`, ver §6) deja de renderizar ese `CardTile`
   — coincide con que el propio `snapshot.leaderHand` ya no contiene ese `cardId` en cuanto el motor
   confirma, así que React ya lo habría desmontado en el siguiente render; el `onAnimationEnd` solo
   importa si se quiere blindar contra un desmontaje brusco a mitad de animación (usar
   `AnimatePresence`-like manual: mantener el nodo montado hasta que la animación termine incluso si
   ya no está en `leaderHand`, patrón estándar "exit animation" de React sin dependencia nueva —
   guardar el último `cardId` jugado en un `useState` local del contenedor de mano, limpiar en
   `onAnimationEnd`).
4. **Reposicionamiento del resto de la mano**: cuando una carta sale, las restantes deben recalcular
   `tileX` y desplazarse — con CSS esto es gratis si `left` ya usa `transition: left 200ms ease-out`
   en el estado normal del `CardTile` (no solo en `--playing`): al cambiar el prop `style.left`
   (recibido del padre, que recalcula `tileX` contra el nuevo `hand.length`), el navegador anima el
   desplazamiento automáticamente sin JS adicional.

### 4.3 Animación de "lista para jugar"/highlight de dado — mismo mecanismo CSS

Reutilizable para: (a) glow de selección `--foil` en `CardTile`/`AbilityTile` (`selected` prop, §1.4),
(b) pulso de "cooldown listo" en `AbilityTile` (§2). Un único `@keyframes foilPulse` en
`apps/shell/src/index.css` (o un nuevo `apps/shell/src/combat/card/card.css` co-localizado con los 2
componentes):

```css
@keyframes foil-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(212, 162, 76, 0.25); }
  50%      { box-shadow: 0 0 0 6px rgba(212, 162, 76, 0.45); }
}
.card-tile--ready { animation: foil-pulse 1.4s ease-in-out infinite; }
```

---

## 5. Feedback de interacción — estados `AWAITING_*` de `gesture-command-translator.ts`

### 5.1 Gap de arquitectura — hoy `pending` es estado 100% privado de Phaser, invisible a React

`gesture-command-translator.ts` mantiene `pending: PendingSelection` como variable de clausura interna
(`let pending`, línea 51) — nunca se expone fuera de `handleGesture()`. No hay forma hoy de que
`apps/shell` (React) sepa que el jugador está en medio de un targeting. Se necesita un canal de
publicación, análogo a `CombatBridge.subscribeHudEvents` pero para este estado de INTERACCIÓN (no de
dominio — deliberadamente NO se mete en `CombatStateSnapshot`, que es estado de reglas, no de UI).

### 5.2 Nuevo módulo `packages/combat-scene/src/interaction/targeting-signal.ts`

```ts
export type TargetingPrompt =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'AWAITING_ATTACK_TARGET'; readonly cardName: string; readonly validTargetIds: readonly string[] }
  | { readonly kind: 'AWAITING_NUCLEO_FOR_CARD'; readonly cardName: string; readonly validDieIds: readonly string[] }
  | { readonly kind: 'AWAITING_NUCLEO_FOR_ABILITY'; readonly abilityName: string; readonly validDieIds: readonly string[] };

export interface TargetingSignal {
  getState(): TargetingPrompt;
  subscribe(listener: (state: TargetingPrompt) => void): () => void; // Unsubscribe, mismo tipo que CombatBridge
}

export function createTargetingSignal(): { readonly signal: TargetingSignal; setState(next: TargetingPrompt): void };
```

`gesture-command-translator.ts` se modifica para: (1) recibir `targetingSignal` (creado en
`CombatScene.create()`, inyectado igual que `bridge`/`boardContext`), (2) sustituir toda asignación
directa `pending = ...` por una función `setPending(next: PendingSelection)` que además traduce a
`TargetingPrompt` y llama `targetingSignal.setState(...)` — ej. al entrar en
`AWAITING_ATTACK_TARGET`, `validTargetIds` se calcula como `[FOCUS_ID_ENEMY, ...snapshot.minionsInPlay.map(m => m.instanceId)]`
(exactamente el mismo conjunto que `resolveAttackTarget` ya acepta, sin nueva lógica de negocio,
solo exponerlo). `createGestureCommandTranslator` devuelve también `translator.targetingSignal` en su
objeto de retorno.

`CombatScene` guarda `this.targetingSignal = translator.targetingSignal` y expone un getter público
`getTargetingSignal(): TargetingSignal` — mismo patrón de acceso que ya usa `apps/shell` para leer
`boardContext`/`leaderAbilities` desde `buildCombatSetup`, pero esta pieza vive DENTRO de la escena
Phaser (se crea en `create()`, no antes), así que `CombatScreen.tsx` la obtiene tras
`Phaser.Core.Events.READY`:

```ts
game.events.once(Phaser.Core.Events.READY, () => {
  const scene = game!.scene.add('CombatScene', CombatScene, false);
  game!.scene.start('CombatScene', { bridge: newBridge, boardContext });
  setTargetingSignal((scene as CombatScene).getTargetingSignal());
});
```

Nuevo hook `apps/shell/src/combat/use-targeting-prompt.ts`, mismo patrón exacto que
`use-combat-snapshot.ts` (`useState` + `subscribe` en `useEffect`):

```ts
export function useTargetingPrompt(signal: TargetingSignal | null): TargetingPrompt {
  const [state, setState] = useState<TargetingPrompt>(signal?.getState() ?? { kind: 'NONE' });
  useEffect(() => {
    if (!signal) return undefined;
    setState(signal.getState());
    return signal.subscribe(setState);
  }, [signal]);
  return state;
}
```

### 5.3 Banner de prompt — HTML, nuevo componente `TargetingPromptBanner.tsx`

Montado dentro de `CombatHudOverlay` (`CombatScreen.tsx`), justo debajo de `CombatHud` (franja fija
superior) — no dentro de `CombatBoardOverlay` (que vive en coordenadas de viewport virtual escaladas;
el banner de prompt debe ser legible SIEMPRE al mismo tamaño, sin escalar con `Phaser.Scale.FIT`,
igual que `CombatHud` ya está anclado fuera de esa transformación).

```tsx
function TargetingPromptBanner({ prompt, onCancel }: { prompt: TargetingPrompt; onCancel: () => void }): JSX.Element | null {
  if (prompt.kind === 'NONE') return null;
  const label = promptLabelFor(prompt); // helper puro: 'AWAITING_ATTACK_TARGET' → 'Elige un objetivo', etc.
  return (
    <div style={{
      position: 'absolute', top: /* justo bajo CombatHud, altura dinámica de este — ver nota abajo */ 0,
      left: 0, right: 0, zIndex: 5,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: 'rgba(212, 162, 76, 0.16)', borderBottom: `2px solid ${COLOR_FOIL}`,
      padding: `${SPACING.sm}px ${SPACING.md}px`,
      animation: 'foil-pulse-bg 1.6s ease-in-out infinite', // variante de fondo del keyframe de §4.3
    }}>
      <span style={{ ...TYPE.bodyMd, fontWeight: 700, color: COLOR_TEXT_PRIMARY }}>{label}</span>
      <button onClick={onCancel} style={{ ...chipStyle(true), background: 'transparent' }}>
        ✕ Cancelar
      </button>
    </div>
  );
}
```

`promptLabelFor`:

```
AWAITING_ATTACK_TARGET   → "Elige un objetivo para «{cardName}»"
AWAITING_NUCLEO_FOR_CARD → "Elige un Núcleo para «{cardName}»"
AWAITING_NUCLEO_FOR_ABILITY → "Elige un Núcleo para «{abilityName}»"
```

**Nota de posicionamiento**: `CombatHud` es de altura variable (crece con `flex-wrap`, §6 de
`H4_diseno_real_ui.md`). Programmer mide su altura real vía `ref`+`ResizeObserver` (mismo patrón ya
usado por `usePhaserViewportTransform` para el canvas) o, más simple y suficiente para esta historia,
ancla el banner con `position: sticky` dentro del mismo contenedor flex-column que ya envuelve
`CombatHud`, evitando el cálculo manual de altura.

**Botón "Cancelar"**: `onCancel` despacha `targetingSignal.setState({ kind: 'NONE' })` +
`translator`... pero `CombatBoardOverlay`/React no tiene referencia directa al `translator` para
forzar su `pending` interno a `null`. Se añade un método explícito al retorno de
`createGestureCommandTranslator`: `translator.cancelPending(): void` (equivalente a lo que ya ocurre
hoy cuando `handleGesture` recibe un `targetId === null`, línea 200-202 — se extrae esa misma lógica a
una función nombrada reutilizable desde fuera del gesto). `CombatScene` expone también
`getGestureCommandTranslator()` (o, más aislado, `cancelPendingTargeting()` delegando internamente) —
Programmer decide cuál de las dos superficies prefiere, ambas son triviales.

### 5.4 Highlight de objetivos válidos — se queda en Phaser (co-localizado con el sprite que resalta)

Nuevo módulo `packages/combat-scene/src/view/targeting-highlight-view.ts`, construido y suscrito en
`CombatScene.create()` junto al resto de vistas:

```ts
export interface TargetingHighlightView {
  /** Se suscribe directamente a `targetingSignal` (no a `bridge`) —阴 sin relación con snapshots de
   *  dominio, reacciona solo a cambios de `pending`. */
}

export function createTargetingHighlightView(scene: Phaser.Scene, targetingSignal: TargetingSignal): TargetingHighlightView;
```

Al recibir un `TargetingPrompt` distinto de `NONE`, resuelve cada `validTargetIds`/`validDieIds` vía
`scene.children.getByName(id)` (mismo mecanismo de `setName`/`targetId` que
`gesture-command-translator.ts` ya usa para resolver taps) y aplica:

```ts
gameObject.setStrokeStyle(4, 0xd4a24c); // = --foil en hex Phaser
scene.tweens.add({ targets: gameObject, alpha: { from: 1, to: 0.6 }, yoyo: true, repeat: -1, duration: 500 });
```

Al volver a `NONE` (o al reemplazarse por un nuevo prompt), limpia el stroke/tween de los objetos
previamente resaltados (guarda la lista de `gameObject`s activos en una `Set` local, mismo patrón de
"nunca destruye/recrea, solo actualiza in-place" que el resto de `view/*.ts`). Esto cubre exactamente
"resaltado visual sobre los elementos válidos para tocar" del encargo, coherente con el criterio ya
fijado de que highlight/juice de sprites de mesa vive en Phaser, mientras el TEXTO del prompt vive en
HTML (§5.3) — misma línea de separación que el resto de esta spec y de `H4_diseno_real_ui.md` §2.2.

---

## 6. Qué reemplaza esto exactamente en los 3 archivos de `combat-scene/view`

| Archivo | Antes de esta pasada | Después |
|---|---|---|
| `card-hand-view.ts` | Crea/actualiza `Rectangle`+`Text` por carta de mano, calcula `tileX`. | **Se retira por completo del árbol de renderizado de Phaser** — sustituido por un nuevo componente React `HandCardRow.tsx` (`apps/shell/src/combat/card/`) que mapea `snapshot.leaderHand` a `<CardTile size="hand">`, reutilizando literalmente `tileX`/`HAND_ROW_POSITION`/`TILE_SEPARATION_PX` ya exportados de `board-layout.ts` (mismas coordenadas, ahora consumidas por CSS `left/top` dentro de `CombatBoardOverlay` en vez de por `rect.setPosition`). El módulo `card-hand-view.ts` se elimina; `cardTileName()` deja de ser necesario para Phaser pero SIGUE existiendo (movido a `apps/shell` o mantenido en `combat-scene` y reexportado) porque `gesture-command-translator.ts` sigue necesitando un `targetId` estable — la diferencia es que ese `targetId` ahora corresponde a un `data-card-id` de un `<div>` HTML, no a un `GameObject.name` de Phaser (ver nota de input abajo). |
| `ability-cooldown-view.ts` | Crea/actualiza `Rectangle` (barra CD) + `Rectangle` (fondo) + `Text` por habilidad. | **Se retira por completo.** Sustituido por `AbilityRow.tsx` (React) que mapea `ctx.leaderAbilities`/`ctx.enemyAbilities` a `<AbilityTile>`. Mismo razonamiento de `targetId`/input que arriba. |
| `role-view.ts` | Mantiene el `Rectangle` de rol (H4 anterior ya retiró su `Text`). | **Sin cambio adicional** — el `Rectangle` de rol sigue en Phaser (recibe screen-shake/flash de daño, sigue siendo el objetivo de tap para "atacar al Enemigo", `FOCUS_ID_ENEMY`). Lo que se AÑADE junto a él es el nuevo slot HTML de carta de Dramaturgia (§3.3), que vive en `CombatBoardOverlay`, no en `role-view.ts`. |

### 6.1 Consecuencia importante — el gesto de tap migra de Phaser `Pointer` events a DOM `onClick`

Hoy `InputAdapter`/`gesture-command-translator.ts` reciben el tap vía el sistema de input de Phaser
(`rect.setInteractive()`), resolviendo `targetId` desde `GameObject.getData('targetId')`. Al mover
`CardTile`/`AbilityTile` a HTML, **el tap real en una carta de mano o un icono de habilidad deja de
pasar por `InputAdapter`** — pasa a ser un `onClick` DOM nativo de React. Esto es un cambio de
arquitectura de input no trivial que Programmer debe resolver así:

- `CardTile`/`AbilityTile` con `onTap` definido llaman directamente a una función expuesta por
  `GestureCommandTranslator` en vez de depender de `PointerGesture`/`InputAdapter` para ESTE tipo de
  objetivo. Se añade al contrato de `GestureCommandTranslator`:
  ```ts
  export interface GestureCommandTranslator {
    handleGesture(gesture: PointerGesture): void; // sin cambio — sigue resolviendo taps de Phaser (rol, dado, Secuaz)
    handleCardTap(cardId: CardId): void; // NUEVO — invocado directo desde CardTile.onClick (React)
    handleAbilityTap(abilityId: AbilityId): void; // NUEVO — invocado directo desde AbilityTile.onClick
  }
  ```
  Internamente reutilizan exactamente `dispatchForCard`/`handleAbilityTap` ya existentes (renombrar la
  función privada actual `handleAbilityTap` si colisiona de nombre con el método público nuevo).
- Los taps que SIGUEN dentro del canvas (rol Líder/Enemigo, Secuaz en mesa, dado de Núcleo) **no
  cambian** — siguen resolviéndose vía `InputAdapter`/`PointerGesture` normal, porque esos sprites
  siguen siendo Phaser. `handleGesture` sigue siendo el punto de entrada para esos 3 tipos de target
  Y para resolver los estados `AWAITING_ATTACK_TARGET`/`AWAITING_NUCLEO_FOR_*` (que apuntan a rol/
  Secuaz/dado — todos siguen en Phaser).
- `CombatScreen.tsx`/el nuevo `HandCardRow.tsx`/`AbilityRow.tsx` reciben el `GestureCommandTranslator`
  (o una interfaz reducida `{ handleCardTap, handleAbilityTap }`) inyectado desde `CombatScene` igual
  que `targetingSignal` (§5.2) — mismo mecanismo de exposición vía getter público post-`READY`.

---

## 7. Mockup — pantalla de combate con los 3 elementos nuevos (retrato, viewport virtual 1080×1920)

```
┌──────────────────────────────────────────────┐
│ CombatHud (sin cambio, H4 anterior)            │
├──────────────────────────────────────────────┤
│ ░░░ Elige un objetivo para «Golpe Certero» ░░░│ ← TargetingPromptBanner, fondo foil translúcido
│                                          [✕ Cancelar]
├──────────────────────────────────────────────┤
│  ENEMIGO                                       │
│  Bestia Base    ♥14/20   Fase 1/2              │
│                [Rectangle 200×200, Phaser]      │ ← con glow --foil pulsante si es objetivo válido
│                                                  │
│   ┌──────────────────────┐                     │
│   │📜                [⚫] │  ← CardTile "featured" (Dramaturgia activa), sin coste visible (badge oculto)
│   │  Avance de las Sombras│
│   │ ──────────────────── │
│   │ La Bestia gana Trama  │
│   │ +2 este turno.        │
│   └──────────────────────┘                     │
├──────────────────────────────────────────────┤
│  ... Secuaces / Escenario / Aliados / Núcleos  │
│  (Núcleo con glow --foil si AWAITING_NUCLEO_*) │
├──────────────────────────────────────────────┤
│  MANO                                           │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐                │
│  │⚔️⚡2││🛡️⚡1││🤝⚡3││⏪⚡0││⚔️⚡4│  ← CardTile "hand" ×5-7, abanico
│  │Golpe││Escudo││Aliado││Rebobinar││Furia│      
│  └────┘└────┘└────┘└────┘└────┘                │
├──────────────────────────────────────────────┤
│  LÍDER  ... (Rectangle Phaser + AbilityTile×4) │
└──────────────────────────────────────────────┘
```

---

## 8. Resumen de archivos por sección

```
apps/shell/src/combat/card/
  CardTile.tsx                        # NUEVO §1
  AbilityTile.tsx                     # NUEVO §2
  card-icon.ts                        # NUEVO §1 — cardIconFor, CARD_ICON_GLYPH
  keyword-label.ts                    # NUEVO §1.4 — traducción KeywordId → texto legible
  card.css                            # NUEVO §4.3 — @keyframes foil-pulse, card-tile--playing
  HandCardRow.tsx                     # NUEVO §6 — sustituye card-hand-view.ts, exit-animation state
  AbilityRow.tsx                      # NUEVO §6 — sustituye ability-cooldown-view.ts
  EnemyDramaturgiaCardSlot.tsx        # NUEVO §3.3
  TargetingPromptBanner.tsx           # NUEVO §5.3
  use-targeting-prompt.ts             # NUEVO §5.2

apps/shell/src/ui/design-tokens.ts    # MODIFICADO — +CARD_TYPE_COLORS (§1.2)
apps/shell/src/combat/CombatBoardOverlay.tsx  # MODIFICADO — monta EnemyDramaturgiaCardSlot (§3.3)
apps/shell/src/screens/CombatScreen.tsx       # MODIFICADO — obtiene targetingSignal/translator tras READY (§5.2/§6.1), monta TargetingPromptBanner

packages/combat-scene/src/interaction/
  targeting-signal.ts                 # NUEVO §5.2
  gesture-command-translator.ts       # MODIFICADO — setPending() centralizado, handleCardTap/handleAbilityTap públicos, cancelPending() (§5.2/§6.1)

packages/combat-scene/src/view/
  card-hand-view.ts                   # ELIMINADO (§6)
  ability-cooldown-view.ts            # ELIMINADO (§6)
  role-view.ts                        # SIN CAMBIO (§6)
  targeting-highlight-view.ts         # NUEVO §5.4
  board-view-context.ts               # MODIFICADO — +DramaturgiaCardViewData, +enemyDramaturgiaDeck (§3.3)
  board-layout.ts                     # POSIBLE AJUSTE — panel-enemy puede necesitar crecer para alojar CardTile featured 332px (§3.3)

packages/combat-scene/src/scenes/CombatScene.ts
                                       # MODIFICADO — construye targetingSignal, expone getTargetingSignal()/getGestureCommandTranslator() (§5.2/§5.3/§6.1)

packages/domain/combat/src/types/snapshot.ts
                                       # MODIFICADO — +enemyActiveDramaturgiaCardId (§3.2 Gap A)
packages/domain/combat/src/combat-engine.ts
                                       # MODIFICADO — asigna this.activeDramaturgiaCardId al robar Dramaturgia (§3.2 Gap A)
packages/domain/catalog/src/types/card.ts
                                       # MODIFICADO — +ruleText?: string (§3.2 Gap B)
packages/domain/catalog/src/types/ability.ts
                                       # MODIFICADO — +ruleText?: string (§3.2 Gap B)
apps/shell/src/combat/build-combat-setup.ts
                                       # MODIFICADO — pobla keywords/ruleText en HandCardViewData, enemyDramaturgiaDeck (§3.3)
packages/combat-scene/src/view/board-view-context.ts (HandCardViewData)
                                       # MODIFICADO — +keywords, +ruleText (§1)
```

---

## 9. Orden de implementación recomendado

1. **§3.2 Gap A + Gap B (datos de dominio/catálogo)** — sin esto nada de lo demás tiene contenido real
   que mostrar; es aditivo y de bajo riesgo, debe ir primero para no bloquear el resto en paralelo.
2. **§1 `CardTile` + §1.2 tokens de color.** Componente más importante del encargo, valida el sistema
   de layout de carta antes de replicarlo en `AbilityTile`.
3. **§6.1 Cableado de input (`handleCardTap`/`handleAbilityTap`).** Riesgo técnico real (cambio de
   arquitectura de input de Phaser-pointer a DOM-onClick) — debe cerrarse antes de montar
   `HandCardRow`/`AbilityRow` en producción o la mano se verá pero no reaccionará a taps.
4. **§6 migración de `card-hand-view.ts`/`ability-cooldown-view.ts`.**
5. **§3.3 Carta de Dramaturgia del Enemigo.** Depende de §3.2 Gap A ya cerrado.
6. **§5 Targeting signal + banner + highlight.** Puede ir en paralelo a 2-5 una vez cerrado §6.1 (usa
   el mismo mecanismo de exposición post-`READY`).
7. **§4 Animaciones CSS de jugar carta.** Última pieza, puramente de pulido visual sobre un
   `CardTile` ya funcional.

---

## 10. Fuera de alcance explícito

- Arte real de cartas/iconos — el `CARD_ICON_GLYPH` Unicode/emoji sigue siendo sustituto temporal
  (igual que el resto del proyecto, `H4_diseno_real_ui.md` §11).
- Relleno de contenido `ruleText` para las 26 cartas/8 habilidades del catálogo 2×2×2 actual — tarea
  de contenido para Coordinator/backlog, no de este documento de arquitectura (§3.2 Gap B lo señala
  como deuda explícita).
- Rediseño de mecánicas de combate — cero cambios de regla; `enemyActiveDramaturgiaCardId` es un
  campo de lectura, nunca influye en ninguna decisión del motor.
- Drag-and-drop de cartas (arrastrar para jugar en vez de tap) — el encargo pide feedback de tap,
  no un nuevo modelo de gesto; `PointerGesture` ya soporta `DRAG_*` pero `gesture-command-translator.ts`
  los ignora deliberadamente (línea 136) y esta pasada no lo cambia.
