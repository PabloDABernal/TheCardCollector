import type { CombatStateSnapshot } from '@collector/domain-combat';

export interface CombatResultModalProps {
  readonly snapshot: CombatStateSnapshot; // snapshot.status !== 'IN_PROGRESS' garantizado por el caller
}

/**
 * Se monta cuando `useCombatSnapshot` refleja `status !== 'IN_PROGRESS'` (evento `COMBAT_ENDED`,
 * único evento terminal, `domain/combat` H1.18). Overlay/portal sobre el canvas — el juego de
 * fondo queda congelado porque `dispatch()` ya rechaza cualquier comando nuevo
 * (`COMBAT_ALREADY_ENDED`), sin necesitar destruir la escena para "pausarla". Botón de continuar
 * queda fuera de esta historia (no hay pantalla de descanso implementada todavía, Épica de run) —
 * placeholder de texto es suficiente.
 */
export function CombatResultModal({ snapshot }: CombatResultModalProps): JSX.Element {
  const title = snapshot.status === 'VICTORY' ? 'Victoria' : 'Derrota';
  return (
    <div
      role="dialog"
      style={{
        position: 'absolute',
        inset: 0,
        // Fondo opaco necesario para ocultar por completo el HUD/canvas congelados detrás (bug QA
        // battle-loop-design: sin esto el texto se solapaba con el HUD vivo debajo). Mismo tono
        // oscuro que `CombatScene.setBackgroundColor('#12141c')` (packages/combat-scene/src/scenes/CombatScene.ts)
        // con un poco más de opacidad para asegurar contraste total del texto, coherente con la
        // paleta oscura del resto del combate.
        backgroundColor: 'rgba(18, 20, 28, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        textAlign: 'center',
      }}
    >
      <h2>{title}</h2>
      {snapshot.status === 'DEFEAT' && <p>Motivo: {snapshot.defeatReason}</p>}
    </div>
  );
}
