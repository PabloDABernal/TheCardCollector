import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from '@collector/combat-scene';
import type { AbilityViewData } from '@collector/combat-scene';
import type { CombatBridge } from '@collector/combat-bridge';
import './CombatScreen.css';
import { buildCombatSetup } from '../combat/build-combat-setup';
import { useCombatSnapshot } from '../combat/use-combat-snapshot';
import { CombatHud } from '../combat/CombatHud';
import { CombatResultModal } from '../combat/CombatResultModal';
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
        const scene = game!.scene.add('CombatScene', CombatScene, false);
        game!.scene.start('CombatScene', { bridge: newBridge, boardContext });
        void scene; // solo para dejar constancia del mismo patrón que main.ts (H2.7)
      });
      setLeaderAbilities(boardContext.leaderAbilities);
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
      {bridge && (
        <CombatHudOverlay bridge={bridge} leaderName={leaderName} leaderAbilities={leaderAbilities} />
      )}
    </div>
  );
}

/**
 * "Chrome" no-juice de React, montado como overlay/portal SOBRE el canvas
 * (`architecture_stack.md` §2.3), nunca dentro de él. Separado en su propio componente para
 * poder usar el hook `useCombatSnapshot` solo una vez `bridge` existe (evita el caso
 * `bridge === null` dentro del hook).
 */
function CombatHudOverlay({
  bridge,
  leaderName,
  leaderAbilities,
}: {
  readonly bridge: CombatBridge;
  readonly leaderName: string;
  readonly leaderAbilities: readonly AbilityViewData[];
}): JSX.Element {
  const snapshot = useCombatSnapshot(bridge);
  return (
    <>
      <CombatHud
        snapshot={snapshot}
        bridge={bridge}
        onEndTurn={() => bridge.dispatch({ type: 'END_TURN' })}
        leaderName={leaderName}
        leaderAbilities={leaderAbilities}
      />
      {snapshot.status !== 'IN_PROGRESS' && <CombatResultModal snapshot={snapshot} />}
    </>
  );
}
