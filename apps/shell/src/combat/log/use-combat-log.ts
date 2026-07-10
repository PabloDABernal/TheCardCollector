import { useEffect, useRef, useState } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { BoardViewContext } from '@collector/combat-scene';
import { translateCombatEvent } from './translate-combat-event';

export type CombatLogTone = 'LEADER_ACTION' | 'ENEMY_ACTION' | 'DAMAGE' | 'HEAL' | 'SUMMON' | 'SYSTEM';

export interface CombatLogEntry {
  readonly id: string; // `${turnNumber}-${sequenceInTurn}`, estable para `key` de React
  readonly turnNumber: number;
  readonly text: string;
  readonly tone: CombatLogTone;
}

const MAX_LOG_ENTRIES = 60; // tope de memoria, ~2-3 combates completos de eventos relevantes

/**
 * H4 spec §3.1 — se suscribe directamente a `bridge.subscribeHudEvents` (mismo canal que
 * `use-combat-snapshot.ts`, independiente del canal de juice `subscribeSceneEvents`) — traduce
 * cada `CombatEvent` relevante (tabla de `translate-combat-event.ts`) a una `CombatLogEntry` y la
 * anexa a una lista acotada. A diferencia de `use-combat-snapshot.ts`, NO usa
 * `useSyncExternalStore`/microtask-coalescing: aquí SÍ importa capturar cada evento individual en
 * orden (el log es una lista aditiva, no un snapshot puntual) — un `useState` + `useEffect` con
 * suscripción directa es el patrón correcto, coalescer eventos perdería líneas de log.
 */
export function useCombatLog(bridge: CombatBridge, ctx: BoardViewContext): readonly CombatLogEntry[] {
  const [entries, setEntries] = useState<readonly CombatLogEntry[]>([]);
  // Contador de secuencia dentro del turno actual, para el `id` estable de cada entrada — vive en
  // un ref (no en estado de dominio) porque es puramente un detalle de identidad de React, se
  // reinicia cuando el número de turno cambia.
  const sequenceRef = useRef<{ turnNumber: number; sequenceInTurn: number }>({
    turnNumber: -1,
    sequenceInTurn: 0,
  });

  useEffect(() => {
    const unsubscribe = bridge.subscribeHudEvents((event) => {
      const translated = translateCombatEvent(event, ctx);
      if (translated === null) {
        return;
      }
      // `currentTurnNumber` se lee de `bridge.getSnapshot()` en el momento del evento (lectura
      // síncrona) — cada línea de log es un hecho puntual, no un estado a reconciliar contra un
      // valor cacheado previo (spec §3.1).
      const currentTurnNumber = bridge.getSnapshot().turn.turnNumber;
      if (sequenceRef.current.turnNumber !== currentTurnNumber) {
        sequenceRef.current = { turnNumber: currentTurnNumber, sequenceInTurn: 0 };
      }
      const id = `${currentTurnNumber}-${sequenceRef.current.sequenceInTurn}`;
      sequenceRef.current.sequenceInTurn += 1;

      const entry: CombatLogEntry = { id, turnNumber: currentTurnNumber, ...translated };
      setEntries((prev) => [...prev, entry].slice(-MAX_LOG_ENTRIES));
    });
    return unsubscribe;
  }, [bridge, ctx]);

  return entries;
}
