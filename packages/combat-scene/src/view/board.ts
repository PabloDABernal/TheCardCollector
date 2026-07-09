import type Phaser from 'phaser';
import { createPanels } from './panel-view';

/**
 * Zonas visuales fijas (Núcleos, Líder, Enemigo, Escenario, Aliados en mesa, Secuaces en mesa, mano)
 * sin lógica de estado — capa puramente decorativa/de layout (spec §0.2 punto 1). No lleva `name`
 * ni `data.targetId` interactivo: no es un game object animable, solo referencia visual de dónde
 * vive cada zona.
 *
 * H4 spec §2.1/§2.4 — pinta paneles de fondo+borde+etiqueta por cada `PanelZone` (E4.2), ANTES de
 * que `createBoardView()` dibuje el resto de game objects (roles/mano/aliados/secuaces/núcleos/
 * habilidades) — `createBoard()` es lo primero que `createBoardView()` invoca (`board-view.ts`),
 * así que los paneles quedan automáticamente detrás de todo lo demás. La antigua `zoneLabels`
 * centrada se sustituye por las etiquetas de `createPanels`, posicionadas relativas a cada
 * `PanelZone` en vez de a las constantes sueltas de posición — mismo texto, una sola fuente de
 * verdad de dónde vive cada zona.
 */
export function createBoard(scene: Phaser.Scene): void {
  createPanels(scene);
}
