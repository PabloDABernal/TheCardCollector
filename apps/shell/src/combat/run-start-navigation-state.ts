/** Forma exacta de `location.state` cuando se navega desde `RunStartScreen` a `/combat` (§2.1). Tipo
 *  compartido para que `CombatScreen` (§3.1) lea `location.state` con seguridad de tipos en vez de un
 *  `unknown`/`any` sin contrato.
 *
 * NUEVO H4.x — `enemyId`/`scenarioId` se suman a `leaderId` como selectores de testeo directos (2
 *  opciones cada uno, sin pool/sorteo); un futuro pool 3+3/sorteo real de H4 (fuera de alcance aquí)
 *  añadiría campos/forma distinta sin depender de esta. */
export interface RunStartNavigationState {
  readonly leaderId: string;
  readonly enemyId: string;
  readonly scenarioId: string;
}
