import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import { err, isOk, ok, parseJson, type Result } from '@vp/result';
import { z } from 'zod';
import type { TimedCue } from './cue';

const WhisperJson = z.object({
  result: z.object({ language: z.string() }),
  transcription: z.array(
    z.object({
      offsets: z.object({ from: z.number(), to: z.number() }),
      text: z.string(),
    })
  ),
});

export interface WhisperTranscript {
  language: string;
  cues: TimedCue[];
}

/** Offsets are milliseconds into the audio whisper was given; empty segments are dropped. */
export function parseWhisperOutput(text: string): Result<WhisperTranscript, MediaFailure> {
  const json = parseJson(text);
  const parsed = isOk(json) ? WhisperJson.safeParse(json.value) : undefined;
  if (!parsed?.success) {
    return err(
      mediaFailure('captions', ErrorCodes.WHISPER_FAILED, 'whisper wrote no readable JSON')
    );
  }

  return ok({
    language: parsed.data.result.language,
    cues: parsed.data.transcription
      .map((segment) => ({
        startMs: segment.offsets.from,
        endMs: segment.offsets.to,
        text: segment.text.trim(),
      }))
      .filter((cue) => cue.text !== ''),
  });
}
