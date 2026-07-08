import Phaser from 'phaser';
import { createId } from '@collector/domain-shared';
import type { NucleoInstanceId } from '@collector/domain-shared';
import type { CombatEvent } from '@collector/domain-combat';
import { diceRoll } from '../src/juice/recipes/dice-roll';

/**
 * H2.5 spec §7 — escena Phaser mínima de verificación visual manual, temporal, solo para
 * `juice-smoke.spec.ts`. NO es `HelloCombatScene` (para no acoplar esta verificación al contenido
 * 2×2×2 real): en su `create()` invoca directamente `diceRoll.play(this, { event }, {})`, sin pasar
 * por `EffectsDirector`/`CombatBridge` (no hace falta para este smoke test visual).
 */
export class JuiceSmokeScene extends Phaser.Scene {
  constructor() {
    super('JuiceSmokeScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#222222');

    const event: CombatEvent = {
      type: 'NUCLEO_POOL_ROLLED',
      pool: [
        { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'smoke-1') as NucleoInstanceId, color: 'AGRESION', value: 3 },
        { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'smoke-2') as NucleoInstanceId, color: 'CONTROL', value: 2 },
        { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'smoke-3') as NucleoInstanceId, color: 'DEFENSA', value: 4 },
      ],
      priorityTurnOwner: 'LEADER',
    };

    void diceRoll.play(this, { event }, {});
  }
}
