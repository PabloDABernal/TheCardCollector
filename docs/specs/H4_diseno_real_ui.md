# H4 — Diseño real de UI/UX (pasada de criterio estético)

> **Sustituye a `docs/specs/H4_rediseno_ui_ux.md`.** Ese documento resolvía "no se solapa" (cableado
> de paneles con bordes); esta pasada resuelve "se ve como un producto real, con personalidad" —
> encargo del Director del Estudio tras el rechazo duro del Director Creativo ("esto es vergonzoso,
> no es usable") sobre el resultado de los commits `f912c92`, `6d14b52`, `64b51e7`.
>
> No se tira `H4_rediseno_ui_ux.md` — se reutiliza su inventario de archivos, su descomposición en
> E4.1-E4.4, y toda pieza de arquitectura que sigue siendo válida (estructura de componentes,
> `PANEL_ZONES` derivadas de bounding box real, receta `turnBanner`, evento `TURN_ENDED`). Lo que
> cambia es: (1) se corrige primero un bug objetivo de escalado de canvas que el documento anterior
> nunca tocó, (2) se sustituye `design-tokens.ts` por un sistema tipográfico/cromático real con
> nombre y criterio, (3) se mueve el texto denso de HUD de Phaser a una capa HTML sincronizada, (4)
> se rediseña cada pantalla con maquetación real, no "gris con borde".
>
> Sin cambios de mecánicas — sigue operando sobre `CombatStateSnapshot`/`CombatEvent` ya cerrados.

---

## 0. Bug objetivo — causa raíz de "en desktop se ve roto"

### 0.1 Diagnóstico confirmado

`packages/combat-scene/src/main.ts` (líneas 112-126) y `apps/shell/src/screens/CombatScreen.tsx`
(líneas 68-83) — ambos puntos donde se construye `new Phaser.Game(...)` — configuran:

```ts
scale: {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: COMBAT_SCENE_VIEWPORT.width,   // 1080
  height: COMBAT_SCENE_VIEWPORT.height, // 1920
}
```

`FIT` con una resolución virtual 9:16 pura, en una ventana de escritorio ancha, escala el canvas
por altura y dejar franjas verticales sin llenar por ambos lados. Hoy esas franjas muestran el
`background: #000` plano fijado en `apps/shell/src/index.css` línea 12 ("color de letterbox") — sin
degradado, sin textura, sin ningún elemento de diseño. Eso es exactamente lo que se ve en la captura
del Director: parece un accidente de layout, no una decisión.

### 0.2 Decisión de arquitectura: se mantiene `FIT` + retrato 9:16, se diseña el exterior como marco

Se evalúan las 2 alternativas que pedía el encargo:

- **`ENVELOP`** — rellenaría el ancho recortando arriba/abajo del tablero virtual de 1920px de
  alto. **Rechazado**: el tablero de combate tiene 7 zonas apiladas verticalmente (Enemigo → Secuaces
  → Escenario → Aliados → Núcleos → Mano → Líder, `board-layout.ts` `PANEL_ZONES`) — cualquier
  recorte vertical corta una zona jugable completa. Es inaceptable en un juego de cartas donde el
  jugador necesita ver todo el tablero permanentemente. También contradice "móvil primero" (la
  resolución fue diseñada retrato-puro a propósito, `decisions.md` 2026-07-05).
- **Resolución virtual/lógica adaptativa por aspect ratio** — reescribir `board-layout.ts` con
  layouts alternativos en horizontal (ej. 2 columnas) es un rediseño de tablero completo, no una
  pasada de estilo; fuera de alcance de esta historia y del criterio "sin cambios de mecánicas /
  arquitectura de tablero".
- **Elegida: mantener `FIT` (9:16 virtual intacto) + convertir el exterior del canvas en un fondo de
  producto real** (fuera del `<canvas>`, en CSS/DOM de `apps/shell`). El canvas se sigue viendo
  siempre completo y sin recortes en cualquier proporción de ventana; en desktop, el marco alrededor
  dejará de ser "vacío roto" y pasará a ser una superficie deliberada de la paleta de abajo — un
  "escritorio de coleccionista" bajo el que descansa la carpeta/canvas.

### 0.3 Implementación del marco exterior

`apps/shell/src/index.css` — sustituir:

```css
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  overflow: hidden;
  background: var(--ink); /* sólido pero YA no es negro puro, ver §1 tokens */
}
```

y en `apps/shell/src/screens/CombatScreen.css`, añadir sobre `.combat-screen-root` (el contenedor
que rodea a `#phaser-mount`, ya con tamaño real de viewport completo, spec previa §1.2 punto 2):

```css
.combat-screen-root {
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  /* NUEVO — el marco exterior al canvas deja de ser un color plano de letterbox y pasa a ser el
     fondo de producto: gradiente radial ink→binder con una viñeta sutil, misma paleta que el resto
     de la app (RunStart usa el mismo COLOR_PAGE_BACKGROUND, §1.4) para que la transición entre
     pantallas se sienta parte del mismo objeto, no de dos apps distintas. */
  background: radial-gradient(ellipse at 50% 20%, var(--binder) 0%, var(--ink) 65%, #0c0c11 100%);
}

/* NUEVO — el propio canvas gana una sombra real (profundidad, §2.5 del sistema) para leerse como
   una pieza colocada SOBRE el fondo, no recortada de él — refuerza que el letterbox es intencional. */
#phaser-mount canvas {
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--rule);
  border-radius: 4px; /* casi imperceptible, evita el canto 100% recto contra el fondo */
}
```

`RunStartScreen`/`CombatScreen` ya usan/usarán la misma variable `COLOR_PAGE_BACKGROUND` (§1.4) para
el fondo de página, así el "marco" del canvas de combate y el fondo del popup de inicio comparten
literalmente el mismo gradiente — refuerzo de que es una decisión de producto, no un parche local.

**No se toca `main.ts` ni `CombatScreen.tsx` más allá de esto** — `Phaser.Scale.FIT` con
`COMBAT_SCENE_VIEWPORT` (1080×1920) se conserva intacto en ambos puntos. Este bug es 100% CSS/marco
exterior, cero cambio de configuración de Phaser.

---

## 1. Sistema de diseño — tokens (sustituye `apps/shell/src/ui/design-tokens.ts` completo)

### 1.1 Grounding

"The Collector": carpeta de coleccionista bajo lámpara de escritorio — cartón envejecido, sellos
"Collector's Edition", fanzine casero pero legible (`vision.md`). El sistema de abajo es la
traducción a tokens; aplica al CHROME de interfaz (paneles, texto, botones) — los 5 colores de
Núcleo (`NUCLEO_COLOR_HEX`) quedan **intactos**, son semántica de juego ya validada.

### 1.2 Color — variables CSS reales (nuevo archivo `apps/shell/src/ui/tokens.css`, importado una vez
desde `index.css`, más las constantes TS espejo para `CombatHud`/componentes React que necesitan el
valor en JS, ej. inline styles)

```css
:root {
  --ink:       #14141a; /* fondo base — nunca negro puro */
  --binder:    #1f1e26; /* superficie de panel/carta */
  --rule:      #3a3744; /* bordes/divisores */
  --parchment: #ece7de; /* texto principal — blanco roto cálido, nunca #fff */
  --foil:      #d4a24c; /* ÚNICO acento de acción/selección — úsalo con moderación */
  --success:   #4caf6f; /* semántico — curación, banner "tu turno" */
  --danger:    #d1495b; /* semántico — daño, banner "turno del enemigo" */

  /* Derivados de texto — mismo parchment, distinta opacidad, para jerarquía sin inventar hex nuevos */
  --text-primary:   var(--parchment);
  --text-secondary: rgba(236, 231, 222, 0.64);
  --text-disabled:  rgba(236, 231, 222, 0.32);

  /* Radio/espaciado — base 4px */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px;
  --radius-panel: 12px; --radius-chip: 10px;
  --shadow-panel: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.6);
}
```

`apps/shell/src/ui/design-tokens.ts` pasa a re-exportar estos mismos valores como constantes TS
(fuente única = `tokens.css`, TS solo repite los literales — sin generación de build adicional, es
un archivo pequeño y estable, mismo criterio de "duplicado documentado 1:1" que ya usa
`board-layout.ts` para constantes cruzadas entre módulos):

```ts
// apps/shell/src/ui/design-tokens.ts — REESCRITO
export const COLOR_INK = '#14141a';
export const COLOR_BINDER = '#1f1e26';
export const COLOR_RULE = '#3a3744';
export const COLOR_PARCHMENT = '#ece7de';
export const COLOR_FOIL = '#d4a24c';
export const COLOR_SUCCESS = '#4caf6f';
export const COLOR_DANGER = '#d1495b';

export const COLOR_TEXT_PRIMARY = COLOR_PARCHMENT;
export const COLOR_TEXT_SECONDARY = 'rgba(236, 231, 222, 0.64)';
export const COLOR_TEXT_DISABLED = 'rgba(236, 231, 222, 0.32)';

// Fondo de página/marco de canvas — MISMO gradiente que CombatScreen.css §0.3, reutilizado aquí
// para que RunStartScreen y el marco de combate compartan literal el mismo valor.
export const COLOR_PAGE_BACKGROUND =
  'radial-gradient(ellipse at 50% 20%, #1f1e26 0%, #14141a 65%, #0c0c11 100%)';
export const COLOR_OVERLAY = 'rgba(10, 10, 12, 0.78)';

// Acentos temáticos de Núcleo — MISMOS hex que NUCLEO_COLOR_HEX (packages/combat-scene), NUNCA se
// reutiliza --foil aquí: el foil es el acento de acción de la UI, los colores de Núcleo son
// semántica de juego, familias separadas a propósito (grounding §encargo).
export const NUCLEO_ACCENT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'] as const;

export const FONT_DISPLAY = "'Staatliches', 'Impact', sans-serif";
export const FONT_UI = "'Manrope', system-ui, -apple-system, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'IBM Plex Mono', monospace";

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const; // base-4, alias legible
export const RADIUS_PANEL = 12;
export const RADIUS_CHIP = 10;
export const SHADOW_PANEL = '0 2px 8px rgba(0, 0, 0, 0.4)';
export const SHADOW_MODAL = '0 20px 60px rgba(0, 0, 0, 0.6)';
export const MIN_TAP_TARGET_PX = 44;
```

**Ruptura deliberada respecto al `design-tokens.ts` anterior** — se retiran `COLOR_MODAL_PANEL`,
`COLOR_CARD_BG`, `COLOR_CARD_BG_SELECTED`, `COLOR_CARD_BORDER`, `COLOR_MODAL_BORDER`,
`ACCENT_COLORS`, `FONT_FAMILY`, `FONT_SIZE_*`, `RADIUS_MODAL`, `RADIUS_CARD`,
`PANEL_BORDER_WIDTH_PX` (duplicado con `board-layout.ts`, se deja solo en `board-layout.ts`, ver
§2.2). Programmer debe actualizar los 4 consumidores existentes
(`RunStartModal.tsx`/`SelectionCard.tsx`/`SelectionSection.tsx`/`CombatHud.tsx`) contra el nuevo
mapa de nombres (tabla de migración abajo) — no son alias, son un sistema nuevo.

| Token viejo | Token nuevo | Nota |
|---|---|---|
| `COLOR_MODAL_PANEL` | `COLOR_BINDER` | superficie de panel |
| `COLOR_CARD_BG` | `COLOR_BINDER` | unificado — antes había 2 grises casi iguales sin razón |
| `COLOR_CARD_BG_SELECTED` | `COLOR_BINDER` + `border: COLOR_FOIL` + glow (§3.3) | selección = foil, no un gris ligeramente distinto |
| `COLOR_CARD_BORDER` / `COLOR_MODAL_BORDER` | `COLOR_RULE` | unificado, un solo borde de sistema |
| `ACCENT_COLORS` | `NUCLEO_ACCENT_COLORS` | mismo valor, renombrado para dejar explícito que es semántica de Núcleo, no un token de acento de UI genérico |
| `FONT_FAMILY` | `FONT_UI` (cuerpo/botones) / `FONT_DISPLAY` (títulos) / `FONT_MONO` (números) | 1 fuente → 3 roles |
| `FONT_SIZE_TITLE`/`FONT_SIZE_SECTION_TITLE`/`FONT_SIZE_CARD_LABEL` | ver escala tipográfica §1.3 | tamaños atados a rol de fuente, no sueltos |
| `RADIUS_MODAL` (20) / `RADIUS_CARD` (12) | `RADIUS_PANEL` (12) | unificado a un único radio de sistema (12px), nunca 0 ni excesivo |

### 1.3 Tipografía — 3 roles, carga real como webfonts

**Decisión de distribución: self-hosted vía `@fontsource` (npm), no `<link>` a Google Fonts CDN.**
`apps/shell` ya usa `vite-plugin-pwa` (workbox) para instalación offline — un `<link>` externo a
`fonts.googleapis.com` rompería el caso offline (la PWA ya validada en `decisions.md` 2026-07-06,
H2.15, "probar el vertical slice en condiciones reales de móvil") y añade una dependencia de red en
cada arranque. `@fontsource/staatliches`, `@fontsource/manrope`, `@fontsource/jetbrains-mono` se
añaden como `dependencies` de `apps/shell`, se importan una vez en `main.tsx`
(`import '@fontsource/staatliches/400.css'`, pesos 400/700 de Manrope, 400/600 de JetBrains Mono) y
Vite los empaqueta como assets estáticos que Workbox cachea igual que el resto del bundle — cero
llamada de red nueva en runtime, funciona offline desde el primer arranque exactamente igual que hoy.

```
Display  — Staatliches   → títulos: "Inicio de Run", banner de turno, nombres de Líder/Enemigo/
                            Escenario. Condensada, tipo sello/póster. NUNCA en párrafos/botones.
UI/cuerpo — Manrope       → botones, etiquetas, la mayoría del texto de interfaz.
Datos     — JetBrains Mono → vida, cooldowns, valores de Núcleo, contador de acciones — cualquier
                            alineación numérica, con font-variant-numeric: tabular-nums.
```

Escala tipográfica (reemplaza los 3 `FONT_SIZE_*` sueltos anteriores):

```ts
export const TYPE = {
  displayLg:  { family: FONT_DISPLAY, size: '32px', letterSpacing: '0.02em' }, // "Inicio de Run"
  displaySm:  { family: FONT_DISPLAY, size: '20px', letterSpacing: '0.02em' }, // nombre Líder/Enemigo/Escenario, banner de turno
  bodyMd:     { family: FONT_UI, size: '15px', weight: 400 },                  // texto de botón/etiqueta
  bodySm:     { family: FONT_UI, size: '13px', weight: 400 },                  // descripción secundaria de tarjeta
  labelUpper: { family: FONT_UI, size: '12px', weight: 700, letterSpacing: '0.08em', transform: 'uppercase' }, // títulos de sección
  dataMd:     { family: FONT_MONO, size: '15px', variant: 'tabular-nums' },    // vida/energía/CD en línea
  dataLg:     { family: FONT_MONO, size: '22px', variant: 'tabular-nums' },    // contador destacado (ej. Acciones X/2)
} as const;
```

### 1.4 Espaciado/geometría — confirmado, base 4px, radio 12px, sombra `--shadow-panel` en todo panel
elevado (nunca fondo plano + borde de 1px sin sombra — esa combinación es exactamente lo que leía
"maqueta de programador" en la ronda anterior).

---

## 2. Decisión de arquitectura: texto en Phaser canvas vs. overlay HTML/CSS

### 2.1 Decisión

**Se migra a una capa HTML superpuesta (nuevo `CombatBoardOverlay.tsx` en `apps/shell`) el texto de
"lectura de estado" que hoy vive en `role-view.ts` (líneas de Líder/Enemigo/Escenario) y las
etiquetas de zona de `panel-view.ts`.** El resto de texto de `combat-scene` (nombres/HP en
`minions-view.ts`/`allies-view.ts`, coste en `card-hand-view.ts`, valores de pip en
`nucleo-table-view.ts`/`nucleo-roll-animation.ts`, cooldown de `ability-cooldown-view.ts`, y el
`turnBanner` de E4.3) **permanece en Phaser**.

### 2.2 Justificación — la línea se traza por acoplamiento a animación, no por "cuánto texto hay"

- **Migra a HTML:** las 3 líneas de estado de rol (`Líder — Daño X/Y | Escudo Z | Energía W | Nivel
  N`, y equivalentes de Enemigo/Escenario) son el bloque de texto MÁS denso de toda la pantalla de
  combate, se actualiza en cada snapshot (no en cada frame), y **nunca participa en tweens/juice**
  (`role-view.ts` línea 16: "Actualiza el texto HUD en el sitio, sin tween"). Es exactamente el
  perfil de contenido donde DOM+CSS gana sin coste: antialiasing real, `tabular-nums`, tres pesos de
  fuente en la misma línea (label en Manrope, número en JetBrains Mono) — imposible de conseguir con
  limpieza en `Phaser.GameObjects.Text` (una sola familia/peso por objeto Text). Las etiquetas de
  zona (`panel-view.ts`) son el mismo perfil: estáticas, sin animación, solo legibilidad.
- **Se queda en Phaser:** cooldown de habilidad, pip de dado, coste de carta y HP de secuaz/aliado
  están todos co-localizados con un sprite/tile que SÍ se anima (el dado rueda, la carta se voltea,
  el tile de secuaz tiembla al recibir daño/desaparece al morir). Sacar ese texto a una capa HTML
  aparte obligaría a sincronizar dos sistemas de animación (Phaser tween del sprite + reposicionado
  CSS del label) por cada gesto de juice — la ganancia tipográfica no compensa la complejidad y el
  riesgo de desincronización visual, que es justo el tipo de bug que ya persiguió
  `FIX_combat_viewport_and_layout.md`. El `turnBanner` (E4.3) es, por diseño, una pieza de juice de
  pantalla completa (fade-in/hold/fade-out dentro del pipeline de `EffectsDirector`) — moverla a
  React rompería el criterio ya cerrado de "mismo pipeline que el resto del feel" (spec previa §3.5).

Esta línea reutiliza y extiende exactamente el patrón que `CombatHud.tsx` ya valida hoy (overlay
`position: absolute` sobre el canvas, spec previa §2.5) — no es un patrón nuevo, es su generalización
a un segundo nivel: `CombatHud` cubre la franja superior fija; `CombatBoardOverlay` cubre coordenadas
arbitrarias dentro del tablero virtual, sincronizadas con el mismo transform.

### 2.3 Mecanismo de sincronización de coordenadas

Nuevo hook `apps/shell/src/combat/use-phaser-viewport-transform.ts`:

```ts
export interface PhaserViewportTransform {
  readonly scale: number;   // factor uniforme aplicado por Phaser.Scale.FIT
  readonly offsetX: number; // píxeles CSS entre el borde del contenedor y el borde real del canvas
  readonly offsetY: number;
}

/** Observa el elemento `<canvas>` real de Phaser (vía ResizeObserver sobre `mountRef.current`) y
 *  devuelve el transform CSS vigente para convertir coordenadas del viewport virtual
 *  (`COMBAT_SCENE_VIEWPORT`, 1080×1920, las MISMAS que board-layout.ts ya usa) a posición real en
 *  pantalla. Recalcula en cada resize/orientationchange — mismo evento que ya dispara el recálculo
 *  interno de `Phaser.Scale.FIT`. */
export function usePhaserViewportTransform(
  mountRef: React.RefObject<HTMLDivElement>,
): PhaserViewportTransform;
```

`CombatBoardOverlay` se monta como un único `<div>` hijo de `.combat-screen-root`, del tamaño exacto
del viewport virtual (1080×1920), con:

```css
position: absolute; left: 0; top: 0;
width: 1080px; height: 1920px;
transform: translate(offsetXpx, offsetYpx) scale(scale);
transform-origin: top left;
pointer-events: none; /* los hijos individuales reactivan pointer-events solo si necesitan click */
```

Dentro de ese `<div>`, cada elemento (línea de rol, etiqueta de zona) se posiciona con las MISMAS
coordenadas crudas que ya exporta `board-layout.ts` (`LEADER_POSITION`, `ENEMY_POSITION`,
`SCENARIO_POSITION`, `PANEL_ZONES`) — sin ninguna conversión adicional, porque el `transform` del
contenedor ya hizo todo el trabajo de escalado/offset. `combat-scene` exporta esas constantes
públicamente (ya lo hace, `packages/combat-scene/src/view/index.ts` puede re-exportar
`board-layout.ts` si no lo hace todavía — Programmer verifica el barrel) para que `apps/shell` nunca
duplique un número de posición.

### 2.4 Qué deja de dibujar Phaser

`role-view.ts` pierde su `Text` (el `Rectangle` de rol se mantiene — el tile de color SÍ es Phaser,
es donde después puede recibir screen shake/flash de daño). `panel-view.ts` pierde su `Text` de
etiqueta de zona (el `Rectangle` de fondo+borde se mantiene). Ningún otro archivo de `view/` cambia.

---

## 3. `RunStartModal` / `SelectionCard` / `SelectionSection` — rediseño

### 3.1 Qué se mantiene de H4 anterior (base razonable)

Estructura de 1 modal + 3 secciones apiladas (§1.1 de la spec anterior, decisión de UX válida — el
dato real sigue siendo 2 opciones por categoría, sigue sin existir el sorteo 3+3). `overflow-x: auto`
en `SelectionSection` como red de seguridad. Gestión de estado interna del modal (`useState` ×3).

### 3.2 Qué cambia — de "grises genéricos" a sistema real

`RunStartModal.tsx`:

```tsx
<div style={{ /* overlay */
  position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: COLOR_OVERLAY, padding: SPACING.md,
}}>
  <div style={{ /* panel */
    background: COLOR_BINDER, border: `1px solid ${COLOR_RULE}`,
    borderRadius: RADIUS_PANEL, boxShadow: SHADOW_MODAL,
    padding: SPACING.xl, display: 'flex', flexDirection: 'column', gap: SPACING.lg,
    maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
  }}>
    <h2 style={{ ...TYPE.displayLg, color: COLOR_TEXT_PRIMARY, margin: 0 }}>
      Inicio de Run
    </h2>
    {/* opcional: pequeño sello circular decorativo esquina superior derecha del panel, borde
        --foil, texto "COLLECTOR'S EDITION" en TYPE.labelUpper — refuerzo de grounding, no
        bloqueante, ver §6 prioridad */}
    ...
    <footer style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button style={{
        ...TYPE.bodyMd, fontWeight: 700,
        minHeight: MIN_TAP_TARGET_PX, padding: `${SPACING.sm}px ${SPACING.lg}px`,
        borderRadius: RADIUS_CHIP, border: 'none',
        background: COLOR_FOIL, color: COLOR_INK, /* texto oscuro sobre foil — máximo contraste */
        cursor: 'pointer',
      }}>
        Iniciar combate
      </button>
    </footer>
  </div>
</div>
```

El botón de confirmación es el ÚNICO lugar de esta pantalla en `--foil` — coherente con "el sistema
grita en un solo sitio" del encargo. La ronda anterior usaba un verde de Núcleo (`ACCENT_COLORS[2]`)
para el botón primario, mezclando semántica de acción con semántica de dado — se corrige aquí.

`SelectionSection.tsx` — título con `TYPE.labelUpper` (mayúsculas, tracking, `COLOR_TEXT_SECONDARY`),
sin cambio estructural.

`SelectionCard.tsx` — la tarjeta pasa de "gris con borde de color de acento round-robin" a leerse
como una funda de carta de coleccionista:

```tsx
<button style={{
  display: 'flex', flexDirection: 'column', gap: SPACING.xs,
  minWidth: 148, minHeight: MIN_TAP_TARGET_PX, padding: SPACING.md,
  borderRadius: RADIUS_PANEL,
  background: COLOR_BINDER,
  border: `2px solid ${selected ? COLOR_FOIL : COLOR_RULE}`,
  boxShadow: selected ? `0 0 0 3px rgba(212, 162, 76, 0.25), ${SHADOW_PANEL}` : SHADOW_PANEL,
  color: COLOR_TEXT_PRIMARY, cursor: 'pointer', textAlign: 'left',
}}>
  <span style={{ width: 10, height: 10, borderRadius: '50%', background: option.accentColor }} />
  <span style={{ ...TYPE.bodyMd, fontWeight: selected ? 700 : 400 }}>{option.label}</span>
  {option.description && <span style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY }}>{option.description}</span>}
</button>
```

Cambios concretos frente a la versión anterior: (a) selección se marca con `--foil` + halo suave
(`box-shadow` de 3px de foil translúcido), no con un color de acento distinto por tarjeta —
consistente con "único lugar donde grita" (el punto de color pequeño interior sigue existiendo como
identificador visual de Núcleo asociado, pero deja de ser también el indicador de selección, los dos
roles estaban mezclados antes); (b) toda tarjeta lleva `SHADOW_PANEL` siempre (seleccionada o no) —
antes el fondo plano sin sombra en estado no-seleccionado es exactamente el "plano sin profundidad"
que el encargo señala.

`to-selection-option.ts` no cambia de contrato — sigue asignando `accentColor` round-robin sobre
`NUCLEO_ACCENT_COLORS` (renombrado, §1.2) para el punto decorativo, ya no para el borde de selección.

---

## 4. Paneles de combate (`board-layout.ts` / `panel-view.ts`) — rediseño

### 4.1 Paleta de panel — sustituye `PANEL_FILL_COLOR`/`PANEL_BORDER_COLOR`

```ts
// board-layout.ts
export const PANEL_FILL_COLOR = 0x1f1e26;   // = --binder, Phaser hex
export const PANEL_FILL_ALPHA = 0.62;        // ligeramente más opaco que antes (0.55) — más lectura
                                              // de "funda de carta" sólida, menos "cristal flotante"
export const PANEL_BORDER_COLOR = 0x3a3744;  // = --rule
export const PANEL_BORDER_WIDTH_PX = 2;
```

Se retira `ZONE_LABEL_COLOR_HEX` de `board-layout.ts` (la etiqueta de zona deja de dibujarse en
Phaser, §2.4) — `panel-view.ts` pierde su bloque de `scene.add.text`, queda:

```ts
// panel-view.ts — REESCRITO, solo Rectangle de fondo+borde, sin texto
export function createPanels(scene: Phaser.Scene): void {
  for (const zone of PANEL_ZONES) {
    scene.add
      .rectangle(zone.x, zone.y, zone.width, zone.height, PANEL_FILL_COLOR, PANEL_FILL_ALPHA)
      .setStrokeStyle(PANEL_BORDER_WIDTH_PX, PANEL_BORDER_COLOR)
      .setName(zone.id);
  }
}
```

`PANEL_ZONES` (coordenadas, bounding-box real derivado — §2.3 de la spec anterior) **no cambia**, ya
está verificado contra el contenido real por `board-layout.test.ts` y sigue siendo válido: esta
pasada es de estilo, no de geometría.

### 4.2 `CombatBoardOverlay.tsx` (NUEVO, `apps/shell/src/combat/`)

```tsx
export interface CombatBoardOverlayProps {
  readonly snapshot: CombatStateSnapshot;
  readonly ctx: BoardViewContext; // mismo tipo que board-view.ts ya usa — leaderMaxHealth, etc.
  readonly transform: PhaserViewportTransform; // de usePhaserViewportTransform (§2.3)
}

/** Overlay HTML posicionado sobre el canvas (§2), pointer-events: none en el contenedor. Pinta:
 *  (a) las 7 etiquetas de zona (mismo texto que panel-view.ts ya no dibuja, TYPE.labelUpper,
 *      color --text-secondary, posicionadas en la esquina superior de cada PanelZone);
 *  (b) las 3 líneas de estado de rol (Líder/Enemigo/Escenario), reescritas como chips de datos en
 *      vez de una única línea de texto plano concatenado con "|": ver mockup §4.3. */
export function CombatBoardOverlay(props: CombatBoardOverlayProps): JSX.Element;
```

### 4.3 Mockup — línea de rol, antes vs. después

Antes (una sola `Text` Phaser, una familia, un tamaño, separador `|`):

```
Líder — Daño 12/30 | Escudo 2 | Energía 3 | Nivel 1
```

Después (HTML, `TYPE.displaySm` para el nombre, `TYPE.dataMd`/mono tabular para cada valor, chips
separados con `gap`, cada chip con su propio color semántico — daño en `--danger` si por debajo del
30% de vida máxima, si no `--text-primary`; energía siempre `--text-primary`; nivel en `--foil` como
pequeño "sello" de progresión):

```
┌─────────────────────────────────────────────┐
│  LÍDER                                       │  ← TYPE.labelUpper, --text-secondary (mismo rol
│  Soldado Base                                │    que la etiqueta de zona, arriba del tile)
│                                               │
│  ♥ 18/30   🛡 2   ⚡ 3   ✦ Nivel 1            │  ← TYPE.displaySm nombre + fila de datos TYPE.dataMd
└─────────────────────────────────────────────┘    monoespaciada, iconos simples (texto/emoji o
                                                     glifo SVG inline, sin nuevo asset pipeline)
```

Estructura real (no icon font nueva — usar caracteres Unicode simples ya soportados por Manrope/
system fonts, sin dependencia de librería de iconos, coherente con "sin sobre-construir"):

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
  <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>Líder</span>
  <span style={{ ...TYPE.displaySm, color: COLOR_TEXT_PRIMARY }}>{leaderName}</span>
  <div style={{ display: 'flex', gap: SPACING.md, ...TYPE.dataMd, fontVariantNumeric: 'tabular-nums' }}>
    <span style={{ color: isLowHealth ? COLOR_DANGER : COLOR_TEXT_PRIMARY }}>♥ {damage}/{maxHealth}</span>
    <span>🛡 {shield}</span>
    <span>⚡ {energy}</span>
    <span style={{ color: COLOR_FOIL }}>✦ Nivel {level}</span>
  </div>
</div>
```

Mismo patrón para Enemigo (sin escudo/energía/nivel, con Fase X/Y en vez de Nivel) y Escenario
(Trama X/Y con color `--danger` si `scenarioPlot >= scenarioPlotDefeatThreshold`, mismo criterio que
el `SCENARIO_ALERT_COLOR` que `role-view.ts` ya aplicaba al `Rectangle` — el Rectangle se mantiene
en Phaser, el número de Trama en HTML adopta el mismo umbral de forma independiente).

---

## 5. Banner de cambio de turno (E4.3) — confirmado, con tokens actualizados

Arquitectura y justificación de "banner de canvas, no fade/HUD/screen-shake" de la spec anterior
(§3, `packages/combat-scene/src/juice/recipes/turn-banner.ts`) **se mantiene sin cambios** — sigue
siendo la decisión correcta (§2.2 arriba reafirma por qué el turnBanner se queda en Phaser). Único
cambio: los colores de texto pasan de los hex de Núcleo (`0x2ecc71`/`0xe74c3c`, "DEFENSA"/"AGRESION")
a los semánticos nuevos — `--success` (`0x4caf6f`) para "Tu turno", `--danger` (`0xd1495b`) para
"Turno del Enemigo". Se retira la reutilización de colores de Núcleo para este propósito: el encargo
es explícito en que semánticos (éxito/peligro) y Núcleo son familias separadas — el banner de turno
es un indicador de sistema, no de color de dado, y no debe confundirse visualmente con las
mecánicas de Núcleo.

```ts
const TURN_BANNER_LEADER_COLOR = 0x4caf6f;  // --success
const TURN_BANNER_ENEMY_COLOR = 0xd1495b;   // --danger
```

Tipografía del banner: `Staatliches` (vía `Phaser.GameObjects.Text` con `fontFamily` apuntando al
webfont ya cargado por `apps/shell`/`main.ts` — Phaser puede usar cualquier fuente ya presente en el
DOM vía CSS `@font-face`, sin asset propio de Phaser; requiere que el `<canvas>` se cree DESPUÉS de
que la fuente esté disponible o aceptar el primer frame con fallback, comportamiento estándar de
webfonts y sin mitigación especial necesaria para un banner de 700ms).

---

## 6. `CombatHud.tsx` — rediseño final

Mantiene la decisión de la spec anterior de que "Jugar Carta"/"Activar Habilidad" son indicadores no
accionables (su gesto real vive en el canvas) y "Generar Energía"/"Robar Carta" sí son botones. Se
rediseña el cromo:

```tsx
<div style={{
  position: 'absolute', top: 0, left: 0, right: 0,
  background: COLOR_BINDER, borderBottom: `2px solid ${COLOR_RULE}`,
  padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm,
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
    <span style={{ ...TYPE.displaySm, color: COLOR_TEXT_PRIMARY }}>{leaderName}</span>
    <span style={{ ...TYPE.dataLg, color: COLOR_FOIL }}>
      {snapshot.actions.actionsTaken}/{snapshot.actions.actionsAllowed}
      <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY, marginLeft: SPACING.xs }}>Acciones</span>
    </span>
  </div>

  {/* Paso previo — chip con borde punteado --rule (sustituye el borde blanco sólido actual,
      demasiado genérico/alto contraste sin relación con el sistema) */}
  <div style={{
    display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center',
    border: `1px dashed ${COLOR_RULE}`, borderRadius: RADIUS_CHIP, padding: SPACING.xs,
  }}>
    <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>Paso previo (gratis)</span>
    {/* botones — mismo componente ButtonChip reutilizado abajo */}
  </div>

  <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
    {/* 4 controles */}
  </div>
</div>
```

`ButtonChip` — helper visual único reutilizado por los 6 controles (2 gratis + 4 pagados + fin de
turno), reemplaza el `buttonBaseStyle`/`enabledStyle`/`disabledStyle` inline actual por una función
pura testeable, mismo criterio que `disabledReasonFor` ya usa:

```ts
export function chipStyle(enabled: boolean): React.CSSProperties {
  return {
    ...TYPE.bodyMd,
    borderRadius: RADIUS_CHIP,
    padding: `${SPACING.xs}px ${SPACING.sm}px`,
    background: COLOR_BINDER,
    border: `1px solid ${enabled ? COLOR_RULE : 'rgba(58, 55, 68, 0.4)'}`,
    color: enabled ? COLOR_TEXT_PRIMARY : COLOR_TEXT_DISABLED,
    cursor: enabled ? 'pointer' : 'default',
  };
}
```

`disabledReasonFor` (contrato ya cerrado, spec previa §4.3) no cambia de firma — solo el estilo que
lo envuelve. Layout responsivo (`flex-wrap`) confirmado sin cambios.

---

## 7. Mockup de pantalla completa — Run Start (desktop, marco visible)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  fondo: radial-gradient(--binder → --ink → casi negro), viñeta sutil     │
│                                                                            │
│              ┌────────────────────────────────────────────┐             │
│              │  INICIO DE RUN                    (Staatliches, 32px)     │
│              │  ────────────────────────────────────────  │             │
│              │  ELIGE TU LÍDER            (Manrope, upper, tracking)     │
│              │  ┌──────────┐  ┌──────────┐                │             │
│              │  │ ● Soldado │  │ ● Mago    │  ← foil border si elegido   │
│              │  └──────────┘  └──────────┘                │             │
│              │  ELIGE ENEMIGO                              │             │
│              │  ┌──────────┐  ┌──────────┐                │             │
│              │  │ ● Bestia  │  │ ● Espectro│                │             │
│              │  └──────────┘  └──────────┘                │             │
│              │  ELIGE ESCENARIO                            │             │
│              │  ┌──────────┐  ┌──────────┐                │             │
│              │  │ ● Bosque  │  │ ● Templo  │                │             │
│              │  └──────────┘  └──────────┘                │             │
│              │                              [Iniciar combate] ← foil    │
│              └────────────────────────────────────────────┘             │
│                        panel: --binder, borde --rule, sombra real        │
└──────────────────────────────────────────────────────────────────────────┘
```

## 8. Mockup de pantalla completa — Combate (desktop, marco lateral visible)

```
┌───────────┬───────────────────────────────────────┬───────────┐
│  marco    │ ┌───────────────────────────────────┐ │  marco    │
│  --ink →  │ │ CombatHud (panel --binder)          │ │  --ink →  │
│  --binder │ │ Soldado Base         Acciones 1/2   │ │  --binder │
│  degradado│ │ ┅ Paso previo (gratis) ┅  [Robar][+E]│ │  degradado│
│  (antes   │ │ [Jugar][Activar][+E][Robar] [Fin turno]│ │  (antes  │
│  #000     │ ├───────────────────────────────────┤ │  #000    │
│  plano)   │ │ ENEMIGO           (panel --binder)  │ │  plano)  │
│           │ │ Bestia Base                          │ │           │
│           │ │ ♥ 20/20   Fase 1/2                   │ │           │
│  canvas   │ │        [tile 200×200 Phaser]          │ │           │
│  con      │ ├───────────────────────────────────┤ │           │
│  box-     │ │ SECUACES          (panel --binder)  │ │           │
│  shadow + │ ├───────────────────────────────────┤ │           │
│  borde    │ │ ESCENARIO                             │ │           │
│  --rule   │ │ Bosque Encantado — Trama 3/10         │ │           │
│  1px      │ ├───────────────────────────────────┤ │           │
│           │ │ ALIADOS / NÚCLEOS / MANO / LÍDER ... │ │           │
└───────────┴───────────────────────────────────────┴───────────┘
```

El marco lateral deja de ser vacío: gradiente `--ink`→`--binder`, mismo que el fondo de Run Start —
la ventana ancha de escritorio deja de leerse como "el juego no llena la pantalla" y pasa a leerse
como "el tablero retrato es una pieza deliberada sobre un escritorio", coherente con el grounding de
"carpeta bajo lámpara de escritorio".

---

## 9. Resumen de archivos por sección (actualiza el inventario de la spec anterior)

```
apps/shell/
  index.html                                  # sin cambios (no se añade <link> de Google Fonts, §1.3)
  src/main.tsx                                 # MODIFICADO — imports de @fontsource/*
  src/index.css                                # MODIFICADO — importa tokens.css, quita background #000 plano
  src/ui/tokens.css                             # NUEVO — variables CSS del sistema (§1.2)
  src/ui/design-tokens.ts                      # REESCRITO por completo (§1.2/1.3) — tabla de migración incluida
  src/screens/run-start/SelectionCard.tsx      # MODIFICADO (§3.2)
  src/screens/run-start/SelectionSection.tsx   # MODIFICADO (§3.2, solo tokens)
  src/screens/run-start/RunStartModal.tsx      # MODIFICADO (§3.2)
  src/screens/run-start/to-selection-option.ts # MODIFICADO — accentColor sobre NUCLEO_ACCENT_COLORS
  src/screens/RunStartScreen.tsx                # MODIFICADO — COLOR_PAGE_BACKGROUND actualizado
  src/screens/CombatScreen.tsx                  # MODIFICADO — monta <CombatBoardOverlay>, usa el hook §2.3
  src/screens/CombatScreen.css                  # MODIFICADO — marco exterior (§0.3)
  src/combat/CombatHud.tsx                      # MODIFICADO (§6)
  src/combat/use-phaser-viewport-transform.ts   # NUEVO (§2.3)
  src/combat/CombatBoardOverlay.tsx             # NUEVO (§4.2/4.3)
  package.json                                  # MODIFICADO — +@fontsource/staatliches, manrope, jetbrains-mono

packages/combat-scene/src/view/
  board-layout.ts                               # MODIFICADO — paleta de panel (§4.1), retira ZONE_LABEL_COLOR_HEX
  panel-view.ts                                 # MODIFICADO — retira el Text de etiqueta (§4.1)
  role-view.ts                                  # MODIFICADO — retira el Text de estado, mantiene el Rectangle (§2.4)
  index.ts                                      # MODIFICADO si hace falta — re-exporta board-layout para apps/shell (§2.3)

packages/combat-scene/src/juice/recipes/
  turn-banner.ts                                # MODIFICADO — colores semánticos --success/--danger, fuente Staatliches (§5)
```

---

## 10. Orden de implementación recomendado

1. **§0 — Fix del marco exterior.** Bug objetivo, aislado a 2 archivos CSS, cero riesgo, resuelve la
   causa raíz de la captura que motivó el rechazo. Primero siempre.
2. **§1 — Tokens.** Todo lo demás depende de este archivo; sin fuentes/paleta reales no hay pasada de
   estilo real en ningún componente.
3. **§3 — `RunStartModal`.** Superficie más pequeña, ya tiene base de H4 anterior, valida el sistema
   de tokens end-to-end antes de tocar el tablero de combate (más arriesgado por el overlay
   sincronizado).
4. **§2 + §4 — Overlay de coordenadas + paneles de combate.** Depende de que §1 exista. Es el cambio
   de mayor riesgo técnico (sincronización de transform) — Programmer debe verificar contra capturas
   reales en varias proporciones de ventana (mismo criterio QA que ya usó
   `FIX_combat_viewport_and_layout.md`).
5. **§5 — Banner de turno.** Cambio de color/fuente puro sobre la receta ya existente.
6. **§6 — `CombatHud`.** Última pieza, menor superficie, mismo criterio de prioridad que la spec
   anterior.

---

## 11. Fuera de alcance explícito (sin cambios respecto a la spec anterior)

- Sorteo real 3+3 de Enemigos/Escenarios.
- Arte real de cartas/Líderes/Enemigos/Escenarios — el punto de color por tarjeta sigue siendo
  sustituto temporal.
- Rediseño de mecánicas — cero cambios en `packages/domain/*`, `CombatEngine`,
  `CombatStateSnapshot`, o cualquier `CombatCommand`/`CombatEvent` existente.
- Resolución virtual/lógica adaptativa por aspect ratio para aprovechar más ancho en desktop (§0.2) —
  evaluada y rechazada esta ronda por requerir rediseño de tablero, no de estilo.
