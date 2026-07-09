import type { DramaturgiaCardViewData } from '@collector/combat-scene';
import { ENEMY_POSITION, ENEMY_ABILITIES_ROW_Y } from '@collector/combat-scene';
import { CardTile, type CardTileData } from './CardTile';
import type { CardIconKind } from './card-icon';

export interface EnemyDramaturgiaCardSlotProps {
  readonly activeCard: DramaturgiaCardViewData | null;
}

// H4_componente_carta.md §3.3 — 'ATTACK'/'PLOT' (EnemyAbilityBranch) → CardIconKind 'ATAQUE'/'TRAMA'.
function iconFor(icon: 'ATTACK' | 'PLOT'): CardIconKind {
  return icon === 'ATTACK' ? 'ATAQUE' : 'TRAMA';
}

function toCardTileData(card: DramaturgiaCardViewData): CardTileData {
  return {
    id: card.dramaturgiaCardId,
    name: card.name,
    icon: iconFor(card.icon),
    cost: null, // Dramaturgia no se "juega" con Energía — sin coste visible al jugador
    keywords: card.keywords,
    ...(card.ruleText !== undefined ? { ruleText: card.ruleText } : {}),
  };
}

// Escala reducida (0.68) para que la carta "featured" (224×332) quepa razonablemente en el hueco
// vertical disponible bajo el tile+abilities del Enemigo sin requerir un rediseño de
// `board-layout.ts`/`PANEL_ZONES` (fuera de alcance de esta pasada — cambio de arquitectura de
// tablero, no de estilo). Posicionada a la derecha de la fila de habilidades del Enemigo, dentro del
// ancho de `panel-enemy` (1000px centrado en `ENEMY_POSITION.x`).
const SLOT_SCALE = 0.68;
const SLOT_OFFSET_X = 260;

/** H4_componente_carta.md §3.3/§5 (mockup §7) — carta de Dramaturgia activa del Enemigo, sustituye
 *  el texto diminuto anterior bajo "Enemigo". `size="featured"`, sin `onTap` (nunca tocable). Se
 *  omite por completo si `activeCard` es `null` (aún no robó ninguna carta / IA deshabilitada) — no
 *  se pinta un placeholder vacío. */
export function EnemyDramaturgiaCardSlot({ activeCard }: EnemyDramaturgiaCardSlotProps): JSX.Element | null {
  if (!activeCard) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: ENEMY_POSITION.x + SLOT_OFFSET_X,
        top: ENEMY_ABILITIES_ROW_Y,
        transform: `translate(-50%, -50%) scale(${SLOT_SCALE})`,
        pointerEvents: 'none',
      }}
    >
      <CardTile card={toCardTileData(activeCard)} size="featured" />
    </div>
  );
}
