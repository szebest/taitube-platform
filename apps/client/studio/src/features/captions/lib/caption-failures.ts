import { ApiError } from '@vp/api-client';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { present } from '@vp/queries';
import { z } from 'zod';

const WORKER_REASONS = {
  NO_AUDIO: 'studio.captionsReasonNoAudio',
  LANGUAGE_TAKEN: 'studio.captionsReasonLanguageTaken',
} as const;

const CODES = Object.values(ErrorCodes);

/** The sentence for why a track failed or is off: the worker's own reasons, else the error code it failed with. */
export function reasonCopy(reason: string | null | undefined) {
  const own = Object.entries(WORKER_REASONS).find(([code]) => code === reason)?.[1];
  const code = CODES.find((known) => known === reason);
  return own ?? (code === undefined ? 'studio.captionsReasonUnknown' : present({ code }).copy);
}

export function hasCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiError && error.code === code;
}

const FileIssue = z.object({ message: z.string(), line: z.number() });

/** The line a refused `.vtt` file names: the API's own sentence, such as `Line 3: ...`. */
export function fileIssueOf(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const issue = FileIssue.safeParse(error.problem?.errors?.[0]);
  return issue.success ? issue.data.message : undefined;
}
