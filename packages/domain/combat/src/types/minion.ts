import type { AbilityId, CardInstanceId } from '@collector/domain-shared';

/**
 * NUEVO H1.16. Alias de `string` — a diferencia de `AbilityId`/`CardId` (branded), un
 * Secuaz no es una `CardDefinition` de catálogo hoy (ver spec H1.16 §0.1): es un
 * concepto propio del Enemigo/Escenario, sin `EnemyId`/`CardId` propio todavía.
 */
export type MinionDefinitionId = string;

/**
 * GDD §3.8: "efecto pasivo definido por el enemigo y/o el escenario (acumulable entre
 * ambas fuentes, sin tope)". Magnitud FIJA, igual que un efecto PLOT (H1.6) — un pasivo
 * no consume Núcleo, así que no hay Umbral que resolver. Ver spec H1.16 §0.1.
 */
export interface MinionPassiveEffectDefinition {
  readonly kind: 'ATTACK' | 'PLOT';
  readonly amount: number; // entero >= 0, mismo piso que abilityEffects (H1.6 §0.5)
  /** Solo relevante si kind === 'ATTACK'; mismo significado que AbilityEffectDefinition.arrollar. Default false. */
  readonly arrollar?: boolean;
}

/**
 * Dato de un Secuaz relevante para el motor. Resuelto externamente e inyectado en
 * `CombatEngineConfig.minionDefinitions` — mismo patrón que `AllyCardDefinition`
 * (H1.15). `domain/combat` no importa `domain/catalog`. Ver spec H1.16 §0.1/§0.2.
 */
export interface MinionDefinition {
  readonly passiveEffect: MinionPassiveEffectDefinition;
  /** GDD §3.8: "acción especial" opcional. Si está presente, DEBE existir en
   *  abilityCoreCosts/abilityCooldowns/abilityEffects con side: 'ENEMY' (validado en el
   *  constructor, mismo estilo que AllyCardDefinition.abilityIds, H1.15 §3.6). */
  readonly specialActionAbilityId?: AbilityId;
  /** GDD §3.8: "Si ninguno tiene acción especial, uno al azar usa su ataque plano" y
   *  "Daño bajo". Magnitud fija, SIN Núcleo ni CD — ver §0.2. Entero >= 0. */
  readonly planoAttackAmount: number;
  /** GDD §3.8, keyword Defensor: "obliga a recibir/atacar a ese secuaz primero". Ver §0.5
   *  sobre por qué esta historia modela su CONTRATO pero no su integración end-to-end. */
  readonly isDefensor: boolean;
}

/**
 * Instancia concreta de un Secuaz en mesa. Identificada por `CardInstanceId` (H1.1,
 * generalizado por H1.15 a "copia concreta de algo en juego en el tablero", no solo
 * cartas de Aliado). Denormaliza `passiveEffect`/`specialActionAbilityId`/
 * `planoAttackAmount`/`isDefensor` desde la `MinionDefinition` en el momento de
 * invocar (mismo patrón que `AllyInPlay.isBerserker`/`maxLife`, H1.15).
 *
 * Sin campo de vida (ver spec H1.16 §0.1) — no existe todavía ningún mecanismo por el
 * que el jugador dañe al Enemigo o a sus Secuaces. Una vez invocado, un Secuaz
 * permanece en mesa indefinidamente en esta historia.
 */
export interface MinionInPlay {
  readonly instanceId: CardInstanceId;
  readonly definitionId: MinionDefinitionId;
  readonly passiveEffect: MinionPassiveEffectDefinition;
  readonly specialActionAbilityId?: AbilityId;
  readonly planoAttackAmount: number;
  readonly isDefensor: boolean;
}
