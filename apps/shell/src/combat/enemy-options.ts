/** Opción seleccionable en `RunStartScreen` — mismo patrón que `LeaderOption` (`leader-options.ts`).
 *  `enemyId` coincide exactamente con `EnemyDefinition.id` (`apps/shell/public/data/enemies/*.json`).
 *
 * NUEVO H4.x (selector de testeo, fuera del sorteo 3+3 de H4) — permite elegir contra qué Enemigo
 * jugar desde la pantalla de inicio, sin implicar ningún pool/sorteo. */
export interface EnemyOption {
  readonly enemyId: string;
  readonly label: string;
}

/** Únicos 2 Enemigos reales del contenido de juguete 2×2×2 (H1.9) — no se amplía en esta historia. */
export const ENEMY_OPTIONS: readonly EnemyOption[] = [
  { enemyId: 'enemy-bestia-base', label: 'Bestia Base' },
  { enemyId: 'enemy-espectro-base', label: 'Espectro Base' },
];

/** Mismo Enemigo por defecto que `build-combat-setup.ts` ya usaba antes de esta historia — se
 *  conserva como fallback cuando `CombatScreen` se monta sin `location.state`. */
export const DEFAULT_ENEMY_OPTION: EnemyOption = ENEMY_OPTIONS[0]!;
