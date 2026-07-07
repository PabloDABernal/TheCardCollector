import type { JuiceRecipe } from '../juice-recipe';
import { abilityIconGroupName } from '../../view/ability-cooldown-view';

const PULSE_LEG_MS = 80;

/** H2.10 spec §3.1 — reacciona a `COOLDOWNS_TICKED` (`target.event.cooldowns:
 *  readonly AbilityCooldownSnapshot[]`, ya filtrado por `side`). Para cada entrada con
 *  `remaining === 0`, resuelve su game object vía `abilityIconGroupName(abilityId)` +
 *  `scene.children.getByName(...)` y aplica un pulso de escala `1→1.15→1` (mismo patrón de
 *  `scene.tweens.chain` que `hitImpact`, H2.5 §3.3). Si el game object no existe todavía (defensivo,
 *  no debería ocurrir en producción) se omite esa entrada sin lanzar error. No distingue "ya estaba
 *  en 0" de "acaba de llegar a 0" — repetir el pulso en una habilidad que ya estaba lista es
 *  redundante pero inocuo. */
export const cooldownReady: JuiceRecipe = {
  id: 'cooldownReady',
  async play(scene, target): Promise<void> {
    if (target.event.type !== 'COOLDOWNS_TICKED') {
      return;
    }

    const readyAbilities = target.event.cooldowns.filter((c) => c.remaining === 0);

    await Promise.all(
      readyAbilities.map(
        (ability) =>
          new Promise<void>((resolve) => {
            const group = scene.children.getByName(abilityIconGroupName(ability.abilityId));
            if (!group) {
              resolve();
              return;
            }

            scene.tweens.chain({
              targets: group,
              tweens: [
                { scale: 1.15, duration: PULSE_LEG_MS, ease: 'Sine.easeOut' },
                { scale: 1, duration: PULSE_LEG_MS, ease: 'Sine.easeIn' },
              ],
              onComplete: () => resolve(),
            });
          }),
      ),
    );
  },
};
