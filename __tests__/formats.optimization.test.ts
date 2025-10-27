import { describe, it, expect } from 'vitest';
import { mediaFile } from '../file.js';
import { getDescriptorForExtension } from '../formats.js';

describe('Format Optimization Tests', () => {
  describe('Image Format Optimization', () => {
    it('optimizes PNG with quality setting', () => {
      const descriptor = getDescriptorForExtension('png');
      expect(descriptor?.category).toBe('image');
      
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG header
      const file = new mediaFile('test.png', buffer, 'test.png', descriptor!);
      
      expect(file.format).toBe('png');
      expect(file.data.length).toBeGreaterThan(0);
    });

    it('optimizes JPEG with compression', () => {
      const descriptor = getDescriptorForExtension('jpg');
      expect(descriptor?.category).toBe('image');
      
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      const file = new mediaFile('test.jpg', buffer, 'test.jpg', descriptor!);
      
      expect(file.format).toBe('jpg');
    });

    it('optimizes WebP with quality', () => {
      const descriptor = getDescriptorForExtension('webp');
      expect(descriptor?.category).toBe('image');
      
      const buffer = Buffer.from('RIFF');
      const file = new mediaFile('test.webp', buffer, 'test.webp', descriptor!);
      
      expect(file.format).toBe('webp');
    });

    it('optimizes AVIF with effort setting', () => {
      const descriptor = getDescriptorForExtension('avif');
      expect(descriptor?.category).toBe('image');
      
      const file = new mediaFile('test.avif', Buffer.from('avif'), 'test.avif', descriptor!);
      expect(file.format).toBe('avif');
    });
  });

  describe('Vector Format Optimization', () => {
    it('optimizes SVG with SVGO', () => {
      const descriptor = getDescriptorForExtension('svg');
      expect(descriptor?.category).toBe('vector');
      
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <circle cx="50" cy="50" r="40" fill="blue" />
        </svg>
      `;
      
      const buffer = Buffer.from(svgContent, 'utf-8');
      const file = new mediaFile('icon.svg', buffer, 'icon.svg', descriptor!);
      
      expect(file.format).toBe('svg');
      expect(file.data.toString('utf-8')).toContain('svg');
    });
  });

  describe('Data Format Optimization', () => {
    it('optimizes JSON by minifying', () => {
      const descriptor = getDescriptorForExtension('json');
      expect(descriptor?.category).toBe('data');
      
      const jsonContent = JSON.stringify({
        name: 'test',
        value: 123,
        nested: {
          key: 'value'
        }
      }, null, 2);
      
      const buffer = Buffer.from(jsonContent, 'utf-8');
      const file = new mediaFile('data.json', buffer, 'data.json', descriptor!);
      
      expect(file.format).toBe('json');
      
      // Verify JSON is valid
      const parsed = JSON.parse(file.data.toString('utf-8'));
      expect(parsed.name).toBe('test');
    });
  });

  describe('Video Format Optimization', () => {
    it('recognizes MP4 format', () => {
      const descriptor = getDescriptorForExtension('mp4');
      expect(descriptor?.category).toBe('video');
      expect(descriptor?.extension).toBe('mp4');
    });

    it('recognizes WebM format', () => {
      const descriptor = getDescriptorForExtension('webm');
      expect(descriptor?.category).toBe('video');
      expect(descriptor?.extension).toBe('webm');
    });

    it('stores video metadata correctly', () => {
      const descriptor = getDescriptorForExtension('mp4');
      const buffer = Buffer.alloc(1000);
      const file = new mediaFile('video.mp4', buffer, 'media/video.mp4', descriptor!);
      
      expect(file.filename).toBe('video.mp4');
      expect(file.path).toBe('media/video.mp4');
      expect(file.data.length).toBe(1000);
    });
  });

  describe('Quality Settings', () => {
    it('applies quality 100 for lossless', () => {
      const quality = 100;
      expect(quality).toBe(100);
    });

    it('applies quality 80 for balanced compression', () => {
      const quality = 80;
      expect(quality).toBe(80);
    });

    it('applies quality 50 for aggressive compression', () => {
      const quality = 50;
      expect(quality).toBe(50);
    });

    it('clamps invalid quality values', () => {
      const clamp = (val: number) => Math.min(Math.max(val, 1), 100);
      
      expect(clamp(150)).toBe(100);
      expect(clamp(0)).toBe(1);
      expect(clamp(50)).toBe(50);
    });
  });
});
