/**
 * FIX QA (Bug 3, "Elige un Núcleo") — canal de publicación de RECHAZO puntual de un tap sobre un
 * dado concreto, análogo a `targeting-signal.ts` (mismo patrón pub/sub que `EventBus`,
 * `@collector/domain-shared`) pero deliberadamente separado de él: `TargetingSignal` es estado
 * PERSISTENTE ("¿hay un prompt vigente y cuál?"), este canal es un EVENTO TRANSITORIO ("este dado en
 * concreto acaba de rechazar un tap, reacciona una vez"). Nace porque `gesture-command-translator.ts`
 * cancelaba SILENCIOSAMENTE toda la selección (`setPending(null)`) cuando el jugador tocaba un dado ya
 * gastado (visualmente casi idéntico a uno disponible, solo cambia el alpha) durante
 * `AWAITING_NUCLEO_FOR_CARD`/`AWAITING_NUCLEO_FOR_ABILITY` — sin ningún mensaje de qué pasó. Ahora ese
 * caso concreto YA NO cancela el prompt (el banner de targeting se queda visible, ver
 * `handleKnownTargetId`); en su lugar emite este evento para que la capa visual (`view/
 * die-rejection-view.ts`, co-localizada con el sprite del dado en Phaser, mismo criterio que
 * `targeting-highlight-view.ts`) reproduzca un shake/flash rojo sobre ESE dado concreto.
 */
export interface DieRejectionEvent {
  readonly dieId: string;
  /** Incrementa en cada emisión — permite a un listener distinguir "el mismo dado rechazado otra vez
   *  seguida" de un evento ya procesado, sin depender de identidad de objeto. */
  readonly nonce: number;
}

export interface RejectionSignal {
  subscribe(listener: (event: DieRejectionEvent) => void): () => void;
}

/**
 * Único punto de construcción (mismo criterio que `createTargetingSignal`): `emit` es el lado de
 * ESCRITURA, usado únicamente por `gesture-command-translator.ts`; `signal` es el lado de LECTURA que
 * se inyecta en `CombatScene` para conectar `view/die-rejection-view.ts`.
 */
export function createRejectionSignal(): { readonly signal: RejectionSignal; emit(dieId: string): void } {
  const listeners = new Set<(event: DieRejectionEvent) => void>();
  let nonce = 0;

  return {
    signal: {
      subscribe(listener: (event: DieRejectionEvent) => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    emit(dieId: string): void {
      nonce += 1;
      const event: DieRejectionEvent = { dieId, nonce };
      listeners.forEach((listener) => listener(event));
    },
  };
}
