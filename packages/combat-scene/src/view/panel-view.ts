import type Phaser from 'phaser';
import {
  PANEL_ZONES,
  PANEL_FILL_COLOR,
  PANEL_FILL_ALPHA,
  PANEL_BORDER_COLOR,
  PANEL_BORDER_WIDTH_PX,
  ZONE_LABEL_COLOR_HEX,
} from './board-layout';

/**
 * H4 spec §2.4 — crea (una única vez) un `Rectangle` de fondo + borde por cada entrada de
 * `PANEL_ZONES`, y un `Text` de etiqueta de zona en su esquina superior (reemplaza el
 * `scene.add.text` centrado que `board.ts` hacía antes — mismo texto, nueva posición/color, spec
 * §2.2). Sin lógica de estado — igual que `createBoard`, capa puramente decorativa.
 */
export function createPanels(scene: Phaser.Scene): void {
  for (const zone of PANEL_ZONES) {
    scene.add
      .rectangle(zone.x, zone.y, zone.width, zone.height, PANEL_FILL_COLOR, PANEL_FILL_ALPHA)
      .setStrokeStyle(PANEL_BORDER_WIDTH_PX, PANEL_BORDER_COLOR)
      .setName(zone.id);

    scene.add
      .text(zone.x - zone.width / 2 + 12, zone.y - zone.height / 2 + 8, zone.label, {
        fontSize: '18px',
        color: ZONE_LABEL_COLOR_HEX,
        align: 'left',
      })
      .setOrigin(0, 0);
  }
}
