import type { AbilityId, CardId, NucleoInstanceId } from '@collector/domain-shared';
import { satisfiesCoreCost } from '@collector/domain-shared';
import type { CombatBridge } from '@collector/combat-bridge';
import type { AttackTarget } from '@collector/domain-combat';
import type { PointerGesture } from '../input';
import type { AbilityViewData, BoardViewContext, HandCardViewData } from '../view';
import { cardTileName } from '../view';
import { FOCUS_ID_ENEMY } from '../juice';

/**
 * H2.9 spec §4 (extendida por H3 §5.4/§6) — traducción `PointerGesture → CombatCommand`, dispatch
 * contra `this.bridge`. Cubre `PLAY_CARD` (con selección de objetivo + Núcleo cuando el efecto de
 * la carta lo exige), `PLAY_ALLY`, `PLAY_CONTRATIEMPO` (ambos en 1 paso, sin Núcleo), y NUEVO H3:
 * `ACTIVATE_ABILITY` (tap en icono de habilidad del Líder, con selección de Núcleo cuando hay más
 * de un dado válido — H3.1/§5.4). `SET_DAMAGE_REDIRECT`/`SUMMON_MINION`/`RESOLVE_MINION_ACTION`
 * siguen fuera de alcance (§0.3 original, sin cambios).
 */
export interface GestureCommandTranslator {
  /** Procesa un `PointerGesture` (solo reacciona a `TAP`; `DRAG_*`/`LONG_PRESS` se ignoran sin
   *  efecto, §0.3). Puede disparar `bridge.dispatch(...)` inmediatamente o transicionar a un estado
   *  de espera interno (targeting de ataque y/o selección de Núcleo). Sin valor de retorno —
   *  efectos observables solo vía `bridge.dispatch`. */
  handleGesture(gesture: PointerGesture): void;
}

/**
 * Estado interno de selección pendiente — generaliza el `pendingCardId: CardId | null` original de
 * H2.9 para cubrir también el targeting de ataque (NUEVO §3.9.2/§5.4) y la selección de Núcleo de
 * una habilidad (NUEVO H3.1/§5.4). Sin timeout (mismo criterio que H2.9 §4.5).
 */
type PendingSelection =
  | { readonly stage: 'AWAITING_ATTACK_TARGET'; readonly cardId: CardId }
  | { readonly stage: 'AWAITING_NUCLEO_FOR_CARD'; readonly cardId: CardId; readonly target: AttackTarget }
  | { readonly stage: 'AWAITING_NUCLEO_FOR_ABILITY'; readonly abilityId: AbilityId }
  | null;

export function createGestureCommandTranslator(
  bridge: CombatBridge,
  boardContext: BoardViewContext,
): GestureCommandTranslator {
  // Mapas construidos una única vez (spec §4.5 punto 3) — nunca se recorre el array en cada gesto.
  const cardsByTileName = new Map<string, HandCardViewData>();
  for (const card of boardContext.leaderCardPool) {
    cardsByTileName.set(cardTileName(card.cardId), card);
  }
  const leaderAbilitiesById = new Map<AbilityId, AbilityViewData>();
  for (const ability of boardContext.leaderAbilities) {
    leaderAbilitiesById.set(ability.abilityId, ability);
  }

  let pending: PendingSelection = null;

  function dispatchAbility(ability: AbilityViewData, nucleoInstanceId: NucleoInstanceId): void {
    bridge.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ability.abilityId,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId,
    });
  }

  /** NUEVO H3.1/§5.4 — tap en un icono de habilidad del Líder: calcula qué dados de `nucleoTable`
   *  satisfacen `ability.coreCost` ahora mismo. 0 válidos → no-op (el motor rechazaría igual, sin
   *  Núcleo que ofrecer no hay comando que construir). 1 válido → auto-selección, dispatch
   *  inmediato (spec §5.4: "si solo hay un dado válido, se puede auto-seleccionar sin pedir el
   *  gesto extra"). 2+ válidos → espera un TAP en un dado concreto. */
  function handleAbilityTap(ability: AbilityViewData): void {
    const snapshot = bridge.getSnapshot();
    const validDice = snapshot.nucleoTable.filter(
      (die) => die.status === 'AVAILABLE' && satisfiesCoreCost(ability.coreCost, die.color),
    );

    if (validDice.length === 0) {
      pending = null;
      return;
    }
    if (validDice.length === 1) {
      pending = null;
      dispatchAbility(ability, validDice[0]!.id);
      return;
    }
    pending = { stage: 'AWAITING_NUCLEO_FOR_ABILITY', abilityId: ability.abilityId };
  }

  /** NUEVO §3.9.2/§5.4 — tap en una carta con efecto de Ataque (`requiresNucleoInstance`, spec
   *  §3.9.2 nota: hoy es exactamente el mismo conjunto de cartas que exige `target`). Si no hay
   *  ningún Secuaz en mesa, el objetivo se resuelve automáticamente al Enemigo sin pedir el gesto
   *  extra (spec §5.4/backlog H3.8, "si NO hay Secuaces en mesa... el ataque se ejecuta
   *  directamente al Enemigo sin pedir confirmación") — el motor sigue exigiendo `target` siempre
   *  (§3.9.3), solo se omite la interacción de UI cuando es trivial. */
  function handleAttackCardTap(card: HandCardViewData): void {
    const snapshot = bridge.getSnapshot();
    if (snapshot.minionsInPlay.length === 0) {
      pending = { stage: 'AWAITING_NUCLEO_FOR_CARD', cardId: card.cardId, target: { kind: 'ENEMY' } };
    } else {
      pending = { stage: 'AWAITING_ATTACK_TARGET', cardId: card.cardId };
    }
  }

  function dispatchForCard(card: HandCardViewData): void {
    const sourceId = cardTileName(card.cardId);
    switch (card.cardType) {
      case 'ALIADO':
        pending = null; // cancela cualquier selección previa distinta (spec §4.5 punto 3)
        bridge.dispatch({ type: 'PLAY_ALLY', cardId: card.cardId, sourceId });
        break;
      case 'CONTRATIEMPO':
        pending = null;
        bridge.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: card.cardId, sourceId });
        break;
      case 'EVENTO':
      case 'EQUIPO':
        if (card.requiresNucleoInstance) {
          handleAttackCardTap(card); // sustituye cualquier valor anterior, sin dispatch todavía
        } else {
          pending = null;
          bridge.dispatch({ type: 'PLAY_CARD', cardId: card.cardId, sourceId });
        }
        break;
    }
  }

  function resolveAttackTarget(targetId: string): AttackTarget | null {
    if (targetId === FOCUS_ID_ENEMY) {
      return { kind: 'ENEMY' };
    }
    const minion = bridge.getSnapshot().minionsInPlay.find((m) => m.instanceId === targetId);
    if (minion) {
      return { kind: 'MINION', minionInstanceId: minion.instanceId };
    }
    return null;
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

        if (pending?.stage === 'AWAITING_ATTACK_TARGET') {
          const target = resolveAttackTarget(targetId);
          if (target) {
            pending = { stage: 'AWAITING_NUCLEO_FOR_CARD', cardId: pending.cardId, target };
            return;
          }
          pending = null; // tap no resuelto a un objetivo válido → cancelación (spec §4.5 punto 2)
          return;
        }

        if (pending?.stage === 'AWAITING_NUCLEO_FOR_CARD') {
          // Resolución contra el snapshot ACTUAL, no cacheado (spec §4.5 punto 5).
          const die = bridge.getSnapshot().nucleoTable.find((d) => d.id === targetId && d.status === 'AVAILABLE');
          if (die) {
            const { cardId, target } = pending;
            pending = null;
            bridge.dispatch({
              type: 'PLAY_CARD',
              cardId,
              sourceId: cardTileName(cardId),
              nucleoInstanceId: die.id,
              target,
            });
            return;
          }
          pending = null;
          return;
        }

        if (pending?.stage === 'AWAITING_NUCLEO_FOR_ABILITY') {
          const die = bridge.getSnapshot().nucleoTable.find((d) => d.id === targetId && d.status === 'AVAILABLE');
          const ability = leaderAbilitiesById.get(pending.abilityId);
          if (die && ability) {
            pending = null;
            dispatchAbility(ability, die.id);
            return;
          }
          pending = null;
          return;
        }

        // Sin selección pendiente: ¿tap en un icono de habilidad del Líder? (NUEVO H3.1)
        const ability = leaderAbilitiesById.get(targetId as AbilityId);
        if (ability) {
          handleAbilityTap(ability);
          return;
        }

        // Tap en un Núcleo sin ninguna carta/habilidad pendiente, o en cualquier otro sprite sin
        // significado (rol, Secuaz/Aliado en mesa fuera de un targeting activo): no-op (§4.5 punto 4).
        return;
      }

      // targetId === null, o cualquier id no resuelto — cancelación explícita de cualquier
      // selección pendiente (§4.5 punto 2).
      pending = null;
    },
  };
}
