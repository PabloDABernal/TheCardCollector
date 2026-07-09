import type { CardId } from '@collector/domain-shared';

/**
 * H4 spec §6 — extraído de `card-hand-view.ts`/`ability-cooldown-view.ts` (ambos ELIMINADOS, la
 * mano y las habilidades del Líder migraron a HTML — `HandCardRow.tsx`/`AbilityRow.tsx` en
 * `apps/shell`). `cardTileName` sigue siendo necesario como `sourceId` estable de los comandos
 * `PLAY_*` (`gesture-command-translator.ts`).
 *
 * H4 (fix Reviewer) — `abilityIconGroupName` RETIRADA: su único consumidor era la juice recipe
 * `cooldownReady` (buscaba un game object de Phaser que ya no existe), también retirada. Ver
 * `../juice/recipes/index.ts`.
 */
export function cardTileName(cardId: CardId): string {
  return `card-${cardId}`;
}
