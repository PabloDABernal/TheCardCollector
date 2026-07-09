import type { CSSProperties } from 'react';
import type { KeywordId } from '@collector/domain-catalog';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_INK,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  CARD_TYPE_COLORS,
  RADIUS_PANEL,
  RADIUS_CHIP,
  SHADOW_PANEL,
  SPACING,
  TYPE,
} from '../../ui/design-tokens';
import { CARD_ICON_GLYPH, type CardIconKind } from './card-icon';
import { keywordLabel } from './keyword-label';

export type CardTileSize = 'hand' | 'featured';

export interface CardTileData {
  readonly id: string; // CardId o DramaturgiaCardId — solo se usa como React key/data-id, opaco aquí
  readonly name: string;
  readonly icon: CardIconKind;
  readonly cost: { readonly kind: 'ENERGY'; readonly amount: number } | null; // null = sin coste visible (Dramaturgia)
  readonly ruleText?: string;
  readonly keywords: readonly { readonly keyword: string; readonly amount?: number }[];
}

export interface CardTileProps {
  readonly card: CardTileData;
  readonly size: CardTileSize; // 'hand' = 132×196, 'featured' = 224×332
  readonly affordable?: boolean; // default true — atenúa igual que ALPHA_UNAFFORDABLE
  readonly selected?: boolean; // borde/halo --foil
  readonly onTap?: () => void; // hand-tap real; featured (Dramaturgia) nunca lo recibe
  readonly style?: CSSProperties; // posicionamiento absoluto lo inyecta el padre
  /** NUEVO — clase CSS adicional (usada por `HandCardRow` para disparar `card-tile--playing`, ver
   *  `card.css`). No forma parte del contrato original de la spec pero es necesaria para enganchar
   *  la animación de "jugar carta" (§4) sin que `CardTile` conozca el ciclo de vida de la mano. */
  readonly className?: string;
  readonly onAnimationEnd?: () => void;
}

/** H4_componente_carta.md §1.4 — estructura DOM exacta de la spec, con tokens ya existentes. */
export function CardTile({
  card,
  size,
  affordable = true,
  selected = false,
  onTap,
  style,
  className,
  onAnimationEnd,
}: CardTileProps): JSX.Element {
  const isHand = size === 'hand';

  return (
    <div
      data-card-id={card.id}
      className={className}
      onClick={onTap}
      onAnimationEnd={onAnimationEnd}
      style={{
        width: isHand ? 132 : 224,
        height: isHand ? 196 : 332,
        display: 'flex',
        flexDirection: 'column',
        background: COLOR_BINDER,
        border: `2px solid ${selected ? COLOR_FOIL : CARD_TYPE_COLORS[card.icon]}`,
        borderRadius: RADIUS_PANEL,
        boxShadow: selected ? `0 0 0 3px rgba(212, 162, 76, 0.25), ${SHADOW_PANEL}` : SHADOW_PANEL,
        opacity: affordable ? 1 : 0.4,
        padding: isHand ? SPACING.xs : SPACING.sm,
        gap: SPACING.xs,
        pointerEvents: onTap ? 'auto' : 'none',
        cursor: onTap ? 'pointer' : 'default',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: isHand ? 16 : 22 }}>{CARD_ICON_GLYPH[card.icon]}</span>
        {card.cost && (
          <span
            style={{
              ...TYPE.dataMd,
              minWidth: 22,
              height: 22,
              borderRadius: '50%',
              background: COLOR_INK,
              color: COLOR_FOIL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${COLOR_RULE}`,
            }}
          >
            {card.cost.amount}
          </span>
        )}
      </div>

      <span
        style={{
          ...(isHand ? TYPE.bodyMd : TYPE.displaySm),
          fontWeight: 700,
          color: COLOR_TEXT_PRIMARY,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {card.name}
      </span>
      <div style={{ borderTop: `1px solid ${COLOR_RULE}` }} />

      {card.ruleText && (
        <p style={{ ...TYPE.bodySm, color: COLOR_TEXT_SECONDARY, margin: 0, flex: 1, overflow: 'hidden' }}>
          {card.ruleText}
        </p>
      )}

      {card.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {card.keywords.map((k, i) => (
            <span
              // eslint-disable-next-line react/no-array-index-key -- una carta puede repetir keyword (ej. dos ATAQUE_MAS_X no ocurre hoy, pero el índice es más estable que el propio keyword como key único)
              key={`${k.keyword}-${i}`}
              style={{
                ...TYPE.labelUpper,
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: RADIUS_CHIP,
                background: COLOR_INK,
                border: `1px solid ${COLOR_RULE}`,
                color: COLOR_TEXT_SECONDARY,
              }}
            >
              {keywordLabel({ keyword: k.keyword as KeywordId, ...(k.amount !== undefined ? { amount: k.amount } : {}) })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
