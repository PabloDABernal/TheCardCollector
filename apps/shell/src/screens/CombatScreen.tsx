import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from '@collector/combat-scene';
import type {
  AbilityViewData,
  BoardViewContext,
  EffectsQueueSignal,
  GestureCommandTranslatorHandle,
  TargetingSignal,
} from '@collector/combat-scene';
import type { CombatBridge } from '@collector/combat-bridge';
import './CombatScreen.css';
import { buildCombatSetup } from '../combat/build-combat-setup';
import { useCombatSnapshot } from '../combat/use-combat-snapshot';
import { usePhaserViewportTransform } from '../combat/use-phaser-viewport-transform';
import { useTargetingPrompt } from '../combat/use-targeting-prompt';
import { useIsWideViewport } from '../combat/use-is-wide-viewport';
import { useEffectsQueueDraining } from '../combat/use-effects-queue-draining';
import { useAutoEndTurn } from '../combat/use-auto-end-turn';
import { CombatBoardOverlay } from '../combat/CombatBoardOverlay';
import { CombatHud } from '../combat/CombatHud';
import { CombatResultModal } from '../combat/CombatResultModal';
import { TurnStartModal } from '../combat/TurnStartModal';
import { CombatLogPanel } from '../combat/log/CombatLogPanel';
import { useCombatLog } from '../combat/log/use-combat-log';
import { TargetingPromptBanner } from '../combat/card/TargetingPromptBanner';
import { LEADER_OPTIONS, DEFAULT_LEADER_OPTION } from '../combat/leader-options';
import { ENEMY_OPTIONS, DEFAULT_ENEMY_OPTION } from '../combat/enemy-options';
import { SCENARIO_OPTIONS, DEFAULT_SCENARIO_OPTION } from '../combat/scenario-options';
import type { RunStartNavigationState } from '../combat/run-start-navigation-state';

/**
 * H2.9 — reescritura completa: sustituye el placeholder vacío de H2.2. Patrón estándar de
 * "librería imperativa dentro de React": `ref` al contenedor DOM + `useEffect` que construye el
 * recurso externo en el montaje y lo destruye en el cleanup.
 *
 * H2.14 — lee `location.state` (navegación desde `RunStartScreen`) para saber qué Líder eligió el
 * jugador; si se monta sin `state` (navegación directa a `/combat`, tests existentes, o futuro
 * deep-link), usa el mismo Líder por defecto de siempre (`DEFAULT_LEADER_OPTION`). El array de
 * dependencias del efecto pasa a `[leaderId]` (spec §3.3) — sin cambio de comportamiento observable
 * respecto a `[]`, ya que React Router desmonta/remonta `CombatScreen` en cada navegación real a la
 * misma ruta con `state` distinto.
 */
export function CombatScreen(): JSX.Element {
  const location = useLocation();
  const requestedLeaderId = (location.state as RunStartNavigationState | null)?.leaderId;
  // H2.14 bug fix (Reviewer): saneamos el `leaderId` UNA sola vez contra `LEADER_OPTIONS` — el mismo
  // id ya validado se usa tanto para `leaderName` (HUD) como para `buildCombatSetup`, evitando que
  // este último reciba un id no validado (ej. navegación con `state` manipulado) que provocaría un
  // `TypeError` opaco más abajo en `catalog.leaders.get(...)!`.
  const leaderOption =
    LEADER_OPTIONS.find((option) => option.leaderId === requestedLeaderId) ?? DEFAULT_LEADER_OPTION;
  const leaderId = leaderOption.leaderId;
  const leaderName = leaderOption.label;

  // NUEVO H4.x — mismo saneamiento contra el catálogo de opciones que `leaderId` (bug fix de
  // H2.14): evita que un `state` manipulado/corrupto llegue a `buildCombatSetup` con un
  // enemyId/scenarioId inexistente en el catálogo.
  const requestedEnemyId = (location.state as RunStartNavigationState | null)?.enemyId;
  const enemyOption =
    ENEMY_OPTIONS.find((option) => option.enemyId === requestedEnemyId) ?? DEFAULT_ENEMY_OPTION;
  const enemyId = enemyOption.enemyId;

  const requestedScenarioId = (location.state as RunStartNavigationState | null)?.scenarioId;
  const scenarioOption =
    SCENARIO_OPTIONS.find((option) => option.scenarioId === requestedScenarioId) ?? DEFAULT_SCENARIO_OPTION;
  const scenarioId = scenarioOption.scenarioId;

  const mountRef = useRef<HTMLDivElement>(null);
  // FIX QA (Bug 1/Bug 2) — el header/footer reales viven SIEMPRE en la misma posición del árbol
  // (filas del flex column de `.combat-screen-root`, ver CombatScreen.css), para que `#phaser-mount`
  // (hermano en la fila central) nunca se desmonte/remonte al aparecer/desaparecer `bridge`. El
  // contenido de esas filas (`CombatHud`/`TargetingPromptBanner`/`CombatLogPanel`) sigue viviendo
  // dentro de `CombatHudOverlay` (única instancia que llama a los hooks que exigen `bridge` no nulo,
  // `useCombatSnapshot`/`useTargetingPrompt`/`useCombatLog`) y se proyecta a estas filas vía
  // `createPortal` — evita duplicar esos hooks en 3 componentes separados solo por posición visual.
  // `useState` (no `useRef`) porque un `ref` callback debe disparar un re-render para que
  // `CombatHudOverlay` reciba el nodo DOM real una vez montado (no está disponible todavía en el
  // primer render de `CombatScreen`).
  const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null);
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null);
  const [bridge, setBridge] = useState<CombatBridge | null>(null);
  // FIX Reviewer post-H3 (commit `cce72a3`) — `CombatHud` necesita las `leaderAbilities` del
  // `boardContext` (mismo dato ya resuelto por `buildCombatSetup`) para calcular disponibilidad de
  // "Activar Habilidad" por color real (`isAnyLeaderAbilityActivatable`).
  const [leaderAbilities, setLeaderAbilities] = useState<readonly AbilityViewData[]>([]);
  // H4 spec §2 — `boardContext` completo, necesario por `CombatBoardOverlay` para las líneas de rol
  // (leaderMaxHealth/enemyMaxHealth/scenarioPlotDefeatThreshold).
  const [boardContext, setBoardContext] = useState<BoardViewContext | null>(null);
  // NUEVO H4 spec §5.2/§6.1 — obtenidos de `CombatScene` tras `Phaser.Core.Events.READY` (la escena
  // se crea/arranca DENTRO del handler de READY, así que estos dos solo existen a partir de ahí).
  const [targetingSignal, setTargetingSignal] = useState<TargetingSignal | null>(null);
  const [gestureHandle, setGestureHandle] = useState<GestureCommandTranslatorHandle | null>(null);
  // NUEVO H5.9 §2 — obtenido de `CombatScene` tras `READY`, mismo ciclo de vida que
  // `targetingSignal`/`gestureHandle`.
  const [effectsQueueSignal, setEffectsQueueSignal] = useState<EffectsQueueSignal | null>(null);
  // H4 spec §2.3 — sincroniza la capa HTML del overlay con el escalado real que
  // `Phaser.Scale.FIT` aplica al canvas.
  const transform = usePhaserViewportTransform(mountRef);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false; // guarda contra doble-construcción si el efecto se limpia antes de que
                            // buildCombatSetup() resuelva (StrictMode monta/desmonta en dev)

    void buildCombatSetup({ leaderId, enemyId, scenarioId }).then(({ bridge: newBridge, boardContext }) => {
      if (cancelled) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: COMBAT_SCENE_VIEWPORT.width,
        height: COMBAT_SCENE_VIEWPORT.height,
        parent: mountRef.current!, // elemento DOM real, no un id de string — evita colisión si
                                    // hubiera más de un <CombatScreen> montado
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: COMBAT_SCENE_VIEWPORT.width,
          height: COMBAT_SCENE_VIEWPORT.height,
        },
        scene: [], // se añade/arranca a mano abajo, para poder pasarle `CombatSceneInitData` en
                   // el `start()` (Phaser no permite inyectar `data` de init a una escena listada
                   // directamente en `scene: [...]` de la config del Game).
      });
      game.events.once(Phaser.Core.Events.READY, () => {
        const scene = game!.scene.add('CombatScene', CombatScene, false) as CombatScene;
        game!.scene.start('CombatScene', { bridge: newBridge, boardContext });
        // NUEVO H4 spec §5.2/§6.1 — `CombatScene.create()` construye `targetingSignal`/el
        // traductor de gestos DENTRO de `start()` (síncrono desde aquí en Phaser), así que ya
        // están disponibles inmediatamente después de `scene.start(...)`.
        setTargetingSignal(scene.getTargetingSignal());
        setGestureHandle(scene.getGestureCommandTranslator());
        setEffectsQueueSignal(scene.getEffectsQueueSignal());
      });
      setLeaderAbilities(boardContext.leaderAbilities);
      setBoardContext(boardContext);
      setBridge(newBridge); // dispara el montaje del HUD React tan pronto el bridge existe, sin
                            // esperar a que Phaser termine su propio arranque asíncrono
    });

    return () => {
      cancelled = true;
      game?.destroy(true); // true: también remueve el <canvas> del DOM
    };
  }, [leaderId, enemyId, scenarioId]);

  return (
    <div className="combat-screen-root">
      {/* FIX QA (Bug 1/Bug 2) — 3 filas reales de flex column (CombatScreen.css): header/footer
          reservan su propio alto SIEMPRE (aunque vacíos mientras `bridge`/`boardContext` no existen
          todavía), y `.combat-screen-canvas-area` (fila central, `flex: 1`) es el único ancestro real
          de `#phaser-mount` — `Phaser.Scale.FIT` mide su tamaño YA descontado el header/footer, en vez
          del viewport completo. */}
      <div className="combat-screen-header" ref={setHeaderEl} />
      <div className="combat-screen-canvas-area">
        <div ref={mountRef} id="phaser-mount" />
        {!bridge && <p>Cargando combate…</p>}
        {bridge && boardContext && (
          <CombatHudOverlay
            bridge={bridge}
            leaderName={leaderName}
            enemyName={enemyOption.label}
            scenarioName={scenarioOption.label}
            leaderAbilities={leaderAbilities}
            boardContext={boardContext}
            transform={transform}
            targetingSignal={targetingSignal}
            gestureHandle={gestureHandle}
            effectsQueueSignal={effectsQueueSignal}
            headerContainer={headerEl}
            footerContainer={footerEl}
          />
        )}
      </div>
      <div className="combat-screen-footer" ref={setFooterEl} />
    </div>
  );
}

/**
 * "Chrome" no-juice de React, montado como overlay/portal SOBRE el canvas
 * (`architecture_stack.md` §2.3), nunca dentro de él. Separado en su propio componente para
 * poder usar el hook `useCombatSnapshot` solo una vez `bridge` existe (evita el caso
 * `bridge === null` dentro del hook).
 *
 * H4 spec §2 — además de `CombatHud` (franja fija superior), monta `CombatBoardOverlay`: la capa
 * HTML sincronizada con las coordenadas virtuales del tablero (líneas de rol + etiquetas de zona),
 * generalización de este mismo patrón `position: absolute` sobre el canvas.
 */
function CombatHudOverlay({
  bridge,
  leaderName,
  enemyName,
  scenarioName,
  leaderAbilities,
  boardContext,
  transform,
  targetingSignal,
  gestureHandle,
  effectsQueueSignal,
  headerContainer,
  footerContainer,
}: {
  readonly bridge: CombatBridge;
  readonly leaderName: string;
  readonly enemyName: string;
  readonly scenarioName: string;
  readonly leaderAbilities: readonly AbilityViewData[];
  readonly boardContext: BoardViewContext;
  readonly transform: ReturnType<typeof usePhaserViewportTransform>;
  readonly targetingSignal: TargetingSignal | null;
  readonly gestureHandle: GestureCommandTranslatorHandle | null;
  /** NUEVO H5.9 §2. */
  readonly effectsQueueSignal: EffectsQueueSignal | null;
  /** FIX QA (Bug 1/Bug 2) — nodos DOM reales de `.combat-screen-header`/`.combat-screen-footer`
   *  (filas del flex column de `CombatScreen.css`, siempre presentes en el árbol). `CombatHud`/
   *  `TargetingPromptBanner`/`CombatLogPanel` se proyectan ahí vía `createPortal` en vez de vivir
   *  como capas `position: absolute` superpuestas al canvas — así reservan espacio real. `null`
   *  únicamente durante el primer render de `CombatScreen` (antes de que el `ref` callback del
   *  contenedor se dispare) — no es un caso de error. */
  readonly headerContainer: HTMLDivElement | null;
  readonly footerContainer: HTMLDivElement | null;
}): JSX.Element {
  const snapshot = useCombatSnapshot(bridge);
  // NUEVO H4 spec §5.2/§5.3 — banner "Elige un objetivo"/"Elige un Núcleo", montado justo debajo de
  // `CombatHud` (franja fija, fuera de la transformación de viewport virtual del canvas).
  const targetingPrompt = useTargetingPrompt(targetingSignal);
  // NUEVO H4 spec §3/§5 — log de combate en texto, traducido desde el canal HUD.
  const logEntries = useCombatLog(bridge, boardContext);
  // NUEVO H5.8 §3.2 — en desktop ancho (>= 1100px CSS reales), `CombatLogPanel` pasa a sidebar
  // persistente (`position: fixed`, no necesita reservar fila del footer); en el resto de casos
  // conserva el comportamiento peek/bottom-sheet de H4, portado a `.combat-screen-footer`.
  const isWideViewport = useIsWideViewport();
  // NUEVO H5.9 §2 — evita el "popup ciego": `TurnStartModal` espera a que la cola de `EffectsDirector`
  // termine de drenar el turno del Enemigo antes de aparecer.
  const effectsQueueDraining = useEffectsQueueDraining(effectsQueueSignal);
  // NUEVO H5.9 §3.2 — fin de turno automático, sustituye al botón manual "Fin de turno" (retirado en
  // H5.5 corrección §5).
  useAutoEndTurn(bridge, snapshot, leaderAbilities);
  return (
    <>
      {/* H4 spec §5.3 — `CombatHud` (franja de cabecera) + `TargetingPromptBanner` (banner justo
          debajo) siguen siendo hermanos de flujo normal, pero ahora dentro de `.combat-screen-header`
          (fila real del flex column, FIX QA Bug 1/Bug 2) en vez de un wrapper `position: absolute`
          superpuesto al canvas. */}
      {headerContainer &&
        createPortal(
          <>
            <CombatHud
              snapshot={snapshot}
              bridge={bridge}
              leaderName={leaderName}
              leaderAbilities={leaderAbilities}
            />
            <TargetingPromptBanner
              prompt={targetingPrompt}
              onCancel={() => gestureHandle?.cancelPending()}
            />
          </>,
          headerContainer,
        )}
      <CombatBoardOverlay
        snapshot={snapshot}
        ctx={boardContext}
        gestureHandle={gestureHandle}
        transform={transform}
        leaderName={leaderName}
        enemyName={enemyName}
        scenarioName={scenarioName}
        targetingPrompt={targetingPrompt}
        bridge={bridge}
      />
      {isWideViewport
        ? <CombatLogPanel entries={logEntries} variant="sidebar" />
        : footerContainer && createPortal(<CombatLogPanel entries={logEntries} variant="peek" />, footerContainer)}
      <TurnStartModal snapshot={snapshot} bridge={bridge} effectsQueueDraining={effectsQueueDraining} />
      {snapshot.status !== 'IN_PROGRESS' && <CombatResultModal snapshot={snapshot} />}
    </>
  );
}
