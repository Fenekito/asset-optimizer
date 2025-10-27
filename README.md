# Asset Optimizer

A toolkit for optimizing common static assets from the command line or programmatically.

## Installation

### Global CLI

```bash
npm install -g asset-optimizer
```

### Local Project (dev dependency)

```bash
npm install --save-dev asset-optimizer
```

## Usage

### CLI

```bash
asset-optimizer --input ./assets --output ./optimized
```

Options:
- `--input, -i` — Input folder path (required)
- `--output, -o` — Output folder path (required)
- `--quality, -q` — Image quality (1-100, default 80)
- `--verbose, -v` — Verbose logging

### Programmatic API

```ts
import { configure } from "asset-optimizer";

const result = await configure("./assets", "./optimized", {
  imageQuality: 75,
  verbose: true,
  onWarning: (message) => console.warn(message),
});

console.log(result);
```

`configure` returns totals, counts, and any warnings emitted during optimization.

## Supported Asset Types

| Category | Extensions | Notes |
| --- | --- | --- |
| Raster images | png, jpg, jpeg, webp, avif | Processed with Sharp (mozjpeg/png/webp/avif tuning) |
| Vector graphics | svg | Minified using SVGO multipass |
| Data files | json | Re-serialized to drop whitespace |
| Video (experimental) | mp4, webm | Requires [`mediabunny`](https://www.npmjs.com/package/mediabunny) and a WebCodecs-enabled runtime; otherwise a warning is emitted |

Unsupported files are copied through unmodified.

## Video Optimization

Video optimization is opt-in:

1. Install `mediabunny` (installed automatically when available).
2. Run the CLI or API in an environment with the WebCodecs API (modern Chromium, Edge, etc.).
3. Outside browsers or when WebCodecs is missing, the optimizer skips video files and surfaces a warning instead of failing.

## Development

```bash
npm install
npm run build
```

`npm run build` compiles the TypeScript sources to `dist/` with declaration files.

## License

MIT
