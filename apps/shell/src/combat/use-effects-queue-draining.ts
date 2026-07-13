import { useEffect, useState } from 'react';
import type { EffectsQueueSignal } from '@collector/combat-scene';

/** H5.9 §2 — mismo patrón que `use-turn-reveal-stage.ts` (H5.2/H5.5, ya retirado): hook de lectura
 *  de un `Signal` pub/sub expuesto por `CombatScene` tras `READY`. `null` mientras la escena no lo
 *  expuso todavía — se lee como "no drenando" (comportamiento por defecto, no bloquea `TurnStartModal`
 *  antes de que `CombatScene` exista). */
export function useEffectsQueueDraining(signal: EffectsQueueSignal | null): boolean {
  const [draining, setDraining] = useState<boolean>(signal?.isDraining() ?? false);

  useEffect(() => {
    if (!signal) return undefined;
    setDraining(signal.isDraining());
    return signal.subscribe(setDraining);
  }, [signal]);

  return draining;
}
