import type { Disclosure } from '@vp/domain';

/**
 * What the next hide or remove tells the author. `v` flips the channel's default for the action
 * shown; with no default known to the viewer, the flip is an explicit visible and no flip sends none.
 */
export function chosenDisclosure(
  channelDefault: Disclosure | undefined,
  flipped: boolean
): Disclosure | undefined {
  if (!flipped) return channelDefault;
  return channelDefault === 'visible' ? 'silent' : 'visible';
}

/** A disclosure that is not known to be silent may be visible, so the author is owed a reason. */
export const needsReason = (disclosure: Disclosure | undefined): boolean => disclosure !== 'silent';
