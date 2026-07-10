import { createId, DefaultRandomSource, SeededRandomSource } from '@collector/domain-shared';
import type { LeaderId, EnemyId, ScenarioId } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig } from '@collector/domain-combat';
import { loadRawContent } from './load-raw-content';
import { buildNameLookup } from './name-lookup';
import { parseLine } from './command-parser';
import { renderSnapshot, renderEvent, renderRejection, renderFinalBanner } from './renderer';
import type { RenderContext } from './renderer';
import { runRepl } from './repl';

const DEFAULT_LEADER_ID = 'leader-soldado-base';
const DEFAULT_ENEMY_ID = 'enemy-bestia-base';
const DEFAULT_SCENARIO_ID = 'scenario-bosque-encantado-base';

const HELP_TEXT = `Comandos disponibles:
  activate ability <abilityId> <nucleoIndex>   — activa una habilidad del Líder
  end turn                                      — termina tu turno (dispara el turno del Enemigo)
  play card <cardId> [nucleoIndex]              — juega una carta EVENTO/EQUIPO
  play ally <cardId>                            — juega una carta ALIADO
  play contratiempo <cardId>                    — juega una carta CONTRATIEMPO
  set redirect <allyIndex> | none               — declara/retira redirección de daño
  status                                         — reimprime el estado actual
  help                                           — muestra esta ayuda
  quit / exit                                    — cierra el proceso`;

interface CliArgs {
  readonly leaderId: string;
  readonly enemyId: string;
  readonly scenarioId: string;
  readonly seed?: number;
}

/** Parseo mínimo propio de `process.argv` (§3.2) — 4 flags no justifican una librería. */
export function parseArgv(argv: readonly string[]): CliArgs {
  let leaderId = DEFAULT_LEADER_ID;
  let enemyId = DEFAULT_ENEMY_ID;
  let scenarioId = DEFAULT_SCENARIO_ID;
  let seed: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--leader':
        if (value !== undefined) leaderId = value;
        i++;
        break;
      case '--enemy':
        if (value !== undefined) enemyId = value;
        i++;
        break;
      case '--scenario':
        if (value !== undefined) scenarioId = value;
        i++;
        break;
      case '--seed':
        if (value !== undefined) seed = Number(value);
        i++;
        break;
      default:
        break;
    }
  }

  return { leaderId, enemyId, scenarioId, ...(seed !== undefined ? { seed } : {}) };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgv(argv);
  const rawInput = loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();

  if (!catalog.leaders.has(createId<'LeaderId'>('LeaderId', args.leaderId) as LeaderId)) {
    process.stderr.write(`Error: leaderId desconocido "${args.leaderId}"\n`);
    process.exitCode = 1;
    return;
  }
  if (!catalog.enemies.has(createId<'EnemyId'>('EnemyId', args.enemyId) as EnemyId)) {
    process.stderr.write(`Error: enemyId desconocido "${args.enemyId}"\n`);
    process.exitCode = 1;
    return;
  }
  if (!catalog.scenarios.has(createId<'ScenarioId'>('ScenarioId', args.scenarioId) as ScenarioId)) {
    process.stderr.write(`Error: scenarioId desconocido "${args.scenarioId}"\n`);
    process.exitCode = 1;
    return;
  }

  const leader = catalog.leaders.get(createId<'LeaderId'>('LeaderId', args.leaderId) as LeaderId)!;
  const enemy = catalog.enemies.get(createId<'EnemyId'>('EnemyId', args.enemyId) as EnemyId)!;
  const scenario = catalog.scenarios.get(createId<'ScenarioId'>('ScenarioId', args.scenarioId) as ScenarioId)!;

  const randomSource = args.seed !== undefined ? new SeededRandomSource(args.seed) : new DefaultRandomSource();

  const config = buildCombatEngineConfig({ catalog, leader, enemy, scenario, randomSource });
  const engine = new CombatEngine(config);

  const nameLookup = buildNameLookup({ leader, enemy, scenario, catalog });
  const renderCtx: RenderContext = {
    nameLookup,
    leaderMaxHealth: config.leaderMaxHealth,
    enemyMaxHealth: config.enemyMaxHealth,
    scenarioPlotDefeatThreshold: config.scenarioPlotDefeatThreshold,
  };

  let lastSnapshot = engine.getSnapshot();
  process.stdout.write(renderSnapshot(lastSnapshot, renderCtx) + '\n');

  await runRepl({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    onEof: () => {
      process.stdout.write('Combate interrumpido (EOF) en estado IN_PROGRESS — sin ganador.\n');
      process.exitCode = 0;
    },
    onLine: (line) => {
      const parsed = parseLine(line, lastSnapshot);

      if (parsed.kind === 'LOCAL') {
        switch (parsed.action) {
          case 'HELP':
            process.stdout.write(HELP_TEXT + '\n');
            return 'CONTINUE';
          case 'STATUS':
            process.stdout.write(renderSnapshot(lastSnapshot, renderCtx) + '\n');
            return 'CONTINUE';
          case 'QUIT':
            process.exit(0);
        }
      }

      if (parsed.kind === 'PARSE_ERROR') {
        process.stdout.write(`✗ ${parsed.message}\n`);
        return 'CONTINUE';
      }

      const result = engine.dispatch(parsed.command);
      if (!result.ok) {
        process.stdout.write(renderRejection(result.error) + '\n');
        return 'CONTINUE';
      }

      for (const event of result.value) {
        process.stdout.write(renderEvent(event, nameLookup) + '\n');
      }
      lastSnapshot = engine.getSnapshot();
      process.stdout.write(renderSnapshot(lastSnapshot, renderCtx) + '\n');

      if (lastSnapshot.status !== 'IN_PROGRESS') {
        process.stdout.write(renderFinalBanner(lastSnapshot) + '\n');
        process.exitCode = 0;
        return 'STOP';
      }

      return 'CONTINUE';
    },
  });
}

// Entry point real — no se ejecuta al importar este módulo desde tests (§7.4).
const isMainModule = process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], 'file://').href;
if (isMainModule) {
  main().catch((error: unknown) => {
    process.stderr.write(`Error fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
