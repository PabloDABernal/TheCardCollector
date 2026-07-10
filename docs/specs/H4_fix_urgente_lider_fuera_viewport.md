# FIX URGENTE — Líder renderizado fuera del viewport (regresión post-`195ecca`/`d825e47`)

Prioridad: P0. El Líder (tile, HP, sus 4 habilidades) es intocable: no se puede jugar. Bloquea todo combate.

## 1. Causa raíz (verificada, no confiar en los comentarios del commit anterior)

`board-layout.ts` deriva `HAND_ROW_POSITION`/`LEADER_POSITION`/`LEADER_ABILITIES_ROW_Y` en cascada a
partir de `NUCLEO_CONTENT_BOTTOM_Y`, que a su vez asume SIEMPRE el peor caso posible de apilado de
dados EXTRA de Núcleo (`NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR = 5`), sin importar cuántos dados
EXTRA hay realmente en mesa. El resultado es una constante de módulo **fija**, calculada una sola vez
al cargar el archivo — no una posición que varíe según el estado real de combate.

Fórmula general (con `N` = número de dados EXTRA apilados reservado, hoy fijo en 5):

```
NUCLEO_CONTENT_BOTTOM_Y(N) = NUCLEO_TABLE_ROW_Y + N·NUCLEO_EXTRA_DIE_STACK_OFFSET_PX + NUCLEO_TILE_HALF_PX
                            = 1340 + 70N + 32 = 1372 + 70N
HAND_ROW_POSITION.y(N)     = NUCLEO_CONTENT_BOTTOM_Y(N) + CONTENT_GAP_PX + CARD_TILE_HALF_PX
                            = 1372 + 70N + 12 + 90 = 1474 + 70N
LEADER_POSITION.y(N)       = HAND_ROW_POSITION.y(N) + CARD_TILE_HALF_PX + CONTENT_GAP_PX + ROLE_TILE_HALF_PX
                            = 1474 + 70N + 90 + 12 + 100 = 1676 + 70N
LEADER_ABILITIES_ROW_Y(N)  = LEADER_POSITION.y(N) + 180 = 1856 + 70N
LEADER_CONTENT.bottom(N)   = LEADER_ABILITIES_ROW_Y(N) + ABILITY_ICON_HEIGHT_PX/2 = 1868 + 70N
```

Con `N = 5` (valor actual): `LEADER_CONTENT.bottom = 1868 + 350 = 2218`, **298px por encima** de
`COMBAT_SCENE_VIEWPORT.height = 1920`. Esto ocurre **siempre**, incluso con 0 dados EXTRA reales en
mesa, porque la reserva es estática y nunca se reduce — confirma la medición de QA (`LEADER_POSITION.y`
≈ 2026 en ambos tamaños de pantalla probados, ya fuera del viewport virtual de 1920px antes incluso de
escalar a pantalla real).

Dato clave para decidir la solución: **con `N = 0` (caso real de hoy, ninguna carta implementa
`ADD_NUCLEO_DIE`), `LEADER_CONTENT.bottom(0) = 1868`, que SÍ cabe** dentro de 1920 con 52px de margen.
El bug no es que el Líder no quepa — es que el layout reserva permanentemente espacio para un caso
(5 dados EXTRA del mismo color apilados) que hoy es matemáticamente inalcanzable con contenido real.

## 2. Opción elegida: variante de la 4 — bajar el tope reservado + crecer el viewport lo justo

Descartadas:
- **Opción 1 pura (reserva 100% dinámica, recalculada en cada render con el estado real de la mesa)**:
  es la solución correcta a largo plazo, pero `LEADER_POSITION`/`HAND_ROW_POSITION` se consumen hoy como
  **constantes estáticas de módulo** en al menos 6 sitios de dos paquetes distintos: `role-view.ts`
  (Phaser, tile creado una única vez en `createLeaderRoleView`, posición nunca se actualiza tras la
  creación — ni siquiera tiene mecanismo de reposicionamiento), `HandCardRow.tsx`, `AbilityRow.tsx`,
  `CombatBoardOverlay.tsx` (React, `apps/shell`), más `PANEL_ZONES` (fondos de panel, también estático).
  Convertir esto en un cálculo dependiente del snapshot en tiempo real exige tocar la creación/actualización
  del tile en Phaser (incluyendo su `GeometryMask` redondeado, hoy fijo en la creación) y las firmas de los
  3 componentes React — cambio arquitectónico correcto pero de alcance amplio, no apto para desplegar ya
  bajo P0 sin el riesgo de introducir una regresión nueva mientras se apaga esta.
- **Opción 3 pura (bajar el tope sin tocar el viewport)**: matemáticamente, para que `LEADER_CONTENT.bottom(N)`
  quepa en 1920 con margen, el único valor de `N` posible es 0 (`70·1 = 70 > 52` de margen disponible) —
  bajar el tope a, por ejemplo, 2 (rango realista sugerido) NO alcanza por sí solo:
  `LEADER_CONTENT.bottom(2) = 2008`, sigue 88px fuera de 1920.
- **Opción 2 pura (subir el viewport para cubrir `N = 5`)**: exigiría 2218 + 36 ≈ 2254px de alto
  (+334px, +17% sobre 1920), una desviación de aspect ratio grande para cubrir un caso que ningún
  card puede producir hoy.

**Elegida: combinar 2+3 con números acotados al rango realista (0–2 dados EXTRA por color), tal como
sugiere la opción 4 del encargo** — sin tocar ningún archivo consumidor (`role-view.ts`, componentes
React, `PANEL_ZONES`), solo 2 constantes en `board-layout.ts`/`CombatScene.ts`. Es la opción implementable
ya, de menor riesgo bajo P0, y matemáticamente correcta para todo el rango de contenido real existente y
previsible a corto plazo. Queda documentado como deuda técnica (ver §4) migrar a reserva 100% dinámica
(opción 1) cuando exista contenido real (`ADD_NUCLEO_DIE`) que pueda superar el nuevo tope de 2.

## 3. Cambios exactos

### `packages/combat-scene/src/view/board-layout.ts`

```
export const NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR = 2; // antes: DEFAULT_NUCLEO_TABLE_MAX_DICE - FIXED_NUCLEO_DICE_COUNT (=5)
```

Sustituye la línea actual (`= DEFAULT_NUCLEO_TABLE_MAX_DICE - FIXED_NUCLEO_DICE_COUNT`) por el literal
`2`, con comentario explicando que es un tope de DISEÑO acotado al rango realista (0–2 dados EXTRA por
color), no derivado de `DEFAULT_NUCLEO_TABLE_MAX_DICE` — ningún card implementa `ADD_NUCLEO_DIE` hoy;
si en el futuro se añade contenido que permita superar 2 dados EXTRA del mismo color apilados, este
valor y `COMBAT_SCENE_VIEWPORT.height` deben revisarse juntos (o migrar a reserva dinámica, ver §4).

Efecto en cascada (recalculado automáticamente por las fórmulas existentes, sin tocar más líneas):
- `NUCLEO_CONTENT_BOTTOM_Y`: 1722 → **1512**
- `HAND_ROW_POSITION.y`: 1824 → **1614**
- `LEADER_POSITION.y`: 2026 → **1816**
- `LEADER_ABILITIES_ROW_Y`: 2206 → **1996**
- `LEADER_CONTENT.bottom` (usado por `PANEL_ZONES['panel-leader']`): 2218 → **2008**
- `panel-leader` bottom real (con `PANEL_CONTENT_PADDING_PX = 5`): → **2013**

### `packages/combat-scene/src/scenes/CombatScene.ts`

```
export const COMBAT_SCENE_VIEWPORT = { width: 1080, height: 2060 } as const; // antes: 1920
```

`2060 = LEADER_CONTENT.bottom(N=2) [2008] + 52px de margen` — el mismo margen (52px) que ya existía
entre `LEADER_CONTENT.bottom(N=0)` [1868] y el viewport original de 1920, preservado ahora contra el
nuevo peor caso reservado (`N=2`) en vez de perderse. Con 0 dados EXTRA reales (caso de hoy),
`LEADER_CONTENT.bottom(0) = 1868`, dejando **192px de margen** contra el nuevo viewport de 2060.

Impacto de aspect ratio: 1080:1920 (0.5625, "9:16" exacto) → 1080:2060 (0.524, ~"9:17.15") — desviación
del 7.3%, menor que la variación entre los propios tamaños de pantalla reales que QA probó
(1400×900 = 1.556 y 390×844 = 0.462, ninguno de los dos es 9:16 tampoco). `Phaser.Scale.FIT` letterboxea
en ambos casos igual que antes; el único efecto real es un factor de escala ligeramente menor en
`use-phaser-viewport-transform.ts`, sin cambios de comportamiento.

No se toca ningún otro archivo — `PANEL_ZONES`, `role-view.ts`, `HandCardRow.tsx`, `AbilityRow.tsx`,
`CombatBoardOverlay.tsx`, `nucleo-table-view.ts` siguen consumiendo las mismas constantes/exports, ahora
con valores recalculados.

## 4. Deuda técnica documentada (no se resuelve en este fix)

Este fix acota el peor caso reservado a un valor "razonable" (2), NO implementa reserva dinámica real.
Si en el futuro un card implementa `ADD_NUCLEO_DIE` y permite apilar más de 2 dados EXTRA del mismo
color en mesa, `LEADER_CONTENT.bottom` volverá a exceder `COMBAT_SCENE_VIEWPORT.height` para esa
partida concreta, sin que ningún test de solape lo detecte salvo el que se añade en §5. Cuando exista
ese contenido real, la solución correcta es la opción 1 original (reserva 100% dinámica: reposicionar
`HAND_ROW_POSITION`/`LEADER_POSITION`/tile del Líder/`PANEL_ZONES` según el número REAL de dados EXTRA
de cada render, no un tope fijo), que requiere tocar `role-view.ts` (reposicionamiento del
`GeometryMask` tras creación) y los 3 componentes React que hoy importan estas constantes como
literales fijos.

## 5. Verificación exigida a Programmer (no basta el test tautológico anterior)

El test insuficiente identificado en la ronda anterior solo comprobaba que las fórmulas de
`board-layout.ts` eran internamente consistentes entre sí (gaps `>= CONTENT_GAP_PX`), nunca contra el
límite real de `COMBAT_SCENE_VIEWPORT.height` — por eso no atrapó esta regresión.

Añadir a `board-layout.test.ts` (o nuevo archivo) una aserción explícita, importando
`COMBAT_SCENE_VIEWPORT` desde `../scenes/CombatScene` (o el módulo que corresponda tras revisar
imports circulares — si hay riesgo de ciclo, extraer el `height` a una constante compartida en
`board-layout.ts` y que `CombatScene.ts` la reexporte, documentando por qué):

```
expect(LEADER_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2).toBeLessThanOrEqual(COMBAT_SCENE_VIEWPORT.height - 36);
```

(36px = margen mínimo exigido por H4 spec §2.1, no solo `<= height`). Este test usa las constantes
YA calculadas con el peor caso reservado (`N = 2`) — si en el futuro alguien vuelve a subir
`NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR` sin ajustar el viewport, este test falla en rojo
inmediatamente, cerrando el hueco que permitió esta regresión.

Además, verificación de MEDICIÓN REAL (no tautológica, reproduce el método de QA), a añadir como test
Playwright (`apps/shell/e2e/combat-end-to-end.spec.ts` o nuevo spec) en AMBOS tamaños de ventana que QA
usó (1400×900 y 390×844):
1. Cargar una pantalla de combate real (0 dados EXTRA en mesa, caso por defecto).
2. Medir el `boundingClientRect()` del elemento DOM del tile/texto del Líder ("Soldado Base" o el
   nombre que corresponda al líder de fixture).
3. Asertar que `boundingClientRect().top` y `.bottom` están dentro de `[0, window.innerHeight]` —
   el Líder debe ser clickeable/tocable dentro del área visible real, no solo "dentro del viewport
   virtual de Phaser" (que es lo que el cálculo de arriba garantiza, pero QA midió coordenadas DOM
   reales, que es lo que hay que reproducir aquí).
4. Adicionalmente, click/tap real sobre el tile del Líder y sobre al menos 1 de sus 4 iconos de
   habilidad, verificando que el gesto se registra (abre ficha / dispara `handleAbilityTap`) — la
   prueba de que es "intocable" no es solo geométrica, es de interacción real.

## Resumen de valores finales

| Constante | Antes | Después |
|---|---|---|
| `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR` | 5 | **2** |
| `COMBAT_SCENE_VIEWPORT.height` | 1920 | **2060** |
| `LEADER_POSITION.y` (N=0, caso real hoy) | 2026 | **1676** |
| `LEADER_POSITION.y` (N=2, peor caso reservado) | — | **1816** |
| `LEADER_CONTENT.bottom` (N=2, peor caso reservado) | 2218 | **2008** |
| Margen contra viewport (N=0) | -106px (ya roto) | **192px** |
| Margen contra viewport (N=2, peor caso) | -298px | **52px** |
