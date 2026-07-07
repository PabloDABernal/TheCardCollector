import type { CombatStateSnapshot } from '@collector/domain-combat';

export interface CombatHudProps {
  readonly snapshot: CombatStateSnapshot;
  readonly onEndTurn: () => void;
}

/**
 * "Chrome" no-juice sobre el canvas (`architecture_stack.md` §2.3) — vida/Trama/turno YA se
 * muestran dentro del canvas vía `role-view.ts` (H2.8); este HUD React NO duplica ese texto,
 * aporta solo lo que Phaser no tiene: el botón de acción "Fin de turno" (END_TURN se dispatch
 * aquí, no por gesto de Phaser, porque no hay ningún sprite de "botón de fin de turno" en el
 * tablero ni lo pide el backlog).
 */
export function CombatHud({ snapshot, onEndTurn }: CombatHudProps): JSX.Element {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <button onClick={onEndTurn} disabled={snapshot.status !== 'IN_PROGRESS'}>
        Fin de turno
      </button>
    </div>
  );
}
