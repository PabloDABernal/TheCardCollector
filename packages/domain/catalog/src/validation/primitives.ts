export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Lanza con mensaje uniforme `"<contexto>: <detalle>"` — mismo estilo que
 *  `combat-engine.ts` (`CombatEngine: ...`). `contexto` siempre incluye la colección y,
 *  si aplica, el índice/id del elemento que falló, para que el mensaje sea accionable
 *  sin depurador (criterio de aceptación: "mensaje claro"). */
export function fail(context: string, detail: string): never {
  throw new Error(`${context}: ${detail}`);
}
