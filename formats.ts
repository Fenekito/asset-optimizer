export type ImageFormat = 'png' | 'webp' | 'jpg' | 'jpeg' | 'avif';
export type VectorFormat = 'svg';
export type DataFormat = 'json';
export type VideoFormat = 'mp4' | 'webm';

export type SupportedFormat = ImageFormat | VectorFormat | DataFormat | VideoFormat;
export type AssetCategory = 'image' | 'vector' | 'data' | 'video';

export interface AssetFormatDescriptor {
	extension: SupportedFormat;
	category: AssetCategory;
}

const IMAGE_FORMATS = ['png', 'webp', 'jpg', 'jpeg', 'avif'] as const;
const VECTOR_FORMATS = ['svg'] as const;
const DATA_FORMATS = ['json'] as const;
const VIDEO_FORMATS = ['mp4', 'webm'] as const;

export const supportedImageFormats: readonly ImageFormat[] = IMAGE_FORMATS;
export const supportedVectorFormats: readonly VectorFormat[] = VECTOR_FORMATS;
export const supportedDataFormats: readonly DataFormat[] = DATA_FORMATS;
export const supportedVideoFormats: readonly VideoFormat[] = VIDEO_FORMATS;

const FORMAT_DESCRIPTORS: AssetFormatDescriptor[] = [
	...IMAGE_FORMATS.map((extension) => ({ extension, category: 'image' as const })),
	...VECTOR_FORMATS.map((extension) => ({ extension, category: 'vector' as const })),
	...DATA_FORMATS.map((extension) => ({ extension, category: 'data' as const })),
	...VIDEO_FORMATS.map((extension) => ({ extension, category: 'video' as const })),
];

const lookupByExtension = new Map<string, AssetFormatDescriptor>(
	FORMAT_DESCRIPTORS.map((descriptor) => [descriptor.extension, descriptor])
);

export function getDescriptorForExtension(extension: string): AssetFormatDescriptor | undefined {
	return lookupByExtension.get(extension);
}

export function isSupportedFormat(extension: string): extension is SupportedFormat {
	return lookupByExtension.has(extension);
}
