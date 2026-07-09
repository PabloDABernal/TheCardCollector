import { useState } from 'react';
import type { RunStartNavigationState } from '../../combat/run-start-navigation-state';
import { SelectionSection } from './SelectionSection';
import type { SelectionCardOption } from './SelectionCard';
import {
  ACCENT_COLORS,
  COLOR_MODAL_BORDER,
  COLOR_MODAL_PANEL,
  COLOR_OVERLAY,
  COLOR_TEXT_PRIMARY,
  FONT_FAMILY,
  FONT_SIZE_TITLE,
  MIN_TAP_TARGET_PX,
  RADIUS_MODAL,
  SPACING,
} from '../../ui/design-tokens';

// Verde de acento (mismo hex que NUCLEO_COLOR_HEX.DEFENSA) — botón principal de confirmación.
const CONFIRM_BUTTON_COLOR = ACCENT_COLORS[2];

// H4 spec §1.3/§1.4 — popup de selección de Líder/Enemigo/Escenario, único overlay+panel con 3
// secciones apiladas (sustituye los 3 `<fieldset>` planos de `RunStartScreen.tsx`).
export interface RunStartModalProps {
  readonly leaderOptions: readonly SelectionCardOption[];
  readonly enemyOptions: readonly SelectionCardOption[];
  readonly scenarioOptions: readonly SelectionCardOption[];
  readonly initialLeaderId: string;
  readonly initialEnemyId: string;
  readonly initialScenarioId: string;
  readonly onConfirm: (selection: RunStartNavigationState) => void;
}

/** Overlay (`COLOR_OVERLAY`, cubre viewport completo) + panel centrado (`COLOR_MODAL_PANEL`,
 *  `RADIUS_MODAL`, `box-shadow`) con las 3 `SelectionSection` + footer con botón "Iniciar combate"
 *  (siempre habilitado: el estado interno siempre arranca con un id válido de cada categoría, nunca
 *  vacío). Gestiona el estado de selección internamente y solo emite hacia arriba en `onConfirm`. */
export function RunStartModal({
  leaderOptions,
  enemyOptions,
  scenarioOptions,
  initialLeaderId,
  initialEnemyId,
  initialScenarioId,
  onConfirm,
}: RunStartModalProps): JSX.Element {
  const [leaderId, setLeaderId] = useState<string>(initialLeaderId);
  const [enemyId, setEnemyId] = useState<string>(initialEnemyId);
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);

  const handleConfirm = (): void => {
    onConfirm({ leaderId, enemyId, scenarioId });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLOR_OVERLAY,
        fontFamily: FONT_FAMILY,
        padding: SPACING.md,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: COLOR_MODAL_PANEL,
          border: `1px solid ${COLOR_MODAL_BORDER}`,
          borderRadius: RADIUS_MODAL,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          padding: SPACING.xl,
          color: COLOR_TEXT_PRIMARY,
        }}
      >
        <h2 style={{ margin: 0, fontSize: FONT_SIZE_TITLE }}>Inicio de Run</h2>

        <SelectionSection
          title="Elige tu Líder"
          options={leaderOptions}
          selectedId={leaderId}
          onSelect={setLeaderId}
        />
        <SelectionSection
          title="Elige Enemigo"
          options={enemyOptions}
          selectedId={enemyId}
          onSelect={setEnemyId}
        />
        <SelectionSection
          title="Elige Escenario"
          options={scenarioOptions}
          selectedId={scenarioId}
          onSelect={setScenarioId}
        />

        <footer style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              minHeight: MIN_TAP_TARGET_PX,
              padding: `${SPACING.sm}px ${SPACING.lg}px`,
              borderRadius: RADIUS_CARD_BUTTON,
              border: 'none',
              background: CONFIRM_BUTTON_COLOR,
              color: '#0a0a0c',
              fontSize: FONT_SIZE_TITLE_BUTTON,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Iniciar combate
          </button>
        </footer>
      </div>
    </div>
  );
}

const RADIUS_CARD_BUTTON = 12;
const FONT_SIZE_TITLE_BUTTON = '16px';
