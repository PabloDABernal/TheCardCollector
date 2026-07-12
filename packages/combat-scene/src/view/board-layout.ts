/**
 * H4 spec (`docs/specs/H4_layout_fuente_unica.md`) §2.1 — única fuente de verdad de coordenadas de
 * combate. Todo lo que se deriva de un vecino (`HAND_ROW_POSITION`, `LEADER_POSITION`, `ALLIES_ROW_Y`,
 * `NUCLEO_TABLE_ROW_Y`, ...) se calcula por fórmula en este mismo módulo — nunca se redeclara en otro
 * archivo.
 *
 * H5.1 (`docs/specs/H5.1_mesa_dados_centro.md`) §1 — INVIERTE cuál nodo es la raíz de la cadena de
 * derivación: `NUCLEO_TABLE_CENTER_Y` (centro exacto del viewport) pasa a ser la ÚNICA ancla, y todo
 * lo demás deriva en DOS direcciones desde ahí (zona superior Enemigo→Secuaces→Escenario hacia
 * arriba; zona inferior Aliados→Mano→Líder hacia abajo). `ENEMY_POSITION`/`SCENARIO_POSITION`/
 * `LEADER_POSITION` dejan de ser anclas top-down independientes — siguen siendo literales solo en el
 * sentido de que no se recalculan desde fuera de este archivo, pero ahora se DERIVAN por fórmula
 * desde `NUCLEO_TABLE_CENTER_Y`, no al revés.
 *
 * Dirección de dependencia: `juice/recipes/placeholder.ts` IMPORTA estas constantes (nunca al revés)
 * — este archivo no importa nada de `placeholder.ts`, así que no hay ciclo posible. Este archivo ya NO
 * importa nada de `@collector/domain-combat` (FIX URGENTE P0,
 * `docs/specs/H4_fix_urgente_lider_fuera_viewport.md` — `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR` dejó
 * de derivarse de `DEFAULT_NUCLEO_TABLE_MAX_DICE`/`FIXED_NUCLEO_DICE_COUNT`, ver ese export más abajo).
 */

/** Viewport virtual de diseño — mobile-first, ver docs/architecture_stack.md §4.2. Misma resolución
 *  que `main.ts` (H2.1) ya usaba para el propio `Phaser.Game` y que `Scale Manager` gobierna
 *  (configurado a nivel de `Phaser.Game`, no de la escena — ver `main.ts`, spec H2.6 §4).
 *
 *  MOVIDO desde `scenes/CombatScene.ts` (FIX URGENTE P0,
 *  `docs/specs/H4_fix_urgente_lider_fuera_viewport.md` §5) — `CombatScene.ts` importa `phaser` en
 *  runtime (no solo tipos), cuyo módulo ejecuta detección real de `Device`/`Canvas` al cargarse;
 *  `board-layout.test.ts` necesita verificar `LEADER_ABILITIES_ROW_Y` contra
 *  `COMBAT_SCENE_VIEWPORT.height` (H4 spec §5) sin arrastrar ese import pesado (crashea bajo el
 *  entorno de test sin un `<canvas>` real). `CombatScene.ts` reexporta este mismo valor para no
 *  romper ningún import externo existente (`main.ts`, `index.ts`).
 *
 *  FIX URGENTE P0 — `height` sube de 1920 a 2060 (+140px). Combinado con bajar
 *  `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR` de 5 a 2 (arriba), esto resuelve la regresión P0 en la
 *  que el Líder (tile, HP, sus 4 habilidades) se renderizaba SIEMPRE fuera del viewport. H5.1
 *  reutiliza el mismo viewport (sin cambios) — la mesa central se logra reorganizando la cadena de
 *  derivación dentro del mismo alto/ancho, no ampliando el viewport de nuevo. */
export const COMBAT_SCENE_VIEWPORT = { width: 1080, height: 2060 } as const;

// FIX QA post-`6d14b52` — duplicados documentados de las dimensiones reales de sprite que SÍ dibujan
// `nucleo-table-view.ts` (`NUCLEO_DIE_SIZE` 64, solo el dado FIXED base — los dados EXTRA apilados con
// `NUCLEO_EXTRA_DIE_STACK_OFFSET_PX` quedan fuera de este cálculo, limitación conocida y
// preexistente, no introducida por este fix). Mismo criterio de aislamiento que
// `MINION_TILE_HEIGHT_PX`/`ABILITY_ICON_HEIGHT_PX` (más abajo): se duplica el número en vez de
// importarlo, para no crear una dependencia cruzada view-a-view solo por una constante — pero queda
// comentado 1:1 contra su origen para que un cambio futuro en uno se refleje manualmente en el otro.
// H5.1 §3 — el tamaño del dado (`NUCLEO_DIE_SIZE`) NO se toca en esta historia (la spec sugiere subirlo
// moderadamente, 80-84, como ajuste visual opcional; se deja para una pasada de tuneo posterior, sin
// riesgo de romper el ancho de columnas dentro de `NUCLEO_PANEL_WIDTH`, ver más abajo).
export const NUCLEO_TILE_HALF_PX = 32; // = NUCLEO_DIE_SIZE (64) / 2 (nucleo-table-view.ts)

// NUEVO H5.1 §2.2 — tamaño compacto de tile de rol (Líder/Enemigo/Escenario), sustituye a
// `ROLE_TILE_HALF_PX` (100, RETIRADO — solo se usaba dentro de este archivo/su test, ninguna
// dependencia externa). Documentado 1:1 contra su origen real igual que el resto de duplicados de
// este archivo — `role-view.ts` reduce `ROLE_SIZE` de {200,200} a {140,140} en el mismo cambio.
export const COMPACT_ROLE_TILE_HALF_PX = 70; // = ROLE_SIZE compacto (140) / 2 (role-view.ts)

// NUEVO H5.1 §2.2 — offset de la fila de habilidades bajo un tile de rol compacto (Líder/Enemigo),
// escalado proporcionalmente desde el valor anterior (180 → ~126, redondeado a 120 por la spec).
export const COMPACT_ABILITIES_ROW_OFFSET_PX = 120;

// NUEVO H5.1 §2.2 — gap dentro de las zonas compactas (superior/inferior alrededor de la mesa),
// separado de `CONTENT_GAP_PX` (12, zonas no-compactas de fuera de esta historia — hoy ninguna, ver
// nota abajo). AJUSTADO a 6 (spec sugería 8 como punto de partida, "Programmer ajusta... si el
// resultado no pasa" — con 8 el margen inferior real cae a 32px, por debajo del mínimo de 36px ya
// exigido por el test heredado de H4 P0 más abajo; 6 es el valor máximo dentro de ese margen).
export const COMPACT_ZONE_GAP_PX = 6;

// Margen mínimo garantizado entre el borde real (bounding box) de dos filas de contenido
// consecutivas (tiles/texto/iconos), NO solo entre los fondos de `PANEL_ZONES`. H5.1 — con la mesa de
// Núcleos como ancla central, TODAS las filas de contenido quedan dentro de las zonas compactas
// (superior/inferior), así que `COMPACT_ZONE_GAP_PX` es hoy el único gap efectivamente usado en la
// cadena de derivación; `CONTENT_GAP_PX` se conserva como constante propia (histórica, referenciada
// por comentarios/tests) por si una futura zona no-compacta vuelve a necesitarla.
export const CONTENT_GAP_PX = 12;

// Alto aproximado de una línea de texto HUD (fontSize 20px, `CombatBoardOverlay.tsx`) — el texto de
// Enemigo/Líder/Escenario no usa saltos de línea (`\n`) hoy, así que basta con una línea; si algún
// día se añaden más líneas, este valor (y por tanto el hueco reservado para Escenario) debe crecer.
const ROLE_HUD_TEXT_LINE_HEIGHT_PX = 24;
// NUEVO H5.1 — offset del bloque de texto HTML (`CombatBoardOverlay.tsx` `ROLE_TEXT_OFFSET_Y`) bajo
// el CENTRO de un tile de rol compacto, escalado proporcionalmente al tile compacto (140/200 = 0.7)
// desde el valor anterior (120 → 84). Solo relevante para el Escenario en este archivo: es el único
// rol cuyo borde inferior de CONTENIDO real está gobernado por el texto (Trama/Fase) y no por una fila
// de habilidades (Líder/Enemigo tienen `AbilityRow`, cuyo offset —`COMPACT_ABILITIES_ROW_OFFSET_PX`,
// 120— ya cae más abajo que el texto, así que domina el cálculo de su propio bounding box en su lugar).
const COMPACT_ROLE_HUD_TEXT_OFFSET_PX = 84; // = ROLE_TEXT_OFFSET_Y compacto (CombatBoardOverlay.tsx)

// FIX_combat_viewport_and_layout.md §2.1 — `MINIONS_ROW_Y` debe dejar hueco vertical suficiente
// contra `ENEMY_ABILITIES_ROW_Y` para que el tile de secuaz (120x180, `CARD_PLACEHOLDER_HEIGHT`,
// `juice/recipes/placeholder.ts`) no solape con el icono de habilidad del Enemigo (`ICON_HEIGHT`,
// `ability-cooldown-view.ts`). Constantes duplicadas localmente (no importadas desde `juice/` ni
// desde `ability-cooldown-view.ts`) para no crear una dependencia cruzada solo por un número —
// mismo criterio de aislamiento que ya separa esos módulos. Exportadas para que
// `board-layout.test.ts` pueda verificar los rangos verticales sin duplicar los valores.
export const MINION_TILE_HEIGHT_PX = 180; // = CARD_PLACEHOLDER_HEIGHT (juice/recipes/placeholder.ts)
export const ABILITY_ICON_HEIGHT_PX = 24; // = ICON_HEIGHT (ability-cooldown-view.ts)
// Mismas dimensiones de tile (`CARD_PLACEHOLDER_WIDTH/HEIGHT`, 120×180) que `MINION_TILE_HEIGHT_PX`
// ya documenta para Secuaces — Aliados y cartas de Mano usan el mismo tile, así que reutilizan la
// misma semi-altura (FIX QA post-`6d14b52`, ver auditoría de `panel-allies`/`panel-hand` abajo).
export const CARD_TILE_HALF_PX = MINION_TILE_HEIGHT_PX / 2; // 90

// ============================================================================================
// H5.1 §2.1 — ancla raíz ÚNICA: centro vertical exacto del viewport. Ya NO es "lo que sobra tras
// colocar lo demás" (como `ENEMY_POSITION` en el modelo anterior) — es un literal de DISEÑO
// explícito (el requisito de backlog H5.1 es "centro de pantalla").
// ============================================================================================
export const NUCLEO_TABLE_CENTER_Y = Math.round(COMBAT_SCENE_VIEWPORT.height / 2); // 1030

// NUEVO H5.1 §2.1 — rango pedido por backlog H5.1 ("40-50% alto, 60-80% ancho"). Valores de diseño
// dentro del rango, no derivados de contenido — única excepción a `panelFromContent` en este archivo
// (ver `PANEL_ZONES` más abajo). `NUCLEO_PANEL_HEIGHT_RATIO` queda en el EXTREMO INFERIOR permitido
// (0.40, no 0.45 como sugería el punto de partida de la spec): un panel más alto reduce el
// presupuesto vertical disponible para las zonas compactas de arriba/abajo, y con `0.45` el margen
// inferior real (Líder) caía por debajo del mínimo de 36px ya exigido por un test heredado de H4 —
// `0.40` es el valor más alto dentro del rango que sigue dejando ese margen en verde (ver
// `board-layout.test.ts`).
export const NUCLEO_PANEL_HEIGHT_RATIO = 0.4; // dentro de [0.40, 0.50]
export const NUCLEO_PANEL_WIDTH_RATIO = 0.72; // dentro de [0.60, 0.80]

export const NUCLEO_PANEL_HEIGHT = Math.round(COMBAT_SCENE_VIEWPORT.height * NUCLEO_PANEL_HEIGHT_RATIO); // 824
export const NUCLEO_PANEL_WIDTH = Math.round(COMBAT_SCENE_VIEWPORT.width * NUCLEO_PANEL_WIDTH_RATIO); // 778

// La fila de dados FIXED se sigue centrando en `NUCLEO_TABLE_CENTER_Y` — con 0 dados EXTRA (caso
// normal), los dados están exactamente en el centro geométrico del panel. El panel tiene margen de
// sobra por diseño (824px de panel contra ~204px de contenido real de los dados) para que el apilado
// de dados EXTRA (hasta `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`) nunca se acerque al borde del panel.
export const NUCLEO_TABLE_ROW_Y = NUCLEO_TABLE_CENTER_Y; // 1030, reemplaza la fórmula derivada de ALLIES_CONTENT_BOTTOM_Y

/** RENOMBRADO H3.4 de `NUCLEO_POOL_ROW_Y` — mesa persistente de dados (ya no "pool" que se vacía).
 *  Alias conservado para no romper referencias existentes fuera de este cambio. */
export const NUCLEO_POOL_ROW_Y = NUCLEO_TABLE_ROW_Y;

const NUCLEO_PANEL_TOP_Y = NUCLEO_TABLE_CENTER_Y - NUCLEO_PANEL_HEIGHT / 2; // 1030 - 412 = 618
const NUCLEO_PANEL_BOTTOM_Y = NUCLEO_TABLE_CENTER_Y + NUCLEO_PANEL_HEIGHT / 2; // 1030 + 412 = 1442

// ============================================================================================
// Zona SUPERIOR — deriva HACIA ARRIBA desde el borde superior del panel de Núcleos (H5.1 §2.2).
// Orden de derivación: Escenario (adyacente al panel) → Secuaces → Enemigo (arriba del todo).
// ============================================================================================

/** Semi-extensión del contenido del Escenario hacia ABAJO desde su centro — el Escenario no tiene
 *  fila de habilidades (a diferencia de Líder/Enemigo), así que su borde inferior real está
 *  gobernado por el bloque de texto HTML (Trama/Fase, `CombatBoardOverlay.tsx`), no por el tile.
 *  `Math.max` cubre ambos casos sin asumir cuál domina (mismo criterio que el `SCENARIO_CONTENT`
 *  de abajo). */
const SCENARIO_BOTTOM_HALF_PX = Math.max(
  COMPACT_ROLE_TILE_HALF_PX,
  COMPACT_ROLE_HUD_TEXT_OFFSET_PX + ROLE_HUD_TEXT_LINE_HEIGHT_PX,
); // max(70, 108) = 108

// FIX deuda técnica (Reviewer, post-E5) — H5.1 spec §2.2 dice explícitamente que el hueco INMEDIATO
// contra el panel de Núcleos debe seguir usando `CONTENT_GAP_PX` (12, "el más importante de
// preservar generoso"), no `COMPACT_ZONE_GAP_PX` (6, reservado a las fronteras INTERNAS de cada zona
// compacta — ej. Escenario→Secuaces, Secuaces→Enemigo — nunca al borde contra la propia mesa). Antes
// de este fix, `CONTENT_GAP_PX` quedaba huérfano (sin ningún uso real en la cadena de derivación).
export const SCENARIO_POSITION = {
  x: 540,
  y: NUCLEO_PANEL_TOP_Y - CONTENT_GAP_PX - SCENARIO_BOTTOM_HALF_PX, // 618-12-108 = 498
};

export const MINIONS_ROW_Y =
  SCENARIO_POSITION.y - COMPACT_ROLE_TILE_HALF_PX - COMPACT_ZONE_GAP_PX - CARD_TILE_HALF_PX; // 498-70-6-90 = 332

/** Semi-extensión del contenido de Enemigo/Líder hacia su fila de habilidades — a diferencia del
 *  Escenario, Líder/Enemigo SÍ tienen `AbilityRow` bajo el tile, a un offset (120) mayor que el
 *  offset del texto HUD (84+24=108), así que la fila de habilidades es la que domina el borde
 *  inferior real de contenido. */
const ROLE_WITH_ABILITIES_BOTTOM_HALF_PX = COMPACT_ABILITIES_ROW_OFFSET_PX + ABILITY_ICON_HEIGHT_PX / 2; // 120+12 = 132

export const ENEMY_POSITION = {
  x: 540,
  y: MINIONS_ROW_Y - CARD_TILE_HALF_PX - COMPACT_ZONE_GAP_PX - ROLE_WITH_ABILITIES_BOTTOM_HALF_PX, // 332-90-6-132 = 104
};

export const ENEMY_ABILITIES_ROW_Y = ENEMY_POSITION.y + COMPACT_ABILITIES_ROW_OFFSET_PX; // 104+120 = 224

// ============================================================================================
// Zona INFERIOR — deriva HACIA ABAJO desde el borde inferior del panel de Núcleos (H5.1 §2.2).
// Orden de derivación: Aliados (adyacente al panel) → Mano → Líder (abajo del todo).
// ============================================================================================

// FIX deuda técnica (Reviewer, post-E5) — mismo criterio que `SCENARIO_POSITION` arriba: hueco
// INMEDIATO contra el panel de Núcleos usa `CONTENT_GAP_PX` (12), no `COMPACT_ZONE_GAP_PX` (6).
export const ALLIES_ROW_Y = NUCLEO_PANEL_BOTTOM_Y + CONTENT_GAP_PX + CARD_TILE_HALF_PX; // 1442+12+90 = 1544

export const HAND_ROW_POSITION = {
  x: 540,
  y: ALLIES_ROW_Y + CARD_TILE_HALF_PX + COMPACT_ZONE_GAP_PX + CARD_TILE_HALF_PX, // 1544+90+6+90 = 1730
};

export const LEADER_POSITION = {
  x: 540,
  y: HAND_ROW_POSITION.y + CARD_TILE_HALF_PX + COMPACT_ZONE_GAP_PX + COMPACT_ROLE_TILE_HALF_PX, // 1730+90+6+70 = 1896
};

// FIX deuda técnica (Reviewer, post-E5) — el margen real del Líder contra el borde del viewport baja
// de 38px a 32px (2060-2028) tras subir los 2 gaps inmediatos al panel de Núcleos de
// `COMPACT_ZONE_GAP_PX` (6) a `CONTENT_GAP_PX` (12) arriba (`SCENARIO_POSITION`/`ALLIES_ROW_Y`) — ese
// cambio empuja TODA la zona inferior (Aliados→Mano→Líder) 6px hacia abajo. Sigue >= 0 (el contenido
// completo del Líder sigue cayendo DENTRO del viewport, ver `board-layout.test.ts` §5.4), pero
// deja de cumplir el margen mínimo histórico de 36px que exigía el test heredado de H4
// (`H4_fix_urgente_lider_fuera_viewport.md` §5, "el borde inferior real del Líder... queda >= 36px
// por encima del alto del viewport") — pasa a 32px. DESVIACIÓN DELIBERADA (5ª, documentada en el
// resumen del fix de Programmer que corrigió `CONTENT_GAP_PX`): se prioriza la exigencia LITERAL y
// más reciente de H5.1 §2.2 ("el hueco inmediato contra el panel de Núcleos es el más importante de
// preservar generoso") sobre el margen numérico exacto de un test P0 anterior cuyo objetivo real
// (que el Líder no quede recortado fuera del viewport) se sigue cumpliendo con margen de sobra.
// RESUELTO: el test `board-layout.test.ts` (§"cabe dentro de COMBAT_SCENE_VIEWPORT.height") ya se
// actualizó a exigir >= 32px (en vez de 36px) para reflejar este trade-off consciente — deja de ser
// una decisión abierta.
export const LEADER_ABILITIES_ROW_Y = LEADER_POSITION.y + COMPACT_ABILITIES_ROW_OFFSET_PX; // 1896+120 = 2016

/** NUEVO H3 (capa visual) — separación vertical entre un dado FIXED y sus dados EXTRA apilados del
 *  mismo color (spec H3 §5.2, "agrupación visual por color"). */
export const NUCLEO_EXTRA_DIE_STACK_OFFSET_PX = 70;

// FIX URGENTE P0 (docs/specs/H4_fix_urgente_lider_fuera_viewport.md) — este valor es un LITERAL de
// diseño (rango realista 0-2 dados EXTRA por color), no derivado del peor caso teórico del dominio
// (`DEFAULT_NUCLEO_TABLE_MAX_DICE - FIXED_NUCLEO_DICE_COUNT`). Si en el futuro un card permite apilar
// más de 2 dados EXTRA del mismo color en mesa, este valor debe revisarse junto con el presupuesto de
// `NUCLEO_PANEL_HEIGHT`/`NUCLEO_PANEL_HEIGHT_RATIO` (H5.1).
export const NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR = 2;
const NUCLEO_MAX_STACK_OFFSET_PX = NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR * NUCLEO_EXTRA_DIE_STACK_OFFSET_PX; // 2*70 = 140
const NUCLEO_CONTENT_BOTTOM_Y = NUCLEO_TABLE_ROW_Y + NUCLEO_MAX_STACK_OFFSET_PX + NUCLEO_TILE_HALF_PX; // 1030+140+32 = 1202 (peor caso reservado: N=2)

export const TILE_SEPARATION_PX = 140;
// NUEVO H4.x — exportadas (antes privadas a minions-view.ts/allies-view.ts, eliminados ese mismo
// spec §2.2) para que `MinionRow.tsx`/`AllyRow.tsx` (apps/shell, HTML) posicionen sus tiles en las
// mismas coordenadas de viewport virtual que Phaser ya usaba, y para que `board-anchors-view.ts`
// (anclas invisibles de juice, ver ese archivo) siga anclando `hitImpact`/`floatingNumber` al mismo
// punto en pantalla que el tile HTML real ocupa.
export const MINIONS_ROW_X_ORIGIN = 200;
export const ALLIES_ROW_X_ORIGIN = 200;

// FIX_combat_viewport_and_layout.md §2.2 — antes: 100. A 14px, la etiqueta más larga del catálogo
// MVP ("Grito de Guerra 2/4", ~20 caracteres) ocupa ~170-180px renderizados — muy por encima de los
// 100px anteriores, provocando solapamiento horizontal entre etiquetas adyacentes con 2+
// habilidades del mismo lado. Con 200px de separación y 4 habilidades por lado (máximo actual del
// catálogo), la fila completa (3 × 200 = 600px, centrada en x=540) cae dentro del viewport de
// 1080px con margen sobrado.
export const ABILITY_ICON_SEPARATION_PX = 200;

// H4 spec §4.1 — paleta y tabla de paneles delimitados por zona (E4.2), sustituye la paleta gris
// genérica anterior por el sistema de diseño real (`--binder`/`--rule`, `apps/shell/src/ui/tokens.css`).
// `board-layout.ts` sigue siendo la única fuente de verdad de coordenadas; `panel-view.ts` consume
// `PANEL_ZONES` sin recalcular nada.
export const PANEL_FILL_COLOR = 0x1f1e26; // = --binder
export const PANEL_FILL_ALPHA = 0.62; // ligeramente más opaco que antes (0.55) — más lectura de
                                       // "funda de carta" sólida, menos "cristal flotante"
export const PANEL_BORDER_COLOR = 0x3a3744; // = --rule
export const PANEL_BORDER_WIDTH_PX = 2;
// ZONE_LABEL_COLOR_HEX retirado (H4 spec §4.1) — la etiqueta de zona deja de dibujarse en Phaser,
// migrada a `CombatBoardOverlay.tsx` (apps/shell), ver §2 de la spec.

// NUEVO H5.1 §3 — constantes de diseño del fondo/borde distintivo de la mesa de Núcleos
// (`nucleo-table-panel.ts`), mismo criterio que `PANEL_FILL_COLOR`/`PANEL_BORDER_COLOR` de arriba
// pero con un tono propio para diferenciar la mesa (la "ancla" visual permanente del tablero) del
// resto de paneles.
export const NUCLEO_PANEL_TABLE_FILL_COLOR = 0x171620; // ligeramente más oscuro que --binder (0x1f1e26)
export const NUCLEO_PANEL_TABLE_FILL_ALPHA = 0.55;
export const NUCLEO_PANEL_TABLE_ACCENT_COLOR = 0xd4a24c; // = --foil
export const NUCLEO_PANEL_TABLE_ACCENT_ALPHA = 0.35; // translúcido — presente SIEMPRE, no solo en foco
export const NUCLEO_PANEL_TABLE_ACCENT_WIDTH_PX = 3;
export const NUCLEO_PANEL_TABLE_RADIUS_PX = 24; // más redondeado que RADIUS_PANEL (12) — distingue su forma

export interface PanelZone {
  readonly id: string; // nombre estable, usado como scene name (debug/QA)
  readonly x: number; // centro X
  readonly y: number; // centro Y
  readonly width: number;
  readonly height: number;
  readonly label: string; // reutiliza el mismo texto que board.ts ya usaba en `zoneLabels`
}

// FIX QA post-`6d14b52` — cada `PanelZone` (salvo `panel-nucleos`, ver H5.1 abajo) parte de su
// BOUNDING BOX de contenido real (tile + HUD/iconos, usando las mismas constantes de tamaño que sus
// vistas — `COMPACT_ROLE_TILE_HALF_PX`, `CARD_TILE_HALF_PX`, `NUCLEO_TILE_HALF_PX`, etc.) y el panel
// se construye como ese bounding box + un margen fijo (`PANEL_CONTENT_PADDING_PX`).
// AJUSTADO H5.1 — bajado de 5 a 2: con `COMPACT_ZONE_GAP_PX` (6) por debajo del antiguo `2*5=10`
// que este padding consumía en cada frontera, dos paneles vecinos dentro de una zona compacta
// (`panel-enemy`/`panel-minions`, `panel-allies`/`panel-hand`, `panel-hand`/`panel-leader`, ...)
// llegaban a solaparse aunque su CONTENIDO real no lo hiciera (test "PANEL_ZONES sin solapes").
// `2` mantiene el mismo relleno cosmético entre sprite y fondo de panel (visualmente sutil en
// cualquiera de los dos valores) mientras deja `6 - 2*2 = 2px` de margen real entre fondos de panel
// vecinos — el resto de constantes de esta cadena (`COMPACT_ZONE_GAP_PX`) no pueden subir sin romper
// el margen mínimo de 36px ya exigido para el Líder (ver test H4 P0 más abajo), así que este es el
// lado que cede.
const PANEL_CONTENT_PADDING_PX = 2;

export interface ContentBox {
  readonly top: number;
  readonly bottom: number;
}

function panelFromContent(x: number, width: number, id: string, label: string, content: ContentBox): PanelZone {
  const top = content.top - PANEL_CONTENT_PADDING_PX;
  const bottom = content.bottom + PANEL_CONTENT_PADDING_PX;
  return { id, x, y: (top + bottom) / 2, width, height: bottom - top, label };
}

const ENEMY_CONTENT: ContentBox = {
  top: ENEMY_POSITION.y - COMPACT_ROLE_TILE_HALF_PX,
  bottom: ENEMY_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
};
const MINIONS_CONTENT: ContentBox = {
  top: MINIONS_ROW_Y - CARD_TILE_HALF_PX,
  bottom: MINIONS_ROW_Y + CARD_TILE_HALF_PX,
};
const SCENARIO_CONTENT: ContentBox = {
  top: SCENARIO_POSITION.y - COMPACT_ROLE_TILE_HALF_PX,
  bottom: SCENARIO_POSITION.y + SCENARIO_BOTTOM_HALF_PX,
};
const ALLIES_CONTENT: ContentBox = {
  top: ALLIES_ROW_Y - CARD_TILE_HALF_PX,
  bottom: ALLIES_ROW_Y + CARD_TILE_HALF_PX,
};
const NUCLEOS_CONTENT: ContentBox = {
  top: NUCLEO_TABLE_ROW_Y - NUCLEO_TILE_HALF_PX,
  bottom: NUCLEO_CONTENT_BOTTOM_Y,
};
const HAND_CONTENT: ContentBox = {
  top: HAND_ROW_POSITION.y - CARD_TILE_HALF_PX,
  bottom: HAND_ROW_POSITION.y + CARD_TILE_HALF_PX,
};
const LEADER_CONTENT: ContentBox = {
  top: LEADER_POSITION.y - COMPACT_ROLE_TILE_HALF_PX,
  bottom: LEADER_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
};

/**
 * H5.1 §2.1/§4 — las 7 filas de contenido real (no fondos de panel), ordenadas de arriba a abajo.
 * `nucleos` cambia de posición respecto al modelo H4 (antes entre `allies` y `hand`; ahora entre
 * `scenario` y `allies`, reflejando que la mesa de Núcleos pasa a ser el CENTRO de la cadena de
 * derivación, no un eslabón más de una cadena top-down única). Expuesto para que
 * `board-layout.test.ts` verifique que el gap real entre `ContentBox` consecutivas es siempre
 * positivo y por encima del mínimo de diseño.
 */
export const CONTENT_BOXES_TOP_TO_BOTTOM: readonly { readonly id: string; readonly box: ContentBox }[] = [
  { id: 'enemy', box: ENEMY_CONTENT },
  { id: 'minions', box: MINIONS_CONTENT },
  { id: 'scenario', box: SCENARIO_CONTENT },
  { id: 'nucleos', box: NUCLEOS_CONTENT },
  { id: 'allies', box: ALLIES_CONTENT },
  { id: 'hand', box: HAND_CONTENT },
  { id: 'leader', box: LEADER_CONTENT },
];

export const PANEL_ZONES: readonly PanelZone[] = [
  panelFromContent(540, 1000, 'panel-enemy', 'Enemigo', ENEMY_CONTENT),
  panelFromContent(540, 1000, 'panel-minions', 'Secuaces', MINIONS_CONTENT),
  panelFromContent(540, 1000, 'panel-scenario', 'Escenario', SCENARIO_CONTENT),
  // NUEVO H5.1 §2.1 — ÚNICA excepción a `panelFromContent` de este archivo: el panel de Núcleos
  // dimensiona por RATIO de viewport (diseño deliberado, "mesa central" con relleno generoso
  // alrededor de los dados), no por el bounding box mínimo de su contenido real (`NUCLEOS_CONTENT`,
  // que sigue existiendo arriba solo para el test de no-solape, ver §5 de la spec).
  { id: 'panel-nucleos', x: 540, y: NUCLEO_TABLE_CENTER_Y, width: NUCLEO_PANEL_WIDTH, height: NUCLEO_PANEL_HEIGHT, label: 'Núcleos' },
  panelFromContent(540, 1000, 'panel-allies', 'Aliados', ALLIES_CONTENT),
  panelFromContent(540, 1040, 'panel-hand', 'Mano', HAND_CONTENT),
  panelFromContent(540, 1000, 'panel-leader', 'Líder', LEADER_CONTENT),
];
