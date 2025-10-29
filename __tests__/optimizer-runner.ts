import type { OptimizeResult } from '../src/index.js';

interface RunnerResult extends OptimizeResult {}

const defaultInput = '../test-assets';
const defaultOutput = '../test-output/programmatic';

function resolvePath(path: string): string {
  return new URL(path, import.meta.url).pathname;
}

export async function runOptimizer(
  input: string = defaultInput,
  output: string = defaultOutput
): Promise<RunnerResult> {
  const { configure } = await import('../dist/index.js');

  const resolvedInput = resolvePath(input);
  const resolvedOutput = resolvePath(output);

  return await configure(resolvedInput, resolvedOutput, {
    verbose: true,
  });
}

export type { RunnerResult };
