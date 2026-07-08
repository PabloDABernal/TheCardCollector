/** Opción seleccionable en `RunStartScreen` (§2). `leaderId` coincide exactamente con `LeaderDefinition.id`
 *  (`packages/data/leaders/*.json`) — sin conversión a `LeaderId` con marca de tipo aquí; esa conversión
 *  (`createId<'LeaderId'>`) sigue ocurriendo solo en `build-combat-setup.ts` (§3.2), único punto que ya la
 *  hacía desde H2.9. */
export interface LeaderOption {
  readonly leaderId: string;
  readonly label: string;
}

/** Únicos 2 Líderes reales del contenido de juguete 2×2×2 (H1.9) — no se amplía en esta historia
 *  (decisions.md 2026-07-06: "reutilizar el 2×2×2 de H1"). */
export const LEADER_OPTIONS: readonly LeaderOption[] = [
  { leaderId: 'leader-soldado-base', label: 'Soldado Base' },
  { leaderId: 'leader-mago-base', label: 'Mago Base' },
];

/** Mismo Líder por defecto que `build-combat-setup.ts` ya usaba antes de esta historia — se conserva como
 *  fallback cuando `CombatScreen` se monta sin `location.state` (§0.3). */
export const DEFAULT_LEADER_OPTION: LeaderOption = LEADER_OPTIONS[0]!;
