import type { TranscriptCue } from '@vp/domain';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import { err, isOk, ok, parseJson, type Result } from '@vp/result';
import { z } from 'zod';
import type { TimedCue } from './cue';

/** The slice of the media timeline one window read, and the part of it whose cues it keeps. */
export interface WindowSpan {
  startMs: number;
  ownsFromMs: number;
  ownsUntilMs: number;
}

/** What one window hands its merge: its detected language and its own cues, on the media timeline. */
export interface WindowTranscript {
  language: string;
  cues: TimedCue[];
}

/**
 * Moves a window's cues onto the media timeline and keeps the ones that start inside its own span,
 * so the lead-in and tail it read for context never yield a cue twice.
 */
export function ownedCues(span: WindowSpan, cues: readonly TimedCue[]): TimedCue[] {
  return cues
    .map((cue) => ({
      ...cue,
      startMs: cue.startMs + span.startMs,
      endMs: cue.endMs + span.startMs,
    }))
    .filter((cue) => cue.startMs >= span.ownsFromMs && cue.startMs < span.ownsUntilMs);
}

function spokenMs(cues: readonly TimedCue[]): number {
  return cues.reduce((total, cue) => total + (cue.endMs - cue.startMs), 0);
}

/** The language spoken longest across the windows; the first window's when nothing was said. */
export function majorityLanguage(windows: readonly WindowTranscript[]): string | undefined {
  const byLanguage = new Map<string, number>();
  for (const window of windows) {
    byLanguage.set(window.language, (byLanguage.get(window.language) ?? 0) + spokenMs(window.cues));
  }

  let winner = windows[0]?.language;
  for (const [language, ms] of byLanguage) {
    if (ms > (byLanguage.get(winner ?? '') ?? 0)) winner = language;
  }
  return winner;
}

export function mergeWindows(windows: readonly WindowTranscript[]): TranscriptCue[] {
  return windows
    .flatMap((window) => window.cues)
    .sort((a, b) => a.startMs - b.startMs)
    .map((cue, index) => ({ index, ...cue }));
}

const WindowTranscriptJson = z.object({
  language: z.string(),
  cues: z.array(z.object({ startMs: z.number(), endMs: z.number(), text: z.string() })),
});

/** A window's file as its merge reads it back; one it cannot read fails the merge for a retry. */
export function parseWindowTranscript(text: string): Result<WindowTranscript, MediaFailure> {
  const json = parseJson(text);
  const parsed = isOk(json) ? WindowTranscriptJson.safeParse(json.value) : undefined;
  return parsed?.success
    ? ok(parsed.data)
    : err(mediaFailure('captions', ErrorCodes.WHISPER_FAILED, 'a captions window is unreadable'));
}
