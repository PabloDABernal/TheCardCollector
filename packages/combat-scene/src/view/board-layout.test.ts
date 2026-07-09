import { describe, it, expect } from 'vitest';
import {
  MINIONS_ROW_Y,
  MINION_TILE_HEIGHT_PX,
  ENEMY_ABILITIES_ROW_Y,
  ABILITY_ICON_HEIGHT_PX,
  PANEL_ZONES,
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
