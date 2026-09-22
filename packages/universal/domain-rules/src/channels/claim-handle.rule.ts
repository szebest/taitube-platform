import type { Channel } from '@vp/domain';
import { type Result, andThen, err, ok } from '@vp/result';
import { type InvalidHandleFormat, validateHandle } from '@vp/validation';
import { type HandleTaken, handleTaken } from './failures.js';

export interface ClaimHandleInput {
  readonly handle: string;
  /** The channel currently holding the normalised handle, as a repository read found it. */
  readonly heldBy: Channel | null;
  /** The claimant, so re-claiming the handle you already hold is not a conflict. */
  readonly claimantChannelId?: string;
}

export type ClaimHandleFailure = InvalidHandleFormat | HandleTaken;

export function decideHandleClaim(input: ClaimHandleInput): Result<string, ClaimHandleFailure> {
  return andThen(validateHandle(input.handle), (normalized) => {
    const takenByAnother = input.heldBy !== null && input.heldBy.id !== input.claimantChannelId;
    return takenByAnother ? err(handleTaken(normalized)) : ok(normalized);
  });
}
