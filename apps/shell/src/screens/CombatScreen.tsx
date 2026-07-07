import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from '@collector/combat-scene';
import type { CombatBridge } from '@collector/combat-bridge';
import { buildCombatSetup } from '../combat/build-combat-setup';
import { useCombatSnapshot } from '../combat/use-combat-snapshot';
import { CombatHud } from '../combat/CombatHud';
import { CombatResultModal } from '../combat/CombatResultModal';

/**
 * H2.9 — reescritura completa: sustituye el placeholder vacío de H2.2. Patrón estándar de
 * "librería imperativa dentro de React": `ref` al contenedor DOM + `useEffect` que construye el
 * recurso externo en el montaje y lo destruye en el cleanup, con array de dependencias vacío
 * (`[]`) para que se ejecute exactamente una vez por montaje del componente
 * (`architecture_stack.md` §2.3: "`<CombatScreen>` monta un `<PhaserMount>` una única vez por
 * combate").
 */
export function CombatScreen(): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const [bridge, setBridge] = useState<CombatBridge | null>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false; // guarda contra doble-construcción si el efecto se limpia antes de que
                            // buildCombatSetup() resuelva (StrictMode monta/desmonta en dev)

    void buildCombatSetup().then(({ bridge: newBridge, boardContext }) => {
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
      setBridge(newBridge); // dispara el montaje del HUD React tan pronto el bridge existe, sin
                            // esperar a que Phaser termine su propio arranque asíncrono
    });

    return () => {
      cancelled = true;
      game?.destroy(true); // true: también remueve el <canvas> del DOM
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mountRef} id="phaser-mount" />
      {bridge && <CombatHudOverlay bridge={bridge} />}
    </div>
  );
}

/**
 * "Chrome" no-juice de React, montado como overlay/portal SOBRE el canvas
 * (`architecture_stack.md` §2.3), nunca dentro de él. Separado en su propio componente para
 * poder usar el hook `useCombatSnapshot` solo una vez `bridge` existe (evita el caso
 * `bridge === null` dentro del hook).
 */
function CombatHudOverlay({ bridge }: { readonly bridge: CombatBridge }): JSX.Element {
  const snapshot = useCombatSnapshot(bridge);
  return (
    <>
      <CombatHud snapshot={snapshot} onEndTurn={() => bridge.dispatch({ type: 'END_TURN' })} />
      {snapshot.status !== 'IN_PROGRESS' && <CombatResultModal snapshot={snapshot} />}
    </>
  );
}
