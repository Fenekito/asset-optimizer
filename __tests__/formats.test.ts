import { describe, it, expect } from 'vitest';
import {
  getDescriptorForExtension,
  isSupportedFormat,
  supportedImageFormats,
  supportedVectorFormats,
  supportedDataFormats,
  supportedVideoFormats,
} from '../formats.js';

describe('formats', () => {
  describe('getDescriptorForExtension', () => {
    it('returns descriptor for supported formats', () => {
      expect(getDescriptorForExtension('png')).toEqual({
        extension: 'png',
        category: 'image',
      });
      expect(getDescriptorForExtension('svg')).toEqual({
        extension: 'svg',
        category: 'vector',
      });
      expect(getDescriptorForExtension('json')).toEqual({
        extension: 'json',
        category: 'data',
      });
      expect(getDescriptorForExtension('mp4')).toEqual({
        extension: 'mp4',
        category: 'video',
      });
    });

    it('returns undefined for unsupported formats', () => {
      expect(getDescriptorForExtension('txt')).toBeUndefined();
      expect(getDescriptorForExtension('')).toBeUndefined();
    });
  });

  describe('isSupportedFormat', () => {
    it('returns true for supported formats', () => {
      expect(isSupportedFormat('png')).toBe(true);
      expect(isSupportedFormat('webp')).toBe(true);
      expect(isSupportedFormat('svg')).toBe(true);
      expect(isSupportedFormat('json')).toBe(true);
      expect(isSupportedFormat('mp4')).toBe(true);
      expect(isSupportedFormat('webm')).toBe(true);
    });

    it('returns false for unsupported formats', () => {
      expect(isSupportedFormat('txt')).toBe(false);
      expect(isSupportedFormat('html')).toBe(false);
      expect(isSupportedFormat('')).toBe(false);
    });
  });

  describe('supported format arrays', () => {
    it('includes expected image formats', () => {
      expect(supportedImageFormats).toContain('png');
      expect(supportedImageFormats).toContain('webp');
      expect(supportedImageFormats).toContain('jpg');
      expect(supportedImageFormats).toContain('jpeg');
      expect(supportedImageFormats).toContain('avif');
    });

    it('includes expected vector formats', () => {
      expect(supportedVectorFormats).toEqual(['svg']);
    });

    it('includes expected data formats', () => {
      expect(supportedDataFormats).toEqual(['json']);
    });

    it('includes expected video formats', () => {
      expect(supportedVideoFormats).toEqual(['mp4', 'webm']);
    });
  });
});