import Phaser from 'phaser';
import type { CombatBridge, Unsubscribe } from '@collector/combat-bridge';
import { createEffectsDirector, JUICE_CONFIG, RECIPE_REGISTRY } from '../juice';

/** Viewport virtual de diseño — mobile-first, ver docs/architecture_stack.md §4.2. Misma resolución que
 *  `main.ts` (H2.1) ya usaba para el propio `Phaser.Game`; ahora también gobierna el `Scale Manager`
 *  (configurado a nivel de `Phaser.Game`, no de esta escena — ver `main.ts`, spec H2.6 §4). */
export const COMBAT_SCENE_VIEWPORT = { width: 1080, height: 1920 } as const;

/** Data que `CombatScene` espera recibir vía `scene.init(data)` (docs/architecture_stack.md §2.3: "el
 *  CombatEngine se crea en React/factory y se inyecta a Phaser vía scene.init(data)"). `CombatScene` NUNCA
 *  construye su propio `CombatBridge`/`CombatEngine` — los recibe ya construidos. */
export interface CombatSceneInitData {
  readonly bridge: CombatBridge;
}

/**
 * H2.6 — escena base de producción que sustituye a `HelloCombatScene` (H2.1, prueba desechable). No
 * construye su propio `CombatEngine`/`CombatBridge` (docs/architecture_stack.md §2.3: "Phaser nunca instancia
 * su propio motor de reglas") ni renderiza tablero/HUD todavía (H2.8) ni registra input (H2.7) — únicamente
 * fija el ciclo de vida estándar de `Phaser.Scene` y conecta el `EffectsDirector` real al `CombatBridge`
 * inyectado, sin fugas de listeners entre reinicios de escena.
 */
export class CombatScene extends Phaser.Scene {
  private bridge!: CombatBridge;

  constructor() {
    super('CombatScene');
  }

  /** Fase 1 del ciclo de vida Phaser — recibe `CombatSceneInitData`. Únicamente asigna `this.bridge`; sin
   *  dispatch, sin suscripciones, sin side-effects (spec §2.1). Lanza si `data.bridge` falta — fallo temprano
   *  y explícito en vez de un `create()` silenciosamente roto más tarde. */
  init(data: CombatSceneInitData): void {
    if (!data?.bridge) {
      throw new Error('CombatScene.init: falta "bridge" en CombatSceneInitData — CombatScene nunca construye su propio CombatBridge.');
    }
    this.bridge = data.bridge;
  }

  /** No-op explícito (spec §2.2) — sin assets propios de `CombatScene` todavía (H2.8 los añadirá: atlas de
   *  cartas, spritesheet de dados, fuentes). Las 4 recetas de H2.5 usan placeholders de `Rectangle`/`Text`
   *  generados en runtime, no requieren `preload`. Se deja el método presente y vacío para que quede
   *  explícito en el código que la ausencia de carga de assets es una decisión de esta historia, no un olvido. */
  preload(): void {
    // no-op deliberado — ver spec H2.6 §2.2.
  }

  /** Fase 3 — cámara mínima, `EffectsDirector` real suscrito al `bridge` inyectado, cleanup registrado en
   *  `shutdown` (spec §2.1/§2.4). No pinta ningún estado de combate (eso es H2.8). */
  create(): void {
    this.cameras.main.setBackgroundColor('#12141c');

    const effectsDirector = createEffectsDirector(JUICE_CONFIG, RECIPE_REGISTRY);
    const unsubscribe: Unsubscribe = effectsDirector.attach(this.bridge, this);

    // `SHUTDOWN` (no `DESTROY`, spec §2.4): cubre tanto el cierre del `Phaser.Game` completo como el
    // reinicio de esta escena (`scene.start()` de nuevo) sin destruir el `Game` — caso relevante para H2.9
    // (modal de resultado que reinicia `CombatScene` con un nuevo `CombatBridge`). Usar solo `DESTROY`
    // dejaría el listener vivo (fuga) en ese escenario de reinicio. `.once` (no `.on`): si la escena se
    // reinicia, `create()` vuelve a registrar un `once` fresco sobre el nuevo `unsubscribe`.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubscribe());
  }

  /** No-op explícito (spec §2.3), confirmado — Phaser ya gestiona su loop de render (RAF interno); el
   *  `Tween Manager`/`Timeline` de las recetas de H2.5 avanza automáticamente cada frame sin necesidad de
   *  lógica aquí. El "juice" es reactivo a eventos del `CombatBridge` (`subscribeSceneEvents` →
   *  `EffectsDirector` → receta), nunca por polling de estado en `update()`. H2.7 (InputAdapter) tampoco
   *  necesita `update()`: usa listeners de input de Phaser registrados en `create()`. Parámetros con prefijo
   *  `_` por convención de "parámetro de interfaz no usado intencionalmente" — no se olvidó, se decidió vacío. */
  // Firma con parámetros nombrados (`_time`, `_delta`) a propósito, ver spec H2.6 §2.3: documenta que
  // update() no fue olvidado, sino decidido vacío, en vez de omitir los nombres de parámetro.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_time: number, _delta: number): void {
    // no-op deliberado — ver spec H2.6 §2.3.
  }
}
