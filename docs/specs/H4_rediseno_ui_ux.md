# H4 — Rediseño de UI/UX: popup de selección, paneles de combate, indicador de turno, HUD

> Spec del Architect que traduce a diseño técnico el feedback del Director Creativo tras jugar la
> build desplegada (`.ai-studio/memory/decisions.md`, entrada implícita de hoy vía la orden de
> trabajo — cita textual: *"el feeling no me gusta... no es usable"*) y las historias E4/H4.1-H4.4
> ya creadas por Coordinator en `.ai-studio/memory/backlog.md`. Referencia de "feel" ya fijada en
> `vision.md`/`decisions.md` 2026-07-05 y 2026-07-06 (forcetable.net/strawtable.net, prioridad
> explícita del feel del combate). **Sin cambios de mecánicas** — todo lo que sigue es capa visual
> sobre un `CombatStateSnapshot`/`CombatEvent` ya cerrados y estables. El Programmer implementa
> contra esto sin ambigüedad; no hay código final de producto en este documento, solo firmas,
> tablas de constantes y contratos.

Estado del repo al momento de escribir esta spec: H1-H3 completos (incluye H3.6, paso previo de
turno, y H3.7/H3.8 targeting). La capa visual de combate (`packages/combat-scene/src/view/*`)
existe y funciona; el problema reportado NO es de lógica sino de contraste/jerarquía/feedback. La
pantalla de inicio de run (`apps/shell/src/screens/RunStartScreen.tsx`) es hoy un selector de
**testeo/desarrollo** con 2 opciones fijas por categoría (Líder/Enemigo/Escenario) — el sorteo real
3+3 de `decisions.md` 2026-07-05 ("El sorteo cruza, el jugador ordena") **no está implementado
todavía** (no hay ningún código de pool/sorteo en `apps/shell/src/combat/*`, ver §1.5 más abajo).
Esta spec rediseña el selector que existe HOY (el que el Director Creativo vio y calificó de "no
usable"), sin inventar el sorteo 3+3 — eso es una historia futura separada, fuera de alcance aquí.

---

## 0. Resumen de archivos por sección

```
apps/shell/src/
  ui/design-tokens.ts                      # NUEVO — paleta/spacing/tipografía compartidos (E4.1 + E4.4)
  screens/run-start/SelectionCard.tsx      # NUEVO
  screens/run-start/SelectionSection.tsx   # NUEVO
  screens/run-start/RunStartModal.tsx      # NUEVO
  screens/run-start/to-selection-option.ts # NUEVO — adapta LeaderOption/EnemyOption/ScenarioOption
  screens/RunStartScreen.tsx                # MODIFICADO — pasa a ser host delgado del modal
  combat/CombatHud.tsx                      # MODIFICADO — E4.4, tokens + tooltips + contador de acciones

packages/combat-scene/src/view/
  board-layout.ts                           # MODIFICADO — +PANEL_ZONES, +paleta de panel
  board.ts                                  # MODIFICADO — dibuja paneles antes que las etiquetas de zona
  panel-view.ts                             # NUEVO — createPanels(scene), aislado de board.ts por claridad

packages/combat-scene/src/juice/
  juice-config.ts                           # MODIFICADO — TURN_ENDED: [{ recipeId: 'turnBanner', ... }]
  effects-director.ts                        # MODIFICADO — case explícito 'TURN_ENDED' en resolveJuiceTarget
  recipes/turn-banner.ts                     # NUEVO — receta de banner de cambio de turno
  recipes/index.ts                           # MODIFICADO — registra 'turnBanner'
```

---

## 1. E4.1 — `RunStartModal`: popup de selección de Líder/Enemigo/Escenario

### 1.1 Decisión de UX: un único popup con 3 secciones, no pasos secuenciales

Se elige **un solo modal con 3 secciones apiladas** (Líder → Enemigo → Escenario, cada una una fila
horizontal de tarjetas) en vez de un wizard de pasos secuenciales, por 3 razones concretas:

1. **El dato real hoy es 2 opciones por categoría** (`LEADER_OPTIONS`, `ENEMY_OPTIONS`,
   `SCENARIO_OPTIONS`, todas de longitud 2). Un wizard de "Líder → Enemigos/Escenarios → vista
   previa → inicio" (la redacción literal de H4.1 en backlog.md, pensada para el sorteo 3+3 futuro)
   añade fricción de navegación (más taps, más animaciones de transición) sin ningún beneficio con
   solo 2 opciones visibles por paso — todas caben en pantalla sin scroll.
2. **No hay sorteo que previsualizar todavía** (§0 arriba) — el paso "vista previa del sorteo" de
   H4.1 no tiene datos que mostrar hasta que exista esa historia futura. Incluirlo ahora sería
   construir UI contra un dato que no existe.
3. **Un solo popup resuelve el 100% de la queja concreta del Director** ("me gustaría que la
   elección fuera en un popup") sin sobre-construir. Cuando llegue el sorteo 3+3 real, el mismo
   *shell* del modal (overlay + panel + footer, §1.3) se reutiliza — solo cambia el contenido
   interior por un flujo de pasos; `RunStartModal` ya aísla "contenido de selección" de "cromo del
   modal" para que ese cambio futuro no toque el overlay/panel.

### 1.2 Sistema de diseño — `apps/shell/src/ui/design-tokens.ts` (NUEVO)

Paleta coherente con la ya fijada para combate en `decisions.md`/backlog.md H4 (base oscura,
paneles ~#222-#333, texto claro, acentos temáticos) — mismo lenguaje visual en ambas pantallas para
que la transición Run Start → Combate se sienta parte del mismo juego:

```ts
// Fondo de página — degradado radial, nunca negro plano sin variación (causa raíz de la queja).
export const COLOR_PAGE_BACKGROUND =
  'radial-gradient(circle at 50% 15%, #1c1c28 0%, #0a0a0c 70%)';

export const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.72)';       // backdrop detrás del panel modal
export const COLOR_MODAL_PANEL = '#1e1e24';                 // panel del popup
export const COLOR_MODAL_BORDER = '#3a3a42';
export const COLOR_CARD_BG = '#2a2a32';
export const COLOR_CARD_BG_SELECTED = '#34343f';
export const COLOR_CARD_BORDER = '#44444e';
export const COLOR_CARD_BORDER_SELECTED_PREFIX = '#'; // ver accentColor por tarjeta, §1.4

export const COLOR_TEXT_PRIMARY = '#f5f5f5';
export const COLOR_TEXT_SECONDARY = '#a0a0a8';
export const COLOR_TEXT_DISABLED = '#5c5c66';

// Acentos temáticos — MISMOS valores hex que `NUCLEO_COLOR_HEX` de
// `packages/combat-scene/src/view/nucleo-colors.ts` en notación CSS, para que el jugador asocie
// visualmente "colores de dado" entre Run Start y Combate sin duplicar una paleta nueva sin
// relación. Reutilizados aquí como acentos decorativos de tarjeta (round-robin, §1.4), no como
// dato de dominio.
export const ACCENT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'] as const;

export const FONT_FAMILY = "'Segoe UI', system-ui, -apple-system, sans-serif"; // sin fuente nueva a cargar
export const FONT_SIZE_TITLE = '24px';
export const FONT_SIZE_SECTION_TITLE = '16px';
export const FONT_SIZE_CARD_LABEL = '16px';

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const RADIUS_MODAL = 20;
export const RADIUS_CARD = 12;
export const MIN_TAP_TARGET_PX = 44; // criterio de aceptación H4.1, botones/tarjetas táctiles
```

Estos tokens son el único punto de verdad de color/tipografía para `RunStartModal`; `CombatHud`
(§4) los reutiliza para los estados enabled/disabled, evitando dos paletas divergentes entre React
y Phaser. `packages/ui-shared` existe pero hoy solo tiene un `Placeholder` (§Glob) — no se fuerza
mover estos tokens ahí en esta historia (siguen siendo específicos de `apps/shell`); si una futura
historia detecta que Phaser también los necesita en CSS (no Phaser-hex), promoverlos a
`packages/ui-shared` es un refactor mecánico sin romper esta spec.

### 1.3 Estructura de componentes

```
RunStartScreen                    (host de página — apps/shell/src/screens/RunStartScreen.tsx)
└── RunStartModal                 (overlay + panel + footer — screens/run-start/RunStartModal.tsx)
    ├── SelectionSection (title="Elige tu Líder")
    │   └── SelectionCard × N
    ├── SelectionSection (title="Elige Enemigo")
    │   └── SelectionCard × N
    ├── SelectionSection (title="Elige Escenario")
    │   └── SelectionCard × N
    └── footer: botón "Iniciar combate" (deshabilitado si falta alguna selección — no puede faltar,
        siempre hay un valor por defecto, pero el botón deshabilitado es la guardia visual)
```

### 1.4 Contratos

```ts
// screens/run-start/SelectionCard.tsx
export interface SelectionCardOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;   // opcional, texto corto bajo el label (p.ej. arquetipo)
  readonly accentColor: string;    // hex CSS, uno de ACCENT_COLORS asignado round-robin por índice
}

export interface SelectionCardProps {
  readonly option: SelectionCardOption;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}

/** Tarjeta seleccionable — Rectangle con `border` de `accentColor` cuando `selected`, fondo
 *  `COLOR_CARD_BG`/`COLOR_CARD_BG_SELECTED`, tamaño mínimo `MIN_TAP_TARGET_PX` en ambos ejes.
 *  Nunca un `<input type="radio">` desnudo (causa raíz de la queja "selectores planos"). */
export function SelectionCard(props: SelectionCardProps): JSX.Element;
```

```ts
// screens/run-start/SelectionSection.tsx
export interface SelectionSectionProps {
  readonly title: string;
  readonly options: readonly SelectionCardOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

/** Fila horizontal de `SelectionCard` con título de sección (`FONT_SIZE_SECTION_TITLE`,
 *  `COLOR_TEXT_SECONDARY`, mayúsculas/letter-spacing sutil para separarlo del label de tarjeta).
 *  `overflow-x: auto` como red de seguridad si el catálogo crece más allá de lo que cabe en un
 *  viewport móvil estrecho — no se asume que el contenido siempre serán 2 opciones. */
export function SelectionSection(props: SelectionSectionProps): JSX.Element;
```

```ts
// screens/run-start/RunStartModal.tsx
export interface RunStartModalProps {
  readonly leaderOptions: readonly SelectionCardOption[];
  readonly enemyOptions: readonly SelectionCardOption[];
  readonly scenarioOptions: readonly SelectionCardOption[];
  readonly initialLeaderId: string;
  readonly initialEnemyId: string;
  readonly initialScenarioId: string;
  readonly onConfirm: (selection: RunStartNavigationState) => void;
}

/** Overlay (`COLOR_OVERLAY`, cubre viewport completo) + panel centrado (`COLOR_MODAL_PANEL`,
 *  `RADIUS_MODAL`, `box-shadow` para separación real del fondo — criterio de aceptación H4.1) con
 *  las 3 `SelectionSection` + footer con botón "Iniciar combate" (siempre habilitado: el estado
 *  interno siempre arranca con un id válido de cada categoría, nunca vacío). Gestiona el estado de
 *  selección internamente (useState ×3) y solo emite hacia arriba en `onConfirm`. Este componente
 *  reutiliza `RunStartNavigationState` ya existente (`combat/run-start-navigation-state.ts`) como
 *  forma del payload — sin tipo nuevo duplicado. */
export function RunStartModal(props: RunStartModalProps): JSX.Element;
```

```ts
// screens/run-start/to-selection-option.ts — adaptadores puros, sin componente
import type { LeaderOption } from '../../combat/leader-options';
import type { EnemyOption } from '../../combat/enemy-options';
import type { ScenarioOption } from '../../combat/scenario-options';
import { ACCENT_COLORS } from '../../ui/design-tokens';
import type { SelectionCardOption } from './SelectionCard';

/** Asigna `accentColor` por índice round-robin sobre `ACCENT_COLORS` (5 colores, ciclando si hay
 *  más de 5 opciones) — el catálogo de juguete no tiene arte propio todavía (§H1.9/H1.10/H1.11),
 *  así que el acento de color es el único diferenciador visual entre tarjetas hasta que exista arte
 *  real (fuera de alcance de esta historia). */
export function leaderToSelectionOption(option: LeaderOption, index: number): SelectionCardOption;
export function enemyToSelectionOption(option: EnemyOption, index: number): SelectionCardOption;
export function scenarioToSelectionOption(option: ScenarioOption, index: number): SelectionCardOption;
```

### 1.5 `RunStartScreen` reescrito (contrato, no implementación)

```ts
// screens/RunStartScreen.tsx — MODIFICADO
export function RunStartScreen(): JSX.Element {
  // 1. mapea LEADER_OPTIONS/ENEMY_OPTIONS/SCENARIO_OPTIONS vía to-selection-option.ts
  // 2. renderiza un contenedor de página a pantalla completa con
  //    style.background = COLOR_PAGE_BACKGROUND (NUNCA negro plano sin degradado)
  // 3. monta <RunStartModal ... onConfirm={(state) => navigate('/combat', { state })} />
  //    (el modal está SIEMPRE abierto en esta pantalla — no hay "página detrás" que ver, el
  //    degradado de fondo del punto 2 es lo único visible fuera del panel)
}
```

No se toca `RunStartNavigationState` (`combat/run-start-navigation-state.ts`) ni
`build-combat-setup.ts` — el contrato de navegación hacia `CombatScreen` es idéntico al actual.

---

## 2. E4.2 — Paneles delimitados en `CombatScene`

### 2.1 Enfoque: capa de paneles data-driven, dibujada antes que todo lo demás

`board-layout.ts` ya es la única fuente de verdad de coordenadas (§ cabecera del archivo) —
se **extiende**, no se reemplaza. Se añade una tabla `PANEL_ZONES` con un rectángulo (centro +
tamaño) por zona, derivado de las constantes YA existentes (mismo criterio de derivación
documentada que `MINIONS_ROW_Y`/`ABILITY_ICON_SEPARATION_PX` ya usan en ese archivo). Los paneles
se pintan como `Phaser.GameObjects.Rectangle` semi-transparentes con borde, creados dentro de
`createBoard(scene)` **antes** de las etiquetas de zona existentes — como `createBoard()` es lo
primero que `createBoardView()` invoca (`board-view.ts` línea 26, antes de roles/mano/aliados/
secuaces/núcleos/habilidades), los paneles quedan automáticamente detrás de TODO el resto de game
objects sin tocar el orden de creación de ningún otro módulo de `view/`.

### 2.2 Paleta de panel — extiende, no sustituye, la paleta ya validada

```ts
// board-layout.ts — NUEVO bloque de constantes de panel
export const PANEL_FILL_COLOR = 0x1e1e24;   // ~mitad de camino entre #222 y #333 (decisions.md/backlog H4)
export const PANEL_FILL_ALPHA = 0.55;        // translúcido — se lee como "panel" sin tapar contenido detrás
export const PANEL_BORDER_COLOR = 0x3a3a42;
export const PANEL_BORDER_WIDTH_PX = 2;
export const ZONE_LABEL_COLOR_HEX = '#9a9aa4'; // SUSTITUYE '#666666' de board.ts (bajo contraste, parte de la queja)
```

`CombatScene.setBackgroundColor('#12141c')` (`scenes/CombatScene.ts` línea 71) **no se toca** — ya
está dentro del rango "~#0a0a0a a #1a1a1e" que pide backlog.md H4.2; los paneles (`0x1e1e24`) quedan
una franja más clara que el fondo, dando la jerarquía fondo→panel→contenido que falta hoy.
`role-view.ts`/`minions-view.ts`/`allies-view.ts` ya usan `stroke: '#000000'` en su texto (contorno
oscuro sobre tile de color) — eso queda sin cambios, es ortogonal al panel de fondo (el panel vive
DETRÁS del tile de rol, no reemplaza su propio contorno de texto).

### 2.3 Tabla `PANEL_ZONES` (derivación de coordenadas)

7 zonas — exactamente las que `board.ts` ya etiqueta con texto hoy (`zoneLabels` en `board.ts`),
más el HUD que ya vive en React (no se pinta panel Phaser para el HUD, ver nota final de esta
sección). Bounds calculados centrando cada panel sobre el contenido conocido de esa fila +
un margen (`PANEL_MARGIN_PX = 40` verticalmente sobre el tile/fila, `PANEL_MARGIN_X_PX = 40` a cada
lado del ancho útil):

```ts
export interface PanelZone {
  readonly id: string;      // nombre estable, usado como scene name (debug/QA)
  readonly x: number;       // centro X
  readonly y: number;       // centro Y
  readonly width: number;
  readonly height: number;
  readonly label: string;   // reutiliza el mismo texto que board.ts ya usaba en `zoneLabels`
}

export const PANEL_ZONES: readonly PanelZone[] = [
  // y: ENEMY_POSITION.y(300) - 100(mitad tile+label) .. ENEMY_ABILITIES_ROW_Y(480) + 32(icono+margen)
  { id: 'panel-enemy',    x: 540, y: 390,  width: 1000, height: 300, label: 'Enemigo' },
  // y: MINIONS_ROW_Y(620) ± MINION_TILE_HEIGHT_PX(180)/2 + margen
  { id: 'panel-minions',  x: 540, y: 620,  width: 1000, height: 220, label: 'Secuaces' },
  // y: SCENARIO_POSITION.y(960) ± ROLE tile(200)/2 + margen
  { id: 'panel-scenario', x: 540, y: 960,  width: 1000, height: 280, label: 'Escenario' },
  // y: ALLIES_ROW_Y(1300) — mismo criterio que panel-minions (tiles espejo)
  { id: 'panel-allies',   x: 540, y: 1300, width: 1000, height: 220, label: 'Aliados' },
  // y: NUCLEO_TABLE_ROW_Y(1450) — cubre fila fija + hueco para dados EXTRA apilados debajo
  // (NUCLEO_EXTRA_DIE_STACK_OFFSET_PX × hasta 4 extras del mismo color en el peor caso, tope 10 en mesa)
  { id: 'panel-nucleos',  x: 540, y: 1480, width: 1000, height: 300, label: 'Núcleos' },
  // y: HAND_ROW_POSITION.y(1600) — fila de hasta 7 cartas (tope de mano), 120px ancho c/u
  { id: 'panel-hand',     x: 540, y: 1600, width: 1040, height: 200, label: 'Mano' },
  // y: LEADER_POSITION.y(1700) .. LEADER_ABILITIES_ROW_Y(1880) + margen — simétrico a panel-enemy
  { id: 'panel-leader',   x: 540, y: 1790, width: 1000, height: 300, label: 'Líder' },
];
```

**Nota de implementación explícita para Programmer:** estos números son un punto de partida
calculado a partir de constantes reales del código, no arte final medido a ojo contra un
render. `panel-hand` (y=1600) y `panel-nucleos` (y=1480, altura 300 → hasta y≈1630) pueden solapar
ligeramente en el caso peor (muchos dados EXTRA apilados) — Programmer debe verificar contra
capturas de pantalla reales (mismo criterio ya usado en `FIX_combat_viewport_and_layout.md`) y
ajustar `height`/`y` en `board-layout.ts` si detecta solape visual, sin cambiar la arquitectura
(sigue siendo una tabla de datos + un `Rectangle` por zona).

### 2.4 Contrato de `panel-view.ts` (NUEVO)

```ts
// packages/combat-scene/src/view/panel-view.ts
import type Phaser from 'phaser';

/** Crea (una única vez) un `Rectangle` de fondo + borde por cada entrada de `PANEL_ZONES`, y un
 *  `Text` de etiqueta de zona en su esquina superior (reemplaza el `scene.add.text` centrado que
 *  `board.ts` hacía hoy — mismo texto, nueva posición/color, §2.2). Sin lógica de estado — igual
 *  que `createBoard` de la que se invoca, capa puramente decorativa. */
export function createPanels(scene: Phaser.Scene): void;
```

`board.ts` pasa a:

```ts
export function createBoard(scene: Phaser.Scene): void {
  createPanels(scene); // NUEVO — dibuja fondo+borde+label de las 7 zonas, PRIMERO
}
```

(La función `zoneLabels` que hoy vive inline en `board.ts` se mueve dentro de `createPanels`, ya
que ahora la etiqueta se posiciona relativa a cada `PanelZone` en vez de a las constantes sueltas de
posición — mismo texto, mismo criterio de "una sola fuente de verdad de dónde vive cada zona".)

### 2.5 HUD React (`CombatHud.tsx`) — sin panel Phaser, mismo criterio ya usado

El HUD de decisión de turno vive en React superpuesto al canvas (`CombatHud.tsx` ya usa
`position: absolute`) — no se pinta un panel Phaser para él. En su lugar, §4 (E4.4) le da su propio
fondo/borde en CSS con los mismos tokens de `design-tokens.ts` de §1.2, para que la delimitación sea
coherente en toda la pantalla sin duplicar la paleta en dos formatos (hex Phaser vs. CSS) más de lo
necesario — cada capa (Phaser/React) usa su propia notación pero el mismo valor de color.

---

## 3. E4.3 — Indicador visual de cambio de turno

### 3.1 Evento real a usar: `TURN_ENDED`, no `TURN_CHANGED`/`TURN_STARTED`

`packages/domain/combat/src/types/events.ts` **no define** ningún evento `TURN_CHANGED` ni
`TURN_STARTED` — el nombre real, ya emitido por `combat-engine.ts` en cada cambio de turno
(`handleEndTurn`, línea ~1371-1380), es:

```ts
{
  readonly type: 'TURN_ENDED';
  readonly previousTurnOwner: CombatSide;  // 'LEADER' | 'ENEMY'
  readonly nextTurnOwner: CombatSide;
  readonly turnNumber: number;
}
```

Este evento ya dispara `COOLDOWNS_TICKED` inmediatamente después (mismo `handleEndTurn`) — la
receta de banner debe engancharse a `TURN_ENDED` en sí (no a `COOLDOWNS_TICKED`, que no lleva
`nextTurnOwner`) para saber a quién le toca ahora. `JUICE_CONFIG.TURN_ENDED` hoy es `[]`
(`juice-config.ts` línea 27) — se rellena.

### 3.2 `JuiceConfig` — nueva entrada

```ts
// juice-config.ts
TURN_ENDED: [{ recipeId: 'turnBanner', mode: 'sequential' }],
```

Sin `soundId`: los 5 `SoundCueId` existentes (`diceRoll`, `cardFlip`, `hit`, `victory`, `defeat`,
`audio/sound-manager.ts`) no tienen ningún cue que encaje semánticamente con "cambio de turno" —
añadir un 6º cue es una decisión de contenido de audio fuera del criterio de aceptación de H4.3
(que pide "banner/overlay con texto... no bloqueante", sin exigir sonido). Se deja la puerta
abierta: si Programmer/QA deciden que el efecto se siente incompleto sin sonido, añadir
`'turnChange'` a `SoundCueId` es un cambio aislado y no bloqueante para esta historia.

### 3.3 `effects-director.ts` — `resolveJuiceTarget`

Añadir un caso explícito (hoy cae en el `default` genérico, que produce el mismo resultado pero sin
declararlo — se hace explícito por claridad de mantenimiento, mismo criterio que el resto del
`switch`):

```ts
case 'TURN_ENDED':
  return { event }; // sin focusId — el banner no ataca a un game object concreto, cubre pantalla
```

### 3.4 Receta `turnBanner` (NUEVA) — `recipes/turn-banner.ts`

```ts
export interface TurnBannerParams {
  readonly holdMs?: number; // por defecto 400 — tiempo visible a opacidad plena
}

/** Banner de ancho completo, centrado verticalmente sobre el tablero (y=960, mismo eje que
 *  `SCENARIO_POSITION`, franja neutral entre Enemigo y Aliados), semi-transparente
 *  (`alpha` 0→0.9→0), con el texto "Tu turno" (verde, `NUCLEO_COLOR_HEX.DEFENSA` = 0x2ecc71) si
 *  `nextTurnOwner === 'LEADER'`, o "Turno del Enemigo" (rojo, `NUCLEO_COLOR_HEX.AGRESION` =
 *  0xe74c3c) si `nextTurnOwner === 'ENEMY'`. Secuencia: fade-in 150ms → hold `holdMs` (400ms
 *  default) → fade-out 150ms = 700ms totales, por debajo del límite de 1s del criterio de
 *  aceptación H4.3. `setDepth` alto para quedar SIEMPRE por encima de paneles/tiles (pero no
 *  bloquea input: es un `Rectangle`+`Text` sin `setInteractive()`, los taps lo atraviesan hacia el
 *  tablero de abajo aunque esté visible — "no bloqueante" del criterio de aceptación no significa
 *  solo "dura poco", también significa que no captura el puntero). Reutiliza el mismo game object
 *  entre invocaciones (creado una vez, reseteado cada vez — mismo patrón "nunca destruir/recrear"
 *  que `role-view.ts`/`ability-cooldown-view.ts`) para no acumular game objects huérfanos turno
 *  tras turno. */
export const turnBanner: JuiceRecipe<TurnBannerParams> = {
  id: 'turnBanner',
  play(scene, target, params) {
    // target.event.type === 'TURN_ENDED' garantizado por JUICE_CONFIG — leer nextTurnOwner de ahí.
    // Devuelve Promise<void> que resuelve al terminar el fade-out (mismo contrato que el resto de
    // recetas, `juice-recipe.ts`).
  },
};
```

Registrar en `recipes/index.ts` (mismo patrón que `screenShake`/`hitImpact`/etc, añadir la entrada
al `JuiceRecipeRegistry` real que H2.6/H2.9 inyectan).

### 3.5 Por qué banner de canvas y no fade de pantalla completa ni solo HUD

De las 4 opciones que backlog.md H4.3 deja abiertas (fade de pantalla, banner/icono HUD, animación
de Núcleos, screen shake), se elige **banner de canvas** porque: (a) es inevitablemente visible sin
ser tan invasivo como un fade a negro de pantalla completa (que rompería el ritmo de combate rápido
que `decisions.md` ya prioriza — "nunca hay turno vacío"); (b) vivir en el canvas de Phaser (no en
el HUD React) lo mantiene en el mismo pipeline de `EffectsDirector`/`JuiceConfig` que el resto del
"feel" del combate, reutilizando exactamente el mecanismo ya validado en vez de inventar un canal
paralelo en React; (c) screen shake ya se usa para impacto de daño (`LEADER_DAMAGED`/
`ENEMY_DAMAGED`/`PHASE_CHANGED`) — reutilizarlo también para cambio de turno diluiría su
significado como "algo golpeó fuerte".

---

## 4. E4.4 — HUD de acciones mejorado (`CombatHud.tsx`)

Pieza más pequeña — prioridad más baja de las 4 si el tiempo aprieta (ver §5). Cambios sobre el
`CombatHud.tsx` actual, reutilizando `apps/shell/src/ui/design-tokens.ts` de §1.2:

### 4.1 Contenedor con panel propio

```tsx
<div
  className="combat-hud"
  style={{
    position: 'absolute', top: 0, left: 0, right: 0,
    background: COLOR_MODAL_PANEL, // mismo tono que el panel del popup de Run Start — coherencia
    borderBottom: `${PANEL_BORDER_WIDTH_PX}px solid ${COLOR_MODAL_BORDER}`, // valor CSS del mismo hex que PANEL_BORDER_COLOR
    padding: SPACING.md,
    fontFamily: FONT_FAMILY,
    color: COLOR_TEXT_PRIMARY,
  }}
>
```

(Reemplaza el `<div>` sin estilo de hoy — sigue siendo overlay "chrome" no-juice, coherente con el
comentario ya existente en el archivo.)

### 4.2 Contador de acciones siempre visible

`CombatStateSnapshot.actions` ya expone `actionsTaken`/`actionsAllowed` (usado hoy solo para
calcular `hasActionsRemaining`, nunca renderizado). Añadir, siempre visible en la cabecera del HUD:

```tsx
<span className="combat-hud-action-counter">
  Acciones: {snapshot.actions.actionsTaken}/{snapshot.actions.actionsAllowed}
</span>
```

### 4.3 Estados enabled/disabled con más contraste + tooltip

Los `<button disabled>`/`<span aria-disabled>` actuales solo bajan `opacity` a 0.4 sobre el mismo
color de texto — poco legible. Sustituir por: color de texto distinto por estado (no solo opacidad)
y `title` nativo (tooltip sin dependencia nueva, satisface "tooltip para deshabilitados" del
criterio de aceptación sin construir un componente de tooltip propio):

```ts
// Helper puro, testeable, reutilizado por los 4 controles (Jugar Carta / Activar Habilidad /
// Generar Energía / Robar Carta) — centraliza qué texto de motivo mostrar por control.
export function disabledReasonFor(
  control: 'PLAY_CARD' | 'ACTIVATE_ABILITY' | 'GENERATE_ENERGY' | 'DRAW_CARD',
  snapshot: CombatStateSnapshot,
  leaderAbilities: readonly AbilityViewData[],
): string | null; // null = disponible, sin tooltip
```

Ejemplos de motivo (ya derivables de las condiciones que `CombatHud.tsx` calcula hoy —
`handEmpty`, `energyAtMax`, `isAnyLeaderAbilityActivatable`, etc., §L45-62 del archivo actual): "Sin
cartas en mano", "Sin Núcleos disponibles o habilidades en cooldown", "Energía al máximo (5/5)", "No
es tu turno", "Sin acciones restantes este turno".

```tsx
<button
  disabled={!canGenerateEnergyPaid}
  title={disabledReasonFor('GENERATE_ENERGY', snapshot, leaderAbilities) ?? undefined}
  style={{ color: canGenerateEnergyPaid ? COLOR_TEXT_PRIMARY : COLOR_TEXT_DISABLED }}
  onClick={() => bridge.dispatch({ type: 'GENERATE_ENERGY' })}
>
  Generar Energía
</button>
```

### 4.4 Layout responsivo

`combat-hud-actions` pasa a `display: flex; flex-wrap: wrap; gap: SPACING.sm` — mismo criterio que
ya usa `SelectionSection` (§1.4) para que en viewport <600px los 4 controles + paso previo quepan
sin overflow horizontal, envolviendo en 2 filas si hace falta en vez de recortarse.

---

## 5. Orden de implementación recomendado

1. **E4.1 — `RunStartModal`** (§1). Es la primera pantalla que ve cualquiera que abra la build;
   resuelve directamente la cita "el negro de la pantalla de selección no se ve" y "que la elección
   fuera en un popup". Auto-contenido (`apps/shell` puro, cero dependencia de `combat-scene`), sin
   riesgo de romper el motor de combate ya cerrado — el trabajo más seguro y de mayor impacto
   inmediato para empezar.
2. **E4.2 — Paneles de `CombatScene`** (§2). Ataca directamente "todo flota sobre negro sin
   jerarquía" — la queja central sobre la pantalla donde el jugador pasa el 90% del tiempo. Depende
   solo de `board-layout.ts`/`board.ts`, no toca ningún otro `view/*.ts` ni el dominio — riesgo
   acotado, impacto alto.
3. **E4.3 — Indicador de cambio de turno** (§3). Depende de que los paneles de E4.2 ya existan
   (el banner se posiciona en la franja central y debe verse coherente con el nuevo fondo de panel
   de Escenario, no con el fondo plano viejo) — por eso va después, aunque es una pieza pequeña y
   aislada (`juice-config.ts` + una receta nueva, sin tocar `view/*`).
4. **E4.4 — HUD de acciones** (§4). La pieza más pequeña y de menor impacto relativo en la queja
   original (el Director no citó explícitamente el HUD de botones, solo "todo flota" y "cambio de
   turno") — se implementa último y es la primera en recortarse si el tiempo aprieta, tal como pide
   la orden de trabajo.

---

## 6. Fuera de alcance explícito (no confundir con historias futuras)

- **Sorteo real 3+3 de Enemigos/Escenarios** (`decisions.md` 2026-07-05, "El sorteo cruza, el
  jugador ordena") — no implementado hoy, no se construye aquí. `RunStartModal` deja el terreno
  preparado (§1.1 punto 3) pero no lo anticipa con código muerto.
- **Arte real de cartas/Líderes/Enemigos/Escenarios** — el acento de color por tarjeta (§1.4) es un
  sustituto deliberado y temporal, no un sistema de arte.
- **Rediseño de mecánicas** — cero cambios en `packages/domain/*`, `CombatEngine`,
  `CombatStateSnapshot`, o cualquier `CombatCommand`/`CombatEvent` existente.
