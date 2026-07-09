import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { FOCUS_ID_LEADER, FOCUS_ID_ENEMY, FOCUS_ID_SCENARIO } from '../juice';
import type { BoardViewContext } from './board-view-context';
import { LEADER_POSITION, ENEMY_POSITION, SCENARIO_POSITION } from './board-layout';

const ROLE_SIZE = { width: 200, height: 200 };
const LEADER_COLOR = 0x2980b9; // azul
const ENEMY_COLOR = 0xc0392b; // rojo
const SCENARIO_COLOR = 0x8e44ad; // violeta
const SCENARIO_ALERT_COLOR = 0xc0392b; // NUEVO H2.11 — mismo rojo de alerta que ENEMY_COLOR

export interface RoleView {
  /** Actualiza el estado visual del tile contra el snapshot actual (sin tween). H4 spec §2.4 — ya
   *  NO actualiza ningún `Text` (retirado, ver abajo); solo lógica que afecta al `Rectangle` en sí
   *  (ej. `SCENARIO_ALERT_COLOR`) sigue viviendo aquí. Nunca destruye/recrea el Rectangle de rol. */
  update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void;
}

function createRoleTile(
  scene: Phaser.Scene,
  position: { x: number; y: number },
  color: number,
  name: string,
): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(position.x, position.y, ROLE_SIZE.width, ROLE_SIZE.height, color);
  rect.setName(name);
  rect.setInteractive().setData('targetId', name);
  return rect;
}

/** Crea (una única vez) el Rectangle de rol del Líder, nombrado `FOCUS_ID_LEADER` (`setName`) y con
 *  `data.targetId = FOCUS_ID_LEADER` (spec §1.1). H4 spec §2.4 — el `Text` de estado (Daño/Escudo/
 *  Energía/Nivel) se retira de Phaser: migrado a `CombatBoardOverlay.tsx` (apps/shell, capa HTML
 *  sincronizada), texto de lectura de estado que nunca participaba en tweens. */
export function createLeaderRoleView(scene: Phaser.Scene): RoleView {
  createRoleTile(scene, LEADER_POSITION, LEADER_COLOR, FOCUS_ID_LEADER);

  return {
    update(): void {
      // Sin-op deliberado — el tile del Líder no cambia de color por estado (a diferencia del
      // Escenario, ver `createScenarioRoleView`). Se mantiene el método `update()` por simetría de
      // contrato `RoleView` y porque `board-view.ts` llama a los 3 roles uniformemente.
    },
  };
}

/** Crea (una única vez) el Rectangle de rol del Enemigo, nombrado `FOCUS_ID_ENEMY`. */
export function createEnemyRoleView(scene: Phaser.Scene): RoleView {
  createRoleTile(scene, ENEMY_POSITION, ENEMY_COLOR, FOCUS_ID_ENEMY);

  return {
    update(): void {
      // Sin-op deliberado — ver `createLeaderRoleView`.
    },
  };
}

/** Crea (una única vez) el Rectangle de rol del Escenario, nombrado `FOCUS_ID_SCENARIO`. Resaltado
 *  persistente de umbral de Trama (H2.11): cambia `fillColor` del tile a `SCENARIO_ALERT_COLOR`
 *  mientras `scenarioPlot >= scenarioPlotDefeatThreshold`, evaluado en cada `update()` de forma
 *  idempotente (spec §1.9). Esta lógica SÍ se queda en Phaser (afecta al Rectangle, no es texto). */
export function createScenarioRoleView(scene: Phaser.Scene): RoleView {
  const rect = createRoleTile(scene, SCENARIO_POSITION, SCENARIO_COLOR, FOCUS_ID_SCENARIO);

  return {
    update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void {
      const atThreshold = snapshot.scenarioPlot >= ctx.scenarioPlotDefeatThreshold;
      rect.setFillStyle(atThreshold ? SCENARIO_ALERT_COLOR : SCENARIO_COLOR); // NUEVO H2.11
    },
  };
}
