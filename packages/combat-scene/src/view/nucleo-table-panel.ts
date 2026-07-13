import type Phaser from 'phaser';
import {
  NUCLEO_PANEL_TABLE_FILL_COLOR,
  NUCLEO_PANEL_TABLE_FILL_ALPHA,
  NUCLEO_PANEL_TABLE_ACCENT_COLOR,
  NUCLEO_PANEL_TABLE_ACCENT_ALPHA,
  NUCLEO_PANEL_TABLE_ACCENT_WIDTH_PX,
  NUCLEO_PANEL_TABLE_RADIUS_PX,
} from './board-layout';

export interface NucleoTablePanelOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** H5.1 §3 — fondo distintivo de la mesa de Núcleos: panel más grande y con más peso visual que el
 *  resto de `PANEL_ZONES` (fill algo más oscuro/saturado + borde `--foil` translúcido PERSISTENTE,
 *  para que se lea como "el centro" incluso sin ningún efecto de foco activo, ver H5.3/H5.4). NO
 *  participa en `panelFromContent` (`board-layout.ts` §2.1) — se dibuja como una capa adicional,
 *  nunca sustituye la entrada `panel-nucleos` de `PANEL_ZONES` (que sigue existiendo para la
 *  etiqueta de zona en `CombatBoardOverlay.tsx` y para el test de no-solape).
 *
 *  Llamado UNA vez desde `createBoardView`/`board-view.ts`, ANTES de `createNucleoTable` — así los
 *  dados se dibujan por encima de este fondo de mesa (orden de creación = orden de capas en Phaser). */
export function createNucleoTablePanel(scene: Phaser.Scene, options: NucleoTablePanelOptions): void {
  const { x, y, width, height } = options;

  scene.add
    .rectangle(x, y, width, height, NUCLEO_PANEL_TABLE_FILL_COLOR, NUCLEO_PANEL_TABLE_FILL_ALPHA)
    .setStrokeStyle(NUCLEO_PANEL_TABLE_ACCENT_WIDTH_PX, NUCLEO_PANEL_TABLE_ACCENT_COLOR, NUCLEO_PANEL_TABLE_ACCENT_ALPHA)
    .setName('nucleo-table-panel');

  // `Rectangle.setStrokeStyle` de Phaser no redondea esquinas — el borde/relleno redondeado real
  // (mismo patrón que `rounded-frame.ts` usa para tiles de rol/dado) se refuerza con un `Graphics`
  // decorativo encima, puramente visual, sin `setName`/`setData('targetId', ...)` (nunca es un
  // objetivo de targeting ni de foco).
  const border = scene.add.graphics();
  border.lineStyle(NUCLEO_PANEL_TABLE_ACCENT_WIDTH_PX, NUCLEO_PANEL_TABLE_ACCENT_COLOR, NUCLEO_PANEL_TABLE_ACCENT_ALPHA);
  border.strokeRoundedRect(x - width / 2, y - height / 2, width, height, NUCLEO_PANEL_TABLE_RADIUS_PX);
}
