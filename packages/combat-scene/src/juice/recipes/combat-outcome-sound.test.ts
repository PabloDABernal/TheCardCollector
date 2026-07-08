// @vitest-environment node
//
// H2.13 spec §4.2 — `combatOutcomeSound` con un `FakeSoundManager` (objeto simple `{ play: vi.fn(),
// unlock: vi.fn() }`), sin necesidad de `FakeAudioContext` real.
import { describe, it, expect, vi } from 'vitest';
import type Phaser from 'phaser';
import { createCombatOutcomeSoundRecipe } from './combat-outcome-sound';
import type { SoundManager } from '../../audio/sound-manager';
import type { JuiceTarget } from '../juice-recipe';

function createFakeSoundManager(): SoundManager {
  return { unlock: vi.fn(), play: vi.fn() };
}

describe('createCombatOutcomeSoundRecipe (H2.13 spec §4.2)', () => {
  it('outcome VICTORY: invoca soundManager.play("victory")', async () => {
    const soundManager = createFakeSoundManager();
    const recipe = createCombatOutcomeSoundRecipe(soundManager);

    const target: JuiceTarget = { event: { type: 'COMBAT_ENDED', outcome: 'VICTORY' } };
    await recipe.play({} as Phaser.Scene, target, {});

    expect(soundManager.play).toHaveBeenCalledWith('victory');
  });

  it('outcome DEFEAT: invoca soundManager.play("defeat")', async () => {
    const soundManager = createFakeSoundManager();
    const recipe = createCombatOutcomeSoundRecipe(soundManager);

    const target: JuiceTarget = { event: { type: 'COMBAT_ENDED', outcome: 'DEFEAT' } };
    await recipe.play({} as Phaser.Scene, target, {});

    expect(soundManager.play).toHaveBeenCalledWith('defeat');
  });

  it('evento distinto de COMBAT_ENDED: soundManager.play NUNCA invocado, Promise resuelve igualmente', async () => {
    const soundManager = createFakeSoundManager();
    const recipe = createCombatOutcomeSoundRecipe(soundManager);

    const target: JuiceTarget = {
      event: { type: 'TURN_ENDED', previousTurnOwner: 'LEADER', nextTurnOwner: 'ENEMY', turnNumber: 1 },
    };

    await expect(recipe.play({} as Phaser.Scene, target, {})).resolves.toBeUndefined();
    expect(soundManager.play).not.toHaveBeenCalled();
  });

  it('play() resuelve su Promise de forma síncrona/inmediata (no depende de ningún tween)', () => {
    const soundManager = createFakeSoundManager();
    const recipe = createCombatOutcomeSoundRecipe(soundManager);

    const target: JuiceTarget = { event: { type: 'COMBAT_ENDED', outcome: 'VICTORY' } };
    const result = recipe.play({} as Phaser.Scene, target, {});

    expect(result).toBeInstanceOf(Promise);
    expect(soundManager.play).toHaveBeenCalledWith('victory');
  });
});
