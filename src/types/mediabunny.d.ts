declare module 'mediabunny' {
  export const ALL_FORMATS: unknown;
  export const QUALITY_MEDIUM: number;

  export class BlobSource {
    constructor(source: Blob);
  }

  export class BufferTarget {
    buffer?: ArrayBuffer;
  }

  export class Mp4OutputFormat {
    constructor(options?: unknown);
  }

  export class WebMOutputFormat {
    constructor(options?: unknown);
  }

  export class Input {
    constructor(options: { formats: unknown; source: BlobSource });
  }

  export class Output {
    target?: BufferTarget;
    constructor(options: { format: unknown; target: BufferTarget });
  }

  export class Conversion {
    static init(options: unknown): Promise<Conversion>;
    isValid?: boolean;
    execute(): Promise<void>;
  }
}
