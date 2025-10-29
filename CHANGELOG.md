# Changelog

## [1.1.0] - 2025-10-29

### Added

- Programmatic API parity with the CLI:
  - `configure()` now returns rich metadata and CLI-equivalent summary lines under `result.summary` (`totalsLine`, `processedLine`, `destinationLine`).
  - Totals now include `totalSavings` and `totalSavingsPercent` for direct consumption.
  - Absolute `inputDirectory` and `outputDirectory` paths are included for better tooling integration.
- Warning collection is consistently surfaced in the returned `result.warnings` while still supporting an `onWarning` callback.

### Changed

- Internals refactored to remove module-level mutable state. Each `configure()` invocation runs in an isolated context, improving reliability for repeated runs and parallel use.
- The CLI now prints the summary lines produced by the library and de-duplicates warnings coming from the API.
- Image compression internals accept a warning sink to unify error/warning reporting.

### Fixed

- More robust error handling for SVG/JSON minification and video optimization. When `mediabunny` or WebCodecs are unavailable, the process skips video optimization and surfaces a single, clear warning without failing.

## [1.0.0] - 2025-XX-YY

### Added

- Initial public release: CLI and programmatic API for optimizing common asset formats (PNG/JPG/WEBP/AVIF, SVG, JSON; browser-only MP4/WebM via `mediabunny`).

[1.1.0]: https://github.com/Fenekito/asset-optimizer/releases/tag/v1.1.0
[1.0.0]: https://github.com/Fenekito/asset-optimizer/releases/tag/v1.0.0
