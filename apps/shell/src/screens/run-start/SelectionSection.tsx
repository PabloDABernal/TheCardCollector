import { SelectionCard, type SelectionCardOption } from './SelectionCard';
import { COLOR_TEXT_SECONDARY, FONT_SIZE_SECTION_TITLE, SPACING } from '../../ui/design-tokens';

// H4 spec §1.4 — fila horizontal de `SelectionCard` con título de sección.
export interface SelectionSectionProps {
  readonly title: string;
  readonly options: readonly SelectionCardOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

/** Fila horizontal de `SelectionCard` con título de sección. `overflow-x: auto` como red de
 *  seguridad si el catálogo crece más allá de lo que cabe en un viewport móvil estrecho — no se
 *  asume que el contenido siempre serán 2 opciones. */
export function SelectionSection({
  title,
  options,
  selectedId,
  onSelect,
}: SelectionSectionProps): JSX.Element {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
      <h3
        style={{
          margin: 0,
          fontSize: FONT_SIZE_SECTION_TITLE,
          color: COLOR_TEXT_SECONDARY,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', gap: SPACING.sm, overflowX: 'auto', paddingBottom: SPACING.xs }}>
        {options.map((option) => (
          <SelectionCard
            key={option.id}
            option={option}
            selected={option.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
