/// <reference path="./node-webvtt.d.ts" />
import { err, ok, type Result, tryCatch } from '@vp/result';
import webvtt from 'node-webvtt';
import type { TimedCue } from './cue';

/** Where a malformed file went wrong, by the 1-based line its cue block starts on. */
export interface WebVttError {
  line: number;
  message: string;
}

const MS_PER_SECOND = 1000;

/** The cue columns are 32-bit integers. */
const MAX_CUE_MS = 2_147_483_647;

export function toWebVtt(cues: readonly TimedCue[]): string {
  return webvtt.compile({
    valid: true,
    cues: cues.map((cue) => ({
      identifier: '',
      start: cue.startMs / MS_PER_SECOND,
      end: cue.endMs / MS_PER_SECOND,
      text: cue.text,
      styles: '',
    })),
  });
}

/**
 * The parser reports a broken block by its position (`cue #n`, the header being block zero's
 * predecessor); the creator needs the line, so the block is mapped back onto the text it came from.
 */
function lineOfBlock(text: string, block: number): number {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let seen = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const startsBlock = lines[index] !== '' && (index === 0 || lines[index - 1] === '');
    if (startsBlock) seen += 1;
    if (startsBlock && seen === block + 1) return index + 1;
  }
  return 1;
}

function blockOf(message: string): number | undefined {
  const marker = message.lastIndexOf('#');
  if (marker < 0) return undefined;
  const block = Number.parseInt(message.slice(marker + 1), 10);
  return Number.isNaN(block) ? undefined : block;
}

export function parseWebVtt(text: string): Result<TimedCue[], WebVttError> {
  const parsed = tryCatch(
    () => webvtt.parse(text, { strict: true }),
    (cause) => (cause as { message?: string })?.message ?? String(cause)
  );
  if (!parsed.ok) {
    const block = blockOf(parsed.error);
    return err({
      line: block === undefined ? 1 : lineOfBlock(text, block),
      message: parsed.error,
    });
  }

  const cues = parsed.value.cues.map((cue) => ({
    startMs: Math.round(cue.start * MS_PER_SECOND),
    endMs: Math.round(cue.end * MS_PER_SECOND),
    text: cue.text,
  }));
  const outOfRange = cues.findIndex((cue) => cue.endMs > MAX_CUE_MS);
  if (outOfRange >= 0) {
    return err({
      line: lineOfBlock(text, outOfRange),
      message: 'a cue time is beyond what a track can store',
    });
  }
  return ok(cues);
}
