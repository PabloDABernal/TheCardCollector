import type { RandomSource } from '@collector/domain-shared';
import type { MinionInPlay } from './types/minion';
import type { MinionBehaviorSpec } from './types/minion-behavior';

/**
 * NUEVO H1.16 (rediseño), spec §3.5/§3.9.5. Resuelve QUÉ instancias de Secuaz actúan
 * este turno, dado el `minionBehavior` de la carta de Dramaturgia robada. Pura respecto
 * al estado del motor — no valida CD/Núcleo (eso sigue en `CombatEngine`, porque
 * depende de `abilityCoreCosts`/`remainingCooldowns`/`nucleoTable` que esta función no
 * conoce).
 *
 * - `undefined` (la carta no menciona Secuaces) → [] siempre, sin importar cuántos
 *   Secuaces haya en mesa.
 * - `ALL` → todas las instancias en mesa (mesa vacía → []).
 * - `RANDOM_ONE` → 1 instancia elegida por `randomSource.pick` (mesa vacía → []).
 * - `SPECIFIC_DEFINITION` → todas las instancias en mesa cuyo `definitionId` coincida
 *   (0, 1 o más si hay duplicados invocados).
 * - `HIGHEST_PLANO_ATTACK` → la(s) instancia(s) con `planoAttackAmount` máximo; empate
 *   se resuelve a UNA sola vía `randomSource.pick`.
 * - `HIGHEST_LIFE`/`LOWEST_LIFE` → análogo, operando sobre `life` ACTUAL (nunca
 *   `maxLife`). Como `minionsInPlay` nunca contiene un Secuaz con `life <= 0` (eliminado
 *   de inmediato al morir), no hace falta filtrar "vivos" aquí.
 */
export function selectActingMinions(
  behavior: MinionBehaviorSpec | undefined,
  minionsInPlay: readonly MinionInPlay[],
  randomSource: RandomSource
): readonly MinionInPlay[] {
  if (!behavior || minionsInPlay.length === 0) return [];

  switch (behavior.criterion.kind) {
    case 'ALL':
      return minionsInPlay;
    case 'RANDOM_ONE':
      return [randomSource.pick(minionsInPlay)];
    case 'SPECIFIC_DEFINITION': {
      const { minionDefinitionId } = behavior.criterion;
      return minionsInPlay.filter((m) => m.definitionId === minionDefinitionId);
    }
    case 'HIGHEST_PLANO_ATTACK': {
      const max = Math.max(...minionsInPlay.map((m) => m.planoAttackAmount));
      const top = minionsInPlay.filter((m) => m.planoAttackAmount === max);
      return [top.length === 1 ? (top[0] as MinionInPlay) : randomSource.pick(top)];
    }
    case 'HIGHEST_LIFE': {
      const max = Math.max(...minionsInPlay.map((m) => m.life));
      const top = minionsInPlay.filter((m) => m.life === max);
      return [top.length === 1 ? (top[0] as MinionInPlay) : randomSource.pick(top)];
    }
    case 'LOWEST_LIFE': {
      const min = Math.min(...minionsInPlay.map((m) => m.life));
      const bottom = minionsInPlay.filter((m) => m.life === min);
      return [bottom.length === 1 ? (bottom[0] as MinionInPlay) : randomSource.pick(bottom)];
    }
  }
}
