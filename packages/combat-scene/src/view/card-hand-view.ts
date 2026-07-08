import type Phaser from 'phaser';
import type { CardId } from '@collector/domain-shared';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext, HandCardViewData } from './board-view-context';
import { HAND_ROW_POSITION, TILE_SEPARATION_PX } from './board-layout';

const CARD_WIDTH = 120;
const CARD_HEIGHT = 180;
const CARD_COLOR = 0x34495e;
const ALPHA_AFFORDABLE = 1;
const ALPHA_UNAFFORDABLE = 0.4;

export function cardTileName(cardId: CardId): string {
  return `card-${cardId}`;
}

export interface CardHandView {
  /** Ajusta SOLO el alpha (afford/no-afford por Energía, spec §0.2 punto 6) contra el snapshot
   *  actual. Nunca destruye/recrea tiles — mismo criterio de estabilidad de identidad que RoleView. */
  update(snapshot: CombatStateSnapshot): void;
}

interface HandTile {
  readonly cardData: HandCardViewData;
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

/** Crea (una única vez) un tile por carta de `ctx.leaderCardPool`, en fila centrada sobre
 *  `HAND_ROW_POSITION` (§3.1), separación `TILE_SEPARATION_PX`. Cada tile: Rectangle (120×180,
 *  proporción de carta) + Text (nombre + coste) + `setName(cardTileName(cardId))` +
 *  `setInteractive().setData('targetId', cardTileName(cardId))` (§1.4). */
export function createCardHandView(scene: Phaser.Scene, ctx: BoardViewContext): CardHandView {
  const pool = ctx.leaderCardPool;
  const startX = HAND_ROW_POSITION.x - ((pool.length - 1) * TILE_SEPARATION_PX) / 2;

  const tiles: HandTile[] = pool.map((cardData, index) => {
    const x = startX + index * TILE_SEPARATION_PX;
    const y = HAND_ROW_POSITION.y;
    const name = cardTileName(cardData.cardId);

    const rect = scene.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_COLOR);
    rect.setName(name);
    rect.setInteractive().setData('targetId', name);

    const text = scene.add.text(x, y, `${cardData.name}\n(${cardData.energyCost})`, {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
    });
    text.setOrigin(0.5, 0.5);

    return { cardData, rect, text };
  });

  return {
    update(snapshot: CombatStateSnapshot): void {
      for (const tile of tiles) {
        const affordable = snapshot.leaderEnergy >= tile.cardData.energyCost;
        const alpha = affordable ? ALPHA_AFFORDABLE : ALPHA_UNAFFORDABLE;
        tile.rect.setAlpha(alpha);
        tile.text.setAlpha(alpha);
      }
    },
  };
}
