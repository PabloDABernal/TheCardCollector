import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext } from './board-view-context';
import { createBoard } from './board';
import { createLeaderRoleView, createEnemyRoleView, createScenarioRoleView } from './role-view';
import { createCardHandView } from './card-hand-view';
import { createAlliesView } from './allies-view';
import { createMinionsView } from './minions-view';
import { createNucleoPoolView } from './nucleo-pool-view';

export interface BoardView {
  /** Idempotente — puede llamarse tantas veces como se quiera con el mismo snapshot sin cambiar el
   *  resultado visual. Actualiza roles, aliados, secuaces, mano (alpha), y redibuja el pool de
   *  Núcleos completo. */
  render(snapshot: CombatStateSnapshot): void;
}

/**
 * Crea TODOS los game objects persistentes (fondo, roles ×3, mano, contenedores vacíos de
 * aliados/secuaces/pool) exactamente una vez — llamar dos veces sobre la misma escena duplica game
 * objects (mismo criterio "sin guardia interna", YAGNI, que EffectsDirector/InputAdapter).
 */
export function createBoardView(scene: Phaser.Scene, ctx: BoardViewContext): BoardView {
  createBoard(scene);

  const leaderRoleView = createLeaderRoleView(scene);
  const enemyRoleView = createEnemyRoleView(scene);
  const scenarioRoleView = createScenarioRoleView(scene);
  const cardHandView = createCardHandView(scene, ctx);
  const alliesView = createAlliesView(scene);
  const minionsView = createMinionsView(scene);
  const nucleoPoolView = createNucleoPoolView(scene);

  return {
    render(snapshot: CombatStateSnapshot): void {
      leaderRoleView.update(snapshot, ctx);
      enemyRoleView.update(snapshot, ctx);
      scenarioRoleView.update(snapshot, ctx);
      cardHandView.update(snapshot);
      alliesView.syncFromSnapshot(snapshot);
      minionsView.syncFromSnapshot(snapshot);
      nucleoPoolView.syncFromSnapshot(snapshot);
    },
  };
}
