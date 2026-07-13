import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { freeStepAvailabilityFor } from './free-step-availability';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_INK,
  COLOR_OVERLAY,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  MIN_TAP_TARGET_PX,
  RADIUS_CHIP,
  RADIUS_PANEL,
  SHADOW_MODAL,
  SPACING,
  TYPE,
} from '../ui/design-tokens';

export interface TurnStartModalProps {
  readonly snapshot: CombatStateSnapshot;
  readonly bridge: CombatBridge;
  /** NUEVO H5.9 §2 — mientras `true`, el modal NO aparece aunque el resto de la condición de
   *  `shouldShow` ya se cumpla: el turno del Enemigo (o la última acción del propio Líder) todavía
   *  se está reproduciendo visualmente (`EffectsQueueSignal`, `EffectsDirector`). Evita el "popup
   *  ciego" — el jugador ve completo lo que ocurrió antes de que se le pida la siguiente decisión. */
  readonly effectsQueueDraining: boolean;
}

/**
 * H4 spec §1 — popup obligatorio de paso previo del turno del Líder. Aparece automáticamente
 * cuando `snapshot.leaderFreeStep.takenThisTurn === false` y es turno del Líder; se cierra solo,
 * sin `onClose`, cuando ese campo pasa a `true` (comando `DRAW_OR_GENERATE` ya resuelto) o cuando
 * el jugador pulsa "Ahora no" (descarte SOLO para este turno, sin comando de dominio — el paso
 * sigue disponible el resto del turno vía la franja de `CombatHud`). Sin cierre por clic fuera ni
 * Escape (spec §1.4: "que no se te olvide" es el encargo central, no debe poder ignorarse por
 * accidente).
 *
 * H5.9 §2 — añade `effectsQueueDraining` a la condición de aparición: espera a que la cola de
 * reproducción de `EffectsDirector` termine de drenar (turno completo del Enemigo ya visible) antes
 * de interrumpir con el popup de la siguiente decisión.
 */
export function TurnStartModal({ snapshot, bridge, effectsQueueDraining }: TurnStartModalProps): JSX.Element | null {
  const [dismissedForTurn, setDismissedForTurn] = useState<ReadonlySet<number>>(new Set());

  const shouldShow =
    snapshot.status === 'IN_PROGRESS' &&
    snapshot.turn.turnOwner === 'LEADER' &&
    !snapshot.leaderFreeStep.takenThisTurn &&
    !dismissedForTurn.has(snapshot.turn.turnNumber) &&
    !effectsQueueDraining;

  if (!shouldShow) {
    return null;
  }

  const avail = freeStepAvailabilityFor(snapshot);

  const primaryButtonStyle = (enabled: boolean): CSSProperties => ({
    ...TYPE.bodyMd,
    fontWeight: 700,
    minHeight: MIN_TAP_TARGET_PX,
    padding: `${SPACING.sm}px ${SPACING.lg}px`,
    borderRadius: RADIUS_CHIP,
    border: 'none',
    background: enabled ? COLOR_FOIL : COLOR_RULE,
    color: enabled ? COLOR_INK : COLOR_TEXT_SECONDARY,
    cursor: enabled ? 'pointer' : 'default',
  });

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLOR_OVERLAY,
        padding: SPACING.md,
        zIndex: 20, // por encima de TargetingPromptBanner (5) y CombatHud (4) — H4 spec §5
      }}
    >
      <div
        style={{
          background: COLOR_BINDER,
          border: `1px solid ${COLOR_RULE}`,
          borderRadius: RADIUS_PANEL,
          boxShadow: SHADOW_MODAL,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <h2 style={{ ...TYPE.displayLg, color: COLOR_TEXT_PRIMARY, margin: 0 }}>Tu turno</h2>
        <p style={{ ...TYPE.bodyMd, color: COLOR_TEXT_SECONDARY, margin: 0 }}>
          Antes de tus 2 acciones, elige tu paso previo gratuito.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          <button
            type="button"
            disabled={!avail.canDraw}
            style={primaryButtonStyle(avail.canDraw)}
            onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' })}
          >
            Robar carta
          </button>
          <button
            type="button"
            disabled={!avail.canGenerate}
            style={primaryButtonStyle(avail.canGenerate)}
            onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' })}
          >
            Generar energía
          </button>
        </div>
        <button
          type="button"
          style={{
            ...TYPE.bodyMd,
            borderRadius: RADIUS_CHIP,
            padding: `${SPACING.xs}px ${SPACING.sm}px`,
            background: 'transparent',
            border: `1px solid ${COLOR_RULE}`,
            color: COLOR_TEXT_PRIMARY,
            cursor: 'pointer',
            alignSelf: 'center',
          }}
          onClick={() =>
            setDismissedForTurn((current) => new Set(current).add(snapshot.turn.turnNumber))
          }
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
