#!/usr/bin/env node

import { configure, parseArguments, type OptimizeResult } from './index.js';

async function runCli(): Promise<void> {
  try {
    const { input, output, quality, verbose } = parseArguments(process.argv.slice(2));
    const collectedWarnings: string[] = [];
    const result: OptimizeResult = await configure(input, output, {
      ...(quality !== undefined ? { imageQuality: quality } : {}),
      ...(verbose ? { verbose } : {}),
      onWarning: (message: string) => {
        collectedWarnings.push(message);
      },
    });

    const warnings = collectedWarnings.length > 0 ? collectedWarnings : result.warnings;

    console.log(result.summary.totalsLine);
    console.log(result.summary.processedLine);
    console.log(result.summary.destinationLine);

    if (warnings.length > 0) {
      console.warn('Warnings:');
      for (const warning of warnings) {
        console.warn(`• ${warning}`);
      }
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

void runCli();
