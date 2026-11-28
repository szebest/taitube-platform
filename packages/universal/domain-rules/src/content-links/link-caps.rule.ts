import { type Result, err, ok } from '@kit/result';
import { LINKS_PER_CHANNEL, OUTGOING_LINKS_PER_ITEM } from '@vp/domain';
import { type LinkLimit, linkLimit } from './failures';

export interface LinkCapsInput {
  /** Links the source already has, not counting the one being added. */
  readonly outgoing: number;
  readonly channelTotal: number;
}

export function decideLinkCaps({ outgoing, channelTotal }: LinkCapsInput): Result<void, LinkLimit> {
  if (outgoing >= OUTGOING_LINKS_PER_ITEM) return err(linkLimit('item', OUTGOING_LINKS_PER_ITEM));
  if (channelTotal >= LINKS_PER_CHANNEL) return err(linkLimit('channel', LINKS_PER_CHANNEL));
  return ok(undefined);
}
