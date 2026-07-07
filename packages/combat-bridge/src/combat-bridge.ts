import { createEventBus } from '@collector/domain-shared';
import type { Unsubscribe } from '@collector/domain-shared';
import type {
  CombatEngine,
  CombatCommand,
  CombatEvent,
  CombatCommandResult,
  CombatStateSnapshot,
} from '@collector/domain-combat';

/**
 * H2.3 §3.1 — puente de pub/sub agnóstico de framework entre un `CombatEngine` ya
 * construido y sus consumidores (React/Phaser). No orquesta construcción de catálogo
 * (ver spec §0.4) ni mantiene copia propia de estado (`getSnapshot` reenvía siempre a
 * `engine.getSnapshot()`).
 */
export interface CombatBridge {
  readonly engine: CombatEngine;

  /** Reenvía el comando a `engine.dispatch(command)`. El valor de retorno es el mismo
   *  `CombatCommandResult` del engine (mismo contrato que ya usa `packages/cli`) — útil
   *  para lógica síncrona inmediata del propio caller (p.ej. mostrar un error de
   *  validación en el mismo tick). Si el comando tuvo éxito, los eventos resultantes
   *  YA fueron publicados a ambos canales de suscripción ANTES de que `dispatch`
   *  retorne (ver §3.2, orden de entrega). */
  dispatch(command: CombatCommand): CombatCommandResult;

  /** Reenvía a `engine.getSnapshot()`. Sin caché ni transformación — el snapshot
   *  siempre refleja el estado inmediatamente después del último `dispatch()`. */
  getSnapshot(): CombatStateSnapshot;

  /** Canal para consumidores "HUD no-juice" (React overlay, `architecture_stack.md`
   *  §2.3) — vida, Trama, turno, resultado final. */
  subscribeHudEvents(listener: (event: CombatEvent) => void): Unsubscribe;

  /** Canal para consumidores "juice" (Phaser/`EffectsDirector`, H2.4) — el mismo
   *  stream de eventos que `subscribeHudEvents`, canal independiente. */
  subscribeSceneEvents(listener: (event: CombatEvent) => void): Unsubscribe;
}

/** Único punto de construcción — `CombatBridge` no tiene constructor propio expuesto
 *  (se evita `new CombatBridge(...)` para dejar la puerta abierta a que el factory, en
 *  el futuro, añada validación o instrumentación sin romper la firma pública). Recibe
 *  un `CombatEngine` YA CONSTRUIDO (ver spec §0.4) — este paquete nunca instancia uno. */
export function createCombatBridge(engine: CombatEngine): CombatBridge {
  const hudBus = createEventBus<CombatEvent>();
  const sceneBus = createEventBus<CombatEvent>();

  // Único listener interno de relé (spec §3.2) — se suscribe una sola vez al bus
  // interno del engine y reemite cada evento a ambos canales, siempre en el mismo
  // orden (hud primero, scene después). No hay lógica de relé duplicada en dispatch().
  engine.subscribe((event: CombatEvent) => {
    hudBus.emit(event);
    sceneBus.emit(event);
  });

  return {
    engine,

    dispatch(command: CombatCommand): CombatCommandResult {
      return engine.dispatch(command);
    },

    getSnapshot(): CombatStateSnapshot {
      return engine.getSnapshot();
    },

    subscribeHudEvents(listener: (event: CombatEvent) => void): Unsubscribe {
      return hudBus.subscribe(listener);
    },

    subscribeSceneEvents(listener: (event: CombatEvent) => void): Unsubscribe {
      return sceneBus.subscribe(listener);
    },
  };
}
