// H5.6 spec §1/§1.1 — verifica que las entradas "grandes" declaradas ESTÁTICAMENTE en `JUICE_CONFIG`
// llevan `isBigMoment: true` en TODOS sus steps (criterio de H5.3 §2.1), y que las entradas
// "dinámicas"/"rutinarias" NO lo llevan (su promoción, si existe, la decide `BigMomentClassifier` en
// runtime, no una tabla estática).
import { describe, it, expect } from 'vitest';
import { JUICE_CONFIG } from './juice-config';

describe('JUICE_CONFIG — isBigMoment (H5.6 §1)', () => {
  it('ABILITY_ACTIVATED: todos los steps son isBigMoment=true (foco total al activar una habilidad)', () => {
    expect(JUICE_CONFIG.ABILITY_ACTIVATED.length).toBeGreaterThan(0);
    for (const step of JUICE_CONFIG.ABILITY_ACTIVATED) {
      expect(step.isBigMoment).toBe(true);
    }
  });

  it('PHASE_CHANGED: todos los steps son isBigMoment=true (cambio de fase)', () => {
    expect(JUICE_CONFIG.PHASE_CHANGED.length).toBeGreaterThan(0);
    for (const step of JUICE_CONFIG.PHASE_CHANGED) {
      expect(step.isBigMoment).toBe(true);
    }
  });

  it('MINION_DEFEATED: todos los steps son isBigMoment=true (muerte de Secuaz)', () => {
    expect(JUICE_CONFIG.MINION_DEFEATED.length).toBeGreaterThan(0);
    for (const step of JUICE_CONFIG.MINION_DEFEATED) {
      expect(step.isBigMoment).toBe(true);
    }
  });

  it('eventos dinámicos (LEADER_DAMAGED/ENEMY_DAMAGED/MINION_DAMAGED/ALLY_DAMAGED/SCENARIO_PLOT_CHANGED): ningún step lleva isBigMoment estático', () => {
    const dynamicTypes = ['LEADER_DAMAGED', 'ENEMY_DAMAGED', 'MINION_DAMAGED', 'ALLY_DAMAGED', 'SCENARIO_PLOT_CHANGED'] as const;
    for (const type of dynamicTypes) {
      for (const step of JUICE_CONFIG[type]) {
        expect(step.isBigMoment).toBeUndefined();
      }
    }
  });

  it('eventos rutinarios (ENERGY_GENERATED/NUCLEO_TABLE_REROLLED/LEADER_HAND_CARD_DRAWN): ningún step lleva isBigMoment', () => {
    const routineTypes = ['ENERGY_GENERATED', 'NUCLEO_TABLE_REROLLED', 'LEADER_HAND_CARD_DRAWN'] as const;
    for (const type of routineTypes) {
      for (const step of JUICE_CONFIG[type]) {
        expect(step.isBigMoment).toBeUndefined();
      }
    }
  });

  it('TURN_ENDED sigue apuntando a turnBanner, sin isBigMoment (fuera del sistema grande/rutinario, H5.6 §1)', () => {
    expect(JUICE_CONFIG.TURN_ENDED).toEqual([{ recipeId: 'turnBanner', mode: 'sequential' }]);
  });
});
