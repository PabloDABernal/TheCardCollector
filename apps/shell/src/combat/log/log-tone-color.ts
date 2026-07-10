import { COLOR_DANGER, COLOR_FOIL, COLOR_SUCCESS, COLOR_TEXT_SECONDARY } from '../../ui/design-tokens';
import type { CombatLogTone } from './use-combat-log';

/** H4 spec §3.2 — color de texto de cada línea de log según su tono semántico. */
export function colorForTone(tone: CombatLogTone): string {
  switch (tone) {
    case 'DAMAGE':
      return COLOR_DANGER;
    case 'HEAL':
      return COLOR_SUCCESS;
    case 'ENEMY_ACTION':
      return COLOR_DANGER;
    case 'LEADER_ACTION':
      return COLOR_SUCCESS;
    case 'SUMMON':
      return COLOR_FOIL;
    case 'SYSTEM':
    default:
      return COLOR_TEXT_SECONDARY;
  }
}
