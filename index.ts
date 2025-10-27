import { promises as fs } from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import { optimize as optimizeSvg } from "svgo";
import type {
    AssetFormatDescriptor,
    SupportedFormat,
    ImageFormat,
    VectorFormat,
    DataFormat,
    VideoFormat,
} from "./formats.js";
import {
    supportedImageFormats,
    supportedVectorFormats,
    supportedDataFormats,
    supportedVideoFormats,
    getDescriptorForExtension,
} from "./formats.js";
import { mediaFile } from "./file.js";

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

export type OptimizeResult = {
    totalOriginalSize: number;
    totalOptimizedSize: number;
    filesScanned: number;
    filesProcessed: number;
    filesOptimized: number;
    warnings: string[];
};

const DEFAULT_OPTIONS: ResolvedOptions = {
    imageQuality: 80,
    verbose: false,
};

let inputFolder: string;
let outputFolder: string;
let options: ResolvedOptions = { ...DEFAULT_OPTIONS };
let totalOriginalSize = 0;
let totalOptimizedSize = 0;
let scannedFiles: Set<string> = new Set();
let processedFiles = 0;
let optimizedFiles = 0;
let warningMessages: Set<string> = new Set();

export async function configure(input: string, output: string, opts: OptimizeOptions = {}): Promise<OptimizeResult> {
    if (!input) {
        throw new Error("An input folder must be provided.");
    }
    if (!output) {
        throw new Error("An output folder must be provided.");
    }

    inputFolder = path.resolve(process.cwd(), input);
    outputFolder = path.resolve(process.cwd(), output);
    options = resolveOptions(opts);

    resetTotals();
    await scanInputFolder();

    return {
        totalOriginalSize,
        totalOptimizedSize,
        filesScanned: scannedFiles.size,
        filesProcessed: processedFiles,
        filesOptimized: optimizedFiles,
        warnings: Array.from(warningMessages),
    };
}

export function parseArguments(args: string[]): { input: string; output: string; quality?: number; verbose?: boolean } {
    const result: { input: string; output: string; quality?: number; verbose?: boolean } = { input: "", output: "", verbose: false };

    for (let index = 0; index < args.length; index += 1) {
        const current = args[index];
        if (current === undefined) {
            continue;
        }
        switch (current) {
            case "--input":
            case "-i":
                result.input = args[++index] ?? "";
                break;
            case "--output":
            case "-o":
                result.output = args[++index] ?? "";
                break;
            case "--quality":
            case "-q": {
                const value = Number(args[++index]);
                if (!Number.isFinite(value)) {
                    throw new Error("Image quality must be a valid number.");
                }
                result.quality = value;
                break;
            }
            case "--verbose":
            case "-v":
                result.verbose = true;
                break;
            default:
                if (current.startsWith("-")) {
                    throw new Error(`Unknown option: ${current}`);
                }
        }
    }

    if (!result.input) {
        throw new Error("Missing required --input option.");
    }
    if (!result.output) {
        throw new Error("Missing required --output option.");
    }

    if (result.quality !== undefined) {
        result.quality = clamp(result.quality, 1, 100);
    }

    return result;
}

function resolveOptions(opts: OptimizeOptions): ResolvedOptions {
    const resolved: ResolvedOptions = {
        imageQuality: clamp(opts.imageQuality ?? DEFAULT_OPTIONS.imageQuality, 1, 100),
        verbose: opts.verbose ?? DEFAULT_OPTIONS.verbose,
    };
    if (typeof opts.onWarning === "function") {
        resolved.onWarning = opts.onWarning;
    }
    return resolved;
}

function resetTotals(): void {
    totalOriginalSize = 0;
    totalOptimizedSize = 0;
    processedFiles = 0;
    optimizedFiles = 0;
    scannedFiles = new Set();
    warningMessages = new Set();
}

async function scanInputFolder(): Promise<void> {
    if (options.verbose) {
        console.log(`Scanning input folder: ${inputFolder}`);
    }
    await ensureInputFolder();
    await traverseDirectory(inputFolder, true); // first pass to collect scanned files
    await prepareOutputFolder();
    await traverseDirectory(inputFolder, false); // second pass to process
}

async function ensureInputFolder(): Promise<void> {
    try {
        const inputStats = await fs.stat(inputFolder);
        if (!inputStats.isDirectory()) {
            throw new Error(`Input path is not a directory: ${inputFolder}`);
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(`Input folder does not exist: ${inputFolder}`);
        }
        throw error;
    }
}

async function prepareOutputFolder(): Promise<void> {
    if (options.verbose) {
        console.log(`Preparing output folder: ${outputFolder}`);
    }
    await fs.mkdir(outputFolder, { recursive: true });
    for (const relPath of scannedFiles) {
        const outPath = path.join(outputFolder, relPath);
        try {
            await fs.unlink(outPath);
        } catch {
            // ignore if not exists or cannot unlink
        }
    }
}

async function traverseDirectory(directory: string, isCollection: boolean = false): Promise<void> {
    if (options.verbose) {
        const relativeDir = path.relative(inputFolder, directory);
        console.log(`Scanning directory: ${relativeDir || '.'}`);
    }
    const entries = await fs.readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await traverseDirectory(entryPath, isCollection);
            return;
        }
        const relativePath = path.relative(inputFolder, entryPath);
        if (isCollection) {
            scannedFiles.add(relativePath);
        } else {
            await processAsset(entryPath);
        }
    }));
}

async function processAsset(filePath: string): Promise<void> {
    let descriptor: AssetFormatDescriptor;
    try {
        descriptor = determineFormat(filePath);
    } catch {
        await copyAsset(filePath);
        return;
    }

    const relativePath = path.relative(inputFolder, filePath);
    if (options.verbose) {
        console.log(`Processing ${descriptor.category}: ${relativePath} (${descriptor.extension})`);
    }

    const fileBuffer = await fs.readFile(filePath);
    const originalAsset = new mediaFile(path.basename(filePath), fileBuffer, relativePath, descriptor);
    const originalSize = originalAsset.data.length;
    let optimizedAsset = await optimizeAsset(originalAsset);
    let optimizedSize = optimizedAsset.data.length;

    if (optimizedSize >= originalSize) {
        optimizedAsset = originalAsset;
        optimizedSize = originalSize;
    }

    await writeOptimizedAsset(optimizedAsset);

    totalOriginalSize += originalSize;
    totalOptimizedSize += optimizedSize;
    processedFiles += 1;
    if (optimizedSize < originalSize) {
        optimizedFiles += 1;
    }

    if (options.verbose) {
        const savings = originalSize - optimizedSize;
        const savingsPercent = originalSize > 0 ? ((savings / originalSize) * 100).toFixed(1) : "0.0";
        const operator = savings > 0 ? "-" : "+";
        console.log(`${relativePath}: ${formatSize(originalSize)} → ${formatSize(optimizedSize)} (${operator}${formatSize(Math.abs(savings))} / ${savingsPercent}%)`);
    }
}

function determineFormat(file: string): AssetFormatDescriptor {
    const extension = path.extname(file).slice(1).toLowerCase();
    if (!extension) {
        throw new Error("Missing file extension");
    }
    const descriptor = getDescriptorForExtension(extension);
    if (!descriptor) {
        throw new Error(`Unsupported file format: ${extension}`);
    }
    return descriptor;
}

async function optimizeAsset(file: mediaFile): Promise<mediaFile> {
    switch (file.category) {
        case "image":
            return optimizeImageAsset(file);
        case "vector":
            return optimizeVectorAsset(file);
        case "data":
            return optimizeDataAsset(file);
        case "video":
            return optimizeVideoAsset(file);
        default:
            return file;
    }
}

async function optimizeImageAsset(file: mediaFile): Promise<mediaFile> {
    const format = file.descriptor.extension;
    if (!supportedImageFormats.includes(format as ImageFormat)) {
        return file;
    }
    const buffer = await compressImage(file.data, format as ImageFormat, options.imageQuality);
    return new mediaFile(file.filename, buffer, file.path, file.descriptor);
}

async function optimizeVectorAsset(file: mediaFile): Promise<mediaFile> {
    const format = file.descriptor.extension;
    if (!supportedVectorFormats.includes(format as VectorFormat)) {
        return file;
    }
    const svgText = file.data.toString("utf8");
    const result = optimizeSvg(svgText, {
        multipass: true,
        floatPrecision: 2,
    });
    if (!("data" in result) || typeof result.data !== "string") {
        recordWarning(`[asset-optimizer] Failed to optimize SVG file: ${file.path}`);
        return file;
    }
    return new mediaFile(file.filename, Buffer.from(result.data, "utf8"), file.path, file.descriptor);
}

async function optimizeDataAsset(file: mediaFile): Promise<mediaFile> {
    const format = file.descriptor.extension;
    if (!supportedDataFormats.includes(format as DataFormat)) {
        return file;
    }
    try {
        const parsed = JSON.parse(file.data.toString("utf8"));
        const minified = JSON.stringify(parsed);
        return new mediaFile(file.filename, Buffer.from(minified, "utf8"), file.path, file.descriptor);
    } catch (error) {
        recordWarning(`[asset-optimizer] Failed to minify JSON file ${file.path}: ${(error as Error).message}`);
        return file;
    }
}

async function optimizeVideoAsset(file: mediaFile): Promise<mediaFile> {
    const format = file.descriptor.extension;
    if (!supportedVideoFormats.includes(format as VideoFormat)) {
        return file;
    }

    if (!hasWebCodecs()) {
        recordWarning(`[asset-optimizer] Skipping video optimization for ${file.path}. WebCodecs API not detected in this runtime.`);
        return file;
    }

    let mediabunnyModule: any;
    try {
        mediabunnyModule = await import("mediabunny");
    } catch (error) {
        recordWarning(`[asset-optimizer] mediabunny is not available. Install it to enable video optimization. Skipping ${file.path}. ${(error as Error).message}`);
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
        recordWarning(`[asset-optimizer] mediabunny is present but missing conversion APIs. Skipping ${file.path}.`);
        return file;
    }

    try {
        const bufferSlice = file.data.buffer.slice(
            file.data.byteOffset,
            file.data.byteOffset + file.data.byteLength,
        ) as ArrayBuffer;
        const input = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(new Blob([bufferSlice])),
        });
        const output = new Output({
            format: format === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat(),
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
            recordWarning(`[asset-optimizer] mediabunny could not initialize conversion for ${file.path}.`);
            return file;
        }

        await conversion.execute();
        const outputBuffer = output.target?.buffer as ArrayBuffer | undefined;
        if (!outputBuffer) {
            recordWarning(`[asset-optimizer] mediabunny did not produce output for ${file.path}.`);
            return file;
        }
        return new mediaFile(file.filename, Buffer.from(outputBuffer), file.path, file.descriptor);
    } catch (error) {
        recordWarning(`[asset-optimizer] Failed to optimize video ${file.path}: ${(error as Error).message}`);
        return file;
    }
}

async function compressImage(data: Buffer, format: ImageFormat, quality: number): Promise<Buffer> {
    try {
        const image = sharp(data, { failOnError: false });
        if (format === "png") {
            return await image
                .png({
                    quality,
                    compressionLevel: 9,
                    adaptiveFiltering: true,
                    palette: true,
                })
                .toBuffer();
        }
        if (format === "jpg" || format === "jpeg") {
            return await image
                .jpeg({
                    quality,
                    mozjpeg: true,
                    chromaSubsampling: "4:4:4",
                })
                .toBuffer();
        }
        if (format === "avif") {
            try {
                return await image
                    .avif({
                        quality,
                        effort: 5,
                    })
                    .toBuffer();
            } catch (error) {
                recordWarning(`[asset-optimizer] AVIF encoding not supported. Falling back to WebP.`);
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
        recordWarning(`[asset-optimizer] Failed to compress image (${format}): ${(error as Error).message}`);
        return data;
    }
}

async function writeOptimizedAsset(file: mediaFile): Promise<void> {
    const destinationPath = path.join(outputFolder, file.path);
    const destinationDir = path.dirname(destinationPath);
    await fs.mkdir(destinationDir, { recursive: true });
    await fs.writeFile(destinationPath, file.data);
    if (options.verbose) {
        console.log(`Wrote optimized file: ${file.path}`);
    }
}

async function copyAsset(filePath: string): Promise<void> {
    const relativePath = path.relative(inputFolder, filePath);
    const destinationPath = path.join(outputFolder, relativePath);
    const destinationDir = path.dirname(destinationPath);
    await fs.mkdir(destinationDir, { recursive: true });
    await fs.copyFile(filePath, destinationPath);
    if (options.verbose) {
        console.log(`Copied file: ${relativePath}`);
    }
}

function hasWebCodecs(): boolean {
    const globalScope = globalThis as { VideoEncoder?: unknown; VideoDecoder?: unknown };
    return typeof globalScope.VideoEncoder === "function" && typeof globalScope.VideoDecoder === "function";
}

function recordWarning(message: string): void {
    if (warningMessages.has(message)) {
        return;
    }
    warningMessages.add(message);
    if (typeof options.onWarning === "function") {
        options.onWarning(message);
    } else {
        console.warn(message);
    }
}

function formatSize(bytes: number): string {
    if (bytes === 0) {
        return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export async function compressImageBuffer(data: Buffer, format: SupportedFormat, quality: number): Promise<Buffer> {
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