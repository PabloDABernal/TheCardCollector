import { useEffect, useRef, useState } from 'react';
import './log.css';
import { chipStyle } from '../chip-style';
import { colorForTone } from './log-tone-color';
import type { CombatLogEntry } from './use-combat-log';
import { COLOR_BINDER, COLOR_RULE, RADIUS_PANEL, SPACING, TYPE, COLOR_TEXT_SECONDARY } from '../../ui/design-tokens';

export interface CombatLogPanelProps {
  readonly entries: readonly CombatLogEntry[];
  /** NUEVO H5.8 §3.2 — por defecto `'peek'` (comportamiento H4 sin cambios: franja inferior +
   *  bottom-sheet expandible). `'sidebar'`: panel lateral SIEMPRE expandido (sin franja peek, sin
   *  toggle), pensado para el margen lateral libre en desktop ancho — mismas entradas, mismo
   *  `colorForTone`, solo cambia el contenedor/posición. */
  readonly variant?: 'peek' | 'sidebar';
}

/**
 * H4 spec §3.2 — franja "peek" siempre visible (~36px), ancla inferior de `combat-screen-root`,
 * expandible a bottom-sheet con el histórico completo. Pulso `--danger` cuando la línea más
 * reciente es una acción del Enemigo (resuelve "que se vea qué hace el Enemigo" sin tocar
 * `turn-banner.ts`).
 *
 * H5.8 §3.2 — `variant='sidebar'` sustituye por completo la franja peek/bottom-sheet por un panel
 * lateral siempre visible con scroll interno, para desktop ancho (`useIsWideViewport`,
 * `CombatScreen.tsx`). `variant='peek'` (o sin prop) es comportamiento IDÉNTICO a H4.
 */
export function CombatLogPanel({ entries, variant = 'peek' }: CombatLogPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const latest = entries[entries.length - 1];
  const [pulseId, setPulseId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (latest?.tone === 'ENEMY_ACTION') {
      setPulseId(latest.id);
      const t = setTimeout(() => setPulseId(null), 1400); // 1 ciclo de log-peek-pulse
      return () => clearTimeout(t);
    }
    return undefined;
  }, [latest?.id, latest?.tone]);

  // Autoscroll al fondo en cada entrada nueva, mientras el panel expandido está abierto.
  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [expanded, entries.length]);

  // H5.8 §3.2 — sidebar: panel lateral SIEMPRE expandido, sin franja peek ni toggle. Reutiliza
  // `colorForTone`/mismas entradas, solo cambia el contenedor (fixed, ancla derecha, scroll interno).
  if (variant === 'sidebar') {
    return (
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 320,
          background: COLOR_BINDER,
          borderLeft: `2px solid ${COLOR_RULE}`,
          padding: SPACING.md,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xs,
          overflowY: 'auto',
          zIndex: 6,
        }}
      >
        <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>Registro de combate</span>
        {entries.length === 0 && (
          <span style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY }}>Sin eventos todavía.</span>
        )}
        {entries.map((e) => (
          <span key={e.id} style={{ ...TYPE.bodySm, color: colorForTone(e.tone) }}>
            {e.text}
          </span>
        ))}
      </div>
    );
  }

  // FIX QA (Bug 1, layout de combate en viewports anchos/bajos) — este panel ya NO vive dentro de un
  // wrapper `position: absolute` superpuesto a la altura completa del canvas (`CombatScreen.tsx`
  // ahora lo porta a `.combat-screen-footer`, una fila real del flex column que reserva su propio
  // alto). Colapsado (caso normal, "peek" de ~36px), se queda en flujo normal (`position: relative`)
  // para que esa fila realmente ocupe espacio y el canvas de Phaser se reescale dejándole hueco.
  // Expandido (bottom-sheet con el histórico completo, gesto explícito del jugador), pasa a
  // `position: fixed` para overlay temporal sobre TODO — eso sigue siendo intencional (el jugador
  // abrió el panel a propósito), no una regresión de este fix.
  return (
    <div style={expanded ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 6 } : { position: 'relative' }}>
      {expanded && (
        <div
          ref={listRef}
          style={{
            maxHeight: '45vh',
            overflowY: 'auto',
            background: COLOR_BINDER,
            borderTop: `2px solid ${COLOR_RULE}`,
            borderRadius: `${RADIUS_PANEL}px ${RADIUS_PANEL}px 0 0`,
            padding: SPACING.md,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.xs,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>Registro de combate</span>
            <button type="button" onClick={() => setExpanded(false)} style={chipStyle(true)}>
              ✕
            </button>
          </div>
          {entries.length === 0 && (
            <span style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY }}>Sin eventos todavía.</span>
          )}
          {entries.map((e) => (
            <span key={e.id} style={{ ...TYPE.bodySm, color: colorForTone(e.tone) }}>
              {e.text}
            </span>
          ))}
        </div>
      )}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'rgba(31, 30, 38, 0.88)',
            borderTop: `1px solid ${COLOR_RULE}`,
            padding: `${SPACING.xs}px ${SPACING.md}px`,
            minHeight: 36,
            border: 'none',
            borderTopStyle: 'solid',
            cursor: 'pointer',
            ...TYPE.bodySm,
            color: colorForTone(latest?.tone ?? 'SYSTEM'),
            animation: pulseId ? 'log-peek-pulse 1.4s ease-in-out' : undefined,
          }}
        >
          {latest ? latest.text : 'Registro de combate'}
        </button>
      )}
    </div>
  );
}
