import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';

const PICK_FIELDS = ['videoId', 'startsAt', 'endsAt', 'note'] as const;

const FieldIssue = z.object({ field: z.enum(PICK_FIELDS) });

type PickField = (typeof PICK_FIELDS)[number];

export type PickFailure =
  | { kind: 'overlap' }
  | { kind: 'field'; field: PickField }
  | { kind: 'other' };

/** Reads a refused save as the form needs it: a window clash, the field the API rejected, or neither. */
export function pickFailureOf(cause: unknown): PickFailure {
  if (!(cause instanceof ApiError)) {
    return { kind: 'other' };
  }
  if (cause.code === ErrorCodes.PICK_WINDOW_OVERLAP) {
    return { kind: 'overlap' };
  }

  const issue = FieldIssue.safeParse(cause.problem?.errors?.[0]);
  return issue.success ? { kind: 'field', field: issue.data.field } : { kind: 'other' };
}
