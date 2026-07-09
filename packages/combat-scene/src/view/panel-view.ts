import type Phaser from 'phaser';
import { PANEL_ZONES, PANEL_FILL_COLOR, PANEL_FILL_ALPHA, PANEL_BORDER_COLOR, PANEL_BORDER_WIDTH_PX } from './board-layout';

/**
 * H4 spec §4.1 — crea (una única vez) un `Rectangle` de fondo + borde por cada entrada de
 * `PANEL_ZONES`. Ya NO dibuja el `Text` de etiqueta de zona (retirado, spec §2.4): ese texto se
 * migró a `CombatBoardOverlay.tsx` (`apps/shell`), la capa HTML sincronizada con el transform del
 * canvas — es texto de lectura de estado estático que nunca participa en tweens/juice, el perfil de
 * contenido donde DOM+CSS gana sin coste (spec §2.2). Sin lógica de estado — igual que `createBoard`,
 * capa puramente decorativa.
 */
export function createPanels(scene: Phaser.Scene): void {
  for (const zone of PANEL_ZONES) {
    scene.add
      .rectangle(zone.x, zone.y, zone.width, zone.height, PANEL_FILL_COLOR, PANEL_FILL_ALPHA)
      .setStrokeStyle(PANEL_BORDER_WIDTH_PX, PANEL_BORDER_COLOR)
      .setName(zone.id);
  }
}
