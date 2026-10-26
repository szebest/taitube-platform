declare module 'node-webvtt' {
  interface WebVttCue {
    identifier: string;
    start: number;
    end: number;
    text: string;
    styles: string;
  }

  interface ParseResult {
    valid: boolean;
    cues: WebVttCue[];
    errors: { message: string }[];
  }

  const webvtt: {
    parse(input: string, options?: { strict?: boolean; meta?: boolean }): ParseResult;
    compile(input: { valid: true; cues: WebVttCue[] }): string;
  };

  export default webvtt;
}
