import { useRef, useState, type ReactNode } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext, GestureCommandTranslatorHandle, TargetingPrompt } from '@collector/combat-scene';
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
  COLOR_OVERLAY,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  RADIUS_PANEL,
  SPACING,
  TYPE,
} from '../ui/design-tokens';
import type { PhaserViewportTransform } from './use-phaser-viewport-transform';
import { HandCardRow } from './card/HandCardRow';
import { AbilityRow } from './card/AbilityRow';
import { AbilityTile, LONG_PRESS_MS, type AbilityTileData } from './card/AbilityTile';
import { EnemyDramaturgiaCardSlot } from './card/EnemyDramaturgiaCardSlot';
import { MinionRow } from './card/MinionRow';
import { AllyRow } from './card/AllyRow';
import { CharacterSheetPreview } from './card/CharacterSheetPreview';
import { SideActionRail } from './SideActionRail';

// H4 spec §2 — mismo offset que `role-view.ts` usaba para su `Text` de estado (retirado de Phaser,
// migrado aquí), para que la posición visual de la línea de rol no cambie respecto a la versión
// anterior en Phaser.
// H5.1 spec §2.3 — escalado proporcionalmente (140/200 = 0.7) tras el tile compacto de rol
// (`role-view.ts` `ROLE_SIZE` 200→140): antes 120, ahora 84. Duplicado 1:1 documentado contra
// `board-layout.ts` (`COMPACT_ROLE_HUD_TEXT_OFFSET_PX`, privado a ese módulo) — mismo criterio de
// aislamiento que el resto de constantes duplicadas del proyecto (evita una dependencia cruzada
// view-a-view solo por un número).
const ROLE_TEXT_OFFSET_Y = 84;
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
  /** NUEVO H4.x — targeting vigente, consumido por `MinionRow` para resolver el highlight
   *  `selected` de un Secuaz que sea objetivo válido ahora mismo. */
  readonly targetingPrompt: TargetingPrompt;
  /** NUEVO H5.5 corrección 2026-07-13 §4/§6 — necesario para que `SideActionRail` (montado aquí,
   *  hermano de `AbilityRow`/`MinionRow`/`AllyRow`) pueda despachar `GENERATE_ENERGY`/`DRAW_CARD`
   *  directamente, mismo patrón que `CombatHud` ya recibe `bridge` desde H3.5. */
  readonly bridge: CombatBridge;
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
  targetingPrompt,
  bridge,
}: CombatBoardOverlayProps): JSX.Element {
  const leaderRemainingRatio =
    (ctx.leaderMaxHealth - snapshot.leaderDamage) / Math.max(ctx.leaderMaxHealth, 1);
  const isLeaderLowHealth = leaderRemainingRatio < LOW_HEALTH_RATIO;
  const isScenarioAtThreshold = snapshot.scenarioPlot >= ctx.scenarioPlotDefeatThreshold;

  // FIX Reviewer (ficha ampliada del Líder se abría fuera del viewport) — la ficha ampliada
  // (`CharacterSheetPreview`) deja de anclarse como popover relativo al tile que la abre (`top: 100%`
  // fijo, `CharacterPanel` más abajo). Con `LEADER_POSITION.y` = 1676 dentro de un viewport virtual de
  // 1080×1920, ese anclaje empujaba el popup muy por debajo de los 1920px de alto disponibles,
  // recortado por `overflow: hidden` de `.combat-screen-root` — el caso de uso principal (el jugador
  // consultando SU PROPIO Líder) quedaba prácticamente inutilizable. Se sustituye por un modal
  // centrado en el viewport real (mismo patrón ya usado por `TurnStartModal`/`RunStartModal`:
  // `position: fixed`, overlay + panel centrado), que no depende de la posición del tile que lo abrió
  // y por tanto es correcto para CUALQUIER tile, incluidos casos futuros cerca de cualquier borde.
  // El estado de qué lado está abierto se levanta aquí (en vez de vivir dentro de `CharacterPanel`)
  // para poder renderizar el modal como HERMANO del `<div>` con `transform` de más abajo — ese
  // `transform` crea un nuevo "containing block" para `position: fixed` (spec CSS), así que un modal
  // `fixed` anidado DENTRO de él dejaría de posicionarse contra el viewport real.
  const [openSheet, setOpenSheet] = useState<'LEADER' | 'ENEMY' | null>(null);

  // NUEVO H4 spec §3.3 — resuelve `snapshot.enemyActiveDramaturgiaCardId` a sus datos completos
  // contra `ctx.enemyDramaturgiaDeck` (resuelto una vez en `build-combat-setup.ts`).
  const activeDramaturgiaCard = snapshot.enemyActiveDramaturgiaCardId
    ? (ctx.enemyDramaturgiaDeck.find((c) => c.dramaturgiaCardId === snapshot.enemyActiveDramaturgiaCardId) ?? null)
    : null;

  // FIX Reviewer — props ya resueltos de la ficha ampliada de cada lado, computados una vez aquí
  // (en vez de recomputarse dentro de `CharacterPanel`) para poder pasárselos también al modal
  // levantado a este nivel sin duplicar la construcción de `abilityTileData`/`extraStats`.
  const leaderSheetProps = {
    name: leaderName,
    side: 'LEADER' as const,
    life: { current: ctx.leaderMaxHealth - snapshot.leaderDamage, max: ctx.leaderMaxHealth },
    extraStats: [
      { label: '🛡', value: String(snapshot.leaderShield) },
      { label: '⚡', value: String(snapshot.leaderEnergy) },
      { label: '✦Nivel', value: String(snapshot.leaderState.level) },
    ],
    abilities: buildAbilityTileData(ctx.leaderAbilities, snapshot.cooldowns),
  };
  const enemySheetProps = {
    name: enemyName ?? 'Enemigo',
    side: 'ENEMY' as const,
    life: { current: ctx.enemyMaxHealth - snapshot.enemyDamage, max: ctx.enemyMaxHealth },
    extraStats: [
      { label: 'Fase', value: `${snapshot.enemyPhase.phaseNumber}/${snapshot.enemyPhase.totalPhases}` },
    ],
    abilities: buildAbilityTileData(ctx.enemyAbilities, snapshot.cooldowns),
  };
  const activeSheetProps = openSheet === 'LEADER' ? leaderSheetProps : openSheet === 'ENEMY' ? enemySheetProps : null;

  return (
    <>
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

      {/* NUEVO H4.x — envuelve RoleBlock en un panel con hover/long-press que abre
          `CharacterSheetPreview` (ficha ampliada, §3.2b). `AbilityRow` del mismo lado (más abajo)
          ya se pinta justo debajo (`LEADER_ABILITIES_ROW_Y`/`ENEMY_ABILITIES_ROW_Y`), quedando
          visualmente adyacente — el pedido de "habilidades embebidas" (§3.2a) es puramente de
          maquetación, cero componentes nuevos ahí. */}
      <CharacterPanel
        x={LEADER_POSITION.x}
        y={LEADER_POSITION.y + ROLE_TEXT_OFFSET_Y}
        label="Líder"
        name={leaderName}
        isOpen={openSheet === 'LEADER'}
        onOpenChange={(open) => setOpenSheet((cur) => (open ? 'LEADER' : cur === 'LEADER' ? null : cur))}
        denseGap
      >
        <span style={{ color: isLeaderLowHealth ? COLOR_DANGER : COLOR_TEXT_PRIMARY }}>
          ♥ {snapshot.leaderDamage}/{ctx.leaderMaxHealth}
        </span>
        <span>🛡 {snapshot.leaderShield}</span>
        <span>⚡ {snapshot.leaderEnergy}</span>
        <span style={{ color: COLOR_FOIL }}>✦ Nivel {snapshot.leaderState.level}</span>
      </CharacterPanel>

      <CharacterPanel
        x={ENEMY_POSITION.x}
        y={ENEMY_POSITION.y + ROLE_TEXT_OFFSET_Y}
        label="Enemigo"
        name={enemyName}
        isOpen={openSheet === 'ENEMY'}
        onOpenChange={(open) => setOpenSheet((cur) => (open ? 'ENEMY' : cur === 'ENEMY' ? null : cur))}
      >
        <span>
          ♥ {snapshot.enemyDamage}/{ctx.enemyMaxHealth}
        </span>
        <span>
          Fase {snapshot.enemyPhase.phaseNumber}/{snapshot.enemyPhase.totalPhases}
        </span>
      </CharacterPanel>

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

      {/* NUEVO H4.x — Secuaces/Aliados en mesa, sustituye `minions-view.ts`/`allies-view.ts`
          (Phaser, eliminados). Nombre legible vía NameLookup (fix del bug de ID crudo). */}
      <MinionRow snapshot={snapshot} ctx={ctx} gestureHandle={gestureHandle} targetingPrompt={targetingPrompt} />
      <AllyRow snapshot={snapshot} ctx={ctx} />

      {/* NUEVO H4 spec §1/§4/§6 — mano del Líder, sustituye `card-hand-view.ts` (Phaser).
          H5.5 corrección 2026-07-13 §4 — REVIERTE el gating por `stage` (H5.2 original): la mano
          vuelve a estar SIEMPRE visible/interactiva durante el turno del jugador, tap directo en
          una carta dispara el comando, exactamente el criterio de H4 antes de H5.2/H5.5. */}
      {gestureHandle && (
        <HandCardRow snapshot={snapshot} ctx={ctx} gestureHandle={gestureHandle} />
      )}

      {/* NUEVO H4 spec §2/§6 — habilidades del Líder (interactivas) y del Enemigo (informativas),
          sustituye `ability-cooldown-view.ts` (Phaser). H5.5 corrección 2026-07-13 §4 — habilidades
          del Líder vuelven a estar SIEMPRE visibles/interactivas (sin gating por `stage`), mismo
          criterio que HandCardRow arriba. Habilidades del Enemigo SIN cambio: siempre visibles,
          nunca interactivas. */}
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

      {/* NUEVO H5.7 §3.3 — Generar Energía/Robar Carta, discretos, anclados al margen lateral de la
          mesa de Núcleos (decisions.md 2026-07-13 punto 2: sin objetivo visual propio en mesa). */}
      <SideActionRail bridge={bridge} snapshot={snapshot} leaderAbilities={ctx.leaderAbilities} />
    </div>

    {/* FIX Reviewer — modal centrado en el viewport REAL, renderizado como HERMANO del `<div>` con
        `transform` de arriba (no anidado dentro), para que `position: fixed` se resuelva contra el
        viewport del navegador y no contra el "containing block" que ese `transform` crea. Mismo
        patrón que `TurnStartModal`/`RunStartModal` (overlay + panel centrado). Sustituye al popover
        `top: 100%` anterior, que para el Líder (`y` ~1796 de 1920 de alto virtual) se abría casi
        totalmente fuera de pantalla. */}
    {activeSheetProps && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLOR_OVERLAY,
          padding: SPACING.md,
          zIndex: 30, // por encima de TurnStartModal (20) — es una capa de LECTURA transitoria
                      // (hover/long-press), no debería quedar nunca detrás de otro modal de bloqueo.
          pointerEvents: 'none', // capa de solo lectura: nunca bloquea el gesto real del tablero de
                                  // debajo; se cierra por el mismo hover-leave/touch-end que la abrió.
        }}
      >
        <CharacterSheetPreview
          name={activeSheetProps.name}
          side={activeSheetProps.side}
          life={activeSheetProps.life}
          extraStats={activeSheetProps.extraStats}
          abilities={activeSheetProps.abilities}
        />
      </div>
    )}
    </>
  );
}

function buildAbilityTileData(
  abilities: readonly {
    readonly abilityId: string;
    readonly name: string;
    readonly coreCost: AbilityTileData['coreCost'];
    readonly baseCooldown: number;
    readonly ruleText?: string;
  }[],
  cooldowns: CombatStateSnapshot['cooldowns'],
): AbilityTileData[] {
  return abilities.map((a) => ({
    abilityId: a.abilityId,
    name: a.name,
    coreCost: a.coreCost,
    baseCooldown: a.baseCooldown,
    remaining: cooldowns.find((c) => c.abilityId === a.abilityId)?.remaining ?? a.baseCooldown,
    ...(a.ruleText !== undefined ? { ruleText: a.ruleText } : {}),
  }));
}

interface RoleBlockProps {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly name?: string | undefined;
  readonly children: ReactNode;
  /** NUEVO H4.x — cuando es `true`, renderiza SIN su propio `position: absolute` (el padre,
   *  `CharacterPanel`, ya se encarga de posicionar el bloque completo). */
  readonly embedded?: boolean;
  /** FIX Reviewer post-E5 (bug real 2) — cuando es `true`, elimina el `gap` vertical entre
   *  etiqueta/nombre/fila de datos (en vez de `SPACING.xs`). Necesario ÚNICAMENTE para el panel del
   *  Líder: el bump de fuente de `TYPE.labelUpper`/`TYPE.dataMd` (H5.8 §2.2, 12→14px/15→17px) creció
   *  el alto real renderizado de `RoleBlock` lo suficiente para que el panel del Líder (el más abajo
   *  de los 3, más cerca del borde inferior del viewport) cruzara el margen mínimo disponible en
   *  viewport 1400×900 (medido con el e2e real: overflow de ~1.46px). Escogido sobre alternativas (ver
   *  discusión en `docs/specs/H5.8_layout_desktop_legibilidad.md` / resumen del fix): NO se toca
   *  `board-layout.ts` (el margen de 32px que reserva ya es para la fila de habilidades, un elemento
   *  DISTINTO — cambiarlo no habría movido ni un píxel el overflow real, que viene del alto propio de
   *  `RoleBlock`, gobernado por CSS/fuentes, no por las posiciones Y de `board-layout.ts`), y NO se
   *  revierte el bump de fuente (perdería la mejora de legibilidad de H5.8 para el Líder, el bloque más
   *  consultado). Solo el panel del Líder usa `denseGap` — Enemigo/Escenario conservan el gap normal,
   *  no tienen el mismo problema de margen. */
  readonly denseGap?: boolean;
}

/** H4 spec §4.3 — bloque de rol: etiqueta (`TYPE.labelUpper`), nombre (`TYPE.displaySm`, Staatliches)
 *  y fila de datos (`TYPE.dataMd`, JetBrains Mono con `tabular-nums`) en chips separados por `gap`. */
function RoleBlock({ x, y, label, name, children, embedded = false, denseGap = false }: RoleBlockProps): JSX.Element {
  return (
    <div
      style={{
        ...(embedded ? {} : { position: 'absolute', left: x, top: y, transform: 'translateX(-50%)' }),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: denseGap ? 0 : SPACING.xs,
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

interface CharacterPanelProps extends RoleBlockProps {
  /** FIX Reviewer — la ficha ampliada (`CharacterSheetPreview`) ya no se renderiza dentro de este
   *  componente (ver comentario en `CombatBoardOverlay` sobre por qué se levantó al nivel superior).
   *  `CharacterPanel` solo necesita saber SI está abierto (para el borde foil) y notificar cambios de
   *  hover/long-press hacia arriba. */
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** NUEVO H4.x — agrupa `RoleBlock` en un panel visual común (borde `--rule`, mismo lenguaje que
 *  `CardTile`) y dispara `CharacterSheetPreview` (ficha ampliada) al mantener pulsado (400ms,
 *  `LONG_PRESS_MS` de `AbilityTile.tsx`, reutilizado) o al pasar el cursor (hover, desktop) sobre el
 *  tile compacto — spec H4_targeting_habilidades_y_ficha_personaje.md §3.2. */
function CharacterPanel({ x, y, label, name, children, isOpen, onOpenChange, denseGap = false }: CharacterPanelProps): JSX.Element {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTouchStart(): void {
    longPressTimer.current = setTimeout(() => onOpenChange(true), LONG_PRESS_MS);
  }
  function handleTouchEnd(): void {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    onOpenChange(false);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translateX(-50%)',
        padding: SPACING.xs,
        borderRadius: RADIUS_PANEL,
        border: `1px solid ${isOpen ? COLOR_FOIL : COLOR_RULE}`, // agrupa visualmente RoleBlock+AbilityRow (§3.2a), foil en hover/long-press
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <RoleBlock x={0} y={0} label={label} name={name} embedded denseGap={denseGap}>
        {children}
      </RoleBlock>
    </div>
  );
}
