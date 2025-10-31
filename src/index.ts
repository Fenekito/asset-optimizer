import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { optimize as optimizeSvg } from 'svgo';
import type {
  AssetFormatDescriptor,
  SupportedFormat,
  ImageFormat,
  VectorFormat,
  DataFormat,
  VideoFormat,
} from './formats.js';
import {
  supportedImageFormats,
  supportedVectorFormats,
  supportedDataFormats,
  supportedVideoFormats,
  getDescriptorForExtension,
} from './formats.js';
import { mediaFile } from './file.js';

type OptimizeOptions = {
  imageQuality?: number;
  verbose?: boolean;
  onWarning?: (message: string) => void;
};

type ResolvedOptions = {
  imageQuality: number;
  verbose: boolean;
  onWarning?: (message: string) => void;
};

export type OptimizeSummary = {
  totalsLine: string;
  processedLine: string;
  destinationLine: string;
};

export type OptimizeResult = {
  input: string;
  output: string;
  inputDirectory: string;
  outputDirectory: string;
  totalOriginalSize: number;
  totalOptimizedSize: number;
  totalSavings: number;
  totalSavingsPercent: number;
  filesScanned: number;
  filesProcessed: number;
  filesOptimized: number;
  warnings: string[];
  summary: OptimizeSummary;
};

export type ParsedArguments = {
  input: string;
  output: string;
  quality?: number;
  verbose: boolean;
  selfReplace: boolean;
  skipWarning: boolean;
};

const DEFAULT_OPTIONS: ResolvedOptions = {
  imageQuality: 80,
  verbose: false,
};

type OptimizationContext = {
  providedInput: string;
  providedOutput: string;
  inputFolder: string;
  outputFolder: string;
  isSelfReplace: boolean;
  options: ResolvedOptions;
  totalOriginalSize: number;
  totalOptimizedSize: number;
  scannedFiles: Set<string>;
  processedFiles: number;
  optimizedFiles: number;
  warningMessages: Set<string>;
};

function createOptimizationContext(
  input: string,
  output: string,
  options: ResolvedOptions
): OptimizationContext {
  const inputFolder = path.resolve(process.cwd(), input);
  const outputFolder = path.resolve(process.cwd(), output);
  return {
    providedInput: input,
    providedOutput: output,
    inputFolder,
    outputFolder,
    isSelfReplace: inputFolder === outputFolder,
    options,
    totalOriginalSize: 0,
    totalOptimizedSize: 0,
    scannedFiles: new Set<string>(),
    processedFiles: 0,
    optimizedFiles: 0,
    warningMessages: new Set<string>(),
  };
}

export async function configure(
  input: string,
  output: string,
  opts: OptimizeOptions = {}
): Promise<OptimizeResult> {
  if (!input) {
    throw new Error('An input folder must be provided.');
  }
  if (!output) {
    throw new Error('An output folder must be provided.');
  }

  const resolvedOptions = resolveOptions(opts);
  const context = createOptimizationContext(input, output, resolvedOptions);
  await scanInputFolder(context);

  return buildOptimizeResult(context);
}

export function parseArguments(args: string[]): ParsedArguments {
  const result: ParsedArguments = {
    input: '',
    output: '',
    verbose: false,
    selfReplace: false,
    skipWarning: false,
  };
  let outputProvided = false;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === undefined) {
      continue;
    }
    switch (current) {
      case '--input':
      case '-i':
        result.input = args[++index] ?? '';
        break;
      case '--output':
      case '-o':
        result.output = args[++index] ?? '';
        outputProvided = true;
        break;
      case '--quality':
      case '-q': {
        const value = Number(args[++index]);
        if (!Number.isFinite(value)) {
          throw new Error('Image quality must be a valid number.');
        }
        result.quality = value;
        break;
      }
      case '--verbose':
      case '-v':
        result.verbose = true;
        break;
      case '--self':
      case '--in-place':
      case '-s':
        result.selfReplace = true;
        break;
      case '--skip-warning':
      case '--yes':
      case '--force':
      case '-y':
        result.skipWarning = true;
        break;
      default:
        if (current.startsWith('-')) {
          throw new Error(`Unknown option: ${current}`);
        }
    }
  }

  if (!result.input) {
    throw new Error('Missing required --input option.');
  }

  if (result.selfReplace) {
    if (outputProvided && result.output) {
      throw new Error('The --self option cannot be used together with --output.');
    }
    result.output = result.input;
  } else {
    if (!outputProvided || !result.output) {
      throw new Error('Missing required --output option.');
    }
  }

  if (result.quality !== undefined) {
    result.quality = clamp(result.quality, 1, 100);
  }

  if (!result.selfReplace) {
    const resolvedInput = path.resolve(process.cwd(), result.input);
    const resolvedOutput = path.resolve(process.cwd(), result.output);
    if (resolvedInput === resolvedOutput) {
      result.selfReplace = true;
    }
  }

  return result;
}

function resolveOptions(opts: OptimizeOptions): ResolvedOptions {
  const resolved: ResolvedOptions = {
    imageQuality: clamp(opts.imageQuality ?? DEFAULT_OPTIONS.imageQuality, 1, 100),
    verbose: opts.verbose ?? DEFAULT_OPTIONS.verbose,
  };
  if (typeof opts.onWarning === 'function') {
    resolved.onWarning = opts.onWarning;
  }
  return resolved;
}

async function scanInputFolder(context: OptimizationContext): Promise<void> {
  if (context.options.verbose) {
    console.log(`Scanning input folder: ${context.inputFolder}`);
  }
  await ensureInputFolder(context);
  await traverseDirectory(context, context.inputFolder, true);
  await prepareOutputFolder(context);
  await traverseDirectory(context, context.inputFolder, false);
}

async function ensureInputFolder(context: OptimizationContext): Promise<void> {
  try {
    const inputStats = await fs.stat(context.inputFolder);
    if (!inputStats.isDirectory()) {
      throw new Error(`Input path is not a directory: ${context.inputFolder}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      throw new Error(`Input folder does not exist: ${context.inputFolder}`);
    }
    throw error;
  }
}

async function prepareOutputFolder(context: OptimizationContext): Promise<void> {
  if (context.options.verbose) {
    console.log(`Preparing output folder: ${context.outputFolder}`);
    if (context.isSelfReplace) {
      console.log('Self-replacing mode detected; skipping cleanup of input files.');
    }
  }
  if (context.isSelfReplace) {
    return;
  }
  await fs.mkdir(context.outputFolder, { recursive: true });
  for (const relPath of context.scannedFiles) {
    const outPath = path.join(context.outputFolder, relPath);
    try {
      await fs.unlink(outPath);
    } catch {
      // ignore if not exists or cannot unlink
    }
  }
}

async function traverseDirectory(
  context: OptimizationContext,
  directory: string,
  isCollection: boolean = false
): Promise<void> {
  if (context.options.verbose) {
    const relativeDir = path.relative(context.inputFolder, directory);
    console.log(`Scanning directory: ${relativeDir || '.'}`);
  }
  const entries = await fs.readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await traverseDirectory(context, entryPath, isCollection);
        return;
      }
      const relativePath = path.relative(context.inputFolder, entryPath);
      if (isCollection) {
        context.scannedFiles.add(relativePath);
      } else {
        await processAsset(context, entryPath);
      }
    })
  );
}

async function processAsset(context: OptimizationContext, filePath: string): Promise<void> {
  let descriptor: AssetFormatDescriptor;
  try {
    descriptor = determineFormat(filePath);
  } catch {
    await copyAsset(context, filePath);
    return;
  }

  const relativePath = path.relative(context.inputFolder, filePath);
  if (context.options.verbose) {
    console.log(`Processing ${descriptor.category}: ${relativePath} (${descriptor.extension})`);
  }

  const fileBuffer = await fs.readFile(filePath);
  const originalAsset = new mediaFile(
    path.basename(filePath),
    fileBuffer,
    relativePath,
    descriptor
  );
  const originalSize = originalAsset.data.length;
  let optimizedAsset = await optimizeAsset(context, originalAsset);
  let optimizedSize = optimizedAsset.data.length;

  if (optimizedSize >= originalSize) {
    optimizedAsset = originalAsset;
    optimizedSize = originalSize;
  }

  await writeOptimizedAsset(context, optimizedAsset);

  context.totalOriginalSize += originalSize;
  context.totalOptimizedSize += optimizedSize;
  context.processedFiles += 1;
  if (optimizedSize < originalSize) {
    context.optimizedFiles += 1;
  }

  if (context.options.verbose) {
    const savings = originalSize - optimizedSize;
    const savingsPercent = originalSize > 0 ? ((savings / originalSize) * 100).toFixed(1) : '0.0';
    const operator = savings > 0 ? '-' : '+';
    console.log(
      `${relativePath}: ${formatSize(originalSize)} → ${formatSize(optimizedSize)} (${operator}${formatSize(Math.abs(savings))} / ${savingsPercent}%)`
    );
  }
}

function determineFormat(file: string): AssetFormatDescriptor {
  const extension = path.extname(file).slice(1).toLowerCase();
  if (!extension) {
    throw new Error('Missing file extension');
  }
  const descriptor = getDescriptorForExtension(extension);
  if (!descriptor) {
    throw new Error(`Unsupported file format: ${extension}`);
  }
  return descriptor;
}

async function optimizeAsset(context: OptimizationContext, file: mediaFile): Promise<mediaFile> {
  switch (file.category) {
    case 'image':
      return optimizeImageAsset(context, file);
    case 'vector':
      return optimizeVectorAsset(context, file);
    case 'data':
      return optimizeDataAsset(context, file);
    case 'video':
      return optimizeVideoAsset(context, file);
    default:
      return file;
  }
}

async function optimizeImageAsset(
  context: OptimizationContext,
  file: mediaFile
): Promise<mediaFile> {
  const format = file.descriptor.extension;
  if (!supportedImageFormats.includes(format as ImageFormat)) {
    return file;
  }
  const buffer = await compressImage(
    file.data,
    format as ImageFormat,
    context.options.imageQuality,
    (message) => recordWarning(context, message)
  );
  return new mediaFile(file.filename, buffer, file.path, file.descriptor);
}

async function optimizeVectorAsset(
  context: OptimizationContext,
  file: mediaFile
): Promise<mediaFile> {
  const format = file.descriptor.extension;
  if (!supportedVectorFormats.includes(format as VectorFormat)) {
    return file;
  }
  const svgText = file.data.toString('utf8');
  const result = optimizeSvg(svgText, {
    multipass: true,
    floatPrecision: 2,
  });
  if (!('data' in result) || typeof result.data !== 'string') {
    recordWarning(context, `[asset-optimizer] Failed to optimize SVG file: ${file.path}`);
    return file;
  }
  return new mediaFile(file.filename, Buffer.from(result.data, 'utf8'), file.path, file.descriptor);
}

async function optimizeDataAsset(
  context: OptimizationContext,
  file: mediaFile
): Promise<mediaFile> {
  const format = file.descriptor.extension;
  if (!supportedDataFormats.includes(format as DataFormat)) {
    return file;
  }
  try {
    const parsed = JSON.parse(file.data.toString('utf8'));
    const minified = JSON.stringify(parsed);
    return new mediaFile(file.filename, Buffer.from(minified, 'utf8'), file.path, file.descriptor);
  } catch (error) {
    recordWarning(
      context,
      `[asset-optimizer] Failed to minify JSON file ${file.path}: ${(error as Error).message}`
    );
    return file;
  }
}

async function optimizeVideoAsset(
  context: OptimizationContext,
  file: mediaFile
): Promise<mediaFile> {
  const format = file.descriptor.extension;
  if (!supportedVideoFormats.includes(format as VideoFormat)) {
    return file;
  }

  if (!hasWebCodecs()) {
    recordWarning(
      context,
      `[asset-optimizer] Skipping video optimization for ${file.path}. WebCodecs API not detected in this runtime.`
    );
    return file;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mediabunnyModule: any;
  try {
    mediabunnyModule = await import('mediabunny');
  } catch (error) {
    recordWarning(
      context,
      `[asset-optimizer] mediabunny is not available. Install it to enable video optimization. Skipping ${file.path}. ${(error as Error).message}`
    );
    return file;
  }

  const {
    Input,
    Output,
    Conversion,
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    QUALITY_MEDIUM,
  } = mediabunnyModule ?? {};

  if (!Input || !Output || !Conversion || !BlobSource || !BufferTarget) {
    recordWarning(
      context,
      `[asset-optimizer] mediabunny is present but missing conversion APIs. Skipping ${file.path}.`
    );
    return file;
  }

  try {
    const bufferSlice = file.data.buffer.slice(
      file.data.byteOffset,
      file.data.byteOffset + file.data.byteLength
    ) as ArrayBuffer;
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(new Blob([bufferSlice])),
    });
    const output = new Output({
      format: format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat(),
      target: new BufferTarget(),
    });

    const conversion = await Conversion.init({
      input,
      output,
      video: {
        bitrate: QUALITY_MEDIUM,
      },
      audio: {
        bitrate: QUALITY_MEDIUM,
      },
    });

    if (!conversion || conversion.isValid === false) {
      recordWarning(
        context,
        `[asset-optimizer] mediabunny could not initialize conversion for ${file.path}.`
      );
      return file;
    }

    await conversion.execute();
    const outputBuffer = output.target?.buffer as ArrayBuffer | undefined;
    if (!outputBuffer) {
      recordWarning(
        context,
        `[asset-optimizer] mediabunny did not produce output for ${file.path}.`
      );
      return file;
    }

    return new mediaFile(file.filename, Buffer.from(outputBuffer), file.path, file.descriptor);
  } catch (error) {
    recordWarning(
      context,
      `[asset-optimizer] Failed to optimize video ${file.path}: ${(error as Error).message}`
    );
    return file;
  }
}

async function compressImage(
  data: Buffer,
  format: ImageFormat,
  quality: number,
  warn: (message: string) => void = (message) => console.warn(message)
): Promise<Buffer> {
  try {
    const image = sharp(data, { failOnError: false });
    if (format === 'png') {
      return await image
        .png({
          quality,
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
        })
        .toBuffer();
    }
    if (format === 'jpg' || format === 'jpeg') {
      return await image
        .jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling: '4:4:4',
        })
        .toBuffer();
    }
    if (format === 'avif') {
      try {
        return await image
          .avif({
            quality,
            effort: 5,
          })
          .toBuffer();
      } catch (error) {
        warn(
          `[asset-optimizer] AVIF encoding not supported. Falling back to WebP. Error message: ${(error as Error).message}`
        );
        return await image
          .webp({
            quality,
            effort: 4,
            alphaQuality: quality,
            nearLossless: false,
          })
          .toBuffer();
      }
    }
    return await image
      .webp({
        quality,
        effort: 4,
        alphaQuality: quality,
        nearLossless: false,
      })
      .toBuffer();
  } catch (error) {
    warn(`[asset-optimizer] Failed to compress image (${format}): ${(error as Error).message}`);
    return data;
  }
}

async function writeOptimizedAsset(context: OptimizationContext, file: mediaFile): Promise<void> {
  const destinationPath = path.join(context.outputFolder, file.path);
  const destinationDir = path.dirname(destinationPath);
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.writeFile(destinationPath, file.data);
  if (context.options.verbose) {
    console.log(`Wrote optimized file: ${file.path}`);
  }
}

async function copyAsset(context: OptimizationContext, filePath: string): Promise<void> {
  const relativePath = path.relative(context.inputFolder, filePath);
  if (context.isSelfReplace) {
    if (context.options.verbose) {
      console.log(`Skipped copying unsupported file during self-replacement: ${relativePath}`);
    }
    return;
  }
  const destinationPath = path.join(context.outputFolder, relativePath);
  const destinationDir = path.dirname(destinationPath);
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.copyFile(filePath, destinationPath);
  if (context.options.verbose) {
    console.log(`Copied file: ${relativePath}`);
  }
}

function hasWebCodecs(): boolean {
  const globalScope = globalThis as { VideoEncoder?: unknown; VideoDecoder?: unknown };
  return (
    typeof globalScope.VideoEncoder === 'function' && typeof globalScope.VideoDecoder === 'function'
  );
}

function recordWarning(context: OptimizationContext, message: string): void {
  if (context.warningMessages.has(message)) {
    return;
  }
  context.warningMessages.add(message);
  if (typeof context.options.onWarning === 'function') {
    context.options.onWarning(message);
  } else {
    console.warn(message);
  }
}

function buildOptimizeResult(context: OptimizationContext): OptimizeResult {
  const totalSavings = context.totalOriginalSize - context.totalOptimizedSize;
  const totalSavingsPercent =
    context.totalOriginalSize > 0 ? (totalSavings / context.totalOriginalSize) * 100 : 0;
  const savingsOperator = totalSavings > 0 ? '-' : '+';
  const totalsLine = `Total: ${formatSize(context.totalOriginalSize)} → ${formatSize(context.totalOptimizedSize)} (${savingsOperator}${formatSize(Math.abs(totalSavings))} / ${totalSavingsPercent.toFixed(1)}%)`;
  const processedLine = `Processed ${context.processedFiles} file(s); improvements on ${context.optimizedFiles}.`;
  const destinationLine = `Optimized assets from ${context.providedInput} → ${context.providedOutput}`;

  return {
    input: context.providedInput,
    output: context.providedOutput,
    inputDirectory: context.inputFolder,
    outputDirectory: context.outputFolder,
    totalOriginalSize: context.totalOriginalSize,
    totalOptimizedSize: context.totalOptimizedSize,
    totalSavings,
    totalSavingsPercent,
    filesScanned: context.scannedFiles.size,
    filesProcessed: context.processedFiles,
    filesOptimized: context.optimizedFiles,
    warnings: Array.from(context.warningMessages),
    summary: {
      totalsLine,
      processedLine,
      destinationLine,
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function compressImageBuffer(
  data: Buffer,
  format: SupportedFormat,
  quality: number
): Promise<Buffer> {
  if (!supportedImageFormats.includes(format as ImageFormat)) {
    return data;
  }
  return compressImage(data, format as ImageFormat, quality);
}

export const _internals = {
  parseArguments,
  determineFormat,
  compressImage,
  compressImageBuffer,
  optimizeImageAsset,
  optimizeVectorAsset,
  optimizeDataAsset,
  optimizeVideoAsset,
};
