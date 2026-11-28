import { andThenAsync, err, isErr, ok, type Result } from '@kit/result';
import type {
  ChannelRepositoryPort,
  ContentLinkRepositoryPort,
  ContentRefDirectoryPort,
  ResolvedContent,
} from '@vp/core/repositories';
import {
  type ContentLinkParams,
  type ContentRef,
  contentRefKey,
  type LinkAnchors,
} from '@vp/domain';
import {
  type ContentLinkNotFound,
  type CreateLinkFailure,
  contentLinkNotFound,
  decideCreateLink,
  type LinkEnd,
  type LinkToWrite,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';

export interface ContentLinkPlannerDeps {
  links: ContentLinkRepositoryPort;
  refs: ContentRefDirectoryPort;
  channels: Pick<ChannelRepositoryPort, 'findByIds'>;
}

export interface LinkRequest {
  source: ContentRef;
  target: ContentRef;
  params: ContentLinkParams;
  anchors: LinkAnchors;
}

export interface PlannedLink extends LinkToWrite {
  sourceChannelId: string;
  targetChannelId: string;
}

export type PlanLinkFailure = CreateLinkFailure | ContentLinkNotFound | DatabaseUnavailable;

function endOf(content: ResolvedContent, ownerId: string): LinkEnd {
  return {
    ref: content.ref,
    channelId: content.channelId,
    ownerId,
    anchor: { type: content.ref.type, durationMs: content.durationMs },
  };
}

/** Reads what the pure link rules need, in a fixed number of lookups, and asks them. */
export async function planLink(
  deps: ContentLinkPlannerDeps,
  actor: UserContext,
  request: LinkRequest
): Promise<Result<PlannedLink, PlanLinkFailure>> {
  const { source, target, params, anchors } = request;
  const resolved = await deps.refs.resolve([source, target]);
  return andThenAsync(resolved, async (contents): Promise<Result<PlannedLink, PlanLinkFailure>> => {
    const from = contents.get(contentRefKey(source));
    const to = contents.get(contentRefKey(target));
    if (!from) return err(contentLinkNotFound(contentRefKey(source)));
    if (!to) return err(contentLinkNotFound(contentRefKey(target)));

    const channels = await deps.channels.findByIds([from.channelId, to.channelId]);
    if (isErr(channels)) return channels;
    const ownerOf = (channelId: string) =>
      channels.value.find(({ id }) => id === channelId)?.userId ?? '';

    const [policy, outgoing, channelTotal, edges] = await Promise.all([
      deps.links.linkPolicy(to.channelId),
      deps.links.countOutgoing(source),
      deps.links.countForChannel(from.channelId),
      deps.links.chainEdges(from.channelId, params.relation),
    ]);
    if (isErr(policy)) return policy;
    if (isErr(outgoing)) return outgoing;
    if (isErr(channelTotal)) return channelTotal;
    if (isErr(edges)) return edges;

    const decided = decideCreateLink({
      actor,
      relation: params.relation,
      source: endOf(from, ownerOf(from.channelId)),
      target: {
        ...endOf(to, ownerOf(to.channelId)),
        policy: policy.value,
        public: to.public,
      },
      anchors,
      outgoing: outgoing.value,
      channelTotal: channelTotal.value,
      chainEdges: edges.value,
    });
    if (isErr(decided)) return decided;
    return ok({
      ...decided.value,
      sourceChannelId: from.channelId,
      targetChannelId: to.channelId,
    });
  });
}
