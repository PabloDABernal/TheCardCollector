import type { AbilityId, CardId, NucleoInstanceId } from '@collector/domain-shared';
import type { CombatBridge } from '@collector/combat-bridge';
import type { AttackTarget } from '@collector/domain-combat';
import type { PointerGesture } from '../input';
import type { AbilityViewData, BoardViewContext, HandCardViewData } from '../view';
import { cardTileName } from '../view';
import { FOCUS_ID_ENEMY } from '../juice';
import { findValidDiceForAbility } from './ability-activation';
import { createTargetingSignal, type TargetingPrompt, type TargetingSignal } from './targeting-signal';
import { createRejectionSignal, type RejectionSignal } from './rejection-signal';

/**
 * H2.9 spec §4 (extendida por H3 §5.4/§6, H4 §5/§6.1) — traducción `PointerGesture → CombatCommand`,
 * dispatch contra `this.bridge`. Cubre `PLAY_CARD` (con selección de objetivo + Núcleo cuando el
 * efecto de la carta lo exige), `PLAY_ALLY`, `PLAY_CONTRATIEMPO` (ambos en 1 paso, sin Núcleo), y
 * `ACTIVATE_ABILITY` (tap en icono de habilidad del Líder, con selección de Núcleo cuando hay más de
 * un dado válido — H3.1/§5.4). `SET_DAMAGE_REDIRECT`/`SUMMON_MINION`/`RESOLVE_MINION_ACTION` siguen
 * fuera de alcance (§0.3 original, sin cambios).
 *
 * H4 §6.1 — el tap real sobre una carta de mano/icono de habilidad ya NO pasa por `handleGesture`
 * (que sigue resolviendo taps de Phaser: rol, Secuaz en mesa, dado de Núcleo) — `CardTile`/
 * `AbilityTile` (HTML, `apps/shell`) invocan directamente `handleCardTap`/`handleAbilityTap`.
 */
export interface GestureCommandTranslator {
  /** Procesa un `PointerGesture` (solo reacciona a `TAP`; `DRAG_*`/`LONG_PRESS` se ignoran sin
   *  efecto, §0.3). Sigue resolviendo taps de Phaser: rol (Líder/Enemigo), Secuaz/Aliado en mesa,
   *  dado de Núcleo — nunca cartas de mano/iconos de habilidad (H4 §6.1, migrados a DOM `onClick`). */
  handleGesture(gesture: PointerGesture): void;
  /** NUEVO H4 §6.1 — invocado directo desde `CardTile.onClick` (React/DOM), sustituye el camino de
   *  `InputAdapter`/`PointerGesture` para este tipo de objetivo. */
  handleCardTap(cardId: CardId): void;
  /** NUEVO H4 §6.1 — invocado directo desde `AbilityTile.onClick` (React/DOM). */
  handleAbilityTap(abilityId: AbilityId): void;
  /** NUEVO H4.x — invocado directo desde `CardTile.onClick` (React/DOM) cuando el tile
   *  representa un Secuaz en mesa (`MinionRow`, size 'board') — Secuaz dejó de ser un
   *  sprite de Phaser (piece 2), así que un tap sobre él debe seguir resolviendo como
   *  tap de targeting mediante el mismo camino que `handleKnownTargetId` ya usa para
   *  Phaser (rol/dado). Delega en la lógica ya existente, `targetId = minionInstanceId`. */
  handleMinionTap(minionInstanceId: string): void;
  /** NUEVO H4 §5.3 — cancela cualquier selección de targeting pendiente (equivalente a lo que ya
   *  ocurre cuando `handleGesture` recibe un `targetId === null`), expuesto para el botón "Cancelar"
   *  del `TargetingPromptBanner` (React), que no tiene forma de despachar un `PointerGesture` real. */
  cancelPending(): void;
  /** NUEVO H4 §5.2 — canal de lectura del estado de targeting vigente, expuesto por `CombatScene`
   *  tras `READY` para que `apps/shell` pueda pintar el `TargetingPromptBanner`/highlight. */
  readonly targetingSignal: TargetingSignal;
  /** FIX QA (Bug 3, "Elige un Núcleo") — canal de lectura de rechazo puntual de un dado, expuesto por
   *  `CombatScene` para conectar `view/die-rejection-view.ts` (shake/flash rojo sobre el dado
   *  concreto que el jugador tocó sin poder gastarlo). Puramente interno a Phaser — nunca cruza a
   *  `apps/shell` (a diferencia de `targetingSignal`), por eso no se expone vía
   *  `GestureCommandTranslatorHandle`. */
  readonly rejectionSignal: RejectionSignal;
}

/**
 * Estado interno de selección pendiente — generaliza el `pendingCardId: CardId | null` original de
 * H2.9 para cubrir también el targeting de ataque (NUEVO §3.9.2/§5.4) y la selección de Núcleo de
 * una habilidad (NUEVO H3.1/§5.4). Sin timeout (mismo criterio que H2.9 §4.5).
 */
type PendingSelection =
  | { readonly stage: 'AWAITING_ATTACK_TARGET'; readonly cardId: CardId }
  /** NUEVO H4.x — análogo a `AWAITING_ATTACK_TARGET`, para una habilidad ATTACK del
   *  Líder en vez de una carta. Ver spec
   *  H4_targeting_habilidades_y_ficha_personaje.md §1.4. */
  | { readonly stage: 'AWAITING_ATTACK_TARGET_FOR_ABILITY'; readonly abilityId: AbilityId }
  | { readonly stage: 'AWAITING_NUCLEO_FOR_CARD'; readonly cardId: CardId; readonly target: AttackTarget }
  | {
      readonly stage: 'AWAITING_NUCLEO_FOR_ABILITY';
      readonly abilityId: AbilityId;
      /** NUEVO H4.x — presente si esta activación viene de una habilidad ATTACK (ya
       *  resuelto el objetivo); ausente para PLOT/sin efecto. */
      readonly target?: AttackTarget;
    }
  | null;

export function createGestureCommandTranslator(
  bridge: CombatBridge,
  boardContext: BoardViewContext,
): GestureCommandTranslator {
  // Mapa construido una única vez (spec §4.5 punto 3) — nunca se recorre el array en cada gesto.
  // H4 §6.1 — ya no se indexa por `cardTileName` (Phaser `targetId`): las cartas de mano dejaron de
  // ser sprites de Phaser, `handleCardTap` recibe el `CardId` directo desde React.
  const cardsById = new Map<CardId, HandCardViewData>();
  for (const card of boardContext.leaderCardPool) {
    cardsById.set(card.cardId, card);
  }
  const leaderAbilitiesById = new Map<AbilityId, AbilityViewData>();
  for (const ability of boardContext.leaderAbilities) {
    leaderAbilitiesById.set(ability.abilityId, ability);
  }

  const { signal: targetingSignal, setState: setTargetingState } = createTargetingSignal();
  // FIX QA (Bug 3) — ver rejection-signal.ts.
  const { signal: rejectionSignal, emit: emitDieRejection } = createRejectionSignal();

  let pending: PendingSelection = null;

  /** NUEVO H4 §5.2 — traduce `PendingSelection` (privado, forma interna de la máquina de estados) a
   *  `TargetingPrompt` (público, forma de lectura para `apps/shell`) y publica el cambio. Único
   *  punto de mutación de `pending` — sustituye toda asignación directa `pending = ...` anterior. */
  function setPending(next: PendingSelection): void {
    pending = next;
    setTargetingState(toPrompt(next));
  }

  function toPrompt(selection: PendingSelection): TargetingPrompt {
    if (selection === null) return { kind: 'NONE' };

    if (selection.stage === 'AWAITING_ATTACK_TARGET') {
      const cardName = cardsById.get(selection.cardId)?.name ?? '';
      const validTargetIds = [
        FOCUS_ID_ENEMY,
        ...bridge.getSnapshot().minionsInPlay.map((m) => m.instanceId as string),
      ];
      return { kind: 'AWAITING_ATTACK_TARGET', cardName, validTargetIds };
    }

    if (selection.stage === 'AWAITING_ATTACK_TARGET_FOR_ABILITY') {
      const abilityName = leaderAbilitiesById.get(selection.abilityId)?.name ?? '';
      const validTargetIds = [
        FOCUS_ID_ENEMY,
        ...bridge.getSnapshot().minionsInPlay.map((m) => m.instanceId as string),
      ];
      return { kind: 'AWAITING_ATTACK_TARGET_FOR_ABILITY', abilityName, validTargetIds };
    }

    if (selection.stage === 'AWAITING_NUCLEO_FOR_CARD') {
      const cardName = cardsById.get(selection.cardId)?.name ?? '';
      const validDieIds = bridge
        .getSnapshot()
        .nucleoTable.filter((d) => d.status === 'AVAILABLE')
        .map((d) => d.id as string);
      return { kind: 'AWAITING_NUCLEO_FOR_CARD', cardName, validDieIds };
    }

    // AWAITING_NUCLEO_FOR_ABILITY
    const ability = leaderAbilitiesById.get(selection.abilityId);
    const abilityName = ability?.name ?? '';
    const validDieIds = ability
      ? findValidDiceForAbility(bridge.getSnapshot().nucleoTable, ability.coreCost).map((d) => d.id as string)
      : [];
    return { kind: 'AWAITING_NUCLEO_FOR_ABILITY', abilityName, validDieIds };
  }

  function dispatchAbility(ability: AbilityViewData, nucleoInstanceId: NucleoInstanceId, target?: AttackTarget): void {
    bridge.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ability.abilityId,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId,
      ...(target ? { target } : {}), // NUEVO H4.x
    });
  }

  /** NUEVO H3.1/§5.4 — tap en un icono de habilidad del Líder: calcula qué dados de `nucleoTable`
   *  satisfacen `ability.coreCost` ahora mismo (`findValidDiceForAbility`, compartido con
   *  `CombatHud.tsx` vía FIX Reviewer post-H3, ver `ability-activation.ts`). 0 válidos → no-op (el
   *  motor rechazaría igual, sin Núcleo que ofrecer no hay comando que construir). 1 válido →
   *  auto-selección, dispatch inmediato (spec §5.4: "si solo hay un dado válido, se puede
   *  auto-seleccionar sin pedir el gesto extra"). 2+ válidos → espera un TAP en un dado concreto. */
  function handleAbilityTapInternal(ability: AbilityViewData): void {
    // NUEVO H4.x — una habilidad ATTACK (siempre del Líder aquí, la única interactiva
    // vía tap, §0.3 punto 4) exige targeting explícito ANTES de pedir Núcleo, mismo
    // criterio que `handleAttackCardTap` para cartas (§3.9.2/§5.4). Sin Secuaces en
    // mesa, el objetivo se resuelve trivialmente al Enemigo sin pedir el gesto extra.
    if (ability.effectKind === 'ATTACK') {
      const snapshot = bridge.getSnapshot();
      if (snapshot.minionsInPlay.length === 0) {
        startNucleoSelectionForAbility(ability, { kind: 'ENEMY' });
        return;
      }
      setPending({ stage: 'AWAITING_ATTACK_TARGET_FOR_ABILITY', abilityId: ability.abilityId });
      return;
    }

    // Camino EXISTENTE sin cambios — habilidades PLOT/sin efecto van directo a
    // selección de Núcleo.
    startNucleoSelectionForAbility(ability, undefined);
  }

  /** NUEVO H4.x — extraído de `handleAbilityTapInternal` (lógica de auto-selección/
   *  espera-de-dado, sin cambio de comportamiento), parametrizado con el `target` ya
   *  resuelto (o `undefined` para habilidades no-ATTACK). */
  function startNucleoSelectionForAbility(ability: AbilityViewData, target: AttackTarget | undefined): void {
    const snapshot = bridge.getSnapshot();
    const validDice = findValidDiceForAbility(snapshot.nucleoTable, ability.coreCost);

    if (validDice.length === 0) {
      setPending(null);
      return;
    }
    if (validDice.length === 1) {
      setPending(null);
      dispatchAbility(ability, validDice[0]!.id, target);
      return;
    }
    setPending({ stage: 'AWAITING_NUCLEO_FOR_ABILITY', abilityId: ability.abilityId, ...(target ? { target } : {}) });
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
      setPending({ stage: 'AWAITING_NUCLEO_FOR_CARD', cardId: card.cardId, target: { kind: 'ENEMY' } });
    } else {
      setPending({ stage: 'AWAITING_ATTACK_TARGET', cardId: card.cardId });
    }
  }

  function dispatchForCard(card: HandCardViewData): void {
    const sourceId = cardTileName(card.cardId);
    switch (card.cardType) {
      case 'ALIADO':
        setPending(null); // cancela cualquier selección previa distinta (spec §4.5 punto 3)
        bridge.dispatch({ type: 'PLAY_ALLY', cardId: card.cardId, sourceId });
        break;
      case 'CONTRATIEMPO':
        setPending(null);
        bridge.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: card.cardId, sourceId });
        break;
      case 'EVENTO':
      case 'EQUIPO':
        if (card.requiresNucleoInstance) {
          handleAttackCardTap(card); // sustituye cualquier valor anterior, sin dispatch todavía
        } else {
          setPending(null);
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

  /** Resuelve un tap sobre un `targetId` YA conocido (Phaser: rol/Secuaz/dado) contra el `pending`
   *  vigente, o lo interpreta como inicio de una selección de Núcleo si coincide con un dado.
   *  Extraído de `handleGesture` para reutilizarlo también cuando la selección se originó fuera de
   *  Phaser (`handleCardTap`/`handleAbilityTap`, que pueden dejar `pending` en un estado que un tap
   *  posterior en el canvas — dado/Secuaz/rol — debe seguir resolviendo). */
  function handleKnownTargetId(targetId: string): void {
    if (pending?.stage === 'AWAITING_ATTACK_TARGET') {
      const target = resolveAttackTarget(targetId);
      if (target) {
        setPending({ stage: 'AWAITING_NUCLEO_FOR_CARD', cardId: pending.cardId, target });
        return;
      }
      setPending(null); // tap no resuelto a un objetivo válido → cancelación (spec §4.5 punto 2)
      return;
    }

    if (pending?.stage === 'AWAITING_ATTACK_TARGET_FOR_ABILITY') {
      // NUEVO H4.x — simétrico a AWAITING_ATTACK_TARGET (cartas): resuelve el tap
      // (rol Enemigo/Secuaz) y transiciona a AWAITING_NUCLEO_FOR_ABILITY con el
      // target ya fijado.
      const target = resolveAttackTarget(targetId);
      if (target) {
        const ability = leaderAbilitiesById.get(pending.abilityId);
        if (ability) {
          startNucleoSelectionForAbility(ability, target);
          return;
        }
      }
      setPending(null);
      return;
    }

    if (pending?.stage === 'AWAITING_NUCLEO_FOR_CARD') {
      // Resolución contra el snapshot ACTUAL, no cacheado (spec §4.5 punto 5).
      const table = bridge.getSnapshot().nucleoTable;
      const die = table.find((d) => d.id === targetId && d.status === 'AVAILABLE');
      if (die) {
        const { cardId, target } = pending;
        setPending(null);
        bridge.dispatch({
          type: 'PLAY_CARD',
          cardId,
          sourceId: cardTileName(cardId),
          nucleoInstanceId: die.id,
          target,
        });
        return;
      }
      // FIX QA (Bug 3) — el `targetId` SÍ es un dado real de mesa (existe en `table`), solo que ya
      // está gastado (visualmente casi idéntico a uno disponible, solo cambia el alpha, spec
      // `ALPHA_SPENT` en `nucleo-table-view.ts`). Antes esto caía al mismo `setPending(null)` de
      // abajo y cancelaba TODA la selección (objetivo + carta) sin ningún mensaje. Ahora se queda en
      // el mismo `pending` (el banner de prompt sigue visible, el objetivo ya elegido no se pierde) y
      // solo se rechaza visualmente ESE dado — ver `rejection-signal.ts`/`view/die-rejection-view.ts`.
      const spentDie = table.find((d) => d.id === targetId);
      if (spentDie) {
        emitDieRejection(spentDie.id);
        return;
      }
      setPending(null);
      return;
    }

    if (pending?.stage === 'AWAITING_NUCLEO_FOR_ABILITY') {
      const table = bridge.getSnapshot().nucleoTable;
      const die = table.find((d) => d.id === targetId && d.status === 'AVAILABLE');
      const ability = leaderAbilitiesById.get(pending.abilityId);
      if (die && ability) {
        const { target } = pending; // NUEVO H4.x
        setPending(null);
        dispatchAbility(ability, die.id, target);
        return;
      }
      // FIX QA (Bug 3) — mismo criterio que en `AWAITING_NUCLEO_FOR_CARD` arriba: un dado real pero
      // gastado rechaza en vez de cancelar toda la selección de habilidad.
      const spentDie = table.find((d) => d.id === targetId);
      if (spentDie) {
        emitDieRejection(spentDie.id);
        return;
      }
      setPending(null);
      return;
    }

    // Sin selección pendiente y `targetId` no es una carta/habilidad (esas ya se resolvieron antes
    // de llegar aquí): tap en un Núcleo/rol/Secuaz sin significado propio — no-op (§4.5 punto 4).
  }

  return {
    handleGesture(gesture: PointerGesture): void {
      if (gesture.kind !== 'TAP') return; // ignora DRAG_*/LONG_PRESS, §0.3/§4.5 punto 1

      const targetId = gesture.targetId;

      if (targetId !== null) {
        handleKnownTargetId(targetId);
        return;
      }

      // targetId === null, o cualquier id no resuelto — cancelación explícita de cualquier
      // selección pendiente (§4.5 punto 2).
      setPending(null);
    },

    handleCardTap(cardId: CardId): void {
      const card = cardsById.get(cardId);
      if (!card) return; // defensivo — no debería ocurrir, `CardTile` solo se monta desde `leaderHand`
      dispatchForCard(card);
    },

    handleAbilityTap(abilityId: AbilityId): void {
      const ability = leaderAbilitiesById.get(abilityId);
      if (!ability) return; // defensivo — solo habilidades del Líder son interactivas (§0.3 punto 4)
      handleAbilityTapInternal(ability);
    },

    handleMinionTap(minionInstanceId: string): void {
      // NUEVO H4.x — mismo camino que un tap de Phaser sobre un Secuaz en mesa.
      handleKnownTargetId(minionInstanceId);
    },

    cancelPending(): void {
      setPending(null);
    },

    targetingSignal,
    rejectionSignal, // FIX QA (Bug 3)
  };
}
