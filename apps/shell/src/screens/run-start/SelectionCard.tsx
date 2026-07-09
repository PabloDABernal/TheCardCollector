import {
  COLOR_CARD_BG,
  COLOR_CARD_BG_SELECTED,
  COLOR_CARD_BORDER,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  FONT_SIZE_CARD_LABEL,
  MIN_TAP_TARGET_PX,
  RADIUS_CARD,
  SPACING,
} from '../../ui/design-tokens';

// H4 spec §1.4 — tarjeta seleccionable, sustituye al `<input type="radio">` desnudo (causa raíz de
// la queja "selectores planos").
export interface SelectionCardOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string; // opcional, texto corto bajo el label (p.ej. arquetipo)
  readonly accentColor: string; // hex CSS, uno de ACCENT_COLORS asignado round-robin por índice
}

export interface SelectionCardProps {
  readonly option: SelectionCardOption;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}

/** Tarjeta seleccionable — `border` de `accentColor` cuando `selected`, fondo
 *  `COLOR_CARD_BG`/`COLOR_CARD_BG_SELECTED`, tamaño mínimo `MIN_TAP_TARGET_PX` en ambos ejes. */
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
        minWidth: 140,
        minHeight: MIN_TAP_TARGET_PX,
        padding: SPACING.md,
        borderRadius: RADIUS_CARD,
        border: `2px solid ${selected ? option.accentColor : COLOR_CARD_BORDER}`,
        background: selected ? COLOR_CARD_BG_SELECTED : COLOR_CARD_BG,
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
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: option.accentColor,
        }}
      />
      <span style={{ fontSize: FONT_SIZE_CARD_LABEL, fontWeight: selected ? 700 : 400 }}>
        {option.label}
      </span>
      {option.description && (
        <span style={{ fontSize: '13px', color: COLOR_TEXT_SECONDARY }}>{option.description}</span>
      )}
    </button>
  );
}
