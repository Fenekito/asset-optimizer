#!/usr/bin/env node

import { configure, parseArguments, type OptimizeResult } from "./index.js";

function formatSize(bytes: number): string {
    if (bytes === 0) {
        return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

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

        const totalSavings = result.totalOriginalSize - result.totalOptimizedSize;
        const totalSavingsPercent = result.totalOriginalSize > 0
            ? ((totalSavings / result.totalOriginalSize) * 100).toFixed(1)
            : "0.0";
        const savingsOperator = totalSavings > 0 ? "-" : "+";

        console.log(`Total: ${formatSize(result.totalOriginalSize)} → ${formatSize(result.totalOptimizedSize)} (${savingsOperator}${formatSize(Math.abs(totalSavings))} / ${totalSavingsPercent}%)`);
        console.log(`Processed ${result.filesProcessed} file(s); improvements on ${result.filesOptimized}.`);
        console.log(`Optimized assets from ${input} → ${output}`);

        if (collectedWarnings.length > 0) {
            console.warn("Warnings:");
            for (const warning of collectedWarnings) {
                console.warn(`• ${warning}`);
            }
        }
    } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
    }
}

void runCli();
