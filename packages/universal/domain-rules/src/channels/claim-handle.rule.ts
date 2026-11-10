import { type Channel, type ChannelHandleRetirement, HANDLE_RESERVATION_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { type Err, type Result, andThen, err, ok } from '@vp/result';
import { type InvalidHandleFormat, isReservedHandle, validateHandle } from '@vp/validation';
import { type HandleReserved, type HandleTaken, handleReserved, handleTaken } from './failures';

export interface ClaimHandleInput {
  readonly handle: string;
  /** The channel currently holding the normalised handle, as a repository read found it. */
  readonly heldBy: Channel | null;
  /** The claimant, so re-claiming the handle you already hold is not a conflict. */
  readonly claimantChannelId?: string;
  /** What the history says of the handle, with the time to judge it by: it is held for its previous owner. */
  readonly retirement?: { readonly retired: ChannelHandleRetirement | null; readonly now: Date };
}

export type ClaimHandleFailure = InvalidHandleFormat | HandleTaken | HandleReserved;

/**
 * A reserved handle is reported as taken rather than malformed: it is well-formed, somebody just
 * cannot have it. That is also what the API has always answered, and it is the answer a form can
 * act on - suggest another handle, rather than re-check the characters.
 */
export function decideHandleClaim(input: ClaimHandleInput): Result<string, ClaimHandleFailure> {
  return andThen(
    validateHandle(input.handle),
    (normalized): Result<string, HandleTaken | HandleReserved> => {
      if (isReservedHandle(normalized)) return err(handleTaken(normalized));

      const takenByAnother = input.heldBy !== null && input.heldBy.id !== input.claimantChannelId;
      if (takenByAnother) return err(handleTaken(normalized));

      return heldForAnother(normalized, input) ?? ok(normalized);
    }
  );
}

function heldForAnother(
  handle: string,
  { retirement, claimantChannelId }: ClaimHandleInput
): Err<HandleReserved> | null {
  if (!retirement?.retired || retirement.retired.channelId === claimantChannelId) return null;

  const releasedAt = new Date(
    retirement.retired.retiredAt.getTime() + HANDLE_RESERVATION_DAYS * MS_PER_DAY
  );
  return releasedAt > retirement.now ? err(handleReserved(handle, releasedAt)) : null;
}
