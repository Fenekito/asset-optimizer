#!/usr/bin/env node

import { configure, parseArguments, type OptimizeResult } from './index.js';
import * as colors from './colors.js';

async function confirmSelfReplacing(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Self-replacing mode requires an interactive terminal or the --skip-warning flag.'
    );
  }

  const { createInterface } = await import('node:readline');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    prompt.question('Continue? (y/N) ', (answer) => {
      prompt.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

async function runCli(): Promise<void> {
  try {
    const { input, output, quality, verbose, selfReplace, skipWarning } = parseArguments(
      process.argv.slice(2)
    );
    const collectedWarnings: string[] = [];

    if (selfReplace && !skipWarning) {
      console.warn(
        colors.bold(colors.warn('WARNING:')) +
          ' ' +
          colors.warn('Self-replacing mode will overwrite files in place and cannot be undone.')
      );
      const confirmed = await confirmSelfReplacing();
      if (!confirmed) {
        console.log(colors.warn('Operation cancelled.'));
        return;
      }
    }

    const result: OptimizeResult = await configure(input, output, {
      ...(quality !== undefined ? { imageQuality: quality } : {}),
      ...(verbose ? { verbose } : {}),
      onWarning: (message: string) => {
        collectedWarnings.push(message);
      },
    });

    const warnings = collectedWarnings.length > 0 ? collectedWarnings : result.warnings;

    console.log(colors.success(result.summary.totalsLine));
    console.log(colors.info(result.summary.processedLine));
    console.log(colors.info(result.summary.destinationLine));

    if (warnings.length > 0) {
      console.warn(colors.bold(colors.warn('Warnings:')));
      for (const warning of warnings) {
        console.warn(colors.warn(`• ${warning}`));
      }
    }
  } catch (error) {
    console.error(colors.error((error as Error).message));
    process.exitCode = 1;
  }
}

void runCli();
