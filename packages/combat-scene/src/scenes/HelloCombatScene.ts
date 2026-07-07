import Phaser from 'phaser';
import { buildHelloCombatResult } from './build-hello-engine';

/**
 * Única escena de H2.1 (spec §3.1) — demuestra que Vite + Phaser + `domain-catalog`/
 * `domain-combat` reales funcionan juntos de punta a punta. Sin renderizado gráfico
 * complejo (sprites/tweens/tablero): eso es alcance de H2.6/H2.8.
 */
export class HelloCombatScene extends Phaser.Scene {
  constructor() {
    super('HelloCombatScene');
  }

  preload(): void {
    // no-op en esta historia — sin assets todavía.
  }

  create(): void {
    void buildHelloCombatResult().then(({ snapshot, leaderMaxHealth, enemyMaxHealth }) => {
      // console.log deliberado — verificación manual pedida por spec H2.1 §3.1.4
      console.log(snapshot);

      const leaderLife = leaderMaxHealth - snapshot.leaderDamage;
      const enemyLife = enemyMaxHealth - snapshot.enemyDamage;
      const nucleoValues = snapshot.nucleoPool.map((n) => n.value).join(', ');

      const lines = [
        `Turno: ${snapshot.turn.turnNumber}`,
        `Vida Líder: ${leaderLife}`,
        `Vida Enemigo: ${enemyLife}`,
        `Pool de Núcleos: [${nucleoValues}]`,
      ];

      this.add.text(32, 32, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
      });
    });
  }
}
