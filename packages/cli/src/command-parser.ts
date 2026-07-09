import type { CombatCommand, CombatStateSnapshot } from '@collector/domain-combat';
import { createId } from '@collector/domain-shared';
import type { AbilityId, CardId, CardInstanceId } from '@collector/domain-shared';

export type ParsedLine =
  | { readonly kind: 'COMMAND'; readonly command: CombatCommand }
  | { readonly kind: 'LOCAL'; readonly action: 'HELP' | 'STATUS' | 'QUIT' }
  | { readonly kind: 'PARSE_ERROR'; readonly message: string };

const SOURCE_ID_LEADER = 'leader';

/**
 * Traduce una línea cruda de stdin a un `CombatCommand` tipado, o a una acción local del
 * CLI (help/status/quit), o a un error de parseo — nunca lanza. `snapshot` es el ÚLTIMO
 * `CombatStateSnapshot` conocido — se usa exclusivamente para resolver
 * `nucleoIndex`/`allyIndex` a los ids reales que el motor espera; si `snapshot` no tiene
 * suficientes entradas para el índice pedido, se devuelve `PARSE_ERROR` con un mensaje
 * legible (nunca un índice fuera de rango llega a `CombatCommand`).
 */
export function parseLine(line: string, snapshot: CombatStateSnapshot): ParsedLine {
  const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return { kind: 'PARSE_ERROR', message: 'línea vacía — escribe "help" para ver los comandos disponibles' };
  }

  const [first, ...rest] = tokens;
  const word0 = (first ?? '').toLowerCase();

  switch (word0) {
    case 'help':
      return { kind: 'LOCAL', action: 'HELP' };
    case 'status':
      return { kind: 'LOCAL', action: 'STATUS' };
    case 'quit':
    case 'exit':
      return { kind: 'LOCAL', action: 'QUIT' };
    case 'end':
      return parseEndTurn(rest);
    case 'activate':
      return parseActivateAbility(rest, snapshot);
    case 'play':
      return parsePlay(rest, snapshot);
    case 'set':
      return parseSetRedirect(rest, snapshot);
    default:
      return {
        kind: 'PARSE_ERROR',
        message: `comando desconocido "${first}" — escribe "help" para ver los comandos disponibles`,
      };
  }
}

function parseEndTurn(rest: readonly string[]): ParsedLine {
  if (rest.length !== 1 || (rest[0] ?? '').toLowerCase() !== 'turn') {
    return { kind: 'PARSE_ERROR', message: 'sintaxis esperada: "end turn"' };
  }
  return { kind: 'COMMAND', command: { type: 'END_TURN' } };
}

function parseActivateAbility(rest: readonly string[], snapshot: CombatStateSnapshot): ParsedLine {
  if ((rest[0] ?? '').toLowerCase() !== 'ability' || rest.length !== 3) {
    return { kind: 'PARSE_ERROR', message: 'sintaxis esperada: "activate ability <abilityId> <nucleoIndex>"' };
  }
  const abilityIdRaw = rest[1] as string;
  const nucleoIndexResult = parseIndex(rest[2] as string, snapshot.nucleoTable.length, 'nucleoIndex');
  if (nucleoIndexResult.kind === 'PARSE_ERROR') return nucleoIndexResult;

  const nucleo = snapshot.nucleoTable[nucleoIndexResult.index];
  if (!nucleo) {
    return { kind: 'PARSE_ERROR', message: `nucleoIndex fuera de rango: ${rest[2]}` };
  }

  return {
    kind: 'COMMAND',
    command: {
      type: 'ACTIVATE_ABILITY',
      abilityId: createId<'AbilityId'>('AbilityId', abilityIdRaw) as AbilityId,
      sourceId: SOURCE_ID_LEADER,
      side: 'LEADER',
      nucleoInstanceId: nucleo.id,
    },
  };
}

function parsePlay(rest: readonly string[], snapshot: CombatStateSnapshot): ParsedLine {
  const sub = (rest[0] ?? '').toLowerCase();
  switch (sub) {
    case 'card':
      return parsePlayCard(rest.slice(1), snapshot);
    case 'ally':
      return parsePlaySimpleCard(rest.slice(1), 'PLAY_ALLY', 'play ally <cardId>');
    case 'contratiempo':
      return parsePlaySimpleCard(rest.slice(1), 'PLAY_CONTRATIEMPO', 'play contratiempo <cardId>');
    default:
      return {
        kind: 'PARSE_ERROR',
        message: 'sintaxis esperada: "play card <cardId> [nucleoIndex]" | "play ally <cardId>" | "play contratiempo <cardId>"',
      };
  }
}

function parsePlayCard(rest: readonly string[], snapshot: CombatStateSnapshot): ParsedLine {
  if (rest.length === 1) {
    const cardId = rest[0] as string;
    return {
      kind: 'COMMAND',
      command: {
        type: 'PLAY_CARD',
        cardId: createId<'CardId'>('CardId', cardId) as CardId,
        sourceId: SOURCE_ID_LEADER,
      },
    };
  }
  if (rest.length === 2) {
    const cardId = rest[0] as string;
    const nucleoIndexResult = parseIndex(rest[1] as string, snapshot.nucleoTable.length, 'nucleoIndex');
    if (nucleoIndexResult.kind === 'PARSE_ERROR') return nucleoIndexResult;
    const nucleo = snapshot.nucleoTable[nucleoIndexResult.index];
    if (!nucleo) {
      return { kind: 'PARSE_ERROR', message: `nucleoIndex fuera de rango: ${rest[1]}` };
    }
    return {
      kind: 'COMMAND',
      command: {
        type: 'PLAY_CARD',
        cardId: createId<'CardId'>('CardId', cardId) as CardId,
        sourceId: SOURCE_ID_LEADER,
        nucleoInstanceId: nucleo.id,
      },
    };
  }
  return { kind: 'PARSE_ERROR', message: 'sintaxis esperada: "play card <cardId> [nucleoIndex]"' };
}

function parsePlaySimpleCard(
  rest: readonly string[],
  type: 'PLAY_ALLY' | 'PLAY_CONTRATIEMPO',
  usage: string
): ParsedLine {
  if (rest.length !== 1) {
    return { kind: 'PARSE_ERROR', message: `sintaxis esperada: "${usage}"` };
  }
  const cardId = rest[0] as string;
  return {
    kind: 'COMMAND',
    command: {
      type,
      cardId: createId<'CardId'>('CardId', cardId) as CardId,
      sourceId: SOURCE_ID_LEADER,
    },
  };
}

function parseSetRedirect(rest: readonly string[], snapshot: CombatStateSnapshot): ParsedLine {
  if ((rest[0] ?? '').toLowerCase() !== 'redirect' || rest.length !== 2) {
    return { kind: 'PARSE_ERROR', message: 'sintaxis esperada: "set redirect <allyIndex>" | "set redirect none"' };
  }
  const target = rest[1] as string;
  if (target.toLowerCase() === 'none') {
    return { kind: 'COMMAND', command: { type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: null } };
  }
  const allyIndexResult = parseIndex(target, snapshot.alliesInPlay.length, 'allyIndex');
  if (allyIndexResult.kind === 'PARSE_ERROR') return allyIndexResult;
  const ally = snapshot.alliesInPlay[allyIndexResult.index];
  if (!ally) {
    return { kind: 'PARSE_ERROR', message: `allyIndex fuera de rango: ${target}` };
  }
  return {
    kind: 'COMMAND',
    command: { type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: ally.instanceId as CardInstanceId },
  };
}

type IndexParseResult = { readonly kind: 'INDEX'; readonly index: number } | { readonly kind: 'PARSE_ERROR'; readonly message: string };

function parseIndex(raw: string, length: number, label: string): IndexParseResult {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return { kind: 'PARSE_ERROR', message: `${label} inválido: "${raw}" (debe ser un entero >= 0)` };
  }
  if (value >= length) {
    return { kind: 'PARSE_ERROR', message: `${label} fuera de rango: ${value} (hay ${length} entradas disponibles)` };
  }
  return { kind: 'INDEX', index: value };
}
