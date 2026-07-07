import Phaser from 'phaser';
import type { CombatBridge, Unsubscribe } from '@collector/combat-bridge';
import { createEffectsDirector, JUICE_CONFIG, RECIPE_REGISTRY } from '../juice';
import { createInputAdapter, type InputAdapter } from '../input';
import { createBoardView, type BoardViewContext } from '../view';

/** Viewport virtual de diseño — mobile-first, ver docs/architecture_stack.md §4.2. Misma resolución que
 *  `main.ts` (H2.1) ya usaba para el propio `Phaser.Game`; ahora también gobierna el `Scale Manager`
 *  (configurado a nivel de `Phaser.Game`, no de esta escena — ver `main.ts`, spec H2.6 §4). */
export const COMBAT_SCENE_VIEWPORT = { width: 1080, height: 1920 } as const;

/** Data que `CombatScene` espera recibir vía `scene.init(data)` (docs/architecture_stack.md §2.3: "el
 *  CombatEngine se crea en React/factory y se inyecta a Phaser vía scene.init(data)"). `CombatScene` NUNCA
 *  construye su propio `CombatBridge`/`CombatEngine` — los recibe ya construidos. `boardContext` es NUEVO
 *  H2.8 (spec §2.2): contexto de catálogo resuelto que `BoardView` necesita para pintar. */
export interface CombatSceneInitData {
  readonly bridge: CombatBridge;
  readonly boardContext: BoardViewContext;
}

/**
 * H2.6 — escena base de producción que sustituye a `HelloCombatScene` (H2.1, prueba desechable). No
 * construye su propio `CombatEngine`/`CombatBridge` (docs/architecture_stack.md §2.3: "Phaser nunca instancia
 * su propio motor de reglas") — fija el ciclo de vida estándar de `Phaser.Scene`, conecta el
 * `EffectsDirector` real al `CombatBridge` inyectado, (H2.7) el `InputAdapter` de clasificación de gestos
 * genéricos y (H2.8) el `BoardView` de renderizado de tablero/Núcleos/roles/mano, sin fugas de listeners
 * entre reinicios de escena.
 */
export class CombatScene extends Phaser.Scene {
  private bridge!: CombatBridge;
  /** H2.7 spec §2.3 — expuesto como propiedad de instancia para que H2.8/H2.9 puedan `subscribe(...)` al
   *  stream de `PointerGesture` desde fuera de `create()` si lo necesitan. */
  private inputAdapter!: InputAdapter;
  /** NUEVO H2.8 — contexto de catálogo resuelto que `BoardView` necesita para pintar (spec §2.2), mismo
   *  patrón de propiedad de instancia que `this.bridge`. */
  private boardContext!: BoardViewContext;

  constructor() {
    super('CombatScene');
  }

  /** Fase 1 del ciclo de vida Phaser — recibe `CombatSceneInitData`. Únicamente asigna `this.bridge`/
   *  `this.boardContext`; sin dispatch, sin suscripciones, sin side-effects (spec §2.1). Lanza si
   *  `data.bridge`/`data.boardContext` faltan — fallo temprano y explícito en vez de un `create()`
   *  silenciosamente roto más tarde. */
  init(data: CombatSceneInitData): void {
    if (!data?.bridge) {
      throw new Error('CombatScene.init: falta "bridge" en CombatSceneInitData — CombatScene nunca construye su propio CombatBridge.');
    }
    if (!data?.boardContext) {
      throw new Error('CombatScene.init: falta "boardContext" en CombatSceneInitData — necesario para render de tablero (H2.8).');
    }
    this.bridge = data.bridge;
    this.boardContext = data.boardContext;
  }

  /** No-op explícito (spec §2.2) — sin assets propios de `CombatScene` todavía (H2.8 los añadirá: atlas de
   *  cartas, spritesheet de dados, fuentes). Las 4 recetas de H2.5 usan placeholders de `Rectangle`/`Text`
   *  generados en runtime, no requieren `preload`. Se deja el método presente y vacío para que quede
   *  explícito en el código que la ausencia de carga de assets es una decisión de esta historia, no un olvido. */
  preload(): void {
    // no-op deliberado — ver spec H2.6 §2.2.
  }

  /** Fase 3 — cámara mínima, `EffectsDirector` real suscrito al `bridge` inyectado, `InputAdapter` (H2.7)
   *  conectado a la escena, `BoardView` (H2.8) construido y pintado contra el snapshot inicial, cleanup de
   *  los 3 registrado en `shutdown` (spec §2.1/§2.4, H2.7 spec §2.3, H2.8 spec §4). */
  create(): void {
    this.cameras.main.setBackgroundColor('#12141c');

    const effectsDirector = createEffectsDirector(JUICE_CONFIG, RECIPE_REGISTRY);
    const unsubscribeEffects: Unsubscribe = effectsDirector.attach(this.bridge, this);

    // H2.7 §2.3 — umbrales por defecto; H2.8/H2.9 pueden pasar config si el feel lo pide. Sin consumidor
    // semántico todavía en esta historia (§0.1): la traducción PointerGesture -> PlayerIntent de dominio es
    // de H2.8/H2.9.
    this.inputAdapter = createInputAdapter();
    const unsubscribeInput: Unsubscribe = this.inputAdapter.attach(this);

    // NUEVO H2.8 (spec §4) — construcción + pintura inicial + suscripción de sincronización. Se usa
    // `subscribeHudEvents` (no `subscribeSceneEvents`) porque `BoardView` refleja ESTADO, no dispara
    // animación transitoria — ver spec §4.1 para la justificación completa de reinterpretar el canal
    // "HUD" por su función en vez de por su ubicación física (React vs. Phaser).
    const boardView = createBoardView(this, this.boardContext);
    boardView.render(this.bridge.getSnapshot());
    const unsubscribeBoard: Unsubscribe = this.bridge.subscribeHudEvents(() => {
      boardView.render(this.bridge.getSnapshot());
    });

    // `SHUTDOWN` (no `DESTROY`, spec §2.4): cubre tanto el cierre del `Phaser.Game` completo como el
    // reinicio de esta escena (`scene.start()` de nuevo) sin destruir el `Game` — caso relevante para H2.9
    // (modal de resultado que reinicia `CombatScene` con un nuevo `CombatBridge`). Usar solo `DESTROY`
    // dejaría el listener vivo (fuga) en ese escenario de reinicio. `.once` (no `.on`): si la escena se
    // reinicia, `create()` vuelve a registrar un `once` fresco sobre los nuevos `unsubscribe`.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeEffects();
      unsubscribeInput();
      unsubscribeBoard();
    });
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
