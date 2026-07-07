import type { AbilityId } from '@collector/domain-shared';
import type { JuiceRecipe } from '../juice-recipe';
import { abilityIconGroupName } from '../../view/ability-cooldown-view';

const PULSE_LEG_MS = 80;

/** Fix H2.10 (bug reportado por Reviewer): `COOLDOWNS_TICKED` se emite en CADA cambio de turno del
 *  lado que recibe turno (`combat-engine.ts` `handleEndTurn`), con el snapshot COMPLETO de sus
 *  cooldowns — no solo las que acaban de llegar a 0. Sin memoria del `remaining` anterior, una
 *  habilidad que lleva varios turnos ya lista (CD=0 sin usar) pulsaría en cada turno, no solo al
 *  llegar a listo (parpadeo constante, bug observable en juego).
 *
 *  Mecanismo: closure con `Map<AbilityId, number>` — mismo espíritu que `lastRemaining` de
 *  `AbilityIconEntry` en `ability-cooldown-view.ts` (que recuerda el `remaining` previo para decidir
 *  si animar), pero construido específicamente aquí porque esta receta es un objeto singleton (no
 *  una entrada por habilidad como `AbilityIconEntry`) y necesita una única `Map` compartida entre
 *  invocaciones de `play`. `createCooldownReadyRecipe` es la factory que crea esa `Map` — el
 *  singleton exportado (`cooldownReady`, usado por `RECIPE_REGISTRY`) es una instancia de esa
 *  factory; los tests crean instancias propias para no compartir estado entre casos. */
export function createCooldownReadyRecipe(): JuiceRecipe {
  const previousRemainingByAbility = new Map<AbilityId, number>();

  return {
    id: 'cooldownReady',
    async play(scene, target): Promise<void> {
      if (target.event.type !== 'COOLDOWNS_TICKED') {
        return;
      }

      const readyAbilities = target.event.cooldowns.filter((c) => {
        const previousRemaining = previousRemainingByAbility.get(c.abilityId);
        previousRemainingByAbility.set(c.abilityId, c.remaining);

        // Primera vez que se ve esta habilidad (sin estado previo): solo se registra el estado
        // inicial, no se pulsa — no hay "transición" que celebrar en el primer tick observado.
        if (previousRemaining === undefined) {
          return false;
        }

        // Pulso solo en la transición real CD>0 -> CD=0. Una habilidad que ya estaba en 0 (sigue
        // en 0 en este tick) no vuelve a pulsar.
        return previousRemaining > 0 && c.remaining === 0;
      });

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
}

export const cooldownReady: JuiceRecipe = createCooldownReadyRecipe();
