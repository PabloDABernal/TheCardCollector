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
  /** RENOMBRADO/AMPLIADO H3.6 (spec §2.7, `leaderHand`): ya no pinta el pool COMPLETO del Líder —
   *  solo las cartas que están realmente en `snapshot.leaderHand` ahora mismo (el motor rechaza
   *  `PLAY_CARD` con `CARD_NOT_IN_HAND` para cualquier otra). Crea un tile cuando una carta entra en
   *  mano (`LEADER_HAND_CARD_DRAWN`), lo destruye cuando sale (jugada con éxito), y reposiciona el
   *  resto en una fila densa centrada (mismo criterio de "abanico de mano" que el resto del tablero).
   *  Ajusta alpha (afford/no-afford por Energía, spec §0.2 punto 6). */
  update(snapshot: CombatStateSnapshot): void;
}

interface HandTile {
  readonly cardData: HandCardViewData;
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

function tileX(index: number, handSize: number): number {
  const startX = HAND_ROW_POSITION.x - ((handSize - 1) * TILE_SEPARATION_PX) / 2;
  return startX + index * TILE_SEPARATION_PX;
}

/** Crea/destruye tiles dinámicamente contra `snapshot.leaderHand` (H3.6) — a diferencia de H2.8
 *  (que pintaba TODO `ctx.leaderCardPool` de una vez, sin concepto de mano todavía). */
export function createCardHandView(scene: Phaser.Scene, ctx: BoardViewContext): CardHandView {
  const cardDataById = new Map<CardId, HandCardViewData>();
  for (const card of ctx.leaderCardPool) {
    cardDataById.set(card.cardId, card);
  }

  const tiles = new Map<CardId, HandTile>();

  function createTile(cardData: HandCardViewData, x: number, y: number): HandTile {
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
  }

  return {
    update(snapshot: CombatStateSnapshot): void {
      const hand = snapshot.leaderHand;
      const handIds = new Set(hand);

      // Destruye tiles de cartas que salieron de la mano (jugadas con éxito).
      for (const [cardId, tile] of Array.from(tiles.entries())) {
        if (!handIds.has(cardId)) {
          tile.rect.destroy();
          tile.text.destroy();
          tiles.delete(cardId);
        }
      }

      // Crea/reposiciona en el orden estable de `leaderHand` (orden de robo, spec §2.3).
      hand.forEach((cardId, index) => {
        const cardData = cardDataById.get(cardId);
        if (!cardData) return; // defensivo — no debería ocurrir (leaderHand solo contiene ids del pool)

        const x = tileX(index, hand.length);
        const y = HAND_ROW_POSITION.y;
        const affordable = snapshot.leaderEnergy >= cardData.energyCost;
        const alpha = affordable ? ALPHA_AFFORDABLE : ALPHA_UNAFFORDABLE;

        let tile = tiles.get(cardId);
        if (!tile) {
          tile = createTile(cardData, x, y);
          tiles.set(cardId, tile);
        } else {
          tile.rect.setPosition(x, y);
          tile.text.setPosition(x, y);
        }
        tile.rect.setAlpha(alpha);
        tile.text.setAlpha(alpha);
      });
    },
  };
}
