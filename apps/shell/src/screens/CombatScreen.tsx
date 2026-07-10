import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from '@collector/combat-scene';
import type { AbilityViewData, BoardViewContext, GestureCommandTranslatorHandle, TargetingSignal } from '@collector/combat-scene';
import type { CombatBridge } from '@collector/combat-bridge';
import './CombatScreen.css';
import { buildCombatSetup } from '../combat/build-combat-setup';
import { useCombatSnapshot } from '../combat/use-combat-snapshot';
import { usePhaserViewportTransform } from '../combat/use-phaser-viewport-transform';
import { useTargetingPrompt } from '../combat/use-targeting-prompt';
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
        />
      )}
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
}): JSX.Element {
  const snapshot = useCombatSnapshot(bridge);
  // NUEVO H4 spec §5.2/§5.3 — banner "Elige un objetivo"/"Elige un Núcleo", montado justo debajo de
  // `CombatHud` (franja fija, fuera de la transformación de viewport virtual del canvas).
  const targetingPrompt = useTargetingPrompt(targetingSignal);
  // NUEVO H4 spec §3/§5 — log de combate en texto, traducido desde el canal HUD.
  const logEntries = useCombatLog(bridge, boardContext);
  return (
    <>
      {/* H4 spec §5.3 — envoltorio `position: absolute` compartido por `CombatHud` (franja fija) y
          `TargetingPromptBanner` (banner justo debajo): al ser ambos hijos de flujo normal DENTRO de
          este wrapper (en vez de cada uno `position: absolute` independiente), el banner cae
          automáticamente bajo `CombatHud` sin necesidad de medir su altura variable
          (`ResizeObserver`) — el propio flujo del navegador resuelve el offset. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }}>
        <CombatHud
          snapshot={snapshot}
          bridge={bridge}
          onEndTurn={() => bridge.dispatch({ type: 'END_TURN' })}
          leaderName={leaderName}
          leaderAbilities={leaderAbilities}
        />
        <TargetingPromptBanner
          prompt={targetingPrompt}
          onCancel={() => gestureHandle?.cancelPending()}
        />
      </div>
      <CombatBoardOverlay
        snapshot={snapshot}
        ctx={boardContext}
        gestureHandle={gestureHandle}
        transform={transform}
        leaderName={leaderName}
        enemyName={enemyName}
        scenarioName={scenarioName}
        targetingPrompt={targetingPrompt}
      />
      <CombatLogPanel entries={logEntries} />
      <TurnStartModal snapshot={snapshot} bridge={bridge} />
      {snapshot.status !== 'IN_PROGRESS' && <CombatResultModal snapshot={snapshot} />}
    </>
  );
}
