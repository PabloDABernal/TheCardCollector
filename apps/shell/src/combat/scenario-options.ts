/** Opción seleccionable en `RunStartScreen` — mismo patrón que `LeaderOption` (`leader-options.ts`).
 *  `scenarioId` coincide exactamente con `ScenarioDefinition.id`
 *  (`apps/shell/public/data/scenarios/*.json`).
 *
 * NUEVO H4.x (selector de testeo, fuera del sorteo 3+3 de H4) — permite elegir contra qué Escenario
 * jugar desde la pantalla de inicio, sin implicar ningún pool/sorteo. */
export interface ScenarioOption {
  readonly scenarioId: string;
  readonly label: string;
}

/** Únicos 2 Escenarios reales del contenido de juguete 2×2×2 (H1.9) — no se amplía en esta historia. */
export const SCENARIO_OPTIONS: readonly ScenarioOption[] = [
  { scenarioId: 'scenario-bosque-encantado-base', label: 'Bosque Encantado Base' },
  { scenarioId: 'scenario-templo-en-ruinas-base', label: 'Templo en Ruinas Base' },
];

/** Mismo Escenario por defecto que `build-combat-setup.ts` ya usaba antes de esta historia — se
 *  conserva como fallback cuando `CombatScreen` se monta sin `location.state`. */
export const DEFAULT_SCENARIO_OPTION: ScenarioOption = SCENARIO_OPTIONS[0]!;
