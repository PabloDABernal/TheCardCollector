import type Phaser from 'phaser';
import {
  LEADER_POSITION,
  ENEMY_POSITION,
  SCENARIO_POSITION,
  HAND_ROW_POSITION,
  NUCLEO_TABLE_ROW_Y,
  ALLIES_ROW_Y,
  MINIONS_ROW_Y,
} from './board-layout';

const ZONE_LABEL_COLOR = '#666666';
const ZONE_WIDTH = 1080;
const ZONE_HEIGHT = 40;

/**
 * Zonas visuales fijas (Núcleos, Líder, Enemigo, Escenario, Aliados en mesa, Secuaces en mesa, mano)
 * sin lógica de estado — capa puramente decorativa/de layout (spec §0.2 punto 1). No lleva `name`
 * ni `data.targetId`: no es un game object interactivo/animable, solo referencia visual de dónde
 * vive cada zona.
 */
export function createBoard(scene: Phaser.Scene): void {
  const zoneLabels: Array<{ y: number; text: string }> = [
    { y: MINIONS_ROW_Y - ZONE_HEIGHT, text: 'Secuaces' },
    { y: ENEMY_POSITION.y - ZONE_HEIGHT, text: 'Enemigo' },
    { y: SCENARIO_POSITION.y - ZONE_HEIGHT, text: 'Escenario' },
    { y: ALLIES_ROW_Y - ZONE_HEIGHT, text: 'Aliados' },
    { y: NUCLEO_TABLE_ROW_Y - ZONE_HEIGHT, text: 'Núcleos' },
    { y: HAND_ROW_POSITION.y - ZONE_HEIGHT, text: 'Mano' },
    { y: LEADER_POSITION.y - ZONE_HEIGHT, text: 'Líder' },
  ];

  for (const zone of zoneLabels) {
    scene.add.text(ZONE_WIDTH / 2, zone.y, zone.text, {
      fontSize: '18px',
      color: ZONE_LABEL_COLOR,
      align: 'center',
    }).setOrigin(0.5, 0.5);
  }
}
