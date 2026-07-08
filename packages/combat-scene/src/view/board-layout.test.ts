import { describe, it, expect } from 'vitest';
import {
  MINIONS_ROW_Y,
  MINION_TILE_HEIGHT_PX,
  ENEMY_ABILITIES_ROW_Y,
  ABILITY_ICON_HEIGHT_PX,
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
