import type { CombatBridge } from '@collector/combat-bridge';
import type { BoardViewContext } from './view';

/**
 * H2.8 (spec §2.4) — `bridge` + `boardContext` (contexto de catálogo resuelto una vez que
 * `BoardView` necesita para pintar, ya que ni `CombatBridge` ni `CombatStateSnapshot` exponen
 * catálogo). NUEVO H2.9 (spec §2.3): sobrevive como TIPO puro tras el retiro de
 * `buildDefaultCombatBridge` (movida a `apps/shell/src/combat/build-combat-setup.ts`) — sigue
 * siendo la firma común de retorno que tanto `apps/shell` como cualquier harness (`main.ts`,
 * `e2e/*-main.ts`) usan, sin redefinirla cada uno por su cuenta.
 */
export interface DefaultCombatSetup {
  readonly bridge: CombatBridge;
  readonly boardContext: BoardViewContext;
}
