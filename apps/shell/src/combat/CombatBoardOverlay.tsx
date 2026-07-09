import type { ReactNode } from 'react';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext, GestureCommandTranslatorHandle } from '@collector/combat-scene';
import {
  COMBAT_SCENE_VIEWPORT,
  LEADER_POSITION,
  ENEMY_POSITION,
  SCENARIO_POSITION,
  PANEL_ZONES,
  LEADER_ABILITIES_ROW_Y,
  ENEMY_ABILITIES_ROW_Y,
} from '@collector/combat-scene';
import {
  COLOR_DANGER,
  COLOR_FOIL,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  SPACING,
  TYPE,
} from '../ui/design-tokens';
import type { PhaserViewportTransform } from './use-phaser-viewport-transform';
import { HandCardRow } from './card/HandCardRow';
import { AbilityRow } from './card/AbilityRow';
import { EnemyDramaturgiaCardSlot } from './card/EnemyDramaturgiaCardSlot';

// H4 spec §2 — mismo offset que `role-view.ts` usaba para su `Text` de estado (retirado de Phaser,
// migrado aquí), para que la posición visual de la línea de rol no cambie respecto a la versión
// anterior en Phaser.
const ROLE_TEXT_OFFSET_Y = 120;
const LOW_HEALTH_RATIO = 0.3; // decisions.md/H4 spec §4.3 — umbral de "vida baja" para --danger

export interface CombatBoardOverlayProps {
  readonly snapshot: CombatStateSnapshot;
  readonly ctx: BoardViewContext;
  readonly transform: PhaserViewportTransform;
  readonly leaderName: string;
  readonly enemyName?: string;
  readonly scenarioName?: string;
  /** NUEVO H4 spec §1/§2/§3/§6.1 — `null` mientras `CombatScene` no ha emitido `READY` todavía
   *  (mismo ciclo de vida que `boardContext`). Con `gestureHandle` presente se montan `HandCardRow`/
   *  `AbilityRow` (interactivos); sin él, el overlay sigue pintando las líneas de rol/etiquetas de
   *  zona igual que antes, pero sin mano ni habilidades interactivas todavía. */
  readonly gestureHandle: GestureCommandTranslatorHandle | null;
}

/**
 * H4 spec §2/§4.2 — capa HTML superpuesta al canvas de Phaser, sincronizada vía `transform`
 * (`usePhaserViewportTransform`). Pinta SOLO el texto de "lectura de estado" que nunca participa en
 * tweens/juice: las 3 líneas de rol (Líder/Enemigo/Escenario, antes en `role-view.ts`) y las
 * etiquetas de las 7 zonas de panel (antes en `panel-view.ts`). Todo lo demás (pips de dado, coste de
 * carta, cooldowns, HP de secuaz/aliado, banner de turno) se queda en Phaser — están co-localizados
 * con un sprite que SÍ se anima (spec §2.2).
 *
 * `pointer-events: none` en el contenedor — esta capa es puramente de lectura, nunca intercepta el
 * gesto real que sigue viviendo en el canvas de abajo.
 */
export function CombatBoardOverlay({
  snapshot,
  ctx,
  transform,
  leaderName,
  enemyName,
  scenarioName,
  gestureHandle,
}: CombatBoardOverlayProps): JSX.Element {
  const leaderRemainingRatio =
    (ctx.leaderMaxHealth - snapshot.leaderDamage) / Math.max(ctx.leaderMaxHealth, 1);
  const isLeaderLowHealth = leaderRemainingRatio < LOW_HEALTH_RATIO;
  const isScenarioAtThreshold = snapshot.scenarioPlot >= ctx.scenarioPlotDefeatThreshold;

  // NUEVO H4 spec §3.3 — resuelve `snapshot.enemyActiveDramaturgiaCardId` a sus datos completos
  // contra `ctx.enemyDramaturgiaDeck` (resuelto una vez en `build-combat-setup.ts`).
  const activeDramaturgiaCard = snapshot.enemyActiveDramaturgiaCardId
    ? (ctx.enemyDramaturgiaDeck.find((c) => c.dramaturgiaCardId === snapshot.enemyActiveDramaturgiaCardId) ?? null)
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: COMBAT_SCENE_VIEWPORT.width,
        height: COMBAT_SCENE_VIEWPORT.height,
        transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
      }}
    >
      {PANEL_ZONES.map((zone) => (
        <span
          key={zone.id}
          style={{
            ...TYPE.labelUpper,
            position: 'absolute',
            left: zone.x - zone.width / 2 + 12,
            top: zone.y - zone.height / 2 + 8,
            color: COLOR_TEXT_SECONDARY,
          }}
        >
          {zone.label}
        </span>
      ))}

      <RoleBlock
        x={LEADER_POSITION.x}
        y={LEADER_POSITION.y + ROLE_TEXT_OFFSET_Y}
        label="Líder"
        name={leaderName}
      >
        <span style={{ color: isLeaderLowHealth ? COLOR_DANGER : COLOR_TEXT_PRIMARY }}>
          ♥ {snapshot.leaderDamage}/{ctx.leaderMaxHealth}
        </span>
        <span>🛡 {snapshot.leaderShield}</span>
        <span>⚡ {snapshot.leaderEnergy}</span>
        <span style={{ color: COLOR_FOIL }}>✦ Nivel {snapshot.leaderState.level}</span>
      </RoleBlock>

      <RoleBlock
        x={ENEMY_POSITION.x}
        y={ENEMY_POSITION.y + ROLE_TEXT_OFFSET_Y}
        label="Enemigo"
        name={enemyName}
      >
        <span>
          ♥ {snapshot.enemyDamage}/{ctx.enemyMaxHealth}
        </span>
        <span>
          Fase {snapshot.enemyPhase.phaseNumber}/{snapshot.enemyPhase.totalPhases}
        </span>
      </RoleBlock>

      <RoleBlock
        x={SCENARIO_POSITION.x}
        y={SCENARIO_POSITION.y + ROLE_TEXT_OFFSET_Y}
        label="Escenario"
        name={scenarioName}
      >
        <span style={{ color: isScenarioAtThreshold ? COLOR_DANGER : COLOR_TEXT_PRIMARY }}>
          Trama {snapshot.scenarioPlot}/{ctx.scenarioPlotDefeatThreshold}
        </span>
        <span>
          Fase {snapshot.scenarioPhase.phaseNumber}/{snapshot.scenarioPhase.totalPhases}
        </span>
      </RoleBlock>

      {/* NUEVO H4 spec §3.3 — carta de Dramaturgia activa del Enemigo, `size="featured"`. */}
      <EnemyDramaturgiaCardSlot activeCard={activeDramaturgiaCard} />

      {/* NUEVO H4 spec §1/§4/§6 — mano del Líder, sustituye `card-hand-view.ts` (Phaser). */}
      {gestureHandle && <HandCardRow snapshot={snapshot} ctx={ctx} gestureHandle={gestureHandle} />}

      {/* NUEVO H4 spec §2/§6 — habilidades del Líder (interactivas) y del Enemigo (informativas),
          sustituye `ability-cooldown-view.ts` (Phaser). */}
      <AbilityRow
        snapshot={snapshot}
        abilities={ctx.leaderAbilities}
        side="LEADER"
        rowY={LEADER_ABILITIES_ROW_Y}
        interactive={gestureHandle !== null}
        {...(gestureHandle ? { gestureHandle } : {})}
      />
      <AbilityRow
        snapshot={snapshot}
        abilities={ctx.enemyAbilities}
        side="ENEMY"
        rowY={ENEMY_ABILITIES_ROW_Y}
        interactive={false}
      />
    </div>
  );
}

interface RoleBlockProps {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly name?: string | undefined;
  readonly children: ReactNode;
}

/** H4 spec §4.3 — bloque de rol: etiqueta (`TYPE.labelUpper`), nombre (`TYPE.displaySm`, Staatliches)
 *  y fila de datos (`TYPE.dataMd`, JetBrains Mono con `tabular-nums`) en chips separados por `gap`. */
function RoleBlock({ x, y, label, name, children }: RoleBlockProps): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: SPACING.xs,
        textAlign: 'center',
      }}
    >
      <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>{label}</span>
      {name && <span style={{ ...TYPE.displaySm, color: COLOR_TEXT_PRIMARY }}>{name}</span>}
      <div style={{ display: 'flex', gap: SPACING.md, ...TYPE.dataMd, color: COLOR_TEXT_PRIMARY }}>
        {children}
      </div>
    </div>
  );
}
