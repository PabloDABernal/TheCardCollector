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
    (onStoreChange) =>
      bridge.subscribeHudEvents(() => {
        cacheRef.current = { bridge, snapshot: bridge.getSnapshot() };
        onStoreChange();
      }),
    readCachedSnapshot,
  );
}
