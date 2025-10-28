import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configure, parseArguments, type OptimizeResult } from '../src/index.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// Mock external dependencies
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    png: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('optimized')),
  })),
}));

vi.mock('svgo', () => ({
  optimize: vi.fn().mockReturnValue({ data: '<svg>optimized</svg>' }),
}));

vi.mock('mediabunny', () => ({
  Input: vi.fn(),
  Output: vi.fn(),
  Conversion: {
    init: vi.fn().mockResolvedValue({
      isValid: true,
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  },
  BlobSource: vi.fn(),
  BufferTarget: vi.fn().mockImplementation(() => ({ buffer: new ArrayBuffer(10) })),
  Mp4OutputFormat: vi.fn(),
  WebMOutputFormat: vi.fn(),
  ALL_FORMATS: {},
  QUALITY_MEDIUM: 0.5,
}));

// Mock fs operations
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    copyFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('parseArguments', () => {
  it('parses basic arguments', () => {
    const args = ['--input', 'src', '--output', 'dist'];
    const result = parseArguments(args);
    expect(result).toMatchObject({
      input: 'src',
      output: 'dist',
    });
    expect(result.quality).toBeUndefined();
    expect(result.verbose).toBe(false);
  });

  it('parses all arguments', () => {
    const args = ['-i', 'src', '-o', 'dist', '-q', '75', '-v'];
    const result = parseArguments(args);
    expect(result).toEqual({
      input: 'src',
      output: 'dist',
      quality: 75,
      verbose: true,
    });
  });

  it('clamps quality', () => {
    const args = ['--input', 'src', '--output', 'dist', '--quality', '150'];
    const result = parseArguments(args);
    expect(result.quality).toBe(100);
  });
});

describe('configure', () => {
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  it('requires input and output', async () => {
    await expect(configure('', 'dist')).rejects.toThrow('An input folder must be provided');
    await expect(configure('src', '')).rejects.toThrow('An output folder must be provided');
  });

  it('returns optimization result', async () => {
    mockFs.readdir.mockResolvedValue([]);
    const result = await configure('src', 'dist');
    expect(result).toMatchObject({
      totalOriginalSize: 0,
      totalOptimizedSize: 0,
      filesScanned: 0,
      filesProcessed: 0,
      filesOptimized: 0,
      warnings: [],
    });
  });

  it('handles warnings', async () => {
    const warnings: string[] = [];
    const result = await configure('src', 'dist', {
      onWarning: (msg) => warnings.push(msg),
    });
    expect(warnings).toEqual([]);
  });
});