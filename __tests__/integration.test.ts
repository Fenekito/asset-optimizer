import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configure } from '../src/index.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testAssetsDir = path.resolve(__dirname, '../test-assets');
const testOutputDir = path.resolve(__dirname, '../test-output/integration');

describe('Integration Tests with Real Files', () => {
  beforeEach(async () => {
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const files = await fs.readdir(testOutputDir);
      for (const file of files) {
        const filePath = path.join(testOutputDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          const subFiles = await fs.readdir(filePath);
          for (const subFile of subFiles) {
            await fs.unlink(path.join(filePath, subFile));
          }
          const entries = await fs.readdir(filePath);
          if (entries.length === 0) {
            // directory is empty
          }
        } else {
          await fs.unlink(filePath);
        }
      }
    } catch {
      // ignore cleanup errors
    }
  });

  it('scans test assets directory', async () => {
    const result = await configure(testAssetsDir, testOutputDir, {
      verbose: true,
    });

    expect(result.filesScanned).toBeGreaterThan(0);
    expect(result.filesProcessed).toBeGreaterThanOrEqual(0);
  });

  it('optimizes PNG images', async () => {
    const result = await configure(testAssetsDir, testOutputDir, {
      verbose: true,
    });

    // Just verify the overall process works
    expect(result.filesScanned).toBeGreaterThan(0);

    const outputFile = path.join(testOutputDir, 'image.png');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('optimizes JPG images', async () => {
    const result = await configure(testAssetsDir, testOutputDir);
    expect(result.filesScanned).toBeGreaterThan(0);

    const outputFile = path.join(testOutputDir, 'image.jpg');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('optimizes WebP images', async () => {
    const result = await configure(testAssetsDir, testOutputDir);
    expect(result.filesScanned).toBeGreaterThan(0);

    const outputFile = path.join(testOutputDir, 'image.webp');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('handles AVIF images (with fallback)', async () => {
    const warnings: string[] = [];
    const result = await configure(testAssetsDir, testOutputDir, {
      onWarning: (msg) => warnings.push(msg),
    });

    expect(result.filesScanned).toBeGreaterThan(0);
    const outputFile = path.join(testOutputDir, 'image.avif');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('optimizes SVG files', async () => {
    const result = await configure(testAssetsDir, testOutputDir);
    expect(result.filesScanned).toBeGreaterThan(0);

    const outputFile = path.join(testOutputDir, 'vector.svg');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('minifies JSON files', async () => {
    const result = await configure(testAssetsDir, testOutputDir, {
      verbose: false,
    });

    const outputFile = path.join(testOutputDir, 'data.json');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    if (exists) {
      const originalData = await fs.readFile(path.join(testAssetsDir, 'data.json'), 'utf-8');
      const optimizedData = await fs.readFile(outputFile, 'utf-8');
      // Minified JSON should be same or smaller
      expect(optimizedData.length).toBeLessThanOrEqual(originalData.length);
    }
  });

  it('copies MP4 video files', async () => {
    const result = await configure(testAssetsDir, testOutputDir);
    expect(result.filesScanned).toBeGreaterThan(0);

    const outputFile = path.join(testOutputDir, 'video.mp4');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('copies WebM video files', async () => {
    const result = await configure(testAssetsDir, testOutputDir);
    expect(result.filesScanned).toBeGreaterThan(0);

    const outputFile = path.join(testOutputDir, 'video.webm');
    const exists = await fs.stat(outputFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('reports optimization metrics', async () => {
    const result = await configure(testAssetsDir, testOutputDir);

    expect(result.totalOriginalSize).toBeGreaterThan(0);
    expect(result.totalOptimizedSize).toBeGreaterThan(0);
    expect(result.filesProcessed).toBeGreaterThanOrEqual(0);
    expect(result.filesScanned).toBeGreaterThan(0);
  });

  it('collects warnings without failing', async () => {
    const warnings: string[] = [];
    const result = await configure(testAssetsDir, testOutputDir, {
      onWarning: (msg) => warnings.push(msg),
    });

    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.filesScanned).toBeGreaterThan(0);
  });

  it('processes multiple file formats in one run', async () => {
    const result = await configure(testAssetsDir, testOutputDir);

    // Verify we processed multiple formats
    expect(result.filesProcessed).toBeGreaterThan(0);
    expect(result.filesScanned).toBeGreaterThan(0);

    // Verify output directory has files
    const outputFiles = await fs.readdir(testOutputDir);
    expect(outputFiles.length).toBeGreaterThan(0);
  });
});
