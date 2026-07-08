/** Forma exacta de `location.state` cuando se navega desde `RunStartScreen` a `/combat` (§2.1). Tipo
 *  compartido para que `CombatScreen` (§3.1) lea `location.state` con seguridad de tipos en vez de un
 *  `unknown`/`any` sin contrato — único campo hoy (`leaderId`); un futuro pool 3+3/sorteo (fuera de
 *  alcance, §0.2) añadiría campos aquí sin romper la forma actual. */
export interface RunStartNavigationState {
  readonly leaderId: string;
}
