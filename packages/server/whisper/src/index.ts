export * from './classify-whisper-failure';
export * from './merge-windows';
export * from './run-whisper';
export * from './webvtt';
export * from './whisper-args';
export * from './whisper-output';

import { runWhisper } from './run-whisper';

/**
 * The speech-to-text process a captions stage spawns, as one value the composition root hands it, so
 * a spec fails a stage with a double instead of spying on the module.
 */
export interface SpeechTools {
  transcribe: typeof runWhisper;
}

export const speechTools: SpeechTools = { transcribe: runWhisper };
