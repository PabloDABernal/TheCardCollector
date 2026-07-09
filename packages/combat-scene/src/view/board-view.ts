import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext } from './board-view-context';
import { createBoard } from './board';
import { createLeaderRoleView, createEnemyRoleView, createScenarioRoleView } from './role-view';
import { createAlliesView } from './allies-view';
import { createMinionsView } from './minions-view';
import { createNucleoTable } from './nucleo-table-view';

export interface BoardView {
  /** Idempotente — puede llamarse tantas veces como se quiera con el mismo snapshot sin cambiar el
   *  resultado visual. Actualiza roles, aliados, secuaces, y redibuja el pool de Núcleos completo.
   *  H4 spec §6 — ya NO actualiza mano ni cooldowns de habilidad (`card-hand-view.ts`/
   *  `ability-cooldown-view.ts` ELIMINADOS, migrados a `HandCardRow.tsx`/`AbilityRow.tsx` en
   *  `apps/shell`, fuera del árbol de renderizado de Phaser). */
  render(snapshot: CombatStateSnapshot): void;
}

/**
 * Crea TODOS los game objects persistentes (fondo, roles ×3, contenedores vacíos de
 * aliados/secuaces/pool) exactamente una vez — llamar dos veces sobre la misma escena duplica game
 * objects (mismo criterio "sin guardia interna", YAGNI, que EffectsDirector/InputAdapter).
 */
export function createBoardView(scene: Phaser.Scene, ctx: BoardViewContext): BoardView {
  createBoard(scene);

  const leaderRoleView = createLeaderRoleView(scene);
  const enemyRoleView = createEnemyRoleView(scene);
  const scenarioRoleView = createScenarioRoleView(scene);
  const alliesView = createAlliesView(scene);
  const minionsView = createMinionsView(scene);
  const nucleoTableView = createNucleoTable(scene, []);

  return {
    render(snapshot: CombatStateSnapshot): void {
      leaderRoleView.update(snapshot, ctx);
      enemyRoleView.update(snapshot, ctx);
      scenarioRoleView.update(snapshot, ctx);
      alliesView.syncFromSnapshot(snapshot);
      minionsView.syncFromSnapshot(snapshot);
      nucleoTableView.syncFromSnapshot(snapshot);
    },
  };
}
