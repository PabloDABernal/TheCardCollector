import type { CSSProperties } from 'react';
import { COLOR_BINDER, COLOR_RULE, COLOR_TEXT_DISABLED, COLOR_TEXT_PRIMARY, RADIUS_CHIP, SPACING, TYPE } from '../ui/design-tokens';

/** H4 spec §6 — helper visual único reutilizado por los controles del HUD de combate (`CombatHud.tsx`)
 *  y por el panel de log (`log/CombatLogPanel.tsx`). Extraído de `CombatHud.tsx` a un módulo
 *  compartido para que `CombatLogPanel.tsx` no dependa de un componente hermano solo por su estilo,
 *  mismo criterio ya aplicado con `free-step-availability.ts`. */
export function chipStyle(enabled: boolean): CSSProperties {
  return {
    ...TYPE.bodyMd,
    borderRadius: RADIUS_CHIP,
    padding: `${SPACING.xs}px ${SPACING.sm}px`,
    background: COLOR_BINDER,
    border: `1px solid ${enabled ? COLOR_RULE : 'rgba(58, 55, 68, 0.4)'}`,
    color: enabled ? COLOR_TEXT_PRIMARY : COLOR_TEXT_DISABLED,
    cursor: enabled ? 'pointer' : 'default',
  };
}
