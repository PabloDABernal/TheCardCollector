import type Phaser from 'phaser';
import type { JuiceRecipe } from '../juice-recipe';
import { NUCLEO_COLOR_HEX } from '../../view/nucleo-colors';
import { SCENARIO_POSITION } from '../../view/board-layout';

// H4 spec §3.4 — indicador visual de cambio de turno, enganchado a `TURN_ENDED` (E4.3).
export interface TurnBannerParams {
  /** Tiempo visible a opacidad plena. Por defecto 400. */
  readonly holdMs?: number;
}

const DEFAULT_HOLD_MS = 400;
const FADE_MS = 150;
const BANNER_ALPHA = 0.9;
const BANNER_WIDTH = 1080;
const BANNER_HEIGHT = 120;
const BANNER_DEPTH = 1000; // por encima de paneles/tiles (E4.2), spec §3.4
const LEADER_TEXT = 'Tu turno';
const ENEMY_TEXT = 'Turno del Enemigo';
// Mismos hex que NUCLEO_COLOR_HEX.DEFENSA/AGRESION (spec §3.4).
const LEADER_COLOR = NUCLEO_COLOR_HEX.DEFENSA;
const ENEMY_COLOR = NUCLEO_COLOR_HEX.AGRESION;

function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Factory con clausura — mismo patrón que `createCooldownReadyRecipe` (H2.10): el banner es un
 * singleton por partida, reutilizado entre invocaciones ("creado una vez, reseteado cada vez",
 * spec §3.4) para no acumular game objects huérfanos turno tras turno. Un `Rectangle`+`Text` SIN
 * `setInteractive()` — no bloquea input, los taps lo atraviesan hacia el tablero de abajo aunque
 * esté visible.
 */
export function createTurnBannerRecipe(): JuiceRecipe<TurnBannerParams> {
  let bannerRect: Phaser.GameObjects.Rectangle | null = null;
  let bannerText: Phaser.GameObjects.Text | null = null;

  return {
    id: 'turnBanner',
    play(scene, target, params): Promise<void> {
      if (target.event.type !== 'TURN_ENDED') {
        return Promise.resolve();
      }

      const holdMs = params.holdMs ?? DEFAULT_HOLD_MS;
      const isLeaderTurn = target.event.nextTurnOwner === 'LEADER';
      const message = isLeaderTurn ? LEADER_TEXT : ENEMY_TEXT;
      const color = isLeaderTurn ? LEADER_COLOR : ENEMY_COLOR;

      if (!bannerRect || !bannerText) {
        bannerRect = scene.add.rectangle(SCENARIO_POSITION.x, SCENARIO_POSITION.y, BANNER_WIDTH, BANNER_HEIGHT, color);
        bannerRect.setAlpha(0);
        bannerRect.setDepth(BANNER_DEPTH);

        bannerText = scene.add.text(SCENARIO_POSITION.x, SCENARIO_POSITION.y, message, {
          fontSize: '48px',
          fontStyle: 'bold',
        });
        bannerText.setOrigin(0.5, 0.5);
        bannerText.setAlpha(0);
        bannerText.setDepth(BANNER_DEPTH + 1);
      }

      bannerRect.setFillStyle(color);
      bannerText.setText(message);
      bannerText.setColor(toCssHex(color));

      return new Promise<void>((resolve) => {
        scene.tweens.chain({
          targets: [bannerRect, bannerText],
          tweens: [
            { alpha: BANNER_ALPHA, duration: FADE_MS, ease: 'Sine.easeOut' },
            { alpha: BANNER_ALPHA, duration: holdMs },
            { alpha: 0, duration: FADE_MS, ease: 'Sine.easeIn' },
          ],
          onComplete: () => resolve(),
        });
      });
    },
  };
}

export const turnBanner: JuiceRecipe<TurnBannerParams> = createTurnBannerRecipe();
