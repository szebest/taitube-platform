import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';

const STAGE = 'captions';

/**
 * A kill (out of memory, a node draining) is worth another attempt; a model whisper cannot load or
 * audio it cannot read will fail the same way every time.
 */
export function classifyWhisperFailure(
  exitCode: number | null,
  signal: string | null,
  stderr: string
): MediaFailure {
  const tail = stderr.slice(-300);
  const lower = stderr.toLowerCase();

  if (exitCode === 137 || signal === 'SIGKILL') {
    return mediaFailure(STAGE, ErrorCodes.WHISPER_KILLED, `whisper was killed: ${tail}`);
  }
  if (lower.includes('failed to initialize whisper context') || lower.includes('failed to load')) {
    return mediaFailure(
      STAGE,
      ErrorCodes.WHISPER_MODEL_INVALID,
      `whisper cannot load its model: ${tail}`
    );
  }
  if (lower.includes('failed to read audio')) {
    return mediaFailure(
      STAGE,
      ErrorCodes.WHISPER_INPUT_REJECTED,
      `whisper cannot read the audio: ${tail}`
    );
  }
  return mediaFailure(
    STAGE,
    ErrorCodes.WHISPER_FAILED,
    `whisper failed (exit code ${exitCode}, signal ${signal}): ${tail}`
  );
}
