import { createInterface } from 'node:readline';

export type ReplStepResult = 'CONTINUE' | 'STOP';

export interface RunReplParams {
  readonly input: NodeJS.ReadableStream;
  readonly output: NodeJS.WritableStream;
  readonly prompt: string;
  readonly onLine: (line: string) => ReplStepResult;
  readonly onEof: () => void;
}

/**
 * Wrapper mínimo sobre `node:readline` (H1.19 §6) — sin dependencias externas de
 * parsing de terminal. Usa la API basada en eventos (`'line'`/`'close'`), NO
 * `rl.question()` de `node:readline/promises`: con un stream de entrada no interactivo
 * (pipe/redirección de fichero, el caso de `main.test.ts`/uso real por script), el
 * evento `'close'` del `Interface` se emite en cuanto el stream subyacente termina de
 * LEERSE, que puede ocurrir antes de que se hayan consumido (vía `question()`) todas las
 * líneas ya bufferizadas — verificado empíricamente: `rl.question()` + una carrera contra
 * `'close'` corta el bucle tras la primera línea aunque queden más líneas pendientes en el
 * pipe. El patrón basado en `'line'`/`'close'` no tiene ese problema: Node garantiza que
 * todos los `'line'` pendientes se emiten antes que `'close'` (§7.1).
 */
export function runRepl(params: RunReplParams): Promise<void> {
  return new Promise((resolve) => {
    const isInteractiveTty = Boolean((params.input as { isTTY?: boolean }).isTTY);
    const rl = createInterface({ input: params.input, output: params.output, terminal: isInteractiveTty });

    let stopped = false;

    const finish = (): void => {
      if (stopped) return;
      stopped = true;
      rl.close();
      resolve();
    };

    rl.on('line', (line: string) => {
      if (stopped) return;
      const result = params.onLine(line);
      if (result === 'STOP') {
        finish();
        return;
      }
      rl.prompt();
    });

    rl.on('close', () => {
      if (stopped) return;
      stopped = true;
      params.onEof();
      resolve();
    });

    rl.setPrompt(params.prompt);
    rl.prompt();
  });
}
