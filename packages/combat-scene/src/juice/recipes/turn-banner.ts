import type Phaser from 'phaser';
import type { JuiceRecipe } from '../juice-recipe';
import { SCENARIO_POSITION, PANEL_ZONES } from '../../view/board-layout';

// H4 spec §3.4 — indicador visual de cambio de turno, enganchado a `TURN_ENDED` (E4.3).
export interface TurnBannerParams {
  /** Tiempo visible a opacidad plena. Por defecto 400. */
  readonly holdMs?: number;
}

const DEFAULT_HOLD_MS = 400;
const FADE_MS = 150;
const BANNER_ALPHA = 0.9;
// FIX Reviewer post-E4.4 (commit `f912c92`) — antes 1080 (ancho completo del viewport, spec §3.4
// literal), pero eso hace que el banner sobresalga 40px por cada lado del panel Escenario (1000px,
// centrado), tapando su borde (confirmado en captura `03-turn-banner.png`). Se deriva del ancho REAL
// del panel Escenario (`PANEL_ZONES`, E4.2) en vez de fijar un segundo número suelto — "ancho
// completo" queda sustituido por "ancho del panel Escenario" como nota de spec.
const SCENARIO_PANEL_ZONE = PANEL_ZONES.find((zone) => zone.id === 'panel-scenario');
if (!SCENARIO_PANEL_ZONE) {
  throw new Error('turn-banner: no se encontró panel-scenario en PANEL_ZONES');
}
const BANNER_WIDTH = SCENARIO_PANEL_ZONE.width;
const BANNER_HEIGHT = 120;
const BANNER_DEPTH = 1000; // por encima de paneles/tiles (E4.2), spec §3.4
const LEADER_TEXT = 'Tu turno';
const ENEMY_TEXT = 'Turno del Enemigo';
// H4 spec §5 — colores semánticos (`--success`/`--danger`), NO colores de Núcleo: el banner de
// turno es un indicador de sistema, no de color de dado, y no debe confundirse visualmente con las
// mecánicas de Núcleo. Sustituye la reutilización previa de `NUCLEO_COLOR_HEX.DEFENSA`/`AGRESION`.
const LEADER_COLOR = 0x4caf6f; // = --success
const ENEMY_COLOR = 0xd1495b; // = --danger
// H4 spec §5 — tipografía Staatliches (webfont ya cargado por `apps/shell`/`main.tsx`); Phaser puede
// usar cualquier fuente ya presente en el DOM vía CSS `@font-face`, sin asset propio de Phaser.
const BANNER_FONT_FAMILY = "'Staatliches', 'Impact', sans-serif";

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
          fontFamily: BANNER_FONT_FAMILY,
          fontSize: '48px',
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
