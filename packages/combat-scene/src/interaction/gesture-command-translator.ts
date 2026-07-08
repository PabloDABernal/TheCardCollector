import type { CardId } from '@collector/domain-shared';
import type { CombatBridge } from '@collector/combat-bridge';
import type { PointerGesture } from '../input';
import type { BoardViewContext, HandCardViewData } from '../view';
import { cardTileName } from '../view';

/**
 * H2.9 spec §4 — traducción `PointerGesture → CombatCommand`, dispatch contra `this.bridge`.
 * Cubre `PLAY_CARD` (con selección de Núcleo en 2 pasos cuando el efecto de la carta lo exige),
 * `PLAY_ALLY`, `PLAY_CONTRATIEMPO` (ambos en 1 paso, sin Núcleo). `ACTIVATE_ABILITY`/
 * `SET_DAMAGE_REDIRECT`/`SUMMON_MINION`/`RESOLVE_MINION_ACTION` quedan fuera de alcance (§0.3).
 */
export interface GestureCommandTranslator {
  /** Procesa un `PointerGesture` (solo reacciona a `TAP`; `DRAG_*`/`LONG_PRESS` se ignoran sin
   *  efecto, §0.3). Puede disparar `bridge.dispatch(...)` inmediatamente (cartas sin Núcleo,
   *  PLAY_ALLY, PLAY_CONTRATIEMPO) o transicionar a un estado de espera interno (PLAY_CARD con
   *  `requiresNucleoInstance`). Sin valor de retorno — efectos observables solo vía
   *  `bridge.dispatch`. */
  handleGesture(gesture: PointerGesture): void;
}

/**
 * Estado interno: una única variable `pendingCardId: CardId | null` (empieza en `null` = `IDLE`;
 * `pendingCardId !== null` = `AWAITING_NUCLEO`). Sin timeout (spec §4.5).
 */
export function createGestureCommandTranslator(
  bridge: CombatBridge,
  boardContext: BoardViewContext,
): GestureCommandTranslator {
  // Mapa construido una única vez (spec §4.5 punto 3) — nunca se recorre el array en cada gesto.
  const cardsByTileName = new Map<string, HandCardViewData>();
  for (const card of boardContext.leaderCardPool) {
    cardsByTileName.set(cardTileName(card.cardId), card);
  }

  let pendingCardId: CardId | null = null;

  function dispatchForCard(card: HandCardViewData): void {
    const sourceId = cardTileName(card.cardId);
    switch (card.cardType) {
      case 'ALIADO':
        pendingCardId = null; // cancela cualquier selección previa distinta (spec §4.5 punto 3)
        bridge.dispatch({ type: 'PLAY_ALLY', cardId: card.cardId, sourceId });
        break;
      case 'CONTRATIEMPO':
        pendingCardId = null;
        bridge.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: card.cardId, sourceId });
        break;
      case 'EVENTO':
      case 'EQUIPO':
        if (card.requiresNucleoInstance) {
          pendingCardId = card.cardId; // sustituye cualquier valor anterior, sin dispatch todavía
        } else {
          pendingCardId = null;
          bridge.dispatch({ type: 'PLAY_CARD', cardId: card.cardId, sourceId });
        }
        break;
    }
  }

  return {
    handleGesture(gesture: PointerGesture): void {
      if (gesture.kind !== 'TAP') return; // ignora DRAG_*/LONG_PRESS, §0.3/§4.5 punto 1

      const targetId = gesture.targetId;

      if (targetId !== null) {
        const card = cardsByTileName.get(targetId);
        if (card) {
          dispatchForCard(card);
          return;
        }

        // Resolución contra el snapshot ACTUAL, no cacheado (spec §4.5 punto 5).
        const nucleo = bridge.getSnapshot().nucleoPool.find((n) => n.id === targetId);
        if (nucleo) {
          if (pendingCardId !== null) {
            const cardId = pendingCardId;
            pendingCardId = null; // vuelve a IDLE independientemente del resultado del dispatch
            bridge.dispatch({
              type: 'PLAY_CARD',
              cardId,
              sourceId: cardTileName(cardId),
              nucleoInstanceId: nucleo.id,
            });
          }
          // pendingCardId === null: tap en un Núcleo sin ninguna carta pendiente, no-op (§4.5 punto 4)
          return;
        }
      }

      // targetId === null, o FOCUS_ID_* (rol), o cualquier otro id no resuelto (Aliado/Secuaz en
      // mesa, fuera de alcance) — cancelación explícita de cualquier selección pendiente (§4.5 punto 2)
      pendingCardId = null;
    },
  };
}
