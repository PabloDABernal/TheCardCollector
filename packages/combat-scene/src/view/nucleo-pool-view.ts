import type Phaser from 'phaser';
import type { CombatStateSnapshot, NucleoInstance } from '@collector/domain-combat';
import type { NucleoInstanceId } from '@collector/domain-shared';
import { NUCLEO_POOL_ROW_Y, TILE_SEPARATION_PX } from './board-layout';
import { NUCLEO_COLOR_HEX } from './nucleo-colors';
import { rotationDegreesFor, spawnDieParticleBurst } from './nucleo-roll-animation';

const NUCLEO_DIE_SIZE = 64;
const NUCLEO_POOL_X_ORIGIN = 200;

/** H2.12 spec §1.2 punto 5 — fade+shrink del Núcleo gastado. */
const FADE_OUT_DURATION_MS = 300;
/** H2.12 spec §1.2 punto 3 — mismos valores que `diceRoll` (H2.5) para el "dado rodando". */
const ROLL_TWEEN_DURATION_MS = 500;

interface NucleoTile {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

export interface NucleoPoolView {
  /** Compara el pool del snapshot anterior (estado interno, inicialmente vacío) contra
   *  `snapshot.nucleoPool` y anima la transición según el caso (H2.12 spec §1.2) en vez de
   *  destruir-y-recrear siempre. Llamar dos veces con el MISMO snapshot no produce ninguna
   *  animación ni cambio (diff vacío) — pero ya no es "reconstruible desde cero sin memoria":
   *  mantiene estado interno (último pool visto) para diferenciar Núcleos conservados de
   *  retirados/añadidos. */
  syncFromSnapshot(snapshot: CombatStateSnapshot): void;
}

function tileX(index: number): number {
  return NUCLEO_POOL_X_ORIGIN + index * TILE_SEPARATION_PX;
}

/** Cada tile: `Rectangle` 64×64 coloreado por `NUCLEO_COLOR_HEX[nucleo.color]` + `Text` con
 *  `nucleo.value` + `setInteractive().setData('targetId', nucleo.id)` (H2.8 spec §1.1; sin
 *  `setName` — `NUCLEO_POOL_ROLLED` no lleva `focusId`, así que ningún juice necesita `getByName`
 *  sobre un Núcleo individual). H2.12: `syncFromSnapshot` deja de destruir-y-recrear siempre —
 *  compara el pool anterior contra el nuevo por `id` y anima únicamente las dos transiciones reales
 *  (gasto → fade+shrink; relanzado completo → roll-in) directamente sobre los sprites reales y
 *  persistentes, ver spec H2.12 §1.1/§1.2. */
export function createNucleoPoolView(scene: Phaser.Scene): NucleoPoolView {
  const tiles = new Map<NucleoInstanceId, NucleoTile>();
  let previousPool: readonly NucleoInstance[] = [];

  function createStaticTile(nucleo: NucleoInstance, index: number): NucleoTile {
    const x = tileX(index);
    const y = NUCLEO_POOL_ROW_Y;

    const rect = scene.add.rectangle(x, y, NUCLEO_DIE_SIZE, NUCLEO_DIE_SIZE, NUCLEO_COLOR_HEX[nucleo.color]);
    rect.setInteractive().setData('targetId', nucleo.id);

    const text = scene.add.text(x, y, `${nucleo.value}`, {
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
    });
    text.setOrigin(0.5, 0.5);

    return { rect, text };
  }

  /** H2.12 spec §1.2 punto 3 — mismo tween de `angle`/`scale` que `diceRoll` (H2.5) ya define,
   *  seguido de `particleBurst` al completar, sobre el sprite REAL en su posición real del pool. */
  function createRollingTile(nucleo: NucleoInstance, index: number): NucleoTile {
    const tile = createStaticTile(nucleo, index);
    const tint = NUCLEO_COLOR_HEX[nucleo.color];

    scene.tweens.add({
      targets: tile.rect,
      angle: { from: 0, to: rotationDegreesFor(nucleo.value) },
      scale: { from: 1.2, to: 1 },
      duration: ROLL_TWEEN_DURATION_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        spawnDieParticleBurst(scene, tile.rect.x, tile.rect.y, tint);
      },
    });

    return tile;
  }

  function destroyTileImmediately(id: NucleoInstanceId): void {
    const tile = tiles.get(id);
    if (!tile) {
      return;
    }
    scene.tweens.killTweensOf(tile.rect);
    scene.tweens.killTweensOf(tile.text);
    tile.rect.destroy();
    tile.text.destroy();
    tiles.delete(id);
  }

  /** H2.12 spec §1.2 punto 5 — fade+shrink del Núcleo gastado sobre su sprite real; el tile
   *  permanece trackeado durante los 300ms para que un relanzado completo a mitad de la animación
   *  pueda destruirlo de inmediato (`killTweensOf`) sin esperar a su propio `onComplete`. */
  function fadeOutAndDestroy(id: NucleoInstanceId): void {
    const tile = tiles.get(id);
    if (!tile) {
      return;
    }

    scene.tweens.add({
      targets: [tile.rect, tile.text],
      alpha: { from: 1, to: 0 },
      scale: { from: 1, to: 0.6 },
      duration: FADE_OUT_DURATION_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        destroyTileImmediately(id);
      },
    });
  }

  return {
    syncFromSnapshot(snapshot: CombatStateSnapshot): void {
      const newPool = snapshot.nucleoPool;
      const previousIds = new Set(previousPool.map((n) => n.id));
      const newIds = new Set(newPool.map((n) => n.id));

      // Relanzado completo (H2.12 spec §1.2 punto 3): sin intersección de ids entre anterior y
      // nuevo. Se exige además `newPool.length > 0` porque el motor nunca vacía el pool sin
      // relanzarlo en el mismo dispatch (§4 del diagrama) — un `newPool` vacío es siempre el caso
      // "parcial" de retirada real (p. ej. el Núcleo gastado deja el pool momentáneamente sin
      // fichas antes del segundo evento de relanzado), no un relanzado sin dados nuevos.
      const isRelaunch =
        previousPool.length > 0 && newPool.length > 0 && previousPool.every((n) => !newIds.has(n.id));

      if (previousPool.length === 0) {
        // Caso primer render (H2.12 spec §1.2 punto 4): comportamiento idéntico al actual (H2.8),
        // sin animación — no hay "roll" que animar la primera vez que se monta la escena.
        newPool.forEach((nucleo, index) => {
          tiles.set(nucleo.id, createStaticTile(nucleo, index));
        });
      } else if (isRelaunch) {
        // Caso relanzado completo (H2.12 spec §1.2 punto 3): destruye TODOS los supervivientes
        // (incluidos los que estuvieran a mitad de fade-out pendiente) y crea los 6 nuevos con
        // animación de "dado rodando" sobre el sprite real.
        for (const id of Array.from(tiles.keys())) {
          destroyTileImmediately(id);
        }
        newPool.forEach((nucleo, index) => {
          tiles.set(nucleo.id, createRollingTile(nucleo, index));
        });
      } else {
        // Caso parcial (H2.12 spec §1.2 punto 5): `removedIds` anima fade+shrink; `keptIds` se
        // reposiciona sin tween si su índice cambió; nunca se destruye/recrea un id conservado.
        for (const id of previousIds) {
          if (!newIds.has(id)) {
            fadeOutAndDestroy(id);
          }
        }

        newPool.forEach((nucleo, index) => {
          const tile = tiles.get(nucleo.id);
          if (tile) {
            const x = tileX(index);
            const y = NUCLEO_POOL_ROW_Y;
            if (tile.rect.x !== x || tile.rect.y !== y) {
              tile.rect.setPosition(x, y);
              tile.text.setPosition(x, y);
            }
            return;
          }
          // Defensivo (spec §1.2 punto 5, "debería ser siempre vacío"): id nuevo fuera de un
          // relanzado completo — crear estático sin animación, mismo criterio del primer render.
          tiles.set(nucleo.id, createStaticTile(nucleo, index));
        });
      }

      previousPool = newPool.map((n) => ({ ...n }));
    },
  };
}
