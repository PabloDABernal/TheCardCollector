# H4 — Fuente única de verdad para el layout de combate

Responde al encargo del Director Creativo: los bugs recurrentes de solape/posicionamiento en la
pantalla de combate (paneles solapados, sprite de Líder invadiendo Mano, tile fantasma, header
tapando controles, y ahora Núcleos↔Mano) son síntoma de arquitectura, no mala suerte. Esta spec
diseña la consolidación estructural, no otro parche puntual, e incluye el fix inmediato del bug
actual como primer paso ejecutable.

## 0. Diagnóstico confirmado contra el código real

El diagnóstico del Director Creativo es correcto en el síntoma pero impreciso en el mecanismo. No
hay tres sistemas de coordenadas independientes sincronizados "por convención" — hay **una única
cadena de derivación matemática correcta en `board-layout.ts`, rota por un ciclo de imports mal
resuelto** que obliga a recalcular dos valores a mano en `placeholder.ts`.

### 0.1 Relación real entre los 3 archivos citados

- `packages/combat-scene/src/view/board-layout.ts` **ya es** la fuente de verdad matemática de casi
  todo: `MINIONS_ROW_Y`, `ALLIES_ROW_Y`, `NUCLEO_TABLE_ROW_Y`, `PANEL_ZONES` (vía `panelFromContent`)
  se derivan por fórmula de `CONTENT_GAP_PX` + semi-tamaños de tile. Ningún valor de estos está
  duplicado en otro archivo — `placeholder.ts`, `nucleo-table-view.ts`, `role-view.ts`,
  `card-hand-view.ts`, `MinionRow.tsx`, `AllyRow.tsx`, `AbilityRow.tsx`, `CombatBoardOverlay.tsx`
  **importan** estas constantes, no las redeclaran (confirmado por búsqueda global — 28 archivos
  referencian estos nombres, todos vía import de `@collector/combat-scene` o de `view/board-layout`,
  ninguno con literales propios).
- La única excepción real está en `packages/combat-scene/src/juice/recipes/placeholder.ts`: define
  `PLACEHOLDER_POSITIONS.leader` (`{x:540, y:1676}`) y `CARD_HAND_POSITION` (`{x:540, y:1474}`) como
  **literales hardcodeados**, no derivados. `board-layout.ts` los importa y re-exporta como
  `LEADER_POSITION`/`HAND_ROW_POSITION` (línea 1 y 21/24 de `board-layout.ts`).
- **Por qué existen como literales en vez de fórmula:** el comentario en `board-layout.ts` líneas
  69-70 es explícito — "no se puede derivar ahí en runtime porque `placeholder.ts` es importado POR
  este archivo, no al revés (evita ciclo)". Es decir: el único obstáculo real es un ciclo de imports
  que NUNCA se intentó resolver invirtiendo la dependencia — se resolvió "a mano", recalculando en
  cada cambio de `CONTENT_GAP_PX`, con la promesa (rota en la práctica) de mantener la misma fórmula
  sincronizada por comentario.

### 0.2 El bug actual, confirmado con los números reales del código

Con los valores vigentes (`CONTENT_GAP_PX = 12`):

- `NUCLEO_TABLE_ROW_Y = 1356` → `NUCLEO_CONTENT_BOTTOM_Y = 1356 + NUCLEO_TILE_HALF_PX(32) = 1388`.
- `HAND_ROW_POSITION.y = 1474` (literal en `placeholder.ts`) → `HAND_CONTENT.top = 1474 -
  CARD_TILE_HALF_PX(90) = 1384`.
- **1384 < 1388: el borde superior real del tile de Mano cae 4px DENTRO del bounding box del dado de
  Núcleo.** Esto es el solape que reporta el Director en su móvil real.
- La fórmula correcta (la misma que ya usa `ALLIES_ROW_Y`/`NUCLEO_TABLE_ROW_Y`, aplicada al siguiente
  eslabón de la cadena) da: `HAND_ROW_POSITION.y = NUCLEO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX +
  CARD_TILE_HALF_PX = 1388 + 12 + 90 = 1490`, no 1474. El valor quedó **16px corto** al
  "recalcularse a mano" tras la última bajada de `CONTENT_GAP_PX` de 20 a 12 — exactamente la
  sospecha del Director Creativo, confirmada.
- Encadenando el mismo error: `LEADER_POSITION.y` también debería derivarse de `HAND_ROW_POSITION`
  (bottom de Mano + gap + `ROLE_TILE_HALF_PX`), y hoy es igualmente un literal recalculado a mano.

### 0.3 El test que debería haber atrapado esto ya existe — y probablemente está en rojo

`board-layout.test.ts` línea 49 (`'ningún PanelZone consecutivo (ordenado por y) se solapa
verticalmente'`) compara exactamente `panel-nucleos.bottom` contra `panel-hand.top` — con los
números de §0.2, `panel-nucleos.bottom = 1393` (1388 + `PANEL_CONTENT_PADDING_PX` 5) y
`panel-hand.top = 1379` (1384 − 5): **1379 no es mayor que 1393**, así que ese `it` debería fallar
tal y como está el código hoy. Programmer debe correr `pnpm vitest board-layout.test.ts` como primer
paso de este trabajo y confirmar si está en rojo (si lo está, es la prueba definitiva de que el
mecanismo de sincronización manual ya falló en producción sin que nadie lo detectara antes del
móvil real del Director — refuerza por qué la solución debe eliminar la posibilidad, no solo el
número).

## 1. Decisión: Opción B reforzada (una única cadena de derivación TS), se descarta Opción A

**Se recomienda la Opción B — consolidar toda la aritmética de posición en `board-layout.ts` como
única fuente, importada (nunca redeclarada) por el resto — pero reforzada con un mecanismo que hace
la desincronización estructuralmente imposible, no solo "más difícil por convención".**

### 1.1 Por qué no Opción A (grid/flexbox HTML + Phaser leyendo `getBoundingClientRect`)

- El criterio "texto en HTML, juice de sprite en Phaser" (decisions.md 2026-07-05, prioridad
  explícita del Director Creativo por el "feel chulo": dados rodando, partículas, screen shake) ya
  está implementado y es deliberado — `CombatBoardOverlay.tsx` ya lee sus coordenadas de arranque
  DESDE `board-layout.ts` (no las inventa), y los tweens/recetas de juice (`diceRoll`, `hitImpact`,
  `screenShake`) viven en Phaser precisamente porque necesitan control de frame síncrono que el ciclo
  de layout/paint del DOM no garantiza con la misma fiabilidad.
- Migrar la fuente de verdad a `getBoundingClientRect()` de `<div>`s HTML introduciría una
  dependencia de **timing** entre dos motores de render (el layout HTML debe completarse y pintarse
  antes de que Phaser pueda leer coordenadas fiables — hoy `usePhaserViewportTransform` ya lidia con
  esta clase de problema para el `<canvas>` mismo, con `ResizeObserver`/`MutationObserver` y casos
  especiales para jsdom/tests) exactamente en el subsistema (juice/animación) que el proyecto ha
  decidido explícitamente que debe ser el más fluido y fiable. Sería resolver un problema de
  sincronización de números con un problema de sincronización de timing entre motores — cambia el
  riesgo, no lo elimina, y es la migración más cara de las dos.
- El coste de migración de Opción A es alto (reescribir 7 zonas como grid/flexbox real, portar toda
  la lógica de `panelFromContent`/`PANEL_ZONES` a CSS, y re-cablear cada receta de juice para leer
  rects en vez de constantes) para resolver un bug cuya causa raíz (§0) es un ciclo de imports mal
  resuelto en un solo archivo — desproporcionado.

### 1.2 Por qué Opción B, reforzada, sí cumple "estructuralmente imposible"

La garantía no viene de "un solo archivo bonito" sino de dos mecanismos concretos, ambos ya
parcialmente presentes en el código y que este plan generaliza a los 2 valores que hoy son
excepción:

1. **Cero literales de posición fuera de `board-layout.ts`.** Cada constante de posición (`x`, `y`)
   de cada zona/fila se calcula por fórmula a partir de: (a) un pequeño conjunto de constantes de
   ANCLA (posiciones fijas que no dependen de vecinos: `ENEMY_POSITION` en la parte superior del
   viewport, `x = 540` centrado) y (b) las constantes de TAMAÑO de tile que cada `view`/componente ya
   expone (`ROLE_TILE_HALF_PX`, `CARD_TILE_HALF_PX`, `NUCLEO_TILE_HALF_PX`, etc.) y `CONTENT_GAP_PX`.
   Ningún otro archivo puede "tener su propia opinión" de dónde está una fila porque no hay otro
   sitio donde escribir ese número — TypeScript no ofrece protección per se contra que alguien
   reintroduzca un literal, pero al eliminar TODOS los que existen hoy, cualquier adición futura de
   un literal nuevo destaca inmediatamente en review (es la única `y:` numérica del archivo entero
   fuera de las 2-3 anclas documentadas).
2. **Rompe el ciclo de imports invirtiendo la dirección, no evitándolo con literales.** El único
   motivo por el que `LEADER_POSITION`/`HAND_ROW_POSITION` no se derivan hoy es el ciclo descrito en
   §0.1. Este plan lo resuelve: `placeholder.ts` deja de definir esas dos posiciones y pasa a
   IMPORTARLAS desde `board-layout.ts` (que ya no necesita importar nada de `placeholder.ts` — ver
   §2). Con la dirección de dependencia correcta, el compilador de TypeScript hace la
   desincronización literalmente imposible de compilar: si `board-layout.ts` cambia
   `CONTENT_GAP_PX`, `HAND_ROW_POSITION.y` recalcula automáticamente en el mismo módulo, y
   `placeholder.ts` recibe el valor nuevo porque lo importa, sin ningún paso manual intermedio que
   alguien pueda olvidar.
3. **Test de regresión reforzado (no solo el gap Núcleos↔Mano) — "ningún panel consecutivo se
   solapa" ya existe (§0.3) y sigue siendo la red de seguridad correcta**; se añade un test explícito
   que hoy no existe: verificación de que el ORDEN vertical de todas las filas de contenido (no solo
   de fondos de panel) es estrictamente creciente y que el gap real entre bounding boxes consecutivos
   de CONTENIDO (no de panel-con-padding) es `>= CONTENT_GAP_PX` — el test actual de panel-vs-panel
   ya lo habría cazado si hubiera estado en verde antes de este bug (§0.3), así que el gap no es de
   cobertura sino de proceso (nadie corrió el test tras el último cambio manual). Añadir este segundo
   test, más estricto y expresado en términos de contenido real, deja doble red.

No se elimina el "duplicado documentado a propósito" de `ROLE_TILE_HALF_PX`/`NUCLEO_TILE_HALF_PX`/
`MINION_TILE_HEIGHT_PX`/`ABILITY_ICON_HEIGHT_PX` en `board-layout.ts` (líneas 26-54) — esos SÍ están
aislados deliberadamente para no crear un acoplamiento view-a-view por una sola constante, y están
comentados 1:1 contra su origen. Es un patrón distinto del bug real (que es sobre POSICIONES
derivadas, no tamaños de sprite ajenos); se puede revisar en un hito futuro si vuelve a causar un
bug real, pero no es parte de este fix.

## 2. Nueva estructura de datos y archivos

### 2.1 `packages/combat-scene/src/view/board-layout.ts` — única fuente, sin imports de `placeholder.ts`

- **Elimina** la línea 1 (`import { PLACEHOLDER_POSITIONS, CARD_HAND_POSITION } from
  '../juice/recipes/placeholder'`).
- `ENEMY_POSITION` y `SCENARIO_POSITION` pasan a definirse aquí mismo como literales de ANCLA
  (mismos valores actuales: `{x:540,y:300}`, `{x:540,y:960}` — son anclas superiores, no dependen de
  ninguna fila vecina por debajo, así que permanecer como literal documentado es correcto y no viola
  el criterio de §1.2; si en el futuro alguna fila por ENCIMA del Enemigo apareciera, se derivarían
  igual que el resto).
- `HAND_ROW_POSITION` pasa a derivarse: `{ x: 540, y: NUCLEO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX +
  CARD_TILE_HALF_PX }` (= 1388+12+90 = **1490**, fix inmediato del bug, ver §3).
- `LEADER_POSITION` pasa a derivarse del bottom real de Mano: `{ x: 540, y: (HAND_ROW_POSITION.y +
  CARD_TILE_HALF_PX) + CONTENT_GAP_PX + ROLE_TILE_HALF_PX }` (= (1490+90)+12+100 = **1692**).
- Recalcular en cascada (mecánicamente, ya con las fórmulas existentes del archivo, sin tocar su
  forma): `LEADER_ABILITIES_ROW_Y`, `LEADER_CONTENT`, `PANEL_ZONES['panel-leader']`,
  `PANEL_ZONES['panel-hand']`. Verificar que `LEADER_CONTENT.bottom` sigue por debajo de 1920 (con
  los valores de arriba: `LEADER_ABILITIES_ROW_Y = 1692+180=1872`, `+ABILITY_ICON_HEIGHT_PX/2(12) =
  1884` — cabe con 36px de margen respecto al borde inferior del viewport virtual).
- Se mantiene igual el resto de la cadena (`MINIONS_ROW_Y`, `ALLIES_ROW_Y`, `NUCLEO_TABLE_ROW_Y`,
  `PANEL_ZONES` para las demás zonas) — no se toca lo que ya funciona.

### 2.2 `packages/combat-scene/src/juice/recipes/placeholder.ts` — deja de definir, pasa a importar

- **Elimina** los literales `PLACEHOLDER_POSITIONS.leader` y `CARD_HAND_POSITION` como valores
  propios.
- **Añade** `import { LEADER_POSITION, HAND_ROW_POSITION, ENEMY_POSITION, SCENARIO_POSITION } from
  '../../view/board-layout'`.
- `PLACEHOLDER_POSITIONS` se construye a partir de los imports: `{ leader: LEADER_POSITION, enemy:
  ENEMY_POSITION, scenario: SCENARIO_POSITION }`.
- `CARD_HAND_POSITION` pasa a ser un alias directo: `export const CARD_HAND_POSITION =
  HAND_ROW_POSITION;` (o se elimina el nombre duplicado y los 2-3 usos internos de este archivo se
  cambian a `HAND_ROW_POSITION` importado — preferible para no mantener dos nombres del mismo valor;
  decisión de Programmer, sin impacto de diseño).
- Los comentarios extensos de "FIX QA post-`6d14b52`"/"FIX visual" en ambos archivos (líneas 9-20 de
  `placeholder.ts`, 9-20 y 66-78 de `board-layout.ts`) que documentan el recálculo manual **se
  eliminan** — dejan de ser ciertos y de aportar nada una vez la derivación es automática. Se
  sustituyen por un comentario corto que referencia esta spec y explica la dirección de dependencia
  (board-layout → placeholder, nunca al revés) para que quede documentado por qué no hay ciclo.

### 2.3 Resto de consumidores — sin cambios de código, solo verificación

`nucleo-table-view.ts`, `role-view.ts`, `card-hand-view.ts` (si sigue existiendo tras H4 — verificar,
puede haberse migrado a HTML, ver `CombatBoardOverlay.tsx` comentario líneas 56-62 que dice que
`card-hand-view.ts` ya fue sustituido por `HandCardRow.tsx`), `MinionRow.tsx`, `AllyRow.tsx`,
`AbilityRow.tsx`, `CombatBoardOverlay.tsx`, `board-anchors-view.ts` ya importan estas constantes
correctamente — no requieren cambios. Programmer debe correr una búsqueda (`grep -rn "y:\s*1[0-9]\{3\}"`
o similar sobre `packages/combat-scene/src` y `apps/shell/src/combat`) para confirmar que ningún otro
archivo tiene un literal de posición de fila no detectado en esta auditoría antes de dar el trabajo
por cerrado.

## 3. Plan de migración paso a paso

### Paso 1 — Fix inmediato del solape Núcleos↔Mano (víctoria visible rápida)

1. En `board-layout.ts`: cambiar `HAND_ROW_POSITION` de `CARD_HAND_POSITION` (importado) a la fórmula
   derivada de §2.1 (`NUCLEO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX + CARD_TILE_HALF_PX`).
2. Recalcular `LEADER_POSITION.y` con la fórmula derivada de §2.1.
3. Actualizar `placeholder.ts` para que `PLACEHOLDER_POSITIONS.leader`/`CARD_HAND_POSITION` usen los
   nuevos valores (puede hacerse todavía como literales actualizados a mano SOLO en este paso 1, como
   parche mínimo, pero documentando explícitamente en el commit que el paso 2 lo hace estructural —
   NO cerrar el trabajo aquí).
4. Correr `board-layout.test.ts` completo — el test de "sin solapes entre paneles consecutivos"
   (§0.3) y el de "bounding box real dentro de su panel" deben estar en verde con los nuevos números.
5. Verificar visualmente en el emulador móvil (o dispositivo real si está disponible) que el dado de
   Núcleo y la fila de Mano ya no se tocan.

### Paso 2 — Migración estructural (elimina el ciclo, cierra la puerta a que vuelva a pasar)

1. Eliminar el import de `placeholder.ts` en `board-layout.ts` (línea 1).
2. Mover `ENEMY_POSITION`/`SCENARIO_POSITION` a literales definidos directamente en `board-layout.ts`
   (mismos valores).
3. Confirmar que `board-layout.ts` compila de forma completamente autocontenida (sin ningún import de
   `juice/recipes/placeholder.ts`).
4. En `placeholder.ts`, añadir el import inverso (`from '../../view/board-layout'`) y eliminar los
   literales de `PLACEHOLDER_POSITIONS.leader`/`CARD_HAND_POSITION`, sustituyéndolos por referencias a
   los valores importados (§2.2).
5. Verificar que NO se ha creado un ciclo real: `board-layout.ts` no debe volver a importar nada de
   `juice/recipes/placeholder.ts` en ningún punto de este paso (chequeo manual o `madge
   --circular packages/combat-scene/src` si la herramienta está disponible en el repo).
6. Correr la suite completa de `combat-scene` (`pnpm vitest packages/combat-scene`) y el E2E de
   Playwright de combate (`apps/shell/e2e/combat-end-to-end.spec.ts`) — no debería haber ningún
   cambio de comportamiento respecto al Paso 1, solo de origen de los números.

### Paso 3 — Test de regresión reforzado (cierra el gap de cobertura de §1.2 punto 3)

1. Añadir a `board-layout.test.ts` un test que recorra las 7 filas de contenido en orden vertical
   (Enemigo → Secuaces → Escenario → Aliados → Núcleos → Mano → Líder) y verifique, para cada par
   consecutivo, que `siguiente.contentTop - anterior.contentBottom >= CONTENT_GAP_PX` (no solo `> 0`
   como hace hoy el test de fondos de panel) — expresado directamente sobre los `ContentBox`
   internos (`ENEMY_CONTENT`, `MINIONS_CONTENT`, etc., ya definidos en el archivo; puede requerir
   exportarlos o exponer un array ordenado de `ContentBox` con id, ya que hoy son `const` privadas del
   módulo).
2. Este test debe fallar si alguien reintroduce un literal de posición no derivado en cualquiera de
   los dos archivos — es la red de seguridad que atrapa cualquier futura regresión de este mismo
   patrón, no solo la del bug actual.

### Paso 4 — Limpieza de comentarios obsoletos

1. Eliminar/reescribir los comentarios "recalculado a mano"/"FIX QA post-`6d14b52`" que ya no
   describen el código real, en ambos archivos, referenciando esta spec (`H4_layout_fuente_unica.md`)
   como el punto de verdad de por qué la cadena de derivación es como es.
2. Actualizar `docs/specs/H4_diseno_real_ui.md`/`FIX_combat_viewport_and_layout.md` si contienen
   texto que describa el mecanismo antiguo de recálculo manual (verificar antes de tocar — pueden
   quedarse como registro histórico si están claramente fechados, a criterio de Programmer/Reviewer).

## 4. Qué NO cambia (alcance explícitamente fuera de esta spec)

- No se toca el criterio "texto en HTML, juice en Phaser" — sigue vigente.
- No se convierte ninguna zona a CSS Grid/Flexbox como fuente de posición (Opción A, descartada).
- No se tocan las constantes de TAMAÑO de sprite duplicadas deliberadamente (`ROLE_TILE_HALF_PX` y
  hermanas, §1.2) — quedan fuera de alcance salvo que un bug real las señale en el futuro.
- No se cambia ningún valor de diseño visual (colores, paddings de panel, `ABILITY_ICON_SEPARATION_PX`,
  etc.) más allá de los recalculados por la cadena de `y` descrita arriba.
