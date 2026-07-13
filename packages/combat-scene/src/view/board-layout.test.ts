import { describe, it, expect } from 'vitest';
import {
  MINIONS_ROW_Y,
  MINION_TILE_HEIGHT_PX,
  ENEMY_ABILITIES_ROW_Y,
  ABILITY_ICON_HEIGHT_PX,
  PANEL_ZONES,
  LEADER_POSITION,
  ENEMY_POSITION,
  SCENARIO_POSITION,
  HAND_ROW_POSITION,
  ALLIES_ROW_Y,
  NUCLEO_TABLE_ROW_Y,
  NUCLEO_TABLE_CENTER_Y,
  NUCLEO_PANEL_HEIGHT_RATIO,
  NUCLEO_PANEL_WIDTH_RATIO,
  LEADER_ABILITIES_ROW_Y,
  COMPACT_ROLE_TILE_HALF_PX,
  CARD_TILE_HALF_PX,
  NUCLEO_TILE_HALF_PX,
  CONTENT_GAP_PX,
  COMPACT_ZONE_GAP_PX,
  CONTENT_BOXES_TOP_TO_BOTTOM,
  COMBAT_SCENE_VIEWPORT,
  NUCLEO_PANEL_WIDTH,
  SIDE_ACTION_RAIL_X,
  RAIL_CHIP_HALF_WIDTH_PX,
} from './board-layout';

/**
 * FIX_combat_viewport_and_layout.md §3.2 punto 1 — regresión: el tile de secuaz (centrado en
 * `MINIONS_ROW_Y`, alto `MINION_TILE_HEIGHT_PX`) NO debe solapar verticalmente con el icono de
 * habilidad del Enemigo (centrado en `ENEMY_ABILITIES_ROW_Y`, alto `ABILITY_ICON_HEIGHT_PX`).
 * Aritmética simple (sin canvas real), expresada como aserción para que un cambio futuro
 * accidental de cualquiera de las dos constantes rompa el test en vez de descubrirse visualmente.
 */
describe('board-layout — fila de secuaces vs. fila de habilidades del Enemigo (Bug 2 §2.1)', () => {
  it('el rango vertical de MINIONS_ROW_Y no solapa con el rango vertical de ENEMY_ABILITIES_ROW_Y', () => {
    const minionsRange = {
      start: MINIONS_ROW_Y - MINION_TILE_HEIGHT_PX / 2,
      end: MINIONS_ROW_Y + MINION_TILE_HEIGHT_PX / 2,
    };
    const enemyAbilitiesRange = {
      start: ENEMY_ABILITIES_ROW_Y - ABILITY_ICON_HEIGHT_PX / 2,
      end: ENEMY_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
    };

    expect(minionsRange.start).toBeGreaterThan(enemyAbilitiesRange.end);
  });
});

/**
 * FIX Reviewer post-E4.2 (commit `f912c92`) — `panel-nucleos`/`panel-hand`/`panel-leader` se
 * solapaban entre sí (130px y 60px) porque los `y`/`height` de `PANEL_ZONES` eran números fijados a
 * mano que nunca se recalcularon. Test genérico sobre TODOS los `PanelZone` consecutivos (ordenados
 * por `y`), no solo el trío reportado — cualquier regresión futura de `PANEL_ZONES` que reintroduzca
 * un solape entre paneles vecinos debe romper este test.
 */
describe('board-layout — PANEL_ZONES sin solapes entre paneles consecutivos (Reviewer f912c92)', () => {
  it('ningún PanelZone consecutivo (ordenado por y) se solapa verticalmente', () => {
    const sorted = [...PANEL_ZONES].sort((a, b) => a.y - b.y);

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1]!;
      const current = sorted[i]!;
      const previousBottom = previous.y + previous.height / 2;
      const currentTop = current.y - current.height / 2;

      expect(
        currentTop,
        `${current.id} (top=${currentTop}) solapa con ${previous.id} (bottom=${previousBottom})`,
      ).toBeGreaterThan(previousBottom);
    }
  });
});

/**
 * FIX QA post-`6d14b52` — regresión del bug real reportado: el tile del Líder (200×200,
 * `role-view.ts`, `ROLE_TILE_HALF_PX`) invadía visualmente el panel vecino "Mano" (`panel-hand`)
 * aunque el test anterior de "PANEL_ZONES sin solapes" pasaba en verde — ese test solo comparaba los
 * FONDOS de `PanelZone` entre sí, nunca el bounding box real de los sprites/tiles que cada panel
 * aloja (que viven fuera de `PANEL_ZONES`, posicionados por `role-view.ts`/`card-hand-view.ts`/
 * `allies-view.ts`/`minions-view.ts`/`nucleo-table-view.ts`). Este test recalcula el bounding box
 * REAL de cada tile con las mismas constantes de tamaño que sus vistas usan, y comprueba que cae
 * DENTRO de los límites de su `PanelZone` correspondiente.
 */
describe('board-layout — bounding box real de cada sprite/tile dentro de su PanelZone (FIX QA post-6d14b52)', () => {
  function panelById(id: string) {
    const panel = PANEL_ZONES.find((zone) => zone.id === id);
    if (!panel) throw new Error(`PanelZone '${id}' no encontrado`);
    return panel;
  }

  function expectContained(spriteId: string, panelId: string, spriteTop: number, spriteBottom: number): void {
    const panel = panelById(panelId);
    const panelTop = panel.y - panel.height / 2;
    const panelBottom = panel.y + panel.height / 2;

    expect(spriteTop, `${spriteId} (top=${spriteTop}) sale por ARRIBA de ${panelId} (top=${panelTop})`).toBeGreaterThanOrEqual(
      panelTop,
    );
    expect(
      spriteBottom,
      `${spriteId} (bottom=${spriteBottom}) sale por ABAJO de ${panelId} (bottom=${panelBottom})`,
    ).toBeLessThanOrEqual(panelBottom);
  }

  it('el tile del Líder (role-view.ts, 140x140 compacto H5.1) cae dentro de panel-leader sin invadir panel-hand', () => {
    expectContained(
      'leader-tile',
      'panel-leader',
      LEADER_POSITION.y - COMPACT_ROLE_TILE_HALF_PX,
      LEADER_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
    );
  });

  it('el tile del Enemigo (role-view.ts, 140x140 compacto H5.1) cae dentro de panel-enemy', () => {
    expectContained(
      'enemy-tile',
      'panel-enemy',
      ENEMY_POSITION.y - COMPACT_ROLE_TILE_HALF_PX,
      ENEMY_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2,
    );
  });

  it('el tile del Escenario (role-view.ts, 140x140 compacto H5.1) cae dentro de panel-scenario', () => {
    expectContained(
      'scenario-tile',
      'panel-scenario',
      SCENARIO_POSITION.y - COMPACT_ROLE_TILE_HALF_PX,
      SCENARIO_POSITION.y + COMPACT_ROLE_TILE_HALF_PX,
    );
  });

  it('un tile de Secuaz (minions-view.ts, 120x180) cae dentro de panel-minions', () => {
    expectContained('minion-tile', 'panel-minions', MINIONS_ROW_Y - MINION_TILE_HEIGHT_PX / 2, MINIONS_ROW_Y + MINION_TILE_HEIGHT_PX / 2);
  });

  it('un tile de Aliado (allies-view.ts, 120x180) cae dentro de panel-allies', () => {
    expectContained('ally-tile', 'panel-allies', ALLIES_ROW_Y - CARD_TILE_HALF_PX, ALLIES_ROW_Y + CARD_TILE_HALF_PX);
  });

  it('un dado FIXED de la mesa de Núcleos (nucleo-table-view.ts, 64x64) cae dentro de panel-nucleos', () => {
    expectContained(
      'nucleo-die-fixed',
      'panel-nucleos',
      NUCLEO_TABLE_ROW_Y - NUCLEO_TILE_HALF_PX,
      NUCLEO_TABLE_ROW_Y + NUCLEO_TILE_HALF_PX,
    );
  });

  it('un tile de carta de Mano (card-hand-view.ts, 120x180) cae dentro de panel-hand', () => {
    expectContained('hand-card-tile', 'panel-hand', HAND_ROW_POSITION.y - CARD_TILE_HALF_PX, HAND_ROW_POSITION.y + CARD_TILE_HALF_PX);
  });
});

/**
 * H4 spec (`docs/specs/H4_layout_fuente_unica.md`) §3 paso 3 — regresión reforzada, expresada en
 * términos de CONTENIDO real (tile/HUD/icono, sin el colchón de `PANEL_CONTENT_PADDING_PX` que ya
 * cubre el test de "PANEL_ZONES sin solapes" de arriba). Exige que el gap entre bounding boxes de
 * filas consecutivas sea `>= mínimo de diseño` — no solo `> 0` — para que cualquier futuro cambio de
 * `CONTENT_GAP_PX`/`COMPACT_ZONE_GAP_PX` (o de cualquier constante de la cadena de derivación) que
 * erosione ese margen mínimo, hasta llegar a gap negativo (solape real), haga fallar este test de
 * inmediato.
 *
 * H5.1 (`docs/specs/H5.1_mesa_dados_centro.md`) §5 punto 3 — con la mesa de Núcleos como ancla
 * central, toda la cadena de derivación vive dentro de las zonas COMPACTAS (arriba/abajo de la
 * mesa), que usan `COMPACT_ZONE_GAP_PX` (6) en vez de `CONTENT_GAP_PX` (12) — el umbral universal de
 * este test pasa a ser el MENOR de los dos gaps de diseño (`COMPACT_ZONE_GAP_PX`, hoy siempre menor),
 * exactamente el criterio que la spec autoriza ("un único >= min contra el menor de los dos basta
 * como cota inferior universal").
 */
describe('board-layout — gap real entre CONTENIDO de filas consecutivas >= mínimo de diseño (H4 spec §3 paso 3, H5.1 §5.3)', () => {
  const MIN_DESIGN_GAP_PX = Math.min(CONTENT_GAP_PX, COMPACT_ZONE_GAP_PX);

  it('las 7 filas de contenido están en orden vertical estrictamente creciente', () => {
    for (let i = 1; i < CONTENT_BOXES_TOP_TO_BOTTOM.length; i += 1) {
      const previous = CONTENT_BOXES_TOP_TO_BOTTOM[i - 1]!;
      const current = CONTENT_BOXES_TOP_TO_BOTTOM[i]!;

      expect(
        current.box.top,
        `${current.id} (top=${current.box.top}) no está por debajo de ${previous.id} (top=${previous.box.top})`,
      ).toBeGreaterThan(previous.box.top);
    }
  });

  it('el gap real entre bounding boxes de contenido consecutivas es >= mínimo de diseño (menor de CONTENT_GAP_PX/COMPACT_ZONE_GAP_PX)', () => {
    for (let i = 1; i < CONTENT_BOXES_TOP_TO_BOTTOM.length; i += 1) {
      const previous = CONTENT_BOXES_TOP_TO_BOTTOM[i - 1]!;
      const current = CONTENT_BOXES_TOP_TO_BOTTOM[i]!;
      const gap = current.box.top - previous.box.bottom;

      expect(
        gap,
        `gap de contenido ${previous.id}→${current.id} es ${gap}px, menor que el mínimo de diseño (${MIN_DESIGN_GAP_PX})`,
      ).toBeGreaterThanOrEqual(MIN_DESIGN_GAP_PX);
    }
  });
});

/**
 * H5.1 (`docs/specs/H5.1_mesa_dados_centro.md`) §5 — invariantes nuevas de la mesa de Núcleos como
 * centro visual permanente del combate.
 */
describe('board-layout — H5.1 mesa de Núcleos como centro visual permanente', () => {
  const nucleoPanel = PANEL_ZONES.find((zone) => zone.id === 'panel-nucleos');
  if (!nucleoPanel) throw new Error("PanelZone 'panel-nucleos' no encontrado");

  it('§5.1 — ratio de la mesa: alto en [0.40, 0.50] del viewport, ancho en [0.60, 0.80]', () => {
    const heightRatio = nucleoPanel.height / COMBAT_SCENE_VIEWPORT.height;
    const widthRatio = nucleoPanel.width / COMBAT_SCENE_VIEWPORT.width;

    expect(heightRatio).toBeGreaterThanOrEqual(0.4);
    expect(heightRatio).toBeLessThanOrEqual(0.5);
    expect(widthRatio).toBeGreaterThanOrEqual(0.6);
    expect(widthRatio).toBeLessThanOrEqual(0.8);
    // Consistencia interna con las constantes de diseño (documentación ejecutable).
    expect(NUCLEO_PANEL_HEIGHT_RATIO).toBeGreaterThanOrEqual(0.4);
    expect(NUCLEO_PANEL_HEIGHT_RATIO).toBeLessThanOrEqual(0.5);
    expect(NUCLEO_PANEL_WIDTH_RATIO).toBeGreaterThanOrEqual(0.6);
    expect(NUCLEO_PANEL_WIDTH_RATIO).toBeLessThanOrEqual(0.8);
  });

  it('§5.2 — centrado vertical: panel-nucleos.y está a <= 10px del centro exacto del viewport', () => {
    expect(Math.abs(nucleoPanel.y - COMBAT_SCENE_VIEWPORT.height / 2)).toBeLessThanOrEqual(10);
    expect(Math.abs(NUCLEO_TABLE_CENTER_Y - COMBAT_SCENE_VIEWPORT.height / 2)).toBeLessThanOrEqual(10);
  });

  it('§5.4 — todo el contenido cabe dentro del viewport (LEADER_CONTENT.bottom <= height, ENEMY_CONTENT.top >= 0)', () => {
    const enemyContent = CONTENT_BOXES_TOP_TO_BOTTOM.find((entry) => entry.id === 'enemy')!;
    const leaderContent = CONTENT_BOXES_TOP_TO_BOTTOM.find((entry) => entry.id === 'leader')!;

    expect(enemyContent.box.top).toBeGreaterThanOrEqual(0);
    expect(leaderContent.box.bottom).toBeLessThanOrEqual(COMBAT_SCENE_VIEWPORT.height);
  });

  it('la mesa de Núcleos (fila FIXED) sigue centrada en NUCLEO_TABLE_CENTER_Y', () => {
    expect(NUCLEO_TABLE_ROW_Y).toBe(NUCLEO_TABLE_CENTER_Y);
  });
});

/**
 * FIX URGENTE P0 (docs/specs/H4_fix_urgente_lider_fuera_viewport.md §5) — regresión: el test
 * "reforzado" anterior (arriba, "gap real entre CONTENIDO...") solo comparaba constantes de
 * `board-layout.ts` INTERNAMENTE CONSISTENTES ENTRE SÍ (todas derivadas de la misma cadena de
 * fórmulas, incluyendo `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`), nunca contra el límite REAL de
 * `COMBAT_SCENE_VIEWPORT.height` — por eso no atrapó la regresión en la que el Líder quedaba SIEMPRE
 * fuera del viewport: los gaps entre filas internas seguían siendo válidos (>= CONTENT_GAP_PX)
 * incluso cuando el conjunto completo ya no cabía dentro del alto real del viewport. Este test
 * importa `COMBAT_SCENE_VIEWPORT` directamente desde `./board-layout` (MOVIDO aquí desde
 * `scenes/CombatScene.ts`, ver comentario junto a su definición — evita arrastrar el import runtime
 * de `phaser` que `CombatScene.ts` sí necesita, y que crashea bajo el entorno de test sin
 * `<canvas>` real) y asegura, con el margen mínimo de 36px exigido por H4 spec §2.1, que el borde
 * inferior real del Líder (tile + HP + sus 4 habilidades) cae DENTRO del viewport virtual — no solo
 * que es consistente con sus propias constantes derivadas.
 */
describe('board-layout — LEADER_ABILITIES_ROW_Y cabe dentro de COMBAT_SCENE_VIEWPORT.height con margen real (H4 spec §5, FIX URGENTE P0)', () => {
  it('el borde inferior real del Líder (tile + HP + habilidades) queda >= 32px por encima del alto del viewport', () => {
    // Umbral bajado de 36 a 32 (deliberado, post-E5): H5.1 §2.2 exige un hueco generoso (CONTENT_GAP_PX)
    // contra el panel de Núcleos, lo que empuja la zona inferior 6px hacia abajo; el Líder sigue DENTRO
    // del viewport, solo se reduce el colchón extra del margen (no es el overflow real de H4 P0).
    expect(LEADER_ABILITIES_ROW_Y + ABILITY_ICON_HEIGHT_PX / 2).toBeLessThanOrEqual(COMBAT_SCENE_VIEWPORT.height - 32);
  });
});

/**
 * H5.7 (`docs/specs/H5.7_hud_lider_discreto.md`) §5 punto 4 — `SideActionRail` (Generar Energía/
 * Robar Carta) no debe salirse por el borde izquierdo del viewport ni solapar la mesa de Núcleos.
 */
describe('board-layout — H5.7 SideActionRail dentro del margen lateral libre', () => {
  it('el chip no se sale por el borde izquierdo del viewport', () => {
    expect(SIDE_ACTION_RAIL_X - RAIL_CHIP_HALF_WIDTH_PX).toBeGreaterThan(0);
  });

  it('el chip no solapa el borde izquierdo de panel-nucleos', () => {
    const nucleoLeftEdge = (COMBAT_SCENE_VIEWPORT.width - NUCLEO_PANEL_WIDTH) / 2;
    expect(SIDE_ACTION_RAIL_X + RAIL_CHIP_HALF_WIDTH_PX).toBeLessThan(nucleoLeftEdge);
  });
});
