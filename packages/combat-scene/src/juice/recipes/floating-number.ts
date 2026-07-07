import type Phaser from 'phaser';
import type { CombatEvent } from '@collector/domain-combat';
import type { JuiceRecipe } from '../juice-recipe';
import { resolveOrCreatePlaceholder } from './placeholder';
import { FOCUS_ID_ENEMY, FOCUS_ID_LEADER, FOCUS_ID_SCENARIO } from '../effects-director';

const RISE_DISTANCE_PX = 60;
const SPAWN_Y_OFFSET_PX = -20; // nace justo por encima del objeto, no centrado (spec §1.6)
const DURATION_MS = 900;
const DAMAGE_COLOR = 0xe74c3c;
const PLOT_INCREASE_COLOR = 0xe67e22;
const PLOT_DECREASE_COLOR = 0x27ae60;

export interface FloatingNumberEntry {
  /** `targetId` estable ya nombrado en escena (`FOCUS_ID_LEADER`/`FOCUS_ID_ENEMY`/`FOCUS_ID_SCENARIO`/
   *  `allyInstanceId`) — resuelto vía `resolveOrCreatePlaceholder`, mismo mecanismo que `hitImpact`. */
  readonly focusId: string;
  /** Texto final ya formado, con signo (`"-4"`, `"+2"`). */
  readonly text: string;
  /** Color hex del texto (rojo daño, verde/naranja Trama según dirección — spec §1.5). */
  readonly color: number;
}

/** Spec §1.2-§1.4 — pura, sin acceso a `scene`. Decide QUÉ mostrar y DÓNDE, nunca CÓMO animarlo
 *  (eso es `floatingNumber.play()`, §2). Puede devolver 0, 1 o 2 entradas (2 solo en `ALLY_DAMAGED`
 *  con Arrollar, §1.4). Exportada para test unitario aislado (spec §5.1). */
export function resolveFloatingNumberEntries(event: CombatEvent): readonly FloatingNumberEntry[] {
  switch (event.type) {
    case 'LEADER_DAMAGED':
      // Spec §1.2: `appliedDamage` (post-Escudo), NO `rawAmount`. Si es 0 (Escudo absorbió todo,
      // sin Arrollar) se omite el floating number — "-0" sería ruido.
      return event.appliedDamage > 0
        ? [{ focusId: FOCUS_ID_LEADER, text: `-${event.appliedDamage}`, color: DAMAGE_COLOR }]
        : [];
    case 'ENEMY_DAMAGED':
      // Spec §1.2: `rawAmount`, NUNCA `bonusResolvedValue` — mismo fix ya validado en
      // `screen-shake.ts` (H2.5): el motor solo suma `rawAmount` a `enemyDamage`.
      return [{ focusId: FOCUS_ID_ENEMY, text: `-${event.rawAmount}`, color: DAMAGE_COLOR }];
    case 'ALLY_DAMAGED': {
      const entries: FloatingNumberEntry[] = [];
      if (event.absorbedByAlly > 0) {
        entries.push({ focusId: event.allyInstanceId, text: `-${event.absorbedByAlly}`, color: DAMAGE_COLOR });
      }
      if (event.appliedDamageToLeader > 0) {
        entries.push({ focusId: FOCUS_ID_LEADER, text: `-${event.appliedDamageToLeader}`, color: DAMAGE_COLOR });
      }
      return entries;
    }
    case 'SCENARIO_PLOT_CHANGED':
      // Spec §1.2: `appliedDelta` ya trae el signo aplicado — no hace falta estado previo.
      return [
        {
          focusId: FOCUS_ID_SCENARIO,
          text: event.appliedDelta > 0 ? `+${event.appliedDelta}` : `${event.appliedDelta}`,
          color: event.direction === 'INCREASE' ? PLOT_INCREASE_COLOR : PLOT_DECREASE_COLOR,
        },
      ];
    default:
      return [];
  }
}

function spawnFloatingText(scene: Phaser.Scene, entry: FloatingNumberEntry): void {
  const anchor = resolveOrCreatePlaceholder(scene, entry.focusId);
  const label = scene.add.text(anchor.x, anchor.y + SPAWN_Y_OFFSET_PX, entry.text, {
    fontSize: '28px',
    color: `#${entry.color.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  });
  label.setOrigin(0.5, 0.5);

  scene.tweens.add({
    targets: label,
    y: label.y - RISE_DISTANCE_PX,
    alpha: 0,
    duration: DURATION_MS,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
}

/** H2.11 spec §2 — floating number de daño/Trama: número que aparece sobre el objetivo, sube y se
 *  desvanece (~900ms). NO espera a que termine su propia animación para resolver (§1.7) —
 *  desviación intencional del contrato "Promise = animación completa" del resto de recetas
 *  (`hitImpact`/`screenShake`/`diceRoll`/`cardFlip`), para no retrasar `screenShake`
 *  (`LEADER_DAMAGED`/`ENEMY_DAMAGED`) ni ningún step `sequential` posterior. El `Text` + tween
 *  siguen corriendo en background, gestionados por el propio `scene.tweens`. */
export const floatingNumber: JuiceRecipe = {
  id: 'floatingNumber',
  play(scene, target): Promise<void> {
    const entries = resolveFloatingNumberEntries(target.event);
    for (const entry of entries) {
      spawnFloatingText(scene, entry);
    }
    return Promise.resolve();
  },
};
