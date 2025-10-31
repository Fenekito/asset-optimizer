# Asset Optimizer

A toolkit for optimizing common static assets from the command line or programmatically.

## Installation

### Global CLI

```bash
npm install -g @fenekito/asset-optimizer
```

### Local Project (dev dependency)

```bash
npm install --save-dev @fenekito/asset-optimizer
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
- `--self, --in-place, -s` — Perform optimization in place, overwriting files on the same directory.
- `--skip-warning, --yes, --force, -y` — Skip the interactive confirmation when using `--self`.

Self-replacement usage:

```bash
# In-place optimization with confirmation prompt
asset-optimizer -i ./public -s -q 60 -v

# In-place optimization with skipped prompt
asset-optimizer -i ./public -s -y -q 60

# implicit self-replace (input and output resolve to the same directory)
asset-optimizer -i ./public -o ./public -y
```

Notes about self-replacement:

- This is destructive since the original files will be overwritten with optimized versions, make sure that this is what you intend before running it with this flag, having a backup is recommended.
- The tool will not delete your input files prior to writing; it overwrites files as it processes them.
- Unsupported files are left untouched in self-replace mode (they are not copied or modified).

### Programmatic API

```ts
import { configure } from '@fenekito/asset-optimizer';

const result = await configure('./assets', './optimized', {
  imageQuality: 75,
  verbose: true,
  onWarning: (message) => console.warn(message),
});

console.log(result);
console.log(result.summary.totalsLine);
console.log(result.summary.processedLine);
console.log(result.summary.destinationLine);
```

`configure` returns raw totals, counts, and any warnings emitted during optimization, along with
CLI-equivalent summary strings in `result.summary` for easy reporting.

Programmatic in-place optimization

You can request in-place optimization by passing the same directory for `input` and `output`:

```ts
await configure('./public', './public', { imageQuality: 60 });
```

This is destructive and there is no safety prompt at the API level; ensure you have backups or version control.

## Supported Asset Types

| Category             | Extensions                 | Notes                                                                                                                             |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Raster images        | png, jpg, jpeg, webp, avif | Processed with Sharp (mozjpeg/png/webp/avif tuning)                                                                               |
| Vector graphics      | svg                        | Minified using SVGO multipass                                                                                                     |
| Data files           | json                       | Re-serialized to drop whitespace                                                                                                  |
| Video (experimental) | mp4, webm                  | Requires [`mediabunny`](https://www.npmjs.com/package/mediabunny) and a WebCodecs-enabled runtime; otherwise a warning is emitted |

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

[MIT](./LICENSE)
