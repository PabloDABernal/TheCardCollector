import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  MIN_TAP_TARGET_PX,
  RADIUS_PANEL,
  SHADOW_PANEL,
  SPACING,
  TYPE,
} from '../../ui/design-tokens';

// H4 spec §3.2 — tarjeta seleccionable, se lee como una funda de carta de coleccionista (sustituye
// al `<input type="radio">` desnudo original, causa raíz de la queja "selectores planos").
export interface SelectionCardOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string; // opcional, texto corto bajo el label (p.ej. arquetipo)
  readonly accentColor: string; // hex CSS, uno de NUCLEO_ACCENT_COLORS asignado round-robin por índice
}

export interface SelectionCardProps {
  readonly option: SelectionCardOption;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}

/** Tarjeta seleccionable — `border`/halo `--foil` cuando `selected` (único indicador de selección,
 *  no un color de acento distinto por tarjeta), `SHADOW_PANEL` SIEMPRE (seleccionada o no: fondo
 *  plano sin sombra en estado no-seleccionado es exactamente el "plano sin profundidad" que la spec
 *  señala), tamaño mínimo `MIN_TAP_TARGET_PX` en ambos ejes. */
export function SelectionCard({ option, selected, onSelect }: SelectionCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      aria-pressed={selected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: SPACING.xs,
        minWidth: 148,
        minHeight: MIN_TAP_TARGET_PX,
        padding: SPACING.md,
        borderRadius: RADIUS_PANEL,
        background: COLOR_BINDER,
        border: `2px solid ${selected ? COLOR_FOIL : COLOR_RULE}`,
        boxShadow: selected ? `0 0 0 3px rgba(212, 162, 76, 0.25), ${SHADOW_PANEL}` : SHADOW_PANEL,
        color: COLOR_TEXT_PRIMARY,
        cursor: 'pointer',
        textAlign: 'left',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: option.accentColor,
        }}
      />
      <span style={{ ...TYPE.bodyMd, fontWeight: selected ? 700 : 400 }}>{option.label}</span>
      {option.description && (
        <span style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY }}>{option.description}</span>
      )}
    </button>
  );
}
