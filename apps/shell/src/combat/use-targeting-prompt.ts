import { useEffect, useState } from 'react';
import type { TargetingSignal, TargetingPrompt } from '@collector/combat-scene';

/** H4_componente_carta.md §5.2 — mismo patrón exacto que `use-combat-snapshot.ts`
 *  (`useState` + `subscribe` en `useEffect`). `signal` es `null` mientras `CombatScene` todavía no
 *  ha emitido `READY` (mismo ciclo de vida que `boardContext`/`leaderAbilities` en `CombatScreen`). */
export function useTargetingPrompt(signal: TargetingSignal | null): TargetingPrompt {
  const [state, setState] = useState<TargetingPrompt>(signal?.getState() ?? { kind: 'NONE' });

  useEffect(() => {
    if (!signal) return undefined;
    setState(signal.getState());
    return signal.subscribe(setState);
  }, [signal]);

  return state;
}
