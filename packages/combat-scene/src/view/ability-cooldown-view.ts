import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityId } from '@collector/domain-shared';
import type { AbilityViewData } from './board-view-context';
import { LEADER_POSITION, ENEMY_POSITION, ABILITY_ICON_SEPARATION_PX } from './board-layout';

// H2.10 spec §1.2/§2.2/§2.3 — icono individual de CD por habilidad: barra de progreso horizontal
// (fondo `iconBg` + relleno `iconFill` con tween de `scaleX`/color) + número/"LISTA" superpuesto
// (`labelText`). Análogo a `role-view.ts`/`card-hand-view.ts`: game objects creados una única vez,
// actualizados in-place, nunca destruidos/recreados.
const ICON_WIDTH = 80;
const ICON_HEIGHT = 24;
const ICON_BG_COLOR = 0x2c2c2c;
const COLOR_ACTIVE = 0xc0392b; // rojo — CD activo
const COLOR_READY = 0x27ae60; // verde — CD=0/listo
const PROGRESS_TWEEN_DURATION_MS = 250;

export interface AbilityCooldownView {
  /** Actualiza barra/color/número de TODAS las habilidades de este lado contra el snapshot actual.
   *  Idempotente (spec §2.1): llamar dos veces con el mismo snapshot no duplica tweens ni deja la
   *  barra en un estado distinto. Nunca destruye/recrea game objects — misma garantía que
   *  `RoleView`/`CardHandView`. */
  update(snapshot: CombatStateSnapshot): void;
}

/** Helper de nombre estable para `setName`/`getByName` — usado también por la receta de juice
 *  `cooldownReady` para resolver el game object de una habilidad concreta a partir de su
 *  `abilityId`. Idéntico patrón a `cardTileName` de `card-hand-view.ts`. Resuelve al `iconBg`
 *  (spec §3.1, nota de implementación: un único elemento representativo es suficiente, no hace
 *  falta un `Container` para "agrupar" en esta historia). */
export function abilityIconGroupName(abilityId: AbilityId): string {
  return `ability-cooldown-${abilityId}`;
}

interface AbilityIconEntry {
  readonly ability: AbilityViewData;
  readonly iconFill: Phaser.GameObjects.Rectangle;
  readonly labelText: Phaser.GameObjects.Text;
  lastRemaining: number | null;
}

/** Progreso `[0, 1]` de la barra: `0` = CD recién gastado (baseCooldown restante), `1` = listo. */
function progressOf(remaining: number, baseCooldown: number): number {
  if (baseCooldown <= 0) {
    return 1;
  }
  return (baseCooldown - remaining) / baseCooldown;
}

/** Interpolación lineal manual de color (sin depender de `Phaser.Display.Color` en runtime — este
 *  módulo se importa también desde tests con `@vitest-environment node`, donde `phaser` como
 *  import de VALOR no puede cargarse sin `window`; solo se usa `import type Phaser`, ver arriba). */
function interpolateColor(from: number, to: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return (r << 16) | (g << 8) | b;
}

function colorFor(remaining: number, baseCooldown: number): number {
  return interpolateColor(COLOR_ACTIVE, COLOR_READY, progressOf(remaining, baseCooldown));
}

/** Fix H2.10 (bug reportado por Reviewer): réplica local de `Phaser.Math.Easing.Sine.Out` (no se
 *  puede importar `phaser` como valor en este módulo, ver comentario de `interpolateColor` — se
 *  carga también en tests con `@vitest-environment node`). El tween de `scaleX` (barra) usa
 *  `ease: 'Sine.easeOut'`; el color debe interpolarse con el mismo easing sobre el mismo progreso
 *  para que ambos avancen sincronizados durante los 250ms — usar `tween.progress` (lineal) crudo
 *  para el color, mientras la barra avanza con Sine.easeOut, producía una ligera desincronía. */
function sineEaseOut(t: number): number {
  return Math.sin((t * Math.PI) / 2);
}

function labelFor(ability: AbilityViewData, remaining: number): string {
  return remaining === 0 ? `${ability.name} LISTA` : `${ability.name} ${remaining}/${ability.baseCooldown}`;
}

/** Crea (una única vez) un icono por entrada de `abilities` (Líder o Enemigo, según `side`), en fila
 *  horizontal centrada sobre `rowY` (spec §2.3). Solo los del Líder reciben
 *  `setInteractive().setData('targetId', abilityId)` (spec §0.3 punto 4) — parámetro `interactive`
 *  decide esto, para no duplicar la función completa entre Líder/Enemigo. */
export function createAbilityCooldownView(
  scene: Phaser.Scene,
  abilities: readonly AbilityViewData[],
  side: 'LEADER' | 'ENEMY',
  rowY: number,
  interactive: boolean,
): AbilityCooldownView {
  const centerX = side === 'LEADER' ? LEADER_POSITION.x : ENEMY_POSITION.x;
  const startX = centerX - ((abilities.length - 1) * ABILITY_ICON_SEPARATION_PX) / 2;

  const entries: AbilityIconEntry[] = abilities.map((ability, index) => {
    const x = startX + index * ABILITY_ICON_SEPARATION_PX;
    const name = abilityIconGroupName(ability.abilityId);

    const iconBg = scene.add.rectangle(x, rowY, ICON_WIDTH, ICON_HEIGHT, ICON_BG_COLOR);
    iconBg.setName(name);
    if (interactive) {
      iconBg.setInteractive().setData('targetId', ability.abilityId);
    }

    const iconFill = scene.add.rectangle(x - ICON_WIDTH / 2, rowY, ICON_WIDTH, ICON_HEIGHT, COLOR_ACTIVE);
    iconFill.setOrigin(0, 0.5);

    const labelText = scene.add.text(x, rowY, '', {
      fontSize: '14px',
      color: '#ffffff',
      align: 'center',
    });
    labelText.setOrigin(0.5, 0.5);

    return { ability, iconFill, labelText, lastRemaining: null };
  });

  return {
    update(snapshot: CombatStateSnapshot): void {
      for (const entry of entries) {
        const cooldown = snapshot.cooldowns.find((c) => c.abilityId === entry.ability.abilityId);
        const remaining = cooldown ? cooldown.remaining : entry.ability.baseCooldown;

        if (entry.lastRemaining === remaining) {
          // Idempotente (spec §2.1): mismo valor origen=destino, ningún tween adicional se dispara.
          continue;
        }

        entry.labelText.setText(labelFor(entry.ability, remaining));

        const newProgress = progressOf(remaining, entry.ability.baseCooldown);
        const newColor = colorFor(remaining, entry.ability.baseCooldown);

        if (entry.lastRemaining === null) {
          // Primera llamada a update(): sin tween, spec §1.3 (evita animación de "aparición" rara).
          entry.iconFill.setScale(newProgress, 1);
          entry.iconFill.setFillStyle(newColor);
          entry.lastRemaining = remaining;
          continue;
        }

        const oldColor = colorFor(entry.lastRemaining, entry.ability.baseCooldown);

        scene.tweens.add({
          targets: entry.iconFill,
          scaleX: newProgress,
          duration: PROGRESS_TWEEN_DURATION_MS,
          ease: 'Sine.easeOut',
          onUpdate: (tween: Phaser.Tweens.Tween) => {
            entry.iconFill.setFillStyle(interpolateColor(oldColor, newColor, sineEaseOut(tween.progress)));
          },
          onComplete: () => {
            entry.iconFill.setFillStyle(newColor);
          },
        });

        entry.lastRemaining = remaining;
      }
    },
  };
}
