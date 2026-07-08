import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEADER_OPTIONS, DEFAULT_LEADER_OPTION } from '../combat/leader-options';
import type { RunStartNavigationState } from '../combat/run-start-navigation-state';

/**
 * H2.14 — reescritura completa: sustituye el placeholder puro de H2.2 (`<Link to="/combat">` sin
 * ningún estado ni elección). Ofrece un único punto de decisión real (elección de Líder, §0.2 de la
 * spec) y navega a `/combat` pasando el `leaderId` elegido vía `location.state` (§0.3).
 */
export function RunStartScreen(): JSX.Element {
  const [leaderId, setLeaderId] = useState<string>(DEFAULT_LEADER_OPTION.leaderId);
  const navigate = useNavigate();

  const handleStartCombat = (): void => {
    const state: RunStartNavigationState = { leaderId };
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
      <button onClick={handleStartCombat}>Iniciar combate</button>
    </div>
  );
}
