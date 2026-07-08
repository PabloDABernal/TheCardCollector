import type Phaser from 'phaser';
import type { CombatEvent } from '@collector/domain-combat';
import type { SoundCueId } from '../audio/sound-manager';

/**
 * H2.4 spec §2 — contrato de destino de un `JuiceStep`. Enmienda al sketch
 * `architecture_stack.md` §3.2 (ver `docs/specs/H2.4_effects_director.md` §0.3).
 */
export interface JuiceTarget {
  /** Evento completo que disparó este step — la receta lee de aquí cualquier dato que necesite
   *  (montos, ids, side, etc.) sin que `EffectsDirector` tenga que conocer la forma de cada evento. */
  readonly event: CombatEvent;
  /** Id semántico y estable del game object principal afectado por este step (ver §3.3
   *  `resolveJuiceTarget` en `effects-director.ts`) — p.ej. 'leader', 'enemy', 'scenario', o un
   *  `cardInstanceId`/`allyInstanceId` real. `undefined` cuando el evento no tiene un único foco
   *  (p.ej. `NUCLEO_POOL_ROLLED` afecta a todo el pool, no a un único game object). La resolución
   *  de `focusId` a un `Phaser.GameObject` real es responsabilidad de la receta (H2.5) contra el
   *  registro de game objects que construya `combat-scene/view` (H2.8) — fuera de alcance aquí. */
  readonly focusId?: string;
}

export type JuiceStepMode = 'parallel' | 'sequential';

/** Una entrada de `JuiceConfig`: qué receta ejecutar, con qué parámetros, y cómo relacionarse en el
 *  tiempo con los steps anteriores del mismo evento (ver `EffectsDirector.resolveEvent`, §3.2). */
export interface JuiceStep {
  readonly recipeId: string;
  readonly params?: Record<string, unknown>;
  readonly mode: JuiceStepMode;
  /** NUEVO H2.13 — cue de audio estático a reproducir cuando este step arranca (independiente de si
   *  su receta visual tiene éxito/fracasa). `undefined` = sin sonido para este step. Casos que
   *  necesitan decidir el cue dinámicamente según el payload del evento (p.ej. victoria vs. derrota,
   *  un único campo `soundId` no puede bifurcar) NO usan este campo — usan una receta dedicada que
   *  lee `target.event` y llama al `SoundManager` ella misma (ver `combatOutcomeSound`), mismo
   *  criterio ya sentado por `resolveFloatingNumberEntries`/`computeIntensity` para parámetros
   *  visuales dependientes del evento. */
  readonly soundId?: SoundCueId;
}

/** Contrato que toda receta (stub en H2.4, real en H2.5) debe cumplir. `id` debe coincidir
 *  exactamente con el `recipeId` usado en `JUICE_CONFIG` — es la clave de `JuiceRecipeRegistry`
 *  que `EffectsDirector` usa para resolver cada `JuiceStep` a una implementación concreta. */
export interface JuiceRecipe<Params = Record<string, unknown>> {
  readonly id: string;
  play(scene: Phaser.Scene, target: JuiceTarget, params: Params): Promise<void>;
}

/** Registro id→implementación, inyectado en `createEffectsDirector`. H2.4 inyecta
 *  `STUB_RECIPE_REGISTRY` (`recipes/index.ts`); H2.6/H2.9 inyectarán el registro real de H2.5 sin
 *  tocar `EffectsDirector` ni `JUICE_CONFIG`. */
export type JuiceRecipeRegistry = Record<string, JuiceRecipe>;
