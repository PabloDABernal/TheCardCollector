import { useNavigate } from 'react-router-dom';
import { LEADER_OPTIONS, DEFAULT_LEADER_OPTION } from '../combat/leader-options';
import { ENEMY_OPTIONS, DEFAULT_ENEMY_OPTION } from '../combat/enemy-options';
import { SCENARIO_OPTIONS, DEFAULT_SCENARIO_OPTION } from '../combat/scenario-options';
import type { RunStartNavigationState } from '../combat/run-start-navigation-state';
import { RunStartModal } from './run-start/RunStartModal';
import {
  leaderToSelectionOption,
  enemyToSelectionOption,
  scenarioToSelectionOption,
} from './run-start/to-selection-option';
import { COLOR_PAGE_BACKGROUND } from '../ui/design-tokens';

/**
 * H2.14 — reescritura completa: sustituye el placeholder puro de H2.2 (`<Link to="/combat">` sin
 * ningún estado ni elección).
 *
 * H4.1 — reescritura sobre selectores planos (`<fieldset>`/`<input type="radio">`): pasa a ser host
 * delgado de `RunStartModal`, un único popup con contraste real (spec `docs/specs/H4_rediseno_ui_ux.md`
 * §1). El modal está SIEMPRE abierto en esta pantalla — el degradado de fondo (`COLOR_PAGE_BACKGROUND`,
 * nunca negro plano) es lo único visible fuera del panel.
 */
export function RunStartScreen(): JSX.Element {
  const navigate = useNavigate();

  const leaderOptions = LEADER_OPTIONS.map(leaderToSelectionOption);
  const enemyOptions = ENEMY_OPTIONS.map(enemyToSelectionOption);
  const scenarioOptions = SCENARIO_OPTIONS.map(scenarioToSelectionOption);

  const handleConfirm = (selection: RunStartNavigationState): void => {
    navigate('/combat', { state: selection });
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: COLOR_PAGE_BACKGROUND,
      }}
    >
      <RunStartModal
        leaderOptions={leaderOptions}
        enemyOptions={enemyOptions}
        scenarioOptions={scenarioOptions}
        initialLeaderId={DEFAULT_LEADER_OPTION.leaderId}
        initialEnemyId={DEFAULT_ENEMY_OPTION.enemyId}
        initialScenarioId={DEFAULT_SCENARIO_OPTION.scenarioId}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
