/**
 * H4 spec H4_componente_carta.md §5.2 — canal de publicación de estado de INTERACCIÓN (no de
 * dominio: deliberadamente separado de `CombatStateSnapshot`, que es estado de reglas). Hoy
 * `gesture-command-translator.ts` mantiene `pending: PendingSelection` como variable de clausura
 * 100% privada — invisible a `apps/shell` (React). Este módulo generaliza el mismo pub/sub que
 * `CombatBridge.subscribeHudEvents` ya usa, pero para "¿el jugador está en medio de un targeting
 * ahora mismo?", análogo directo al patrón de `EventBus` (`@collector/domain-shared`).
 */
export type TargetingPrompt =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'AWAITING_ATTACK_TARGET'; readonly cardName: string; readonly validTargetIds: readonly string[] }
  | { readonly kind: 'AWAITING_NUCLEO_FOR_CARD'; readonly cardName: string; readonly validDieIds: readonly string[] }
  | { readonly kind: 'AWAITING_NUCLEO_FOR_ABILITY'; readonly abilityName: string; readonly validDieIds: readonly string[] };

export interface TargetingSignal {
  getState(): TargetingPrompt;
  /** Mismo tipo de retorno (`Unsubscribe`) que `CombatBridge.subscribeHudEvents`. */
  subscribe(listener: (state: TargetingPrompt) => void): () => void;
}

const NONE_PROMPT: TargetingPrompt = { kind: 'NONE' };

/**
 * Único punto de construcción — mismo patrón que `createEffectsDirector`/`createInputAdapter`: sin
 * `new` expuesto. `setState` es el lado de ESCRITURA, usado únicamente por
 * `gesture-command-translator.ts` (dueño real de la máquina de estados de targeting); `signal` es el
 * lado de LECTURA que se inyecta en `apps/shell` vía `CombatScene.getTargetingSignal()`.
 */
export function createTargetingSignal(): { readonly signal: TargetingSignal; setState(next: TargetingPrompt): void } {
  let state: TargetingPrompt = NONE_PROMPT;
  const listeners = new Set<(state: TargetingPrompt) => void>();

  const signal: TargetingSignal = {
    getState(): TargetingPrompt {
      return state;
    },
    subscribe(listener: (state: TargetingPrompt) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    signal,
    setState(next: TargetingPrompt): void {
      state = next;
      listeners.forEach((listener) => listener(state));
    },
  };
}
