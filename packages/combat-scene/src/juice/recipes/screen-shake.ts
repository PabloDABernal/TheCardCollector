import type { CombatEvent } from '@collector/domain-combat';
import type { JuiceRecipe } from '../juice-recipe';

const DEFAULT_DURATION_MS = 200;
const DEFAULT_BASE_INTENSITY = 0.01;
const REFERENCE_DAMAGE = 10;
const MIN_DAMAGE_SCALE = 0.5;
const MAX_DAMAGE_SCALE = 2;

export interface ScreenShakeParams {
  /** Duración del shake en ms. Por defecto 200. */
  readonly durationMs?: number;
  /** Intensidad base (0-1, escala nativa de `Camera.shake`). Por defecto 0.01. */
  readonly baseIntensity?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Spec §3.4: intensidad proporcional a `appliedDamage` en `LEADER_DAMAGED`/`ENEMY_DAMAGED`, fija en
 * cualquier otro tipo de evento (p.ej. `PHASE_CHANGED`, beat narrativo sin monto).
 *
 * Desviación respecto a la spec (documentada, ver entrega): `LEADER_DAMAGED` expone
 * `appliedDamage` tal cual (`events.ts`), pero `ENEMY_DAMAGED` NO tiene ese campo en el contrato
 * de dominio actual (`rawAmount`, `bonusActivated`, `bonusResolvedValue?`, `enemyDamageAfter`, sin
 * `appliedDamage`). Se usa `bonusActivated ? (bonusResolvedValue ?? rawAmount) : rawAmount` como
 * monto equivalente de daño aplicado — mismo criterio que `resolveAbilityUmbral` usa para calcular
 * el valor final resuelto. Queda pendiente de confirmación por Architect/Coordinator si la
 * intención era otra.
 */
function resolveDamageAmount(event: CombatEvent): number | null {
  switch (event.type) {
    case 'LEADER_DAMAGED':
      return event.appliedDamage;
    case 'ENEMY_DAMAGED':
      return event.bonusActivated ? event.bonusResolvedValue ?? event.rawAmount : event.rawAmount;
    default:
      return null;
  }
}

function computeIntensity(event: CombatEvent, baseIntensity: number): number {
  const damageAmount = resolveDamageAmount(event);
  if (damageAmount === null) {
    return baseIntensity;
  }
  const scale = clamp(damageAmount / REFERENCE_DAMAGE, MIN_DAMAGE_SCALE, MAX_DAMAGE_SCALE);
  return baseIntensity * scale;
}

/** H2.5 spec §3.4 — sacudida de cámara nativa (`Camera.shake`), intensidad calculada desde
 *  `target.event` (no desde `JuiceStep.params` estático). Dispara con `LEADER_DAMAGED`,
 *  `ENEMY_DAMAGED` (tras `hitImpact`), `PHASE_CHANGED` (solo). */
export const screenShake: JuiceRecipe<ScreenShakeParams> = {
  id: 'screenShake',
  play(scene, target, params) {
    const durationMs = params.durationMs ?? DEFAULT_DURATION_MS;
    const baseIntensity = params.baseIntensity ?? DEFAULT_BASE_INTENSITY;
    const intensity = computeIntensity(target.event, baseIntensity);

    return new Promise<void>((resolve) => {
      scene.cameras.main.shake(durationMs, intensity, false, () => resolve());
    });
  },
};
