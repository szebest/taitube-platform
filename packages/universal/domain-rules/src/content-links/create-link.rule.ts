import { type Result, andThen, map } from '@kit/result';
import type { ContentLinkRelation, ContentRef, LinkAnchors, LinkPolicy } from '@vp/domain';
import { type UserContext, canActOnContentLink } from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import type { LinkAnchorInvalid, LinkLimit, LinkLoop } from './failures';
import { type AnchorSide, decideLinkAnchors } from './link-anchors.rule';
import { decideLinkCaps } from './link-caps.rule';
import { decideLinkLoop } from './link-loop.rule';
import { type LinkPairFailure, decideLinkPair } from './link-pair.rule';
import { type LinkPolicyFailure, decideLinkStatus } from './link-policy.rule';

export interface LinkEnd {
  readonly ref: ContentRef;
  readonly channelId: string;
  readonly ownerId: string;
  readonly anchor: AnchorSide;
}

export interface CreateLinkInput {
  readonly actor: UserContext | null;
  readonly relation: ContentLinkRelation;
  readonly source: LinkEnd;
  readonly target: LinkEnd & { readonly policy: LinkPolicy; readonly public: boolean };
  readonly anchors: LinkAnchors;
  readonly outgoing: number;
  readonly channelTotal: number;
  readonly chainEdges: ReadonlyMap<string, readonly string[]>;
}

export type CreateLinkFailure =
  | AuthorizationFailure
  | LinkPairFailure
  | LinkAnchorInvalid
  | LinkLimit
  | LinkLoop
  | LinkPolicyFailure;

export interface LinkToWrite {
  readonly status: 'active' | 'pending';
  readonly anchors: LinkAnchors;
}

export function decideLinkWrite(
  actor: UserContext | null,
  channel: { readonly channelId: string; readonly ownerId: string },
  action: 'link' | 'approveLink' | 'removeInboundLink'
): Result<UserContext, AuthorizationFailure> {
  return authorize(actor, canActOnContentLink({ user: actor, action, channel }), {
    action,
    subject: 'ContentLink',
  });
}

/** Permission on the source first, so a stranger learns nothing about the target or the caps. */
export function decideCreateLink(input: CreateLinkInput): Result<LinkToWrite, CreateLinkFailure> {
  const { actor, relation, source, target, anchors } = input;
  return andThen(
    decideLinkWrite(actor, source, 'link'),
    (): Result<LinkToWrite, CreateLinkFailure> =>
      andThen(
        decideLinkPair({
          relation,
          source: source.ref,
          target: target.ref,
          sourceChannelId: source.channelId,
          targetChannelId: target.channelId,
        }),
        (): Result<LinkToWrite, CreateLinkFailure> =>
          andThen(
            decideLinkAnchors({ anchors, source: source.anchor, target: target.anchor }),
            (checked): Result<LinkToWrite, CreateLinkFailure> =>
              andThen(decideLinkCaps(input), () =>
                andThen(
                  decideLinkLoop({
                    relation,
                    source: source.ref,
                    target: target.ref,
                    edges: input.chainEdges,
                  }),
                  () =>
                    map(
                      decideLinkStatus({
                        sourceChannelId: source.channelId,
                        targetChannelId: target.channelId,
                        policy: target.policy,
                        targetPublic: target.public,
                      }),
                      (status) => ({ status, anchors: checked })
                    )
                )
              )
          )
      )
  );
}
