import type { JuiceRecipe } from '../juice-recipe';
import { resolveOrCreateCardPlaceholder } from './placeholder';

const HALF_FLIP_DURATION_MS = 150;
const CARD_BACK_COLOR = 0x808080;
const CARD_FRONT_COLOR = 0xffffff;

/** H2.5 spec §3.2 — volteo de carta en dos tramos (`scaleX` 1→0→1, ~300ms total), con cambio de
 *  "aspecto" del placeholder en el punto medio (simula cambio de textura sin sprite real todavía,
 *  H2.8). Dispara con `CARD_PLAYED`, `CONTRATIEMPO_PLAYED`, `ALLY_ENTERED_PLAY`,
 *  `MINION_SUMMONED`, `DRAMATURGIA_CARD_DRAWN`.
 *
 *  H2.8 fix: `DRAMATURGIA_CARD_DRAWN` (§3.3 de `effects-director.ts`) no lleva `focusId` — no hay
 *  ningún rol/instancia real que nombrar, así que `resolveOrCreateCardPlaceholder` nunca reutiliza
 *  ese placeholder por `getByName` ni le asigna nombre (ver `placeholder.ts`). Sin destruirlo al
 *  terminar la animación, cada disparo del evento acumulaba un `Rectangle` huérfano nuevo en
 *  `CARD_HAND_POSITION` (leak visual/de memoria en sesiones largas). Cuando `target.focusId` es
 *  `undefined` el placeholder es efímero por definición (no hay nombre bajo el que reutilizarlo),
 *  así que se destruye al terminar el flip.
 *
 *  FIX QA (bug cosmético — tile de Secuaz/Aliado invocado queda con relleno blanco sólido
 *  permanente): el punto medio del flip alternaba el color del placeholder a `CARD_FRONT_COLOR`
 *  (blanco) para simular el "cambio de textura", pero nunca lo revertía — para placeholders NO
 *  efímeros (`ALLY_ENTERED_PLAY`/`MINION_SUMMONED`, que persisten en mesa y siguen siendo
 *  reutilizados por `allies-view.ts`/`minions-view.ts` en cada `syncFromSnapshot` posterior), el
 *  tile se quedaba blanco para siempre tras la animación, dejando ilegible el texto de vida (blanco
 *  sobre blanco). Se captura el color ORIGINAL del placeholder antes de animar y se restaura al
 *  terminar el flip completo — el cambio de color a mitad de tween sigue dando el efecto visual de
 *  "voltea y revela" sin dejar ningún estado final distinto al que tenía antes de la animación (no
 *  hay textura real todavía, H2.8, así que no hay un color "final" correcto salvo el de partida). */
export const cardFlip: JuiceRecipe = {
  id: 'cardFlip',
  play(scene, target) {
    const card = resolveOrCreateCardPlaceholder(scene, target.focusId);
    // FIX H4 spec §8 — una carta jugada desde la mano (`CARD_PLAYED`/`CONTRATIEMPO_PLAYED`) SIEMPRE
    // trae `focusId` definido (`sourceId`), pero nunca tiene un slot visual persistente que la
    // reutilice después (a diferencia de `ALLY_ENTERED_PLAY`/`MINION_SUMMONED`, que sí) — sin este
    // caso, el placeholder gris quedaba huérfano permanentemente en `CARD_HAND_POSITION`, pegado al
    // tile del Líder.
    const isEphemeral =
      target.focusId === undefined ||
      target.event.type === 'CARD_PLAYED' ||
      target.event.type === 'CONTRATIEMPO_PLAYED';
    const originalColor = card.fillColor;

    return new Promise<void>((resolve) => {
      scene.tweens.chain({
        targets: card,
        tweens: [
          {
            scaleX: 0,
            duration: HALF_FLIP_DURATION_MS,
            ease: 'Sine.easeIn',
            onComplete: () => {
              // Punto medio del flip (scaleX === 0): "cambia de textura" alternando el color del
              // placeholder — spec §3.2 punto 2.
              card.setFillStyle(card.fillColor === CARD_FRONT_COLOR ? CARD_BACK_COLOR : CARD_FRONT_COLOR);
            },
          },
          {
            scaleX: 1,
            duration: HALF_FLIP_DURATION_MS,
            ease: 'Sine.easeOut',
          },
        ],
        onComplete: () => {
          if (isEphemeral) {
            card.destroy();
          } else {
            // Restaura el color de partida — evita que el tile quede permanentemente en el color
            // "cara" (blanco) usado solo como efecto transitorio a mitad de flip.
            card.setFillStyle(originalColor);
          }
          resolve();
        },
      });
    });
  },
};
