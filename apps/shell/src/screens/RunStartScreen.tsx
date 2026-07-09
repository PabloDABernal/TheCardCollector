import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEADER_OPTIONS, DEFAULT_LEADER_OPTION } from '../combat/leader-options';
import { ENEMY_OPTIONS, DEFAULT_ENEMY_OPTION } from '../combat/enemy-options';
import { SCENARIO_OPTIONS, DEFAULT_SCENARIO_OPTION } from '../combat/scenario-options';
import type { RunStartNavigationState } from '../combat/run-start-navigation-state';

/**
 * H2.14 — reescritura completa: sustituye el placeholder puro de H2.2 (`<Link to="/combat">` sin
 * ningún estado ni elección). Ofrece un único punto de decisión real (elección de Líder, §0.2 de la
 * spec) y navega a `/combat` pasando el `leaderId` elegido vía `location.state` (§0.3).
 *
 * NUEVO H4.x — selector de testeo/desarrollo directo (fuera del sorteo 3+3 de H4, ver spec): suma
 * selección de Enemigo y Escenario con el mismo patrón visual/estado que el selector de Líder ya
 * existente, para poder probar el segundo combate del contenido de juguete 2×2×2 sin esperar al
 * sorteo real de la run completa.
 */
export function RunStartScreen(): JSX.Element {
  const [leaderId, setLeaderId] = useState<string>(DEFAULT_LEADER_OPTION.leaderId);
  const [enemyId, setEnemyId] = useState<string>(DEFAULT_ENEMY_OPTION.enemyId);
  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIO_OPTION.scenarioId);
  const navigate = useNavigate();

  const handleStartCombat = (): void => {
    const state: RunStartNavigationState = { leaderId, enemyId, scenarioId };
    navigate('/combat', { state });
  };

  return (
    <div>
      <p>Inicio de Run</p>
      <fieldset>
        <legend>Elige tu Líder</legend>
        {LEADER_OPTIONS.map((option) => (
          <label key={option.leaderId}>
            <input
              type="radio"
              name="leader"
              value={option.leaderId}
              checked={leaderId === option.leaderId}
              onChange={() => setLeaderId(option.leaderId)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Elige Enemigo</legend>
        {ENEMY_OPTIONS.map((option) => (
          <label key={option.enemyId}>
            <input
              type="radio"
              name="enemy"
              value={option.enemyId}
              checked={enemyId === option.enemyId}
              onChange={() => setEnemyId(option.enemyId)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Elige Escenario</legend>
        {SCENARIO_OPTIONS.map((option) => (
          <label key={option.scenarioId}>
            <input
              type="radio"
              name="scenario"
              value={option.scenarioId}
              checked={scenarioId === option.scenarioId}
              onChange={() => setScenarioId(option.scenarioId)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <button onClick={handleStartCombat}>Iniciar combate</button>
    </div>
  );
}
