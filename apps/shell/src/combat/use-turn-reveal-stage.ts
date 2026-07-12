import { useEffect, useState } from 'react';
import type { TurnDecisionFlow, TurnRevealStage } from '@collector/combat-scene';

/** H5.5 spec §2 — mismo patrón exacto que `useTargetingPrompt`/`use-combat-snapshot.ts` (`useState` +
 *  `subscribe` en `useEffect`). `flow` es `null` mientras `CombatScene` todavía no ha emitido `READY`
 *  (mismo ciclo de vida que `boardContext`/`targetingSignal`/`gestureHandle` en `CombatScreen`). */
export function useTurnRevealStage(flow: TurnDecisionFlow | null): TurnRevealStage {
  const [state, setState] = useState<TurnRevealStage>(flow?.signal.getState() ?? { stage: 'CATEGORY' });

  useEffect(() => {
    if (!flow) return undefined;
    setState(flow.signal.getState());
    return flow.signal.subscribe(setState);
  }, [flow]);

  return state;
}
