import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardId } from '@collector/domain-shared';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext, GestureCommandTranslatorHandle } from '@collector/combat-scene';
import { HAND_ROW_POSITION, TILE_SEPARATION_PX } from '@collector/combat-scene';
import { CardTile, type CardTileData } from './CardTile';
import { cardIconFor } from './card-icon';

export interface HandCardRowProps {
  readonly snapshot: CombatStateSnapshot;
  readonly ctx: BoardViewContext;
  readonly gestureHandle: GestureCommandTranslatorHandle;
}

/** Mismo cálculo que `tileX` (antes privado en `card-hand-view.ts`, ELIMINADO H4 §6) — abanico de
 *  mano centrado en `HAND_ROW_POSITION.x`. */
function tileX(index: number, handSize: number): number {
  const startX = HAND_ROW_POSITION.x - ((handSize - 1) * TILE_SEPARATION_PX) / 2;
  return startX + index * TILE_SEPARATION_PX;
}

/** H4_componente_carta.md §1/§4/§6 — sustituye `card-hand-view.ts` (Phaser). Mapea
 *  `snapshot.leaderHand` a `<CardTile size="hand">`, reutilizando literalmente `tileX`/
 *  `HAND_ROW_POSITION`/`TILE_SEPARATION_PX` de `board-layout.ts`. Implementa el patrón de "exit
 *  animation" manual: cuando una carta sale de `leaderHand` (jugada con éxito), se mantiene montada
 *  con la clase `card-tile--playing` (280ms, `card.css`) hasta `onAnimationEnd`, en su posición
 *  ORIGINAL dentro del abanico — evita el desmontaje brusco a mitad de transición. */
export function HandCardRow({ snapshot, ctx, gestureHandle }: HandCardRowProps): JSX.Element {
  const [exiting, setExiting] = useState<{ readonly cardId: CardId; readonly index: number } | null>(null);
  const prevHandRef = useRef<readonly CardId[]>(snapshot.leaderHand);

  useEffect(() => {
    const prevHand = prevHandRef.current;
    const nextHand = snapshot.leaderHand;
    if (prevHand.length > nextHand.length) {
      const nextSet = new Set(nextHand);
      const removedIndex = prevHand.findIndex((id) => !nextSet.has(id));
      if (removedIndex !== -1) {
        setExiting({ cardId: prevHand[removedIndex]!, index: removedIndex });
      }
    }
    prevHandRef.current = nextHand;
  }, [snapshot.leaderHand]);

  const cardById = useMemo(() => {
    const map = new Map(ctx.leaderCardPool.map((c) => [c.cardId, c] as const));
    return map;
  }, [ctx.leaderCardPool]);

  const displayed: readonly { readonly cardId: CardId; readonly exiting: boolean }[] = useMemo(() => {
    const base = snapshot.leaderHand.map((cardId) => ({ cardId, exiting: false }));
    if (exiting && !snapshot.leaderHand.includes(exiting.cardId)) {
      const clampedIndex = Math.min(exiting.index, base.length);
      base.splice(clampedIndex, 0, { cardId: exiting.cardId, exiting: true });
    }
    return base;
  }, [snapshot.leaderHand, exiting]);

  return (
    <>
      {displayed.map((entry, index) => {
        const data = cardById.get(entry.cardId);
        if (!data) return null;

        const cardTileData: CardTileData = {
          id: data.cardId,
          name: data.name,
          icon: cardIconFor(data.cardType, data.keywords),
          cost: { kind: 'ENERGY', amount: data.energyCost },
          keywords: data.keywords,
          ...(data.ruleText !== undefined ? { ruleText: data.ruleText } : {}),
        };
        const affordable = snapshot.leaderEnergy >= data.energyCost;
        const x = tileX(index, displayed.length);

        return (
          <CardTile
            key={entry.cardId}
            card={cardTileData}
            size="hand"
            affordable={affordable}
            className={entry.exiting ? 'card-tile--playing hand-card-slot' : 'hand-card-slot'}
            style={{ left: x, top: HAND_ROW_POSITION.y, transform: 'translate(-50%, -50%)' }}
            {...(entry.exiting
              ? { onAnimationEnd: () => setExiting(null) }
              : { onTap: () => gestureHandle.handleCardTap(entry.cardId) })}
          />
        );
      })}
    </>
  );
}
