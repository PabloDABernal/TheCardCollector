import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { FOCUS_ID_LEADER, FOCUS_ID_ENEMY, FOCUS_ID_SCENARIO } from '../juice';
import type { BoardViewContext } from './board-view-context';
import { LEADER_POSITION, ENEMY_POSITION, SCENARIO_POSITION } from './board-layout';
import { createRoundedFrameRectangle } from './rounded-frame';

// H5.1 spec §2.2/§2.3 — tile compacto (antes 200×200): libera presupuesto vertical para que
// Enemigo/Secuaces/Escenario y Aliados/Mano/Líder quepan en las zonas compactas arriba/abajo de la
// mesa de Núcleos, ahora ancla central del tablero (`board-layout.ts` `COMPACT_ROLE_TILE_HALF_PX`).
const ROLE_SIZE = { width: 140, height: 140 };
const LEADER_COLOR = 0x2980b9; // azul
const ENEMY_COLOR = 0xc0392b; // rojo
const SCENARIO_COLOR = 0x8e44ad; // violeta
const SCENARIO_ALERT_COLOR = 0xc0392b; // NUEVO H2.11 — mismo rojo de alerta que ENEMY_COLOR

// FIX visual (feedback Director Creativo en móvil real, docs/specs/H4_diseno_real_ui.md) — los tiles
// de rol eran cuadrados planos sin marco, un lenguaje visual distinto al de `CardTile.tsx`
// (`apps/shell/src/ui/design-tokens.ts`: RADIUS_PANEL=12, --rule=#3a3744, SHADOW_PANEL). `Rectangle`
// de Phaser no soporta esquinas redondeadas nativas, así que el REDONDEADO real se logra con un
// `GeometryMask` (Graphics `fillRoundedRect` usado solo como máscara, nunca añadido visualmente) —
// enmascara TODO el render del `Rectangle` (fill Y stroke). El borde temático (`--rule`) y la sombra
// se dibujan aparte, en `Graphics` puramente decorativos que NUNCA reciben `targetId`
// (targeting-highlight-view.ts los ignora al buscar por `getData('targetId')`).
// FIX crítico (review post-marco redondeado) — `targeting-highlight-view.ts` YA NO llama
// `setStrokeStyle` sobre este `rect`: ese stroke quedaba parcialmente recortado por el
// `GeometryMask` (mismo tamaño que el `rect`) y, en la mitad que sobrevivía, tapado por `border`
// (creado después en la display list, opaco). El highlight ahora es un `Graphics` propio que ese
// módulo dibuja por encima de todo (`setDepth`), leyendo la geometría del `rect` vía
// `data.highlightRadius` (ver `setData` más abajo) — el orden de creación de `shadow`/`border` deja
// de importarle a targeting.
const ROLE_RADIUS_PX = 12; // = RADIUS_PANEL (design-tokens.ts)
const ROLE_BORDER_COLOR = 0x3a3744; // = --rule
const ROLE_BORDER_WIDTH_PX = 2;
const ROLE_SHADOW_COLOR = 0x000000;
const ROLE_SHADOW_ALPHA = 0.4; // = SHADOW_PANEL "rgba(0,0,0,0.4)"
const ROLE_SHADOW_OFFSET_PX = 4;

export interface RoleView {
  /** Actualiza el estado visual del tile contra el snapshot actual (sin tween). H4 spec §2.4 — ya
   *  NO actualiza ningún `Text` (retirado, ver abajo); solo lógica que afecta al `Rectangle` en sí
   *  (ej. `SCENARIO_ALERT_COLOR`) sigue viviendo aquí. Nunca destruye/recrea el Rectangle de rol. */
  update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void;
}

function createRoleTile(
  scene: Phaser.Scene,
  position: { x: number; y: number },
  color: number,
  name: string,
): Phaser.GameObjects.Rectangle {
  const { width, height } = ROLE_SIZE;

  // Sombra + GeometryMask redondeado + borde temático (`--rule`) — helper compartido con
  // `nucleo-table-view.ts` (`rounded-frame.ts`, extraído en review post-marco-redondeado). El
  // `Rectangle` devuelto es EXACTAMENTE el mismo tipo/comportamiento de siempre (mismo
  // fillColor/setName/setInteractive/setData, spec §1.1 y `role-view.test.ts`); el borde/sombra
  // decorativos NUNCA reciben `targetId` (targeting-highlight-view.ts los ignora al buscar por
  // `getData('targetId')`), y su glow de targeting vive en un `Graphics` propio con `setDepth`
  // explícito, así que el orden de creación aquí ya no compite con él (ver comentario arriba).
  const rect = createRoundedFrameRectangle(scene, {
    x: position.x,
    y: position.y,
    width,
    height,
    fillColor: color,
    radius: ROLE_RADIUS_PX,
    borderColor: ROLE_BORDER_COLOR,
    borderWidthPx: ROLE_BORDER_WIDTH_PX,
    shadowColor: ROLE_SHADOW_COLOR,
    shadowAlpha: ROLE_SHADOW_ALPHA, // = SHADOW_PANEL "rgba(0,0,0,0.4)" (sin blur real, offset + alpha baja)
    shadowOffsetPx: ROLE_SHADOW_OFFSET_PX,
  });
  rect.setName(name);
  rect.setInteractive().setData('targetId', name);

  return rect;
}

/** Crea (una única vez) el Rectangle de rol del Líder, nombrado `FOCUS_ID_LEADER` (`setName`) y con
 *  `data.targetId = FOCUS_ID_LEADER` (spec §1.1). H4 spec §2.4 — el `Text` de estado (Daño/Escudo/
 *  Energía/Nivel) se retira de Phaser: migrado a `CombatBoardOverlay.tsx` (apps/shell, capa HTML
 *  sincronizada), texto de lectura de estado que nunca participaba en tweens. */
export function createLeaderRoleView(scene: Phaser.Scene): RoleView {
  createRoleTile(scene, LEADER_POSITION, LEADER_COLOR, FOCUS_ID_LEADER);

  return {
    update(): void {
      // Sin-op deliberado — el tile del Líder no cambia de color por estado (a diferencia del
      // Escenario, ver `createScenarioRoleView`). Se mantiene el método `update()` por simetría de
      // contrato `RoleView` y porque `board-view.ts` llama a los 3 roles uniformemente.
    },
  };
}

/** Crea (una única vez) el Rectangle de rol del Enemigo, nombrado `FOCUS_ID_ENEMY`. */
export function createEnemyRoleView(scene: Phaser.Scene): RoleView {
  createRoleTile(scene, ENEMY_POSITION, ENEMY_COLOR, FOCUS_ID_ENEMY);

  return {
    update(): void {
      // Sin-op deliberado — ver `createLeaderRoleView`.
    },
  };
}

/** Crea (una única vez) el Rectangle de rol del Escenario, nombrado `FOCUS_ID_SCENARIO`. Resaltado
 *  persistente de umbral de Trama (H2.11): cambia `fillColor` del tile a `SCENARIO_ALERT_COLOR`
 *  mientras `scenarioPlot >= scenarioPlotDefeatThreshold`, evaluado en cada `update()` de forma
 *  idempotente (spec §1.9). Esta lógica SÍ se queda en Phaser (afecta al Rectangle, no es texto). */
export function createScenarioRoleView(scene: Phaser.Scene): RoleView {
  const rect = createRoleTile(scene, SCENARIO_POSITION, SCENARIO_COLOR, FOCUS_ID_SCENARIO);

  return {
    update(snapshot: CombatStateSnapshot, ctx: BoardViewContext): void {
      const atThreshold = snapshot.scenarioPlot >= ctx.scenarioPlotDefeatThreshold;
      rect.setFillStyle(atThreshold ? SCENARIO_ALERT_COLOR : SCENARIO_COLOR); // NUEVO H2.11
    },
  };
}
