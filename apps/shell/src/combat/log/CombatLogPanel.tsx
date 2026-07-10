import { useEffect, useRef, useState } from 'react';
import './log.css';
import { chipStyle } from '../chip-style';
import { colorForTone } from './log-tone-color';
import type { CombatLogEntry } from './use-combat-log';
import { COLOR_BINDER, COLOR_RULE, RADIUS_PANEL, SPACING, TYPE, COLOR_TEXT_SECONDARY } from '../../ui/design-tokens';

export interface CombatLogPanelProps {
  readonly entries: readonly CombatLogEntry[];
}

/**
 * H4 spec §3.2 — franja "peek" siempre visible (~36px), ancla inferior de `combat-screen-root`,
 * expandible a bottom-sheet con el histórico completo. Pulso `--danger` cuando la línea más
 * reciente es una acción del Enemigo (resuelve "que se vea qué hace el Enemigo" sin tocar
 * `turn-banner.ts`).
 */
export function CombatLogPanel({ entries }: CombatLogPanelProps): JSX.Element {
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

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6 }}>
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
