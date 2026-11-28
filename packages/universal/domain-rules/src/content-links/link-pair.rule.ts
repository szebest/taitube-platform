import { type Result, err, ok } from '@kit/result';
import { type ContentLinkRelation, type ContentRef, RELATIONS, sameContentRef } from '@vp/domain';
import {
  type LinkPairNotAllowed,
  type LinkRelationSameChannel,
  type LinkSelf,
  linkPairNotAllowed,
  linkRelationSameChannel,
  linkSelf,
} from './failures';

export interface LinkPairInput {
  readonly relation: ContentLinkRelation;
  readonly source: ContentRef;
  readonly target: ContentRef;
  readonly sourceChannelId: string;
  readonly targetChannelId: string;
}

export type LinkPairFailure = LinkSelf | LinkPairNotAllowed | LinkRelationSameChannel;

/** `clip_of` is read from the clips table, so it is never a pair a caller may store. */
export function decideLinkPair(input: LinkPairInput): Result<void, LinkPairFailure> {
  const { relation, source, target, sourceChannelId, targetChannelId } = input;
  if (sameContentRef(source, target)) return err(linkSelf());

  const spec = RELATIONS[relation];
  const allowed =
    relation !== 'clip_of' &&
    (spec.sources as readonly string[]).includes(source.type) &&
    (spec.targets as readonly string[]).includes(target.type);
  if (!allowed) return err(linkPairNotAllowed(relation));

  if (sourceChannelId !== targetChannelId && !spec.acrossChannels) {
    return err(linkRelationSameChannel(relation));
  }
  return ok(undefined);
}
