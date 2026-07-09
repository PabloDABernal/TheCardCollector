import { useState } from 'react';
import type { RunStartNavigationState } from '../../combat/run-start-navigation-state';
import { SelectionSection } from './SelectionSection';
import type { SelectionCardOption } from './SelectionCard';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_INK,
  COLOR_OVERLAY,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  MIN_TAP_TARGET_PX,
  RADIUS_CHIP,
  RADIUS_PANEL,
  SHADOW_MODAL,
  SPACING,
  TYPE,
} from '../../ui/design-tokens';

// H4 spec §3 — popup de selección de Líder/Enemigo/Escenario, único overlay+panel con 3 secciones
// apiladas (estructura ya validada de la spec anterior, sustituye los 3 `<fieldset>` planos
// originales de `RunStartScreen.tsx`). Esta pasada adopta el sistema de diseño real (§1) en vez de
// grises genéricos: paleta con nombre, tipografía Staatliches/Manrope, `--foil` como único acento.
export interface RunStartModalProps {
  readonly leaderOptions: readonly SelectionCardOption[];
  readonly enemyOptions: readonly SelectionCardOption[];
  readonly scenarioOptions: readonly SelectionCardOption[];
  readonly initialLeaderId: string;
  readonly initialEnemyId: string;
  readonly initialScenarioId: string;
  readonly onConfirm: (selection: RunStartNavigationState) => void;
}

/** Overlay (`COLOR_OVERLAY`, cubre viewport completo) + panel centrado (`COLOR_BINDER`,
 *  `RADIUS_PANEL`, `SHADOW_MODAL`) con las 3 `SelectionSection` + footer con botón "Iniciar combate"
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
          background: COLOR_BINDER,
          border: `1px solid ${COLOR_RULE}`,
          borderRadius: RADIUS_PANEL,
          boxShadow: SHADOW_MODAL,
          padding: SPACING.xl,
          color: COLOR_TEXT_PRIMARY,
        }}
      >
        <h2 style={{ ...TYPE.displayLg, color: COLOR_TEXT_PRIMARY, margin: 0 }}>Inicio de Run</h2>

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
              ...TYPE.bodyMd,
              fontWeight: 700,
              minHeight: MIN_TAP_TARGET_PX,
              padding: `${SPACING.sm}px ${SPACING.lg}px`,
              borderRadius: RADIUS_CHIP,
              border: 'none',
              // Único lugar de la pantalla en `--foil` — coherente con "el sistema grita en un solo
              // sitio" del sistema de diseño; texto oscuro (`--ink`) sobre foil para máximo contraste.
              background: COLOR_FOIL,
              color: COLOR_INK,
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
