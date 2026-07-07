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
const HUD_TEXT_OFFSET_Y = 120;

export interface RoleView {
  /** Actualiza el texto HUD en el sitio (sin tween, spec §0.3) contra el snapshot actual. Nunca
   *  destruye/recrea el Rectangle de rol — ver spec §3.4 para el porqué. */
  update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void;
}

function createRoleTile(
  scene: Phaser.Scene,
  position: { x: number; y: number },
  color: number,
  name: string,
): { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
  const rect = scene.add.rectangle(position.x, position.y, ROLE_SIZE.width, ROLE_SIZE.height, color);
  rect.setName(name);
  rect.setInteractive().setData('targetId', name);

  const text = scene.add.text(position.x, position.y + HUD_TEXT_OFFSET_Y, '', {
    fontSize: '20px',
    color: '#ffffff',
    align: 'center',
  });
  text.setOrigin(0.5, 0);

  return { rect, text };
}

/** Crea (una única vez) el Rectangle + Text de rol del Líder, nombrado `FOCUS_ID_LEADER` (`setName`)
 *  y con `data.targetId = FOCUS_ID_LEADER` (spec §1.1). */
export function createLeaderRoleView(scene: Phaser.Scene): RoleView {
  const { text } = createRoleTile(scene, LEADER_POSITION, LEADER_COLOR, FOCUS_ID_LEADER);

  return {
    update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void {
      // Línea "CD: ..." retirada (H2.10) — ahora la muestran los iconos de ability-cooldown-view.
      text.setText(
        `Líder — Daño ${snapshot.leaderDamage}/${ctx.leaderMaxHealth} | Escudo ${snapshot.leaderShield} | ` +
          `Energía ${snapshot.leaderEnergy} | Nivel ${snapshot.leaderState.level}`,
      );
    },
  };
}

/** Crea (una única vez) el Rectangle + Text de rol del Enemigo, nombrado `FOCUS_ID_ENEMY`. */
export function createEnemyRoleView(scene: Phaser.Scene): RoleView {
  const { text } = createRoleTile(scene, ENEMY_POSITION, ENEMY_COLOR, FOCUS_ID_ENEMY);

  return {
    update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void {
      // Línea "CD: ..." retirada (H2.10) — ahora la muestran los iconos de ability-cooldown-view.
      text.setText(
        `Enemigo — Daño ${snapshot.enemyDamage}/${ctx.enemyMaxHealth} | Fase ${snapshot.enemyPhase.phaseNumber}/${snapshot.enemyPhase.totalPhases}`,
      );
    },
  };
}

/** Crea (una única vez) el Rectangle + Text de rol del Escenario, nombrado `FOCUS_ID_SCENARIO`.
 *  NUEVO H2.11: resaltado persistente de umbral de Trama — cambia `fillColor` del tile a
 *  `SCENARIO_ALERT_COLOR` mientras `scenarioPlot >= scenarioPlotDefeatThreshold`, evaluado en cada
 *  `update()` de forma idempotente (spec §1.9). */
export function createScenarioRoleView(scene: Phaser.Scene): RoleView {
  const { rect, text } = createRoleTile(scene, SCENARIO_POSITION, SCENARIO_COLOR, FOCUS_ID_SCENARIO);

  return {
    update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void {
      const atThreshold = snapshot.scenarioPlot >= ctx.scenarioPlotDefeatThreshold;
      rect.setFillStyle(atThreshold ? SCENARIO_ALERT_COLOR : SCENARIO_COLOR); // NUEVO H2.11
      text.setText(
        `Escenario — Trama ${snapshot.scenarioPlot}/${ctx.scenarioPlotDefeatThreshold} | ` +
          `Fase ${snapshot.scenarioPhase.phaseNumber}/${snapshot.scenarioPhase.totalPhases}`,
      );
    },
  };
}
