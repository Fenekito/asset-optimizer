import type { AssetFormatDescriptor, AssetCategory, SupportedFormat } from './formats.js';

export class mediaFile {
  filename: string;
  data: Buffer;
  path: string;
  format: SupportedFormat;
  category: AssetCategory;
  descriptor: AssetFormatDescriptor;

  constructor(filename: string, data: Buffer, path: string, descriptor: AssetFormatDescriptor) {
    this.filename = filename;
    this.data = data;
    this.path = path;
    this.format = descriptor.extension;
    this.category = descriptor.category;
    this.descriptor = descriptor;
  }
}
