# H4 — HUD compacto para viewports móviles estrechos (fix altura de `CombatHud`)

## 0. Origen

Captura real del Director Creativo (rama `main`, commit `039c5c6`, móvil portrait) — el header de
combate (`CombatHud.tsx`, montado en `.combat-screen-header`, `CombatScreen.css`) ocupa ~1/3 de la
altura del viewport, dejando el tablero real (Enemigo/Secuaces/Escenario/Aliados/Núcleos/Mano/Líder)
aplastado en el resto. Cita: *"es tan poco jugable"*.

Causa raíz confirmada por revisión de código: `89bca10` cambió `.combat-screen-header` de
`position: absolute` (superpuesto, sin coste de espacio) a una fila real de `flex column` que
reserva su propio alto — correcto para el bug de clics fantasma que resolvía, pero el tamaño de
`CombatHud` (`apps/shell/src/combat/CombatHud.tsx`) nunca se diseñó con un límite de altura: se
construyó y probó solo en viewports de escritorio anchos, donde el ancho sobrante permite que las 2
filas de botones (`combat-hud-free-step`, `combat-hud-actions`) quepan en una sola línea cada una.
En un viewport estrecho (390px), esas filas envuelven (`flexWrap: 'wrap'`) a 2 líneas cada una,
duplicando su alto — de ahí el tercio de pantalla.

Este documento NO introduce un sistema de diseño nuevo — reutiliza los tokens de
`apps/shell/src/ui/design-tokens.ts` / `tokens.css` (H4_diseno_real_ui.md §1.2/§1.3) y el patrón ya
existente de variables CSS en `:root` (`tokens.css`), extendiéndolo con variables locales
redefinibles por `@media`. Es el primer uso de `@media` en el proyecto (no había ninguno hasta
ahora) — se documenta explícitamente porque `CombatHud.tsx` es 100% estilo inline hoy y necesita este
puente CSS-vars para poder responder a `@media` sin reescribirse a CSS Modules.

## 1. Objetivo de altura

**El header (`.combat-screen-header`, contenido = `CombatHud` + `TargetingPromptBanner`) no debe
superar el 18% de `100dvh` en el breakpoint compacto**, medido en el viewport de referencia
**390×844** (iPhone 12/13/14 — clase de dispositivo más común hoy). Objetivo de diseño: **≈110-120px
(13-14% de 844px)**, dejando margen bajo el tope duro de 18% (≈152px) para cuando
`TargetingPromptBanner` también esté visible (se porta al mismo `.combat-screen-header`, ver
`CombatScreen.tsx`/`CombatScreen.css` §comentario "Fila superior").

## 2. Breakpoint

```css
@media (max-width: 480px) { ... }
```

480px cubre el rango real de teléfonos en portrait (iPhone SE 375 → gama alta Android 428) con
margen; no toca tablets/desktop. Un único breakpoint, sin escalones intermedios — el objetivo es
resolver el caso roto de la captura, no construir un sistema fluido de N tamaños (YAGNI, coherente
con el resto del proyecto, que tampoco tiene escalones intermedios en ningún otro componente).

## 3. Mecanismo: variables CSS locales en vez de reescribir a CSS Modules

`CombatHud.tsx` es hoy 100% `style={{ ... }}` inline (spread de `TYPE.*`, `SPACING.*`, etc. de
`design-tokens.ts`). Un inline style siempre gana de especificidad sobre una regla CSS normal
(incluso una que lo siga en el cascade), así que un `@media` en `CombatScreen.css` **no puede**
sobreescribir directamente esos `padding`/`fontSize` con overrides CSS clásicos.

Solución (mismo patrón que `tokens.css` ya usa para `--space-*`/`--radius-*`, extendido a nivel de
componente): definir variables CSS **con scope en `.combat-hud`**, con valores por defecto
(desktop/tablet, IGUALES a los literales actuales) y redefinirlas dentro del `@media` — el inline
style de React referencia esas variables vía `var(--nombre)`, así que el navegador SÍ puede
recalcularlas cuando cambia el media query, sin que la especificidad del inline entre en juego (el
inline sigue "ganando", pero lo que gana es `var(--x)`, cuyo valor final sí depende del CSS externo).

### 3.1 Nuevo bloque en `CombatScreen.css` (añadir, no reemplaza nada existente)

```css
/* H4 — HUD compacto móvil. Variables consumidas por CombatHud.tsx vía var(...) en sus inline
 * styles — ver spec H4_hud_compacto_movil.md §3. Valores por defecto = literales actuales
 * (SPACING.md/sm/xs, TYPE.displaySm/bodyMd/labelUpper, TYPE.dataLg), sin cambio de comportamiento
 * fuera del breakpoint compacto. */
.combat-hud {
  --hud-padding-v: 16px;       /* = SPACING.md */
  --hud-padding-h: 16px;       /* = SPACING.md */
  --hud-gap: 8px;              /* = SPACING.sm */
  --hud-title-size: 20px;      /* = TYPE.displaySm.fontSize */
  --hud-counter-size: 22px;    /* = TYPE.dataLg.fontSize */
  --hud-label-size: 12px;      /* = TYPE.labelUpper.fontSize */
  --hud-chip-padding-v: 4px;   /* = SPACING.xs, igual que chip-style.ts */
  --hud-chip-padding-h: 8px;   /* = SPACING.sm, igual que chip-style.ts */
  --hud-chip-font-size: 15px;  /* = TYPE.bodyMd.fontSize */
}

@media (max-width: 480px) {
  .combat-hud {
    --hud-padding-v: 4px;      /* SPACING.xs */
    --hud-padding-h: 8px;      /* SPACING.sm */
    --hud-gap: 4px;            /* SPACING.xs */
    --hud-title-size: 15px;
    --hud-counter-size: 16px;
    --hud-label-size: 10px;
    --hud-chip-padding-v: 2px;
    --hud-chip-padding-h: 6px;
    --hud-chip-font-size: 12px;
  }
}
```

### 3.2 Cambios en `CombatHud.tsx` (referenciar las variables, sin tocar `chip-style.ts`)

`chip-style.ts` se mantiene TAL CUAL (sigue siendo la fuente de verdad de color/borde/cursor de un
chip, reusado también por `CombatLogPanel` — el footer no necesita cambios, ver §5). En
`CombatHud.tsx`, sobre CADA botón/chip de las filas `combat-hud-free-step` y `combat-hud-actions`
(y sobre el botón "Fin de turno"), añadir un pequeño objeto de override de `padding`/`fontSize` DESPUÉS
del spread de `enabledStyle`/`disabledStyle` (el que va después gana en un `style={{...a, ...b}}`):

```ts
const compactChipOverride = { padding: 'var(--hud-chip-padding-v) var(--hud-chip-padding-h)', fontSize: 'var(--hud-chip-font-size)' };
```

y aplicarlo así: `style={{ ...(canFreeDraw ? enabledStyle : disabledStyle), ...compactChipOverride }}`
en los 6 controles existentes (2 del paso previo, 4 de acciones pagadas) + "Fin de turno".

Resto de cambios puntuales en `CombatHud.tsx`:
- Contenedor raíz (`className="combat-hud"`, ya existe): `padding: 'var(--hud-padding-v) var(--hud-padding-h)'`, `gap: 'var(--hud-gap)'` en vez de `SPACING.md`/`SPACING.sm` literales.
- Fila 1 (nombre + contador de acciones): `leaderName` span → `fontSize: 'var(--hud-title-size)'` (spread `TYPE.displaySm` y sobreescribir `fontSize` después); contador de acciones → `fontSize: 'var(--hud-counter-size)'` sobre `TYPE.dataLg`; etiqueta "Acciones" → `fontSize: 'var(--hud-label-size)'` sobre `TYPE.labelUpper`.
- Fila "Paso previo" (`combat-hud-free-step`): `gap: 'var(--hud-gap)'`, `padding: 'var(--hud-padding-h)'` en el box con borde punteado; label → `fontSize: 'var(--hud-label-size)'`.
- Fila de acciones pagadas (`combat-hud-actions`): `gap: 'var(--hud-gap)'`.

## 4. Textos compactos (evitar el wrap que hoy dobla la altura de cada fila)

En el breakpoint compacto, además de reducir padding/fuente, se acortan las etiquetas para que las
filas quepan en una sola línea a 390px de ancho (358px útiles tras el padding del header). Esto
requiere texto CONDICIONAL en JS (no solo CSS) — se resuelve con un hook mínimo, coherente con no
tener aún ningún `matchMedia` en el proyecto: un hook nuevo y pequeño, reutilizable.

**Nuevo módulo `apps/shell/src/combat/use-is-compact-viewport.ts`:**

```ts
/** true cuando window.innerWidth <= 480 (mismo breakpoint que .combat-hud en CombatScreen.css,
 *  MISMO valor, mantener sincronizados). Solo gobierna qué TEXTO se renderiza (los tamaños/paddings
 *  ya responden vía CSS var(), ver H4_hud_compacto_movil.md §3) — evita duplicar lógica de layout
 *  en JS que el CSS ya resuelve. */
export function useIsCompactViewport(): boolean;
```

Implementación esperada (Programmer): `useState` inicializado desde `window.innerWidth <= 480`
+ listener de `resize` con cleanup en `useEffect`, mismo patrón estándar de hook de viewport que
`use-phaser-viewport-transform.ts` ya usa para medir tamaño real (reutilizar su estilo de
suscripción/cleanup, no inventar uno nuevo).

**Textos por control** (`compact` = `useIsCompactViewport()` es `true`):

| Control | Texto normal (actual) | Texto compacto |
|---|---|---|
| Paso previo — label | "Paso previo (gratis)" | "Gratis" |
| Paso previo — robar | "Robar carta (gratis)" | "Robar" |
| Paso previo — energía | "Generar energía (gratis)" | "+1 Energía" |
| Acción pagada — indicador | "Jugar Carta" | "Carta" |
| Acción pagada — indicador | "Activar Habilidad" | "Habilidad" |
| Acción pagada — botón | "Generar Energía" | "Energía" |
| Acción pagada — botón | "Robar Carta" | "Robar" |
| Botón inferior | "Fin de turno" | "Fin de turno" (sin cambio — ya es corto, una sola fila completa) |

Nota: "Robar" aparece en ambas filas (gratis y pagada) — no es ambiguo porque las dos filas ya son
visualmente distintas hoy (borde punteado `--rule` + label "Gratis" a la izquierda vs. fila sólida
sin label), mismo criterio de distinción que ya existía con el sufijo "(gratis)" completo.

## 5. Footer (`CombatLogPanel` colapsado) — revisado, NO requiere cambios

`apps/shell/src/combat/log/CombatLogPanel.tsx`, estado colapsado (el que se ve en la captura):
`minHeight: 36`, padding `${SPACING.xs}px ${SPACING.md}px` (4px/16px), una sola línea de texto
(`TYPE.bodySm`, 13px) truncada. En viewport 390×844, esto son ~36-40px reales — **≈4.5% de la
altura**, muy por debajo de cualquier umbral problemático. Confirmado: el footer NO es parte de este
problema y no se toca. (El estado EXPANDIDO pasa a `position: fixed`, overlay temporal iniciado por
el jugador — comportamiento ya correcto e intencional, fuera de alcance.)

## 6. Mockup ASCII — header compacto en 390×844 (ancho útil 358px tras padding 8px/lado)

```
┌──────────────────────────────────────────────┐  ← 100dvh = 844px
│ SOLDADO BASE              3/2  ACCIONES       │  15px / 16px, ~20px alto
│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│┊ Gratis  [Robar]  [+1 Energía]               ┊│  ~22px alto (1 línea)
│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│ [Carta] [Habilidad] [Energía] [Robar]         │  ~22px alto (1 línea)
│ [           Fin de turno            ]         │  ~22px alto
├──────────────────────────────────────────────┤  ← total header ≈ 110-120px (~14%)
│                                                │
│                (tablero de juego,             │
│           Enemigo/Secuaces/Escenario/          │
│         Aliados/Núcleos/Mano/Líder)            │
│                                                │
│           ← ahora ~82% de la pantalla →        │
│                                                │
├──────────────────────────────────────────────┤
│ Registro de combate...                         │  ~36-40px (~4.5%), sin cambios
└──────────────────────────────────────────────┘
```

Antes del fix: header ≈250-280px (~30-33%, coincide con "un tercio" reportado) por el wrap a 2
líneas en `combat-hud-free-step` y `combat-hud-actions` con el texto largo actual.

## 7. Criterio de aceptación (para QA)

1. En 390×844 (o el emulador de móvil equivalente de las DevTools), la altura real renderizada de
   `.combat-screen-header` (incluye `CombatHud`; incluye `TargetingPromptBanner` si está visible) no
   supera **152px (18% de 844px)**; objetivo de diseño 110-120px.
2. Ninguna fila de `combat-hud-free-step` / `combat-hud-actions` envuelve a una segunda línea en
   390px de ancho de viewport.
3. En viewports ≥481px (desktop, tablet), el header se ve exactamente igual que antes de este fix —
   cero regresión visual fuera del breakpoint (los valores por defecto de las variables CSS son
   idénticos a los literales previos).
4. El footer (`CombatLogPanel` colapsado) no cambia de tamaño en ningún viewport — confirmado fuera
   de alcance en §5.

## 8. Investigación — rectángulo gris junto al tile del Líder

**Conclusión: es un bug real (opción b), no un frame de animación de mala suerte.** Causa raíz
identificada con precisión de línea:

- `packages/combat-scene/src/juice/recipes/placeholder.ts` — `CARD_HAND_POSITION = { x: 540, y:
  1474 }` (línea 35) está a solo 202px del centro de `LEADER_POSITION = { x: 540, y: 1676 }`
  (`packages/combat-scene/src/view/board-layout.ts` línea 21). El tile de carta mide 120×180
  (`CARD_PLACEHOLDER_HEIGHT`) y el tile del Líder 200×200 — sus bounding boxes casi se tocan
  verticalmente (borde inferior de la carta en 1474+90=1564, borde superior del Líder en
  1676-100=1576 — 12px de separación real, prácticamente pegados). Esto coincide exactamente con
  la posición del rectángulo gris de la captura: "pegado al tile del Líder, justo encima de la
  etiqueta LÍDER".
- `packages/combat-scene/src/juice/recipes/card-flip.ts` (`cardFlip` recipe), líneas 33-70:
  `resolveOrCreateCardPlaceholder(scene, target.focusId)` crea un `Rectangle` gris
  (`CARD_BACK_COLOR = 0x808080`, mismo gris que reporta la captura) en `CARD_HAND_POSITION` cuando
  `focusId` no es uno de los 3 roles fijos (Líder/Enemigo/Escenario). Al terminar la animación,
  `isEphemeral = target.focusId === undefined` decide si se destruye (línea 35, 59-60): si es
  `false` (hay un `focusId`), el placeholder **NO se destruye** — solo se le restaura el color
  original (línea 62-64), y se queda con nombre asignado (`setName`, `placeholder.ts` línea 106)
  para siempre en la escena.
- El evento `CARD_PLAYED` (`effects-director.ts` línea 26-27) resuelve `focusId: event.sourceId` —
  **siempre un ID definido** (el `cardInstanceId` real de la carta jugada), nunca `undefined`. Por
  tanto, cada vez que el jugador (o el Enemigo, vía `CONTRATIEMPO_PLAYED`, misma resolución en la
  línea 28-29) juega una carta de la mano, `cardFlip` crea un placeholder gris nombrado con ese
  `sourceId` en `CARD_HAND_POSITION` y **lo deja huérfano permanentemente** tras el flip — el motivo
  de `isEphemeral` (no destruir el placeholder de un objeto que SÍ persiste en mesa, ej. un Aliado
  invocado vía `ALLY_ENTERED_PLAY`/`MINION_SUMMONED`, reutilizado luego por `allies-view.ts`/
  `minions-view.ts` en cada `syncFromSnapshot`) NO aplica a una carta jugada desde la mano: una vez
  resuelta, la carta SALE de la mano (al descarte/mesa según su tipo) y no tiene ningún slot visual
  persistente que la reutilice — nada vuelve a nombrar ni destruir ese rectángulo después. El
  resultado es un tile gris fantasma acumulado en `CARD_HAND_POSITION`, exactamente pegado al tile
  del Líder, cada vez que se juega una carta (Evento/Ataque/Contratiempo) — que es justo lo que se
  ve en la captura del Director Creativo.

### Fix propuesto (para Programmer, no implementado aquí)

En `card-flip.ts`, la condición de destrucción no debe depender solo de `focusId === undefined`
(“¿hay nombre?”) sino de si el EVENTO representa algo que persiste en mesa. Reutilizar
`target.event.type` (ya disponible en `JuiceTarget`, ver `effects-director.ts` línea 16-52,
`resolveJuiceTarget`): destruir el placeholder al terminar el flip también cuando
`target.event.type === 'CARD_PLAYED'` o `target.event.type === 'CONTRATIEMPO_PLAYED'` (una carta
jugada desde la mano nunca tiene slot visual persistente, a diferencia de `ALLY_ENTERED_PLAY`/
`MINION_SUMMONED`, que sí). Sugerencia de condición reemplazando la línea 35:

```ts
const isEphemeral =
  target.focusId === undefined ||
  target.event.type === 'CARD_PLAYED' ||
  target.event.type === 'CONTRATIEMPO_PLAYED';
```

No cambia nada del comportamiento de `ALLY_ENTERED_PLAY`/`MINION_SUMMONED` (siguen sin destruirse,
correcto — esos sí persisten). No requiere tocar `placeholder.ts` ni `board-layout.ts`. Añadir
cobertura en `card-flip.test.ts`: tras un evento `CARD_PLAYED`, el placeholder nombrado con
`sourceId` debe quedar destruido (`destroy()` invocado) al resolver la promesa de `cardFlip.play`.

## 9. Resumen de archivos a tocar (Programmer)

- `apps/shell/src/screens/CombatScreen.css` — nuevo bloque §3.1 (variables + `@media`).
- `apps/shell/src/combat/CombatHud.tsx` — consumir `var(--hud-*)` en los estilos inline listados en
  §3.2; textos condicionales de §4 vía `useIsCompactViewport()`.
- `apps/shell/src/combat/use-is-compact-viewport.ts` — nuevo hook, §4.
- `packages/combat-scene/src/juice/recipes/card-flip.ts` — fix del rectángulo gris huérfano, §8.
- `packages/combat-scene/src/juice/recipes/card-flip.test.ts` — nueva cobertura del fix.
- Sin cambios: `apps/shell/src/combat/chip-style.ts`, `apps/shell/src/combat/log/CombatLogPanel.tsx`
  (footer confirmado fuera de alcance, §5), `packages/combat-scene/src/juice/recipes/placeholder.ts`,
  `packages/combat-scene/src/view/board-layout.ts`.
