import type { AbilityId, CardId, CardInstanceId, NucleoInstanceId } from '@collector/domain-shared';
import type { CombatSide } from './turn';
import type { MinionDefinitionId } from './minion';

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
  | { readonly type: 'END_TURN' }
  | {
      /**
       * NUEVO H1.14. Contratiempo es EXCLUSIVO del Líder (GDD §2.7: "carta que juegas...
       * en tu propio turno"; el Enemigo no tiene mano, solo Dramaturgia, GDD §3.4) — por
       * eso este comando no lleva `side` (a diferencia de ACTIVATE_ABILITY): siempre se
       * valida contra `turnOwner === 'LEADER'` (ver combat-engine.ts,
       * handlePlayContratiempo). No lleva `nucleoInstanceId` — Contratiempo paga
       * Energía, nunca Núcleo (GDD §2.7: "Paga Energía").
       */
      readonly type: 'PLAY_CONTRATIEMPO';
      readonly cardId: CardId;
      readonly sourceId: string;
    }
  | {
      /**
       * NUEVO H1.15. Bajar una carta ALIADO de la mano (GDD §2.2 punto 4). Exclusivo del
       * Líder (mismo motivo que PLAY_CONTRATIEMPO: el Enemigo no tiene mano, GDD §3.4).
       * Consume 1 acción + Energía — ver spec H1.15 §0.2.
       */
      readonly type: 'PLAY_ALLY';
      readonly cardId: CardId;
      readonly sourceId: string;
    }
  | {
      /**
       * NUEVO H1.15. Declara/retira el Aliado al que se redirige el daño de Ataque
       * entrante — GDD §3.3/§3.7, "sin gastar acción". Ver spec H1.15 §0.3/§0.4.
       */
      readonly type: 'SET_DAMAGE_REDIRECT';
      readonly targetAllyInstanceId: CardInstanceId | null;
    }
  | {
      /**
       * NUEVO H1.16. Introduce un Secuaz en mesa (GDD §3.8) — equivalente a lo que hoy
       * hace, sin ejecutar, el `effectDescription` de una carta de Dramaturgia (ver spec
       * H1.16 §0.8). Sin coste de acción/Núcleo/Energía. Exclusivo de
       * `turnOwner === 'ENEMY'` (mismo criterio que `PLAY_CONTRATIEMPO`/`PLAY_ALLY` con
       * su lado fijo, pero espejado a Enemigo).
       */
      readonly type: 'SUMMON_MINION';
      readonly minionDefinitionId: MinionDefinitionId;
      readonly sourceId: string;
    }
  | {
      /**
       * NUEVO H1.16. Decide Y ejecuta, en una sola llamada, la acción del turno de los
       * Secuaces (selección aleatoria con filtro de validez incluida — ver spec H1.16
       * §0.3). Sin payload — a diferencia de `ACTIVATE_ABILITY`, la selección es
       * responsabilidad del motor. Exclusivo de `turnOwner === 'ENEMY'`, 1 sola vez por
       * turno de Enemigo (contador propio `minionActionResolvedThisEnemyTurn`,
       * independiente de `ENEMY_BASE_ACTIONS_PER_TURN`).
       */
      readonly type: 'RESOLVE_MINION_ACTION';
    };
