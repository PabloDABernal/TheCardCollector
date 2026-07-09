import { useRef, useSyncExternalStore } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';

/**
 * `architecture_stack.md` §2.3 ya lo anticipaba: "implementable con `useSyncExternalStore` sobre
 * `subscribeHudEvents`". Se suscribe al canal HUD (no al de juice/escena) — no se re-renderiza en
 * cada tick de animación de Phaser, solo cuando ocurre un evento de dominio real.
 *
 * `CombatBridge.getSnapshot()` reenvía siempre a `CombatEngine.getSnapshot()`
 * (`combat-bridge.ts`), que construye un objeto NUEVO en cada llamada (`combat-engine.ts`, sin
 * caché) — nunca la misma referencia entre dos llamadas aunque el estado no haya cambiado.
 * `useSyncExternalStore` exige que `getSnapshot` devuelva un valor referencialmente estable entre
 * renders salvo que el store haya cambiado de verdad; devolver un objeto nuevo en cada render
 * dispara un bucle infinito de re-render ("Maximum update depth exceeded", confirmado
 * empíricamente). Se cachea el snapshot en un `ref`, invalidado únicamente cuando
 * `subscribeHudEvents` notifica un evento real — mismo patrón recomendado por React para adaptar
 * stores externos "no reactivos" a `useSyncExternalStore`.
 *
 * FIX QA (bug HUD permanentemente deshabilitado desde ~turno 4, reproducido 2/2): un solo
 * `dispatch()` (p.ej. "Fin de turno" con IA de Enemigo automática, `combat-engine.ts`
 * `handleEndTurn`) puede emitir VARIOS eventos de dominio en cadena antes de terminar todas sus
 * mutaciones síncronas — en concreto, el cierre del turno automático de Enemigo emite
 * `TURN_ENDED`/`COOLDOWNS_TICKED` ANTES de resetear `actionsTakenThisTurn`/`actionsAllowedThisTurn`
 * para el turno entrante del Líder, y esa última mutación solo queda reflejada en un evento
 * posterior si además hay un cambio de fase/Level-Up en ESE mismo `dispatch()` (no siempre pasa).
 * La versión anterior llamaba a `bridge.getSnapshot()` de forma EAGER dentro del propio listener
 * (en el momento exacto de cada evento intermedio), así que si el ÚLTIMO evento emitido en un
 * `dispatch()` no coincidía con el ÚLTIMO paso mutador de ese `dispatch()`, el snapshot cacheado
 * quedaba congelado a medio camino (turno del Líder ya activo, pero acciones aún sin resetear) sin
 * que ningún evento posterior lo corrigiera — confirmado empíricamente contra el motor real
 * (simulación paralela via `bridge.getSnapshot()` tras cada `dispatch()` siempre muestra
 * `actionsTaken=0/actionsAllowed=2`, mientras el HUD servido por este hook se quedaba disabled).
 * Arreglo (intento 1, INSUFICIENTE por sí solo — dejado documentado porque el motivo importa):
 * invalidar el cache (`cacheRef.current = null`) y dejar que `bridge.getSnapshot()` se llame de
 * forma perezosa en `readCachedSnapshot` NO basta, porque `useSyncExternalStore` de React llama a
 * `getSnapshot` de forma SÍNCRONA dentro de su propio manejo interno de `onStoreChange` (para
 * comparar contra el snapshot anterior y decidir si hace falta re-renderizar) — es decir,
 * `readCachedSnapshot` se re-ejecuta INMEDIATAMENTE, todavía a mitad del mismo `dispatch()`
 * síncrono, re-poblando el cache con el mismo estado a medio camino que se quería evitar. Cada
 * evento subsiguiente del mismo `dispatch()` repite el patrón, así que el cache queda fijado al
 * valor capturado en el ÚLTIMO evento emitido — igual de roto que la versión original.
 *
 * Arreglo real: además de invalidar el cache, se difiere `onStoreChange()` a un microtask
 * (`queueMicrotask`), coalescido para que un `dispatch()` con muchos eventos en cadena (p.ej. el
 * cierre recursivo del turno automático de Enemigo en `handleEndTurn`) solo dispare UNA notificación
 * — la primera invalidación de la ráfaga agenda el microtask, las siguientes solo tocan el cache.
 * Un microtask se ejecuta siempre DESPUÉS de que el `dispatch()` que lo agendó (y toda la pila de
 * llamadas síncrona que lo contiene — el `onClick` completo) haya retornado, así que quien acabe
 * llamando a `getSnapshot()` (React, sea de forma interna al notificar o durante el render) siempre
 * lee el estado ya completamente asentado, sin importar cuántas mutaciones síncronas quedaran
 * pendientes tras el último evento emitido.
 */
export function useCombatSnapshot(bridge: CombatBridge): CombatStateSnapshot {
  const cacheRef = useRef<{ bridge: CombatBridge; snapshot: CombatStateSnapshot } | null>(null);

  function readCachedSnapshot(): CombatStateSnapshot {
    if (!cacheRef.current || cacheRef.current.bridge !== bridge) {
      cacheRef.current = { bridge, snapshot: bridge.getSnapshot() };
    }
    return cacheRef.current.snapshot;
  }

  return useSyncExternalStore(
    (onStoreChange) => {
      let notifyScheduled = false;
      return bridge.subscribeHudEvents(() => {
        cacheRef.current = null;
        if (notifyScheduled) return;
        notifyScheduled = true;
        queueMicrotask(() => {
          notifyScheduled = false;
          cacheRef.current = null; // por si algo repobló el cache mientras el microtask esperaba
          onStoreChange();
        });
      });
    },
    readCachedSnapshot,
  );
}
