import type { DramaturgiaCardId } from '@collector/domain-shared';
import type { EnemyAbilityBranch } from './enemy';
import type { MinionBehaviorSpec, MinionDefinitionId } from './minion-behavior'; // NUEVO H1.16 (rediseño)

/** NUEVO §3.10.1. Efecto de invocación de Secuaz atado a una carta de Dramaturgia
 *  concreta — independiente de `minionBehavior` (que dicta qué Secuaces YA en mesa
 *  actúan, no invoca ninguno nuevo). */
export interface DramaturgiaSummonEffect {
  readonly minionDefinitionId: MinionDefinitionId;
}

/**
 * Carta de Dramaturgia propia de un Enemigo (GDD §3.4/§5.2/§5.3). Su ÚNICO dato
 * ejecutable hoy es `icon` — determina qué rama de `decideEnemyAbility` (domain/combat,
 * H1.7) se activa al robarse; la habilidad EXACTA que se ejecuta dentro de esa rama la
 * decide la IA en runtime (firma/básica para ATTACK, mayor-CD/básica para PLOT, GDD
 * §3.5), nunca esta carta. NO referencia ningún `AbilityId` — deliberado, ver spec H1.10
 * §0.1.
 *
 * `effectDescription` cubre "la carta también resuelve su propio efecto (invocar
 * secuaz, daño extra, etc.)" (GDD §3.4) como texto libre no ejecutable — mismo patrón
 * ya usado por `ScenarioPlotThreshold`/`ScenarioPassiveEffect` (catalog/types/scenario.ts)
 * para mecánicas descritas por el GDD pero cuyo motor ejecutable todavía no existe
 * (secuaces = H1.16, Combo = H1.14). Ausente = carta sin efecto adicional más allá del
 * icono (la mayoría del mazo).
 */
export interface DramaturgiaCardDefinition {
  readonly id: DramaturgiaCardId;
  readonly name: string;
  /** Reutiliza `EnemyAbilityBranch` (mismo vocabulario cerrado ATTACK|PLOT que ya usa
   *  `EnemyAbilityAiProfile.branch`, enemy.ts) — el icono de la carta Y la rama de una
   *  habilidad son el mismo concepto de dominio (⚔️/📜, GDD §3.4), no dos vocabularios
   *  paralelos que puedan divergir. */
  readonly icon: EnemyAbilityBranch;
  readonly effectDescription?: string;
  /** NUEVO H1.16 (rediseño). Ausente = esta carta NO dicta comportamiento de Secuaz —
   *  ningún Secuaz actúa el turno en que sale esta carta. Presente = el motor resuelve
   *  exactamente este criterio, sin azar propio salvo que el criterio sea RANDOM_ONE. */
  readonly minionBehavior?: MinionBehaviorSpec;
  /** NUEVO §3.10.1. Ausente = esta carta no invoca ningún Secuaz al jugarse (la mayoría
   *  del mazo). Presente = el motor dispara `SUMMON_MINION` para `minionDefinitionId`
   *  automáticamente, en el MISMO turno de Enemigo en que esta carta se resuelve, sin
   *  coste de acción/Núcleo/Energía adicional. `summonEffect` y `minionBehavior` son
   *  campos INDEPENDIENTES de la misma carta — el Secuaz recién invocado por
   *  `summonEffect` nunca es seleccionado por el `minionBehavior` de esa misma carta (ver
   *  spec §3.10.2). */
  readonly summonEffect?: DramaturgiaSummonEffect;
}
