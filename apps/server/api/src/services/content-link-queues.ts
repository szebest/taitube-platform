import { andThen, andThenAsync, isErr, ok, type Result } from '@kit/result';
import type { ContentLinkView, LinkListView } from '@vp/api-contracts';
import type {
  ContentLinkRepositoryPort,
  ContentLinkStatCounts,
  ContentLinkStatsRepositoryPort,
  ContentRefDirectoryPort,
  ResolvedContent,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ContentLink,
  type ContentLinkStatus,
  contentRefKey,
  type LinkPolicy,
} from '@vp/domain';
import { authorize, decideLinkWrite } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { canReadContentLinkStats, type UserContext } from '@vp/permissions';
import type { ContentLinkNotifier } from './content-link-notifier';
import type { ContentLinkDecideFailure } from './content-link-service';
import { canSeeContent, toLinkView } from './content-link-views';

export interface ContentLinkQueuesDeps {
  links: ContentLinkRepositoryPort;
  refs: ContentRefDirectoryPort;
  stats: Pick<ContentLinkStatsRepositoryPort, 'totalsFor'>;
  notifier: ContentLinkNotifier;
}

const LIST_LIMIT = 200;
const ALL_STATUSES: ContentLinkStatus[] = ['active', 'pending', 'declined', 'broken'];

/** What a channel's team reads and sets about its links: the queues, the fix-ups, the stats and the policy. */
export class ContentLinkQueues {
  constructor(private readonly deps: ContentLinkQueuesDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel,
    view: LinkListView
  ): Promise<Result<ContentLinkView[], ContentLinkDecideFailure>> {
    const action = view === 'requests' ? 'approveLink' : 'link';
    const allowed = decideLinkWrite(user, acting, action);
    if (isErr(allowed)) return allowed;

    const rows = await this.rowsOf(acting.channelId, view);
    return andThenAsync(rows, async (links) => {
      const contents = await this.deps.refs.resolve(
        links.flatMap((link) => [link.source, link.target])
      );
      return andThenAsync(contents, async (resolved) => {
        const stats = await this.statsFor(user, acting, links);
        return andThenAsync(stats, (totals) => {
          const kept = view === 'fixups' ? links.filter((link) => isFixup(link, resolved)) : links;
          return ok(
            kept.map((link) =>
              toLinkView(link, { viewer: user, contents: resolved, stats: totals })
            )
          );
        });
      });
    });
  }

  async stats(
    user: UserContext,
    acting: ActingChannel
  ): Promise<
    Result<
      { linkId: string; impressions: number; clicks: number; watchSeconds: number }[],
      ContentLinkDecideFailure
    >
  > {
    const allowed = authorize(user, canReadContentLinkStats({ user, channel: acting }), {
      action: 'read',
      subject: 'ContentLinkStats',
    });
    if (isErr(allowed)) return allowed;
    const rows = await this.deps.links.listBySourceChannel(acting.channelId, ALL_STATUSES, 5000);
    return andThenAsync(rows, async (links) => {
      const totals = await this.deps.stats.totalsFor(links.map(({ id }) => id));
      return andThen(totals, (found) =>
        ok([...found].map(([linkId, counts]) => ({ linkId, ...counts })))
      );
    });
  }

  async policy(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<LinkPolicy, ContentLinkDecideFailure>> {
    const allowed = decideLinkWrite(user, acting, 'link');
    if (isErr(allowed)) return allowed;
    return this.deps.links.linkPolicy(acting.channelId);
  }

  async setPolicy(
    user: UserContext,
    acting: ActingChannel,
    policy: LinkPolicy
  ): Promise<Result<LinkPolicy, ContentLinkDecideFailure>> {
    const allowed = decideLinkWrite(user, acting, 'approveLink');
    if (isErr(allowed)) return allowed;
    const saved = await this.deps.links.setLinkPolicy(acting.channelId, policy);
    return andThenAsync(saved, async () => {
      const audited = await this.deps.notifier.auditPolicy(user, acting.channelId, policy);
      return andThen(audited, () => ok(policy));
    });
  }

  private async statsFor(
    user: UserContext,
    acting: ActingChannel,
    links: readonly ContentLink[]
  ): Promise<Result<ReadonlyMap<string, ContentLinkStatCounts> | null, DatabaseUnavailable>> {
    if (!canReadContentLinkStats({ user, channel: acting })) return ok(null);
    return this.deps.stats.totalsFor(links.map(({ id }) => id));
  }

  private rowsOf(
    channelId: string,
    view: LinkListView
  ): Promise<Result<ContentLink[], DatabaseUnavailable>> {
    switch (view) {
      case 'requests':
        return this.deps.links.listByTargetChannel(channelId, ['pending'], LIST_LIMIT);
      case 'suggestions':
        return this.deps.links.listBySourceChannel(channelId, ['suggested'], LIST_LIMIT);
      case 'fixups':
        return this.deps.links.listBySourceChannel(channelId, ['active', 'broken'], LIST_LIMIT);
      case 'all':
        return this.deps.links.listBySourceChannel(channelId, ALL_STATUSES, LIST_LIMIT);
    }
  }
}

function isFixup(link: ContentLink, contents: ReadonlyMap<string, ResolvedContent>): boolean {
  if (link.status === 'broken') return true;
  const target = contents.get(contentRefKey(link.target));
  return !target || !canSeeContent(null, target);
}
