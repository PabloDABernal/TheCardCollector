import type { AbilityId, NucleoInstanceId } from '@collector/domain-shared';
import type { CombatSide } from './turn';

/**
 * Slice de H1.3 del union completo esbozado en architecture_stack.md §2.2. Historias
 * futuras (H1.4, H1.6, H1.14, H1.15, H1.16, H1.18...) AÑADEN variantes a este mismo
 * union (PLAY_CARD, GENERATE_ENERGY, CHANNEL, REDIRECT_DAMAGE, PLAY_CONTRATIEMPO...) —
 * nunca quitan ACTIVATE_ABILITY/END_TURN.
 *
 * `sourceId` identifica quién activa la habilidad (hoy: 'leader' o el id del Enemigo;
 * en el futuro, un Aliado o Secuaz concreto) — es informativo/de auditoría en H1.3,
 * no participa en la validación. `side` es el campo que SÍ valida el motor (de qué
 * lado del combate viene la acción); no existe todavía (H1.15/H1.16) un registro
 * sourceId → side, así que H1.3 lo pide explícito para no bloquearse con un diseño
 * prematuro de ese registro.
 */
export type CombatCommand =
  | {
      readonly type: 'ACTIVATE_ABILITY';
      readonly abilityId: AbilityId;
      readonly sourceId: string;
      readonly side: CombatSide;
      readonly nucleoInstanceId: NucleoInstanceId;
    }
  | { readonly type: 'END_TURN' };
