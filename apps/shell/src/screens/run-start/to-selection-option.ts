import type { LeaderOption } from '../../combat/leader-options';
import type { EnemyOption } from '../../combat/enemy-options';
import type { ScenarioOption } from '../../combat/scenario-options';
import { NUCLEO_ACCENT_COLORS } from '../../ui/design-tokens';
import type { SelectionCardOption } from './SelectionCard';

/** Asigna `accentColor` por índice round-robin sobre `NUCLEO_ACCENT_COLORS` (5 colores, ciclando si
 *  hay más de 5 opciones) — el catálogo de juguete no tiene arte propio todavía, así que el acento de
 *  color es el único diferenciador visual entre tarjetas hasta que exista arte real. Este punto de
 *  color es decorativo/identificador de Núcleo asociado; la selección se marca aparte con `--foil`
 *  (H4 spec §3.2). */
function accentColorFor(index: number): string {
  return NUCLEO_ACCENT_COLORS[index % NUCLEO_ACCENT_COLORS.length]!;
}

export function leaderToSelectionOption(option: LeaderOption, index: number): SelectionCardOption {
  return { id: option.leaderId, label: option.label, accentColor: accentColorFor(index) };
}

export function enemyToSelectionOption(option: EnemyOption, index: number): SelectionCardOption {
  return { id: option.enemyId, label: option.label, accentColor: accentColorFor(index) };
}

export function scenarioToSelectionOption(option: ScenarioOption, index: number): SelectionCardOption {
  return { id: option.scenarioId, label: option.label, accentColor: accentColorFor(index) };
}
