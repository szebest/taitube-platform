export interface WhisperArgsOptions {
  modelPath: string;
  vadModelPath: string;
  inputPath: string;
  /** whisper.cpp appends `.json`. */
  outputBase: string;
  threads: number;
  /** `null` detects the language. */
  language: string | null;
}

/** JSON output, Silero VAD so silence is skipped instead of transcribed into invented text. */
export function buildWhisperArgs(options: WhisperArgsOptions): string[] {
  return [
    '--model',
    options.modelPath,
    '--file',
    options.inputPath,
    '--threads',
    String(options.threads),
    '--language',
    options.language ?? 'auto',
    '--vad',
    '--vad-model',
    options.vadModelPath,
    '--output-json',
    '--output-file',
    options.outputBase,
    '--no-prints',
  ];
}
