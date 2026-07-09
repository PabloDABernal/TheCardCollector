import type Phaser from 'phaser';
import type { CombatStateSnapshot, NucleoDie } from '@collector/domain-combat';
import type { NucleoInstanceId } from '@collector/domain-shared';
import { ALL_NUCLEO_COLORS } from '@collector/domain-shared';
import { NUCLEO_TABLE_ROW_Y, TILE_SEPARATION_PX, NUCLEO_EXTRA_DIE_STACK_OFFSET_PX } from './board-layout';
import { NUCLEO_COLOR_HEX } from './nucleo-colors';
import { rotationDegreesFor, spawnDieParticleBurst } from './nucleo-roll-animation';

/**
 * RENOMBRADO H3 (capa visual, spec §5.1/§5.2) de `nucleo-pool-view.ts` — sustituye el modelo viejo
 * de "pool homogéneo que se vacía por remoción" por el nuevo modelo de MESA PERSISTENTE de
 * `CombatStateSnapshot.nucleoTable` (5 dados FIXED, uno por color, + dados EXTRA): un dado NUNCA
 * desaparece de mesa al gastarse (spec §5.3, fila `ABILITY_ACTIVATED`) — solo cambia su estado
 * visual a "gastado" (dim). Solo `NUCLEO_DIE_ADDED` crea un game object nuevo (dado EXTRA añadido).
 */

const NUCLEO_DIE_SIZE = 64;
const NUCLEO_TABLE_X_ORIGIN = 200;
const ALPHA_AVAILABLE = 1;
const ALPHA_SPENT = 0.4;
/** Spec §5.2 — mismo tween que `diceRoll` (H2.5) para el "dado rodando", reutilizado aquí sobre el
 *  sprite REAL (persistente) en vez de uno recreado. */
const ROLL_TWEEN_DURATION_MS = 500;

interface NucleoTile {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

/** Contrato de spec §5.2 — un game object por dado, indexado por `NucleoInstanceId`. */
export interface NucleoTableView {
  getDieObject(id: NucleoInstanceId): Phaser.GameObjects.GameObject | undefined;
  /** Crea el game object de un dado EXTRA nuevo (spec §5.2/§5.3, evento `NUCLEO_DIE_ADDED`) con
   *  animación de entrada — no-op si el id ya existe (defensivo). */
  addDie(die: NucleoDie, table: readonly NucleoDie[]): void;
  /** Actualiza el sprite de un dado ya existente (valor/tinte de estado) sin recrearlo. Si el
   *  `value` cambió respecto al último visto, reproduce la receta de "dado rodando" (reroll); si
   *  solo cambió `status`, únicamente ajusta el alpha (gastado/disponible). */
  updateDie(die: NucleoDie): void;
  /** Conveniencia de integración con `BoardView` (mismo patrón `syncFromSnapshot` que el resto de
   *  `view/*`, spec §5.2 nota de implementación): en el primer render construye TODOS los tiles sin
   *  animación; en renders posteriores diffea por `id` y llama a `addDie`/`updateDie` según
   *  corresponda. Nunca destruye un tile (los dados nunca salen de mesa una vez añadidos). */
  syncFromSnapshot(snapshot: CombatStateSnapshot): void;
}

/** Índice de columna por color — orden estable de `ALL_NUCLEO_COLORS` (spec §5.2/domain §1.3). */
function colorColumnIndex(die: NucleoDie): number {
  return ALL_NUCLEO_COLORS.indexOf(die.color);
}

/** Posición de mesa de un dado: los FIXED ocupan la fila principal, uno por columna de color; los
 *  EXTRA de un color se apilan verticalmente bajo la posición fija de ese mismo color (spec §5.2,
 *  "agrupación visual por color" — los extras son visualmente identificables sin confundirse con
 *  el fijo). `table` es el array COMPLETO (orden estable: FIXED primero, luego EXTRA por orden de
 *  creación, domain §1.3) — necesario para contar cuántos EXTRA del mismo color preceden a `die`. */
function positionFor(die: NucleoDie, table: readonly NucleoDie[]): { x: number; y: number } {
  const columnIndex = colorColumnIndex(die);
  const x = NUCLEO_TABLE_X_ORIGIN + columnIndex * TILE_SEPARATION_PX;

  if (die.kind === 'FIXED') {
    return { x, y: NUCLEO_TABLE_ROW_Y };
  }

  // EXTRA — cuenta cuántos EXTRA del mismo color aparecen ANTES que `die` en `table` (orden estable
  // de creación) para apilarlos en orden bajo el dado FIXED de su color.
  let extraIndex = 0;
  for (const candidate of table) {
    if (candidate.id === die.id) break;
    if (candidate.kind === 'EXTRA' && candidate.color === die.color) extraIndex += 1;
  }
  return { x, y: NUCLEO_TABLE_ROW_Y + (extraIndex + 1) * NUCLEO_EXTRA_DIE_STACK_OFFSET_PX };
}

function alphaFor(die: NucleoDie): number {
  return die.status === 'AVAILABLE' ? ALPHA_AVAILABLE : ALPHA_SPENT;
}

/**
 * Contrato exacto de spec §5.2 — construye la mesa completa a partir de un `table` inicial (sin
 * animación, mismo criterio de "primer render sin juice" que el resto de `view/*`). El caller
 * (`syncFromSnapshot`, más abajo) es responsable de invocar `addDie`/`updateDie` en renders
 * posteriores.
 */
export function createNucleoTable(scene: Phaser.Scene, table: readonly NucleoDie[]): NucleoTableView {
  const tiles = new Map<NucleoInstanceId, NucleoTile>();
  const lastSeen = new Map<NucleoInstanceId, { value: number; status: NucleoDie['status'] }>();
  let currentTable: readonly NucleoDie[] = table;

  function createStaticTile(die: NucleoDie): NucleoTile {
    const { x, y } = positionFor(die, currentTable);

    const rect = scene.add.rectangle(x, y, NUCLEO_DIE_SIZE, NUCLEO_DIE_SIZE, NUCLEO_COLOR_HEX[die.color]);
    rect.setInteractive().setData('targetId', die.id);
    rect.setAlpha(alphaFor(die));

    const text = scene.add.text(x, y, `${die.value}`, {
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
    });
    text.setOrigin(0.5, 0.5);
    text.setAlpha(alphaFor(die));

    return { rect, text };
  }

  /** Spec §5.3 fila `NUCLEO_TABLE_REROLLED`/`NUCLEO_DIE_ADDED` — mismo tween de `angle`/`scale` que
   *  `diceRoll` (H2.5), seguido de `particleBurst`, sobre el sprite REAL en su posición real. */
  function playRollAnimation(die: NucleoDie, tile: NucleoTile): void {
    const tint = NUCLEO_COLOR_HEX[die.color];
    scene.tweens.add({
      targets: tile.rect,
      angle: { from: 0, to: rotationDegreesFor(die.value) },
      scale: { from: 1.2, to: 1 },
      duration: ROLL_TWEEN_DURATION_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        spawnDieParticleBurst(scene, tile.rect.x, tile.rect.y, tint);
      },
    });
  }

  function setTileValueAndAlpha(die: NucleoDie, tile: NucleoTile): void {
    tile.text.setText(`${die.value}`);
    tile.rect.setAlpha(alphaFor(die));
    tile.text.setAlpha(alphaFor(die));
  }

  function rememberDie(die: NucleoDie): void {
    lastSeen.set(die.id, { value: die.value, status: die.status });
  }

  const view: NucleoTableView = {
    getDieObject(id: NucleoInstanceId): Phaser.GameObjects.GameObject | undefined {
      return tiles.get(id)?.rect;
    },

    addDie(die: NucleoDie, fullTable: readonly NucleoDie[]): void {
      if (tiles.has(die.id)) return; // defensivo — nunca debería llegar dos veces (spec §1.1)
      currentTable = fullTable;
      const tile = createStaticTile(die);
      tiles.set(die.id, tile);
      rememberDie(die);
      playRollAnimation(die, tile); // "spawn" — mismo lenguaje visual que un reroll (spec §5.3)
    },

    updateDie(die: NucleoDie): void {
      const tile = tiles.get(die.id);
      if (!tile) return; // defensivo — un dado desconocido se ignora, nunca se crea aquí (usar addDie)

      const previous = lastSeen.get(die.id);
      const valueChanged = previous !== undefined && previous.value !== die.value;

      if (valueChanged) {
        setTileValueAndAlpha(die, tile);
        playRollAnimation(die, tile);
      } else {
        setTileValueAndAlpha(die, tile);
      }
      rememberDie(die);
    },

    syncFromSnapshot(snapshot: CombatStateSnapshot): void {
      currentTable = snapshot.nucleoTable;
      // Capturado ANTES del bucle (fix): `tiles.size` cambia dentro del propio bucle a medida que se
      // insertan tiles nuevos — evaluar la condición por-dado clasificaría erróneamente los dados 2..N
      // del PRIMER render como "añadidos tras el primer render" (con animación de roll indebida).
      const isFirstSync = tiles.size === 0;

      for (const die of snapshot.nucleoTable) {
        if (!tiles.has(die.id)) {
          if (isFirstSync) {
            // Primer render global — sin animación (mismo criterio que el resto de `view/*`).
            const tile = createStaticTile(die);
            tiles.set(die.id, tile);
            rememberDie(die);
          } else {
            // Dado EXTRA añadido tras el primer render — `NUCLEO_DIE_ADDED` (spec §5.3).
            view.addDie(die, snapshot.nucleoTable);
          }
        } else {
          view.updateDie(die);
        }
      }
    },
  };

  // Construcción inicial contra `table` (contrato §5.2) — sin animación.
  for (const die of table) {
    tiles.set(die.id, createStaticTile(die));
    rememberDie(die);
  }

  return view;
}
