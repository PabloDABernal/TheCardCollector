# H4 — Flujo de turno (popup de paso previo) + anuncio de acción del Enemigo + Log de combate

> **Complementa** `docs/specs/H4_diseno_real_ui.md` (tokens, `CombatBoardOverlay`, `turnBanner`) y
> `docs/specs/H4_componente_carta.md` (`CardTile`/`AbilityTile`, `enemyActiveDramaturgiaCardId` ya
> añadido al snapshot, `TargetingPromptBanner`, patrón de overlay HTML). No sustituye nada de eso —
> reutiliza tokens (`COLOR_BINDER/COLOR_FOIL/COLOR_RULE/COLOR_SUCCESS/COLOR_DANGER`, `TYPE`,
> `SPACING`, `RADIUS_PANEL/RADIUS_CHIP`, `SHADOW_MODAL/SHADOW_PANEL`), el patrón de modal de
> `RunStartModal.tsx`, el patrón de hook+`subscribeHudEvents` de `use-combat-snapshot.ts`, y
> `NameLookup` (`packages/domain/catalog/src/name-lookup.ts`).
>
> Origen: feedback de UX del Director Creativo tras ver la build en producción (`main`, `ecf0c94`)
> sobre 3 puntos — (1) paso previo del turno demasiado ignorable, debe ser un popup obligatorio; (2)
> el banner de turno del Enemigo no dice qué hizo; (3) falta un log de combate persistente. Sin
> cambios de mecánicas — mismas reglas de `decisions.md` ("paso previo gratis + 2 acciones"), solo
> presentación + 2 extensiones aditivas de datos de dominio (ver §4).

---

## 0. Diagnóstico y decisión de arquitectura conjunta

Los 3 encargos comparten una raíz técnica: hoy solo existe un canal de **juice de canvas**
(`subscribeSceneEvents` → `EffectsDirector` → `JUICE_CONFIG`) para reaccionar a `CombatEvent`, sin
ningún canal de **texto legible persistente** en `apps/shell`. La solución de los 3 puntos es la
misma pieza de infraestructura reutilizada tres veces:

- **Punto 1** (`TurnStartModal`) no necesita el stream de eventos — solo lee `CombatStateSnapshot`
  (`leaderFreeStep.takenThisTurn`, ya expuesto) y reutiliza los mismos comandos que
  `CombatHud` ya despacha (`DRAW_OR_GENERATE`).
- **Punto 3** (`CombatLogPanel`) sí necesita un stream de eventos de dominio traducidos a texto —
  nuevo hook `useCombatLog`, suscrito directamente a `bridge.subscribeHudEvents` (mismo canal que
  `use-combat-snapshot.ts`, canal independiente del de juice/Phaser).
- **Punto 2** (qué hizo el Enemigo) **se resuelve reutilizando el propio `CombatLogPanel`**, no con
  una pieza nueva: la franja "peek" del log (siempre visible, ver §3.2) muestra la línea más reciente
  en todo momento, incluida la del Enemigo apenas ocurre. Se añade solo un realce visual (pulso
  `--danger`) cuando la entrada nueva es de acción del Enemigo, para que el jugador la note sin tener
  que abrir el panel. El `turnBanner` de Phaser (`packages/combat-scene/src/juice/recipes/turn-banner.ts`)
  **no cambia** — sigue anunciando solo DE QUIÉN es el turno; explicar QUÉ hizo pasa a ser
  responsabilidad exclusiva del log, evitando duplicar el mismo texto en dos sistemas de render
  (Phaser canvas vs. HTML) y respetando el criterio ya cerrado en `H4_diseno_real_ui.md` §2.2 de no
  mezclar animación de pantalla completa con lectura de texto denso.

---

## 1. `TurnStartModal`

Nuevo archivo `apps/shell/src/combat/TurnStartModal.tsx`.

### 1.1 Condición de aparición

```ts
const shouldShow =
  snapshot.status === 'IN_PROGRESS' &&
  snapshot.turn.turnOwner === 'LEADER' &&
  !snapshot.leaderFreeStep.takenThisTurn &&
  !dismissedForTurn.has(snapshot.turn.turnNumber); // ver §1.4
```

`snapshot.leaderFreeStep.takenThisTurn` es el campo exacto ya definido en
`packages/domain/combat/src/types/turn-phase.ts` (`LeaderFreeStepState = { readonly takenThisTurn: boolean }`)
y expuesto en `CombatStateSnapshot.leaderFreeStep` — no requiere ningún cambio de dominio.

### 1.2 Contrato de props

```tsx
export interface TurnStartModalProps {
  readonly snapshot: CombatStateSnapshot;
  readonly bridge: CombatBridge;
}

export function TurnStartModal(props: TurnStartModalProps): JSX.Element | null;
```

Se monta en `CombatScreen.tsx`, dentro de `CombatHudOverlay`, al mismo nivel que
`CombatResultModal` (ambos son overlays de pantalla completa condicionales — mismo patrón, ver §5
para el punto de montaje exacto). No recibe `onClose`: gestiona su propio ciclo de vida
completamente a partir de `snapshot` + `bridge`, igual que `CombatResultModal` ya hace.

### 1.3 Reutilización de disponibilidad — extrae la lógica ya duplicada en `CombatHud`

`CombatHud.tsx` ya calcula `canFreeDraw`/`canFreeGenerate` (handFull/deckEmpty/energyAtMax). Se
extrae a un helper puro nuevo, reutilizado por ambos componentes (evita una tercera copia de la
misma lógica, mismo criterio que `disabledReasonFor`):

```ts
// apps/shell/src/combat/free-step-availability.ts (NUEVO)
export interface FreeStepAvailability {
  readonly available: boolean; // isLeaderTurn && !takenThisTurn
  readonly canDraw: boolean;   // available && !handFull && !deckEmpty
  readonly canGenerate: boolean; // available && !energyAtMax
  readonly handFull: boolean;
  readonly deckEmpty: boolean;
  readonly energyAtMax: boolean;
}

export function freeStepAvailabilityFor(snapshot: CombatStateSnapshot): FreeStepAvailability;
```

`CombatHud.tsx` se modifica para calcular `freeStepAvailable`/`canFreeDraw`/`canFreeGenerate` vía
esta función en vez de inline (cambio mecánico, sin alterar su JSX). `TurnStartModal` la reutiliza
tal cual.

### 1.4 Comportamiento de los 3 botones

```tsx
<button onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' })} disabled={!avail.canDraw}>
  Robar carta
</button>
<button onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' })} disabled={!avail.canGenerate}>
  Generar energía
</button>
<button onClick={() => setDismissedForTurn((s) => new Set(s).add(snapshot.turn.turnNumber))}>
  Ahora no
</button>
```

- **"Robar carta" / "Generar energía"**: despachan el mismo comando `DRAW_OR_GENERATE` que hoy usa
  `CombatHud` para el paso previo — **sin comando nuevo**. Al resolverse, el motor emite
  `FREE_STEP_RESOLVED`/`LEADER_HAND_CARD_DRAWN`/`ENERGY_GENERATED` (ya existentes), lo que actualiza
  `snapshot.leaderFreeStep.takenThisTurn` a `true` y el modal se cierra automáticamente por la
  condición de §1.1 (no hace falta un `onClose` explícito — el propio snapshot lo apaga).
- **"Ahora no"**: NO despacha ningún comando (no existe ni se necesita un comando `SKIP_FREE_STEP` —
  las reglas de `decisions.md` ya permiten no usar el paso previo, "si ya está al tope... no ocurre
  nada" implica que el paso es opcional por diseño). Solo registra `turnNumber` actual en un
  `Set<number>` de estado local (`useState`), para que el modal no reaparezca ESTE turno. El paso
  previo sigue disponible el resto del turno a través de la franja punteada que `CombatHud` ya
  muestra ("Paso previo (gratis)", sin cambios) — el jugador puede tomarlo más tarde desde ahí sin
  reabrir el popup. `dismissedForTurn` se resetea implícitamente porque es un `Set` que solo crece
  con turnos ya usados; no necesita limpieza porque `turnNumber` nunca se repite en un combate.
- **Sin clic-fuera-para-cerrar y sin tecla Escape**: a diferencia de `RunStartModal`, el overlay NO
  tiene `onClick` en el fondo. Es la pieza central del encargo del Director ("que no se te olvide") —
  cerrar el modal exige una decisión explícita (una de las 3 acciones), nunca un descarte accidental.

### 1.5 Estructura visual (reutiliza el patrón exacto de `RunStartModal.tsx` §3.2 de `H4_diseno_real_ui.md`)

```tsx
<div style={{
  position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: COLOR_OVERLAY, padding: SPACING.md, zIndex: 20, // por encima de TargetingPromptBanner (5) y CombatHud (4)
}}>
  <div style={{
    background: COLOR_BINDER, border: `1px solid ${COLOR_RULE}`, borderRadius: RADIUS_PANEL,
    boxShadow: SHADOW_MODAL, padding: SPACING.xl, display: 'flex', flexDirection: 'column',
    gap: SPACING.lg, maxWidth: 420, textAlign: 'center',
  }}>
    <h2 style={{ ...TYPE.displayLg, color: COLOR_TEXT_PRIMARY, margin: 0 }}>Tu turno</h2>
    <p style={{ ...TYPE.bodyMd, color: COLOR_TEXT_SECONDARY, margin: 0 }}>
      Antes de tus 2 acciones, elige tu paso previo gratuito.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
      {/* Robar carta / Generar energía — botones grandes, tap target >= MIN_TAP_TARGET_PX,
          estilo `--foil` (única acción primaria de la pantalla, igual criterio que
          "Iniciar combate" de RunStartModal) cuando habilitados */}
    </div>
    <button style={{ ...chipStyle(true), background: 'transparent', alignSelf: 'center' }}>
      Ahora no
    </button>
  </div>
</div>
```

Mockup:

```
┌─────────────────────────────────┐
│         fondo oscurecido          │
│                                    │
│      ┌───────────────────┐        │
│      │      TU TURNO       │        │  ← Staatliches, TYPE.displayLg
│      │  Antes de tus 2      │        │
│      │  acciones, elige tu   │        │
│      │  paso previo gratis.  │        │
│      │                        │        │
│      │  [ Robar carta ]      │  ← --foil, botón grande
│      │  [ Generar energía ]  │  ← --foil, botón grande
│      │                        │        │
│      │     Ahora no           │  ← texto/chip, sin --foil
│      └───────────────────┘        │
└─────────────────────────────────┘
```

---

## 2. Anuncio de la acción del Enemigo — resuelto por el `CombatLogPanel` (§3), sin pieza nueva de Phaser

Confirmado en §0: el `turnBanner` (`packages/combat-scene/src/juice/recipes/turn-banner.ts`) **no se
modifica**. Lo que cierra el punto 2 del encargo es el comportamiento "siempre visible + realce" del
log, especificado en §3.2/§3.4 abajo. Se documenta aquí solo la secuencia temporal para que quede
clara la coordinación entre las 2 piezas:

```
Líder termina turno
  → TURN_ENDED(nextTurnOwner=ENEMY)      → turnBanner Phaser: "Turno del Enemigo" (~700ms)
  → [motor ya resolvió toda la IA de forma síncrona dentro de handleEndTurn, en cola de eventos]
  → DRAMATURGIA_CARD_DRAWN, ABILITY_ACTIVATED, LEADER_DAMAGED, ...  → CombatLogPanel: nuevas líneas,
    la franja peek (§3.2) se actualiza y pulsa en --danger en cada una (mismo dispatch, pero el canal
    HUD del bridge —del que se alimenta el log— entrega estos eventos independientemente del pipeline
    de juice de canvas, así que el texto aparece sin esperar a que termine cada animación de Phaser)
  → TURN_ENDED(nextTurnOwner=LEADER)     → turnBanner Phaser: "Tu turno" (~700ms)
  → TurnStartModal (§1) aparece automáticamente
```

---

## 3. `CombatLogPanel`

### 3.1 `useCombatLog` — hook de traducción de eventos

Nuevo archivo `apps/shell/src/combat/log/use-combat-log.ts`.

```ts
export type CombatLogTone = 'LEADER_ACTION' | 'ENEMY_ACTION' | 'DAMAGE' | 'HEAL' | 'SUMMON' | 'SYSTEM';

export interface CombatLogEntry {
  readonly id: string; // `${turnNumber}-${sequenceInTurn}`, estable para `key` de React
  readonly turnNumber: number;
  readonly text: string;
  readonly tone: CombatLogTone;
}

const MAX_LOG_ENTRIES = 60; // tope de memoria, ~2-3 combates completos de eventos relevantes

/** Se suscribe directamente a `bridge.subscribeHudEvents` (mismo canal que `use-combat-snapshot.ts`,
 *  independiente del canal de juice `subscribeSceneEvents`) — traduce cada `CombatEvent` relevante
 *  (tabla §3.3) a una `CombatLogEntry` y la anexa a una lista acotada. A diferencia de
 *  `use-combat-snapshot.ts`, NO usa `useSyncExternalStore`/microtask-coalescing: aquí SÍ importa
 *  capturar cada evento individual en orden (el log es una lista aditiva, no un snapshot puntual),
 *  así que un `useState` + `useEffect` con suscripción directa es el patrón correcto — coalescer
 *  eventos perdería líneas de log. */
export function useCombatLog(
  bridge: CombatBridge,
  ctx: BoardViewContext,
): readonly CombatLogEntry[];
```

Internamente: `useState<CombatLogEntry[]>([])`, `useEffect` que llama
`bridge.subscribeHudEvents(handleEvent)` una vez (dependencias `[bridge]`), `handleEvent` traduce vía
la tabla de §3.3 (función pura `translateCombatEvent(event, ctx, currentTurnNumber): CombatLogEntry | null`,
`null` = evento no traducible, se ignora) y hace `setEntries((prev) => [...prev, entry].slice(-MAX_LOG_ENTRIES))`.
`currentTurnNumber` se lee de `bridge.getSnapshot().turn.turnNumber` en el momento del evento (lectura
síncrona, sin el problema de `use-combat-snapshot.ts` porque aquí no se compara con un valor cacheado
previo — cada línea de log es un hecho puntual, no un estado a reconciliar).

### 3.2 `CombatLogPanel` — patrón de interacción: franja peek siempre visible + expansión a lista completa

Nuevo archivo `apps/shell/src/combat/log/CombatLogPanel.tsx`.

```tsx
export interface CombatLogPanelProps {
  readonly entries: readonly CombatLogEntry[];
}

export function CombatLogPanel(props: CombatLogPanelProps): JSX.Element;
```

**Decisión de patrón (móvil primero, `decisions.md`): franja "peek" anclada al borde inferior de
`combat-screen-root`, siempre visible, mostrando la ÚLTIMA línea (o últimas 2 en pantallas con
espacio) sin ocupar espacio permanente significativo (~36px de alto) — nunca un panel lateral fijo
(inviable en retrato 9:16, tapa el tablero). Tap/click en cualquier punto de la franja expande un
panel tipo "bottom sheet" con la lista completa, scrollable, que se cierra con el mismo gesto o un
botón `✕`.**

```tsx
function CombatLogPanel({ entries }: CombatLogPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const latest = entries[entries.length - 1];
  const [pulseId, setPulseId] = useState<string | null>(null);

  useEffect(() => {
    if (latest?.tone === 'ENEMY_ACTION') {
      setPulseId(latest.id);
      const t = setTimeout(() => setPulseId(null), 1400); // 1 ciclo de foil-pulse-like, en --danger
      return () => clearTimeout(t);
    }
    return undefined;
  }, [latest?.id, latest?.tone]);

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6 }}>
      {expanded && (
        <div /* bottom sheet */ style={{
          maxHeight: '45vh', overflowY: 'auto', background: COLOR_BINDER,
          borderTop: `2px solid ${COLOR_RULE}`, borderRadius: `${RADIUS_PANEL}px ${RADIUS_PANEL}px 0 0`,
          padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.xs,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>Registro de combate</span>
            <button onClick={() => setExpanded(false)} style={chipStyle(true)}>✕</button>
          </div>
          {/* cronológico, más antigua arriba, más reciente abajo — mismo orden que un chat; se
              autoscrolla al fondo en cada entrada nueva vía ref + `scrollTop = scrollHeight` en un
              efecto sobre `entries.length`, patrón estándar sin librería nueva */}
          {entries.map((e) => (
            <span key={e.id} style={{ ...TYPE.bodySm, color: colorForTone(e.tone) }}>{e.text}</span>
          ))}
        </div>
      )}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%', textAlign: 'left', background: 'rgba(31, 30, 38, 0.88)',
            borderTop: `1px solid ${COLOR_RULE}`, padding: `${SPACING.xs}px ${SPACING.md}px`,
            ...TYPE.bodySm, color: colorForTone(latest?.tone ?? 'SYSTEM'),
            animation: pulseId ? 'log-peek-pulse 1.4s ease-in-out' : undefined,
          }}
        >
          {latest ? latest.text : 'Registro de combate'}
        </button>
      )}
    </div>
  );
}
```

`colorForTone` — helper puro (`apps/shell/src/combat/log/log-tone-color.ts`):

```ts
export function colorForTone(tone: CombatLogTone): string {
  switch (tone) {
    case 'DAMAGE': return COLOR_DANGER;
    case 'HEAL': return COLOR_SUCCESS;
    case 'ENEMY_ACTION': return COLOR_DANGER;
    case 'LEADER_ACTION': return COLOR_SUCCESS;
    case 'SUMMON': return COLOR_FOIL;
    case 'SYSTEM': default: return COLOR_TEXT_SECONDARY;
  }
}
```

`@keyframes log-peek-pulse` — nuevo, co-localizado en `apps/shell/src/combat/log/log.css` (mismo
criterio que `card.css` de `H4_componente_carta.md` §4.3): fondo de la franja parpadea suavemente en
`rgba(209, 73, 91, 0.25)` (`--danger` translúcido) una vez, para llamar la atención sin ser un banner
de pantalla completa.

### 3.3 Tabla de traducción — qué eventos se traducen y con qué plantilla

Cobertura completa del catálogo de `events.ts` (39 variantes). "—" = no se traduce a línea de log
(ruido/no relevante para el jugador, ver justificación por bloque).

| `CombatEvent.type` | ¿Log? | Plantilla / tono |
|---|---|---|
| `CARD_PLAYED` | Sí | `«Juegas «{nameLookup.cardName(cardId)}».»` — `LEADER_ACTION` |
| `ENEMY_DAMAGED` | Sí | `«Infliges {rawAmount + (bonusResolvedValue ?? 0)} de daño al Enemigo.»` — `DAMAGE` |
| `LEADER_DAMAGED` | Sí | `«El Enemigo inflige {appliedDamage > 0 ? appliedDamage : rawAmount} de daño al Líder.»` (+ si `absorbedByShield > 0`: `` ` (Escudo absorbe ${absorbedByShield})` ``) — `DAMAGE` |
| `MINION_DAMAGED` | Sí | `«Infliges {rawAmount} de daño a un Secuaz enemigo{died ? ', que cae derrotado' : ''}.»` — `DAMAGE`. Nota de implementación: usar `«a un Secuaz enemigo»` genérico en el MVP (el evento solo trae `minionInstanceId`, no el nombre — resolverlo a `minionDefinitionId` requeriría cruzar `bridge.getSnapshot().minionsInPlay` en el instante del evento; queda como mejora futura anotada, no bloqueante). |
| `ALLY_DAMAGED` | Sí | `«Tu aliado recibe {rawAmount} de daño{allyDied ? ' y cae' : ''}.»` — `DAMAGE` |
| `ABILITY_ACTIVATED` | Sí | `side==='LEADER'`: `«Activas «{nameLookup.abilityName(abilityId)}».»` (`LEADER_ACTION`) / `side==='ENEMY'`: `«El Enemigo activa «{nameLookup.abilityName(abilityId)}».»` (`ENEMY_ACTION`) |
| `DRAMATURGIA_CARD_DRAWN` | Sí | `«El Enemigo juega «{ctx.enemyDramaturgiaDeck.find(c => c.dramaturgiaCardId === event.cardId)?.name ?? '???'}».»` — `ENEMY_ACTION`. **Requiere Gap A del §4** (el evento hoy no trae `cardId`). |
| `MINION_SUMMONED` | Sí | `«Aparece {nameLookup.minionName(minionDefinitionId)} en mesa.»` — `SUMMON`. **Requiere Gap B del §4.** |
| `MINION_DEFEATED` | Sí | `«{nameLookup.minionName(definitionId)} es derrotado.»` — `SYSTEM` |
| `ALLY_ENTERED_PLAY` | Sí | `«Invocas a tu aliado «{nameLookup.cardName(cardId)}».»` — `LEADER_ACTION` |
| `CONTRATIEMPO_PLAYED` | Sí | `«Juegas el Contratiempo «{nameLookup.cardName(cardId)}», deshaciendo la última acción del Enemigo.»` — `LEADER_ACTION` |
| `LEADER_SHIELD_GAINED` | Sí | `«Ganas {rawAmount} de Escudo.»` — `HEAL` |
| `SCENARIO_PLOT_CHANGED` | Sí | `direction==='INCREASE'`: `«La Trama del Escenario avanza a {scenarioPlotAfter}.»` (`ENEMY_ACTION`) / `direction==='DECREASE'`: `«Reduces la Trama del Escenario a {scenarioPlotAfter}.»` (`LEADER_ACTION`) |
| `PHASE_CHANGED` | Sí | `«{source==='ENEMY' ? 'El Enemigo' : 'El Escenario'} avanza a la fase {toPhaseNumber}.»` — `SYSTEM` |
| `LEADER_LEVELED_UP` | Sí | `«¡El Líder sube al nivel {levelAfter}!»` — `SYSTEM` |
| `TURN_ENDED` | Sí | `«— Turno de {nextTurnOwner === 'LEADER' ? 'Líder' : 'Enemigo'} —»` — `SYSTEM`. Sirve de separador visual entre turnos dentro de la lista completa. |
| `COMBAT_ENDED` | Sí | `outcome==='VICTORY'`: `«¡Combate ganado!»` / si no: `«Combate perdido.»` — `SYSTEM` |
| `NUCLEO_TABLE_REROLLED` | — | Ruido de alta frecuencia sin valor narrativo (relanzado de dados es mecánico, ya visible en el propio tablero). |
| `NUCLEO_DIE_ADDED` / `NUCLEO_DIE_ADD_SKIPPED` | — | Idem. |
| `COOLDOWNS_TICKED` | — | Ocurre cada inicio de turno, sin acción del jugador que explicar. |
| `COMBO_TRIGGERED` | — | Se considera mejora futura (fuera del encargo explícito: "cartas jugadas, habilidades activadas, daño, Secuaces, cambios de turno"); no bloqueante. |
| `DAMAGE_REDIRECT_SET` | — | Configuración silenciosa, sin corresponder a una "acción relevante" narrativa. |
| `MINION_SUMMON_SKIPPED` | — | No-op de mesa llena, sin acción visible. |
| `MINION_ACTION_RESOLVED` / `MINION_ACTION_SKIPPED` | — | Metadato interno de qué Secuaz actuó — el efecto real de esa acción ya se traduce vía el `LEADER_DAMAGED`/`SCENARIO_PLOT_CHANGED`/etc. que se emite en el mismo `dispatch()` por el mecanismo `SPECIAL_ACTION`/`PLANO_ATTACK` (ver comentario del propio evento en `events.ts`) — traducirlo aquí duplicaría la línea. |
| `MINION_PASSIVE_EFFECTS_APPLIED` | — | Ídem — el daño/Trama ya se refleja en `LEADER_DAMAGED`/`SCENARIO_PLOT_CHANGED` del mismo turno (a confirmar contra el motor si emite ambos; si el motor NO emite un evento de daño específico para este caso, promover esta fila a traducible en una iteración posterior — no bloqueante para esta historia). |
| `FREE_STEP_RESOLVED` / `LEADER_HAND_CARD_DRAWN` / `LEADER_HAND_DRAW_SKIPPED` / `ENERGY_GENERATED` / `ENERGY_GENERATE_SKIPPED` | — | Fuera de la lista explícita del Director ("cartas jugadas, habilidades, daño, Secuaces, turno"); robar/generar energía es rutina de cada turno y ensuciaría el log con 1-2 líneas por turno sin aportar tensión narrativa. Reevaluable si QA reporta que su ausencia confunde. |
| `DRAMATURGIA_DECK_RESHUFFLED` | — | Detalle interno de la pila de Dramaturgia, sin relevancia de juego para el jugador. |

---

## 4. Extensiones de datos requeridas (2 gaps, ambos aditivos — mismo criterio de bajo riesgo que
`H4_componente_carta.md` §3.2)

### Gap A — `DRAMATURGIA_CARD_DRAWN` debe incluir el `cardId`

```ts
// packages/domain/combat/src/types/events.ts — MODIFICAR
| {
    readonly type: 'DRAMATURGIA_CARD_DRAWN';
    readonly icon: DramaturgiaCardIcon;
    /** NUEVO H4.y — id de la carta robada, para que el log/UI puedan resolver su nombre real sin
     *  depender de una lectura síncrona de `getSnapshot()` en el listener. */
    readonly cardId: DramaturgiaCardId;
  }
```

Implementación (`combat-engine.ts` línea ~2305, mismo punto donde ya se asigna
`this.activeDramaturgiaCardId = card.id`): cambiar
`const drawn: CombatEvent = { type: 'DRAMATURGIA_CARD_DRAWN', icon: card.icon };` por
`{ type: 'DRAMATURGIA_CARD_DRAWN', icon: card.icon, cardId: card.id }`. `card.id` ya está en scope
(es el mismo valor que puebla `this.activeDramaturgiaCardId` dos líneas antes) — cambio de una línea,
aditivo, ningún test existente que compare por campo individual se rompe; si algún test usa
`toEqual` exacto sobre este evento, es actualización mecánica de fixture.

### Gap B — `NameLookup` necesita `minionName(id)`

`MINION_SUMMONED`/`MINION_DEFEATED` solo traen `minionDefinitionId` (`MinionDefinitionId = string`).
Hoy `NameLookup` (`packages/domain/catalog/src/name-lookup.ts`) solo resuelve `abilityName`/`cardName`
a partir de `leader`/`enemy`/`catalog.cards` — los Secuaces viven en `EnemyDefinition.minions`/
`ScenarioDefinition.minions` (`catalog/types/enemy.ts`/`scenario.ts`, ambos `readonly MinionDefinition[]`,
opcionales), nunca en un mapa central del catálogo.

```ts
// packages/domain/catalog/src/name-lookup.ts — MODIFICAR
export interface NameLookup {
  abilityName(id: AbilityId): string;
  cardName(id: CardId): string;
  /** NUEVO H4.y. */
  minionName(id: MinionDefinitionId): string;
}

export function buildNameLookup(params: {
  readonly leader: LeaderDefinition;
  readonly enemy: EnemyDefinition;
  readonly scenario: ScenarioDefinition; // NUEVO H4.y — antes no se recibía
  readonly catalog: Catalog;
}): NameLookup {
  // ...abilityNames sin cambio...
  const minionNames = new Map<MinionDefinitionId, string>();
  for (const m of params.enemy.minions ?? []) minionNames.set(m.id, m.name);
  for (const m of params.scenario.minions ?? []) minionNames.set(m.id, m.name);

  return {
    abilityName: /* sin cambio */,
    cardName: /* sin cambio */,
    minionName(id: MinionDefinitionId): string {
      return minionNames.get(id) ?? id;
    },
  };
}
```

**Cambio de firma que rompe un llamador** — `build-combat-setup.ts` línea 62
(`buildNameLookup({ leader, enemy, catalog })`) debe pasar también `scenario` (ya está en scope en
esa función, es una variable local ya cargada dos líneas antes). Único punto de producción de
`buildNameLookup`; Programmer verifica si algún test unitario de `name-lookup.test.ts` construye el
lookup sin `scenario` y lo actualiza (aditivo con `?? []` interno, así que un `scenario` sin
`minions` no rompe nada).

---

## 5. Integración en `CombatScreen.tsx` — puntos de montaje exactos

```tsx
// dentro de CombatHudOverlay (mismo componente que ya monta CombatHud/TargetingPromptBanner/
// CombatBoardOverlay/CombatResultModal):

const logEntries = useCombatLog(bridge, boardContext); // NUEVO

return (
  <>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }}>
      <CombatHud ... />
      <TargetingPromptBanner ... />
    </div>
    <CombatBoardOverlay ... />
    <CombatLogPanel entries={logEntries} />           {/* NUEVO — zIndex 6, ancla inferior */}
    <TurnStartModal snapshot={snapshot} bridge={bridge} /> {/* NUEVO — zIndex 20, se auto-oculta */}
    {snapshot.status !== 'IN_PROGRESS' && <CombatResultModal snapshot={snapshot} />}
  </>
);
```

Orden de `zIndex` ya existente + nuevos, de menor a mayor (documentado explícitamente para que
Programmer no improvise números sueltos): `CombatBoardOverlay` (implícito, base) <
`CombatHud`/`TargetingPromptBanner` (4/5) < `CombatLogPanel` peek/expandido (6) < `TurnStartModal` (20)
≈ `CombatResultModal` (sin zIndex explícito hoy — Programmer verifica que quede por encima de
`TurnStartModal` solo si ambos pudieran coexistir; en la práctica no coexisten: `CombatResultModal`
solo aparece cuando `status !== 'IN_PROGRESS'`, momento en el que `TURN_ENDED`/el propio flujo de
turno ya no vuelve a disparar `TurnStartModal`).

**`CombatHud.tsx`**: único cambio es la extracción a `freeStepAvailabilityFor` (§1.3) — su JSX/props
no cambian, la franja "Paso previo (gratis)" existente se mantiene intacta como vía secundaria para
el caso "Ahora no" del modal (§1.4).

---

## 6. Resumen de archivos

```
apps/shell/src/combat/
  TurnStartModal.tsx                    # NUEVO §1
  free-step-availability.ts             # NUEVO §1.3 — extraído de CombatHud.tsx
  CombatHud.tsx                         # MODIFICADO — usa freeStepAvailabilityFor (§1.3/§5)
  log/
    use-combat-log.ts                   # NUEVO §3.1
    CombatLogPanel.tsx                  # NUEVO §3.2
    log-tone-color.ts                   # NUEVO §3.2
    log.css                             # NUEVO §3.2 — @keyframes log-peek-pulse
    translate-combat-event.ts           # NUEVO §3.3 — translateCombatEvent(), tabla completa
apps/shell/src/screens/CombatScreen.tsx # MODIFICADO — monta CombatLogPanel + TurnStartModal (§5)
apps/shell/src/combat/build-combat-setup.ts
                                         # MODIFICADO — buildNameLookup recibe `scenario` (Gap B, §4)

packages/domain/combat/src/types/events.ts
                                         # MODIFICADO — DRAMATURGIA_CARD_DRAWN += cardId (Gap A, §4)
packages/domain/combat/src/combat-engine.ts
                                         # MODIFICADO — emite cardId en drawDramaturgiaCard() (Gap A, §4)
packages/domain/catalog/src/name-lookup.ts
                                         # MODIFICADO — += minionName(), buildNameLookup += scenario (Gap B, §4)

packages/combat-scene/src/juice/recipes/turn-banner.ts
                                         # SIN CAMBIO (§0/§2 — decisión explícita de no tocarlo)
```

---

## 7. Orden de implementación recomendado

1. **§4 Gaps A y B (dominio/catálogo).** Aditivos, bajo riesgo, desbloquean el contenido real del
   log — igual criterio que `H4_componente_carta.md` §9.
2. **§1 `TurnStartModal` + `free-step-availability.ts`.** Independiente del log, cierra el punto más
   señalado por el Director ("que no se te olvide"), y es la superficie más pequeña de las 3.
3. **§3 `useCombatLog` + `CombatLogPanel` + tabla de traducción.** Depende de §4 Gaps A/B para las 2
   filas que los necesitan (Dramaturgia, Secuaces) — el resto de filas de la tabla no dependen de
   nada nuevo y pueden implementarse/testearse primero.
4. **§5 Integración en `CombatScreen.tsx`.** Última pieza, cablea los 3 componentes ya validados por
   separado.

---

## 8. Fuera de alcance explícito

- Resolver el nombre real del Secuaz en `MINION_DAMAGED` (hoy genérico "un Secuaz enemigo", §3.3) —
  mejora futura anotada, requiere cruzar `minionInstanceId → minionDefinitionId` contra el snapshot
  en el instante del evento.
- Traducir `COMBO_TRIGGERED`/`MINION_PASSIVE_EFFECTS_APPLIED` a línea de log propia — no forman parte
  de la lista explícita del encargo; ambas quedan documentadas como candidatas de una iteración
  futura si QA/Director las echan en falta.
- Persistencia del log entre combates o exportable — vive solo en memoria de React durante el
  combate actual, se descarta al desmontar `CombatScreen` (mismo alcance que el resto del estado de
  UI de combate, `use-combat-snapshot.ts` incluido).
- Sonido dedicado para nuevas entradas de log — el catálogo de `SoundCueId` no se toca en esta
  historia (mismo criterio que `H4_componente_carta.md` fuera-de-alcance sobre audio).
