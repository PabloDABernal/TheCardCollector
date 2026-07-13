import { useState } from 'react';
import type { CoreCostRequirement } from '@collector/domain-shared';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_INK,
  COLOR_RULE,
  COLOR_SUCCESS,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  NUCLEO_COLOR_HEX_CSS,
  RADIUS_PANEL,
  SHADOW_PANEL,
  SPACING,
  TYPE,
} from '../../ui/design-tokens';

export interface AbilityTileData {
  readonly abilityId: string;
  readonly name: string;
  readonly coreCost: CoreCostRequirement;
  readonly baseCooldown: number;
  readonly remaining: number; // 0 = lista
  readonly ruleText?: string;
}

export interface AbilityTileProps {
  readonly ability: AbilityTileData;
  readonly interactive: boolean; // solo las del Líder reciben onTap real
  readonly onTap?: () => void;
  /** NUEVO H4.x — `CharacterSheetPreview` (ficha ampliada, ya es "el nivel superior de long-press")
   *  pasa `true` para que `ruleText` se muestre SIEMPRE en línea, debajo del nombre, en vez de tras
   *  un long-press interno — no tiene sentido anidar un segundo long-press dentro del primero.
   *  `false`/ausente (default) preserva el comportamiento existente (tooltip + popover). */
  readonly forceShowRuleText?: boolean;
}

const TILE_SIZE = 60;
const RING_RADIUS = 27;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
// NUEVO H4.x — exportada (antes privada) para que `CombatBoardOverlay.tsx` reutilice el mismo
// umbral al disparar `CharacterSheetPreview` por long-press, en vez de reintroducirlo.
export const LONG_PRESS_MS = 400; // mismo umbral que InputAdapter/PointerGesture usa para LONG_PRESS

function fillColorFor(coreCost: CoreCostRequirement): string {
  if (coreCost.kind === 'COLOR' && coreCost.colors.length > 0) {
    return NUCLEO_COLOR_HEX_CSS[coreCost.colors[0]!];
  }
  return COLOR_RULE; // kind === 'ANY' — gris neutro
}

/**
 * H4_componente_carta.md §2 — sustituye el icono de `ability-cooldown-view.ts` (barra de progreso +
 * Text superpuesto, Phaser) por un tile HTML: círculo de color de coste (60×60) + anillo de progreso
 * de cooldown (SVG `<circle>` `stroke-dasharray`) + nombre debajo. Descripción sin ocupar espacio
 * permanente: `title` (tooltip nativo desktop) + long-press (400ms) que abre un popover CSS-only.
 */
export function AbilityTile({ ability, interactive, onTap, forceShowRuleText = false }: AbilityTileProps): JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const ready = ability.remaining === 0;
  const progress = ability.baseCooldown <= 0 ? 1 : (ability.baseCooldown - ability.remaining) / ability.baseCooldown;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const fillColor = fillColorFor(ability.coreCost);

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  function handleTouchStart(): void {
    longPressTimer = setTimeout(() => setPopoverOpen(true), LONG_PRESS_MS);
  }
  function handleTouchEnd(): void {
    if (longPressTimer) clearTimeout(longPressTimer);
    setPopoverOpen(false); // "se cierra al soltar" (spec §2)
  }

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.xs }}
      title={ability.ruleText}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        data-ability-id={ability.abilityId}
        onClick={interactive ? onTap : undefined}
        className={ready ? 'card-tile--ready' : undefined}
        style={{
          position: 'relative',
          width: TILE_SIZE,
          height: TILE_SIZE,
          borderRadius: '50%',
          background: fillColor,
          border: `2px solid ${COLOR_BINDER}`,
          boxShadow: SHADOW_PANEL,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: interactive ? 'pointer' : 'default',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        <svg
          width={TILE_SIZE}
          height={TILE_SIZE}
          style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={TILE_SIZE / 2}
            cy={TILE_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={COLOR_RULE}
            strokeWidth={4}
          />
          <circle
            cx={TILE_SIZE / 2}
            cy={TILE_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={ready ? COLOR_SUCCESS : COLOR_RULE}
            strokeWidth={4}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ ...TYPE.dataMd, color: COLOR_TEXT_PRIMARY, fontWeight: 700, zIndex: 1 }}>
          {ready ? '✓' : ability.remaining}
        </span>
      </div>
      <span style={{ ...TYPE.labelUpper, fontSize: 14, color: COLOR_TEXT_SECONDARY, textAlign: 'center' }}>
        {ability.name}
      </span>

      {forceShowRuleText && ability.ruleText && (
        <p style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY, margin: 0, textAlign: 'center', maxWidth: 140 }}>
          {ability.ruleText}
        </p>
      )}

      {!forceShowRuleText && popoverOpen && ability.ruleText && (
        <div
          onClick={() => setPopoverOpen(false)}
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translate(-50%, 8px)',
            maxWidth: 220,
            background: COLOR_INK,
            border: `1px solid ${COLOR_RULE}`,
            borderRadius: RADIUS_PANEL,
            padding: SPACING.sm,
            zIndex: 10,
            boxShadow: SHADOW_PANEL,
            ...TYPE.bodySm,
            color: COLOR_TEXT_PRIMARY,
          }}
        >
          {ability.ruleText}
          <span style={{ display: 'block', marginTop: SPACING.xs, color: COLOR_FOIL, ...TYPE.labelUpper, fontSize: 10 }}>
            Toca fuera para cerrar
          </span>
        </div>
      )}
    </div>
  );
}
