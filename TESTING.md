# Asset Optimizer - Test Suite Documentation

## Overview

The asset-optimizer package includes a comprehensive test suite with unit tests, integration tests, and browser-based tests for video optimization.

## Test Files

### 1. `__tests__/formats.test.ts` - Format Detection Tests

Tests the format detection and classification system.

**Coverage:**

- ✅ Format descriptor lookups for all supported types
- ✅ Supported format validation
- ✅ Image format arrays (PNG, WebP, JPG, JPEG, AVIF)
- ✅ Vector format arrays (SVG)
- ✅ Data format arrays (JSON)
- ✅ Video format arrays (MP4, WebM)
- ✅ Unsupported format rejection

**Run:** `npm run test -- formats`

### 2. `__tests__/index.test.ts` - Unit Tests

Tests core library functions with mocked dependencies.

**Coverage:**

- ✅ CLI argument parsing
- ✅ Quality parameter clamping
- ✅ Input validation
- ✅ Optimization result generation
- ✅ Warning collection

**Run:** `npm run test -- index`

### 3. `__tests__/integration.test.ts` - Real File Tests

Tests actual optimization of real files in the `test-assets/` directory.

**Test Assets:**

- `image.png` - PNG image optimization
- `image.jpg` - JPEG optimization
- `image.webp` - WebP optimization
- `image.avif` - AVIF image (with fallback handling)
- `vector.svg` - SVG minification
- `data.json` - JSON minification
- `video.mp4` - MP4 video handling
- `video.webm` - WebM video handling

**Coverage:**

- ✅ PNG image optimization
- ✅ JPG image optimization
- ✅ WebP image optimization
- ✅ AVIF image optimization with graceful fallback
- ✅ SVG minification
- ✅ JSON minification
- ✅ Video file copying (MP4 & WebM)
- ✅ Multi-format batch processing
- ✅ Metrics reporting (total size, files processed)
- ✅ Warning collection without failures

**Run:** `npm run test -- integration`

### 4. `__tests__/video.browser.test.ts` - Browser Video Tests

Tests video optimization workflow using mediabunny with WebCodecs API simulation.

**Coverage:**

- ✅ WebCodecs API detection
- ✅ Video codec configuration
- ✅ Audio codec configuration
- ✅ Input/Output creation simulation
- ✅ Conversion initialization and execution
- ✅ Invalid conversion state handling
- ✅ Multiple output format support
- ✅ Quality preset application
- ✅ Bitrate calculation
- ✅ Full conversion workflow with progress tracking

**Run:** `npm run test -- video.browser`

## Running Tests

### All Tests

```bash
npm run test          # Run in watch mode
npm run test:run      # Run once and exit
npm run test:ui       # Open interactive UI
```

### Specific Test File

```bash
npm run test -- formats
npm run test -- index
npm run test -- integration
npm run test -- video.browser
```

### With Coverage

```bash
npm run test:run -- --coverage
```

## Test Configuration

Tests are configured in `vitest.config.ts`:

- **Environment:** Node.js
- **Globals:** Vitest global functions enabled
- **Plugins:** vite-plugin-dts for declaration generation
- **Mocks:** Sharp, SVGO, mediabunny, and fs modules

## Key Test Patterns

### Error Handling

- AVIF encoding failures gracefully fall back to WebP
- Image compression errors are logged as warnings
- SVG optimization failures don't crash the process
- Video optimization skips gracefully when WebCodecs unavailable

### Assertions

- File existence checks after optimization
- Size comparisons (original vs optimized)
- Metrics validation (files processed, warnings collected)
- Format-specific result verification

### Mocking

- External libraries mocked at module level
- File system operations use real files from `test-assets/`
- WebCodecs APIs mocked in browser tests
- mediabunny APIs mocked with realistic behavior

## Integration Test File Structure

The integration tests use real files organized by type:

```
test-assets/
├── image.png          # PNG image for optimization
├── image.jpg          # JPEG for optimization
├── image.webp         # WebP for optimization
├── image.avif         # AVIF with fallback support
├── vector.svg         # SVG for minification
├── data.json          # JSON for minification
├── video.mp4          # MP4 video
└── video.webm         # WebM video
```

Output is written to `test-output/integration/` and cleaned up after each test.

## Browser Test Workflow

The `video.browser.test.ts` file simulates a browser environment and tests the mediabunny integration:

1. **API Detection** - Verifies WebCodecs availability
2. **Configuration** - Tests codec setup for audio/video
3. **Input Handling** - Mocks mediabunny Input with track metadata
4. **Output Setup** - Mocks mediabunny Output with buffer target
5. **Conversion** - Tests the complete conversion workflow
6. **Progress** - Validates progress callback mechanism

## Known Limitations

### AVIF Support

- AVIF encoding requires system libavif support
- Falls back to WebP if AVIF not available

### Video Optimization

- Requires WebCodecs API (browser or Node.js with compat)
- mediabunny is optional (warnings if not available)
- Videos are currently copied when WebCodecs unavailable
