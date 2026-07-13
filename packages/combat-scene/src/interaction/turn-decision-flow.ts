import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';

/** H5.2 spec §1 — las 4 categorías de la spec de dominio (decisions.md "Estructura del turno del
 *  jugador", 2 acciones pagadas). Mismo vocabulario que `ControlId` ya usa `CombatHud.tsx` — H5.5
 *  unifica ambos. */
export type ActionCategory = 'PLAY_CARD' | 'ACTIVATE_ABILITY' | 'GENERATE_ENERGY' | 'DRAW_CARD';

/** Categorías que SIEMPRE requieren un tramo de detalle (elegir qué carta/qué habilidad) antes de
 *  poder ejecutarse — coincide exactamente con las 2 categorías "grandes" de vision.md. Las otras 2
 *  (`GENERATE_ENERGY`/`DRAW_CARD`) son las "rutinarias": categoría=acción, sin tramo de detalle. */
export type DetailCategory = Extract<ActionCategory, 'PLAY_CARD' | 'ACTIVATE_ABILITY'>;

export type TurnRevealStage =
  | { readonly stage: 'CATEGORY' }
  | { readonly stage: 'DETAIL'; readonly category: DetailCategory };

export interface TurnDecisionSignal {
  getState(): TurnRevealStage;
  /** Mismo tipo de retorno que `TargetingSignal.subscribe`/`CombatBridge.subscribeHudEvents`. */
  subscribe(listener: (state: TurnRevealStage) => void): () => void;
}

export interface TurnDecisionFlow {
  /** Único punto de entrada del gesto "el jugador tocó la categoría X" — H5.2 §2. */
  selectCategory(category: ActionCategory): void;
  /** Vuelve a `CATEGORY` desde `DETAIL`, cancelando también cualquier selección de objetivo/Núcleo
   *  pendiente en `GestureCommandTranslator` (delega en `cancelPending()`, inyectado en la
   *  construcción). Equivalente al botón "Cancelar"/"Atrás" que H5.5 monta en fase DETAIL. */
  cancelDetail(): void;
  readonly signal: TurnDecisionSignal;
}

export interface TurnDecisionFlowDeps {
  readonly bridge: CombatBridge;
  /** Reutiliza el MISMO `cancelPending()` que ya expone `GestureCommandTranslator` (H4 §5.3) — al
   *  cancelar el tramo de detalle, cualquier `PendingSelection` de targeting/Núcleo en curso también
   *  se limpia, para no dejar un prompt de "elige un objetivo" huérfano tras volver a CATEGORY. */
  readonly cancelPending: () => void;
}

const CATEGORY_STAGE: TurnRevealStage = { stage: 'CATEGORY' };

/** H5.2 §2.3 — eventos de dominio cuya llegada mientras `stage === 'DETAIL'` significa "la acción de
 *  esta categoría se completó" — vuelve a CATEGORY automáticamente. Un comando RECHAZADO (el motor
 *  devuelve error, sin emitir evento) deja al jugador en DETAIL para reintentar o cancelar
 *  manualmente — comportamiento deliberado, mismo criterio que el resto del flujo de targeting. */
const TERMINAL_EVENT_TYPES: ReadonlySet<CombatEvent['type']> = new Set([
  'CARD_PLAYED',
  'ALLY_ENTERED_PLAY',
  'CONTRATIEMPO_PLAYED',
  'ABILITY_ACTIVATED',
]);

/** Categoría de detalle a la que corresponde un evento terminal — usado para filtrar por la
 *  categoría ACTIVA (spec §2.3 regla 1, "cualquier evento terminal cierra cualquier detalle" queda
 *  explícitamente descartado, ver caso de test 5 de la spec). */
function detailCategoryForTerminalEvent(type: CombatEvent['type']): DetailCategory | null {
  switch (type) {
    case 'CARD_PLAYED':
    case 'ALLY_ENTERED_PLAY':
    case 'CONTRATIEMPO_PLAYED':
      return 'PLAY_CARD';
    case 'ABILITY_ACTIVATED':
      return 'ACTIVATE_ABILITY';
    default:
      return null;
  }
}

/** Único punto de construcción — mismo patrón que `createTargetingSignal`/`createEffectsDirector`:
 *  sin `new` expuesto. H5.2 §1-§3. */
export function createTurnDecisionFlow(deps: TurnDecisionFlowDeps): TurnDecisionFlow {
  const { bridge, cancelPending } = deps;

  let state: TurnRevealStage = CATEGORY_STAGE;
  const listeners = new Set<(state: TurnRevealStage) => void>();

  function setStage(next: TurnRevealStage): void {
    state = next;
    listeners.forEach((listener) => listener(state));
  }

  bridge.subscribeHudEvents((event: CombatEvent) => {
    if (state.stage === 'DETAIL' && TERMINAL_EVENT_TYPES.has(event.type)) {
      const category = detailCategoryForTerminalEvent(event.type);
      if (category === state.category) {
        setStage(CATEGORY_STAGE);
      }
      return;
    }

    // Regla 2 (§2.3) — reset defensivo de inicio de turno, incondicional, cubre cualquier caso
    // borde en el que la regla 1 no haya cerrado ya el tramo anterior.
    if (event.type === 'TURN_ENDED' && event.nextTurnOwner === 'LEADER') {
      setStage(CATEGORY_STAGE);
    }
  });

  const signal: TurnDecisionSignal = {
    getState(): TurnRevealStage {
      return state;
    },
    subscribe(listener: (state: TurnRevealStage) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    selectCategory(category: ActionCategory): void {
      if (category === 'GENERATE_ENERGY') {
        bridge.dispatch({ type: 'GENERATE_ENERGY' });
        return; // el estado SIGUE en CATEGORY — nunca hubo transición, no hace falta "volver"
      }
      if (category === 'DRAW_CARD') {
        bridge.dispatch({ type: 'DRAW_CARD' });
        return;
      }
      // PLAY_CARD | ACTIVATE_ABILITY — categorías "grandes", abren tramo de detalle (§2.2).
      setStage({ stage: 'DETAIL', category });
    },

    cancelDetail(): void {
      cancelPending();
      setStage(CATEGORY_STAGE);
    },

    signal,
  };
}
