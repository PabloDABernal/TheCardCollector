import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  RADIUS_PANEL,
  SHADOW_PANEL,
  SPACING,
  TYPE,
} from '../../ui/design-tokens';
import { AbilityTile, type AbilityTileData } from './AbilityTile';

export interface CharacterSheetPreviewProps {
  readonly name: string;
  readonly side: 'LEADER' | 'ENEMY';
  readonly life: { readonly current: number; readonly max: number };
  /** Escudo/Energía/Nivel (Líder) o Fase (Enemigo) — mismos datos que `RoleBlock` ya consume hoy. */
  readonly extraStats?: readonly { readonly label: string; readonly value: string }[];
  /** TODAS las abilities de ese lado — `ruleText` SIEMPRE visible (no popover), ver `AbilityTile`
   *  `forceShowRuleText`. */
  readonly abilities: readonly AbilityTileData[];
}

/**
 * NUEVO H4.x — vista ampliada tipo carta al mantener pulsado/hover sobre el tile compacto de
 * Líder/Enemigo (`RoleBlock`, `CombatBoardOverlay.tsx`). Composición LITERAL de `AbilityTile`s ya
 * existentes dentro de un panel más grande — sin sistema nuevo, reutiliza lo que ya hay (spec
 * H4_targeting_habilidades_y_ficha_personaje.md §3.2b). Referencia de "feel": hover en strawtable.net
 * (vision.md/decisions.md).
 */
export function CharacterSheetPreview({ name, life, extraStats, abilities }: CharacterSheetPreviewProps): JSX.Element {
  return (
    <div
      style={{
        width: 320,
        background: COLOR_BINDER,
        border: `2px solid ${COLOR_FOIL}`,
        borderRadius: RADIUS_PANEL,
        boxShadow: SHADOW_PANEL,
        padding: SPACING.md,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
      }}
    >
      <span style={{ ...TYPE.displaySm, color: COLOR_TEXT_PRIMARY }}>{name}</span>
      <div style={{ display: 'flex', gap: SPACING.md, flexWrap: 'wrap', ...TYPE.dataMd, color: COLOR_TEXT_PRIMARY }}>
        <span>
          ♥ {life.current}/{life.max}
        </span>
        {extraStats?.map((s) => (
          <span key={s.label}>
            {s.label} {s.value}
          </span>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${COLOR_RULE}` }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACING.sm }}>
        {abilities.map((ability) => (
          <AbilityTile key={ability.abilityId} ability={ability} interactive={false} forceShowRuleText />
        ))}
      </div>
    </div>
  );
}
