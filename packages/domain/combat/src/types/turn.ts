/**
 * H1.3 solo modela el ciclo básico Líder↔Enemigo (GDD §2.1: "2 acciones por turno,
 * alternos"). Aliados/Secuaces (H1.15/H1.16) actúan DENTRO del turno de uno de estos
 * dos lados — no son un tercer valor de `CombatSide`, son `sourceId` distintos dentro
 * del mismo lado (ver comentario en CombatCommand, §3.4).
 */
export type CombatSide = 'LEADER' | 'ENEMY';

export interface TurnState {
  readonly turnOwner: CombatSide;
  /** Empieza en 1, se incrementa en cada `END_TURN` (independiente de qué lado actúa). */
  readonly turnNumber: number;
}
