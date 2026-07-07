import type { NucleoInstance } from './nucleo';
import type { TurnState } from './turn';
import type { AbilityCooldownSnapshot } from './cooldown';
import type { ActionsStateSnapshot } from './action';
import type { UndoableEnemyActionLogEntry } from './contratiempo';
import type { AllyInPlay } from './ally';
import type { MinionInPlay } from './minion';
import type { CardInstanceId } from '@collector/domain-shared';
import type { LeaderState } from './leader-state'; // NUEVO H1.17
import type { CombatOutcome, DefeatReason } from './combat-status'; // NUEVO H1.18

/**
 * Slice de H1.3 de `CombatStateSnapshot` (architecture_stack.md §2.2). Historias
 * futuras EXTIENDEN esta misma interfaz con campos nuevos, nunca quitan `turn`/`nucleoPool`:
 *  - H1.4 añade cooldowns.
 *  - H1.6 añade `leaderDamage`/`scenarioPlot`.
 *  - H1.17 añade nivel/level-ups del Líder.
 *  - H1.18 la compone con el resto de estado (Energía, mano, mesa...).
 */
export interface CombatStateSnapshot {
  readonly turn: TurnState;
  readonly nucleoPool: readonly NucleoInstance[];
  /**
   * NUEVO en H1.4. Una entrada por cada habilidad conocida en
   * `CombatEngineConfig.abilityCooldowns`, en el mismo orden de inserción de ese mapa
   * (orden estable, útil para tests con `toEqual` y para UI futura).
   */
  readonly cooldowns: readonly AbilityCooldownSnapshot[];

  /**
   * NUEVO en H1.6. Daño de Ataque acumulado sobre el Líder (GDD §3.4/§3.7), YA NETO de
   * absorción por `leaderShield` (§3.2). Empieza en 0, solo sube. Deliberadamente NO es
   * "vida restante" — la vida máxima del Líder y la condición de derrota
   * (`leaderDamage` vs. vida máxima) son alcance de H1.18 (que sí depende de
   * `LeaderDefinition`, H1.8, todavía inexistente). Ver spec H1.6 §0.5.
   */
  readonly leaderDamage: number;

  /**
   * NUEVO en H1.6. Fichas de Escudo del Líder disponibles ahora mismo (GDD §2.8).
   * Entero en `[0, LEADER_SHIELD_MAX]`. Consume daño de Ataque antes de que llegue a
   * `leaderDamage` (§3.2); nunca es afectado por Trama (GDD §3.6: "el daño de Trama es
   * inabsorbible"). Modelo mínimo de "algo que bloquea daño" para esta historia — NO
   * es el sistema de Aliados de H1.15. Ver spec H1.6 §0.1.
   */
  readonly leaderShield: number;

  /**
   * NUEVO en H1.6. Contador de Trama del Escenario (GDD §3.6), bidireccional: sube con
   * habilidades `PLOT` de `side: 'ENEMY'`, baja con las de `side: 'LEADER'` (GDD §12:
   * "Enemigo sube, jugador baja"). Piso en 0 (saturado, ver spec §0.4). Sin techo en
   * esta historia — el "Umbral final" de derrota es dato de `ScenarioDefinition`
   * (H1.11) y su comprobación es alcance de H1.18. Pertenece conceptualmente al
   * Escenario, no al Enemigo (decisions.md) — el propio nombre del campo lo refleja.
   */
  readonly scenarioPlot: number;

  /** NUEVO H1.14. */
  readonly leaderEnergy: number;

  /** NUEVO H1.14. Acciones del `turnOwner` ACTUAL. */
  readonly actions: ActionsStateSnapshot;

  /**
   * NUEVO H1.14. Ventana de Contratiempo vigente AHORA MISMO (vacía si no aplica — ni
   * hay turno de Enemigo previo, ni ya se jugó un Contratiempo este ciclo). Ver spec §0.4.
   */
  readonly undoableLastEnemyTurn: readonly UndoableEnemyActionLogEntry[];

  /** NUEVO H1.15. Incluye Aliados muertos (`life === 0`, ver spec H1.15 §0.6) — filtrar
   *  en el consumidor si se necesita solo "vivos". Orden estable = orden de entrada en mesa. */
  readonly alliesInPlay: readonly AllyInPlay[];

  /** NUEVO H1.15. Postura de redirección vigente ahora mismo (`null` = ninguna) — ver
   *  spec H1.15 §0.3/§0.4. Puede apuntar a un Aliado que en la práctica será ignorado si
   *  hay un Berserker vivo (consultar `alliesInPlay` para saberlo, igual que hace el motor). */
  readonly activeDamageRedirectTargetId: CardInstanceId | null;

  /** NUEVO H1.16. Nunca se eliminan entradas (ver spec §0.1 — sin mecanismo de "matar"
   *  Secuaces en esta historia). Orden estable = orden de invocación. */
  readonly minionsInPlay: readonly MinionInPlay[];

  /** NUEVO H1.17. `level` derivado de `levelUpsSpent` — ver spec H1.17 §0.6. */
  readonly leaderState: LeaderState;

  /** NUEVO H1.17. Fase activa del Enemigo ahora mismo. `totalPhases === 0` si
   *  `CombatEngineConfig.enemyPhases` se omitió (sin tracking de fase para este lado). */
  readonly enemyPhase: { readonly phaseNumber: number; readonly totalPhases: number };

  /** NUEVO H1.17. Análogo para el Escenario. */
  readonly scenarioPhase: { readonly phaseNumber: number; readonly totalPhases: number };

  /** NUEVO H1.17. Daño acumulado sobre el Enemigo — "dato en reposo" hasta H1.18 (ver
   *  spec §0.3): ningún comando de esta historia lo muta. Solo alimenta la evaluación
   *  de `HEALTH_BELOW_PERCENT`. */
  readonly enemyDamage: number;

  /** NUEVO H1.18. Ver spec §0.6. `'IN_PROGRESS'` hasta que se cumple una condición de
   *  victoria o derrota; a partir de ahí, permanece fijo (nunca vuelve a `'IN_PROGRESS'`). */
  readonly status: 'IN_PROGRESS' | CombatOutcome;

  /** NUEVO H1.18. Presente solo si `status === 'DEFEAT'`. */
  readonly defeatReason?: DefeatReason;
}
