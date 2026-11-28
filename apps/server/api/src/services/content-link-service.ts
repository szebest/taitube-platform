import {
  type Awaitable,
  andThen,
  andThenAsync,
  err,
  isErr,
  map,
  ok,
  type Result,
} from '@kit/result';
import type { ContentLinkView, CreateLinkBody, LinkListView } from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  ContentLinkRepositoryPort,
  ContentLinkStatCounts,
  ContentLinkStatsRepositoryPort,
  ContentRefDirectoryPort,
  ChannelUserRestrictionRepositoryPort,
  ResolvedContent,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ContentLink,
  type ContentRef,
  type ContentLinkStatus,
  contentRefKey,
  type LinkAnchors,
  type LinkPolicy,
  NO_ANCHORS,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  authorize,
  type CommentsBanned,
  type ContentLinkNotFound,
  contentLinkNotFound,
  decideLinkAnchors,
  decideLinkCaps,
  decideLinkLoop,
  decideLinkPair,
  decideLinkSuggestion,
  decideLinkWrite,
  type LinkAnchorInvalid,
  type LinkExists,
  type LinkPairFailure,
  type LinkSuggestionLimit,
  type LinkTargetNotPublic,
  linkExists,
  linkTargetNotPublic,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { canReadContentLinkStats, canSuggestContentLink, type UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { refuseWhileBanned } from './channel-ban';
import type { ContentLinkCache } from './content-link-cache';
import type { ContentLinkNotifier } from './content-link-notifier';
import {
  type PlanLinkFailure,
  type PlannedLink,
  planLink,
  type ContentLinkPlannerDeps,
} from './content-link-planner';
import { canSeeContent, toLinkView } from './content-link-views';

export interface ContentLinkServiceDeps {
  links: ContentLinkRepositoryPort;
  refs: ContentRefDirectoryPort;
  channels: Pick<ChannelRepositoryPort, 'findByIds' | 'findById'>;
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
  stats: Pick<ContentLinkStatsRepositoryPort, 'totalsFor'>;
  cache: Pick<ContentLinkCache, 'drop'>;
  notifier: ContentLinkNotifier;
  now: () => number;
}

export type ContentLinkWriteFailure = PlanLinkFailure | LinkExists | AuthorizationFailure;
export type ContentLinkSuggestFailure =
  | AuthorizationFailure
  | ContentLinkNotFound
  | LinkPairFailure
  | LinkAnchorInvalid
  | LinkTargetNotPublic
  | LinkExists
  | LinkSuggestionLimit
  | CommentsBanned
  | DatabaseUnavailable;
export type ContentLinkDecideFailure =
  | AuthorizationFailure
  | ContentLinkNotFound
  | DatabaseUnavailable;

const LIST_LIMIT = 200;
const ALL_STATUSES: ContentLinkStatus[] = ['active', 'pending', 'declined', 'broken'];

const startOfDay = (at: number) => new Date(Math.floor(at / 86_400_000) * 86_400_000);

/** Everything that changes or lists the link graph; reads for viewers are `ContentLinkReads`. */
export class ContentLinkService {
  constructor(private readonly deps: ContentLinkServiceDeps) {}

  private get planner(): ContentLinkPlannerDeps {
    return this.deps;
  }

  async create(
    user: UserContext,
    body: CreateLinkBody
  ): Promise<Result<ContentLinkView, ContentLinkWriteFailure>> {
    const request = { ...body, anchors: body.anchors ?? NO_ANCHORS };
    const planned = await planLink(this.planner, user, request);
    return andThenAsync(planned, async (plan) => {
      const link = this.newLink(request, plan, user.id, plan.status);
      const stored = await this.deps.links.insertGuarded(link, (state) =>
        andThen(decideLinkCaps(state), () =>
          decideLinkLoop({
            relation: request.params.relation,
            source: request.source,
            target: request.target,
            edges: state.chainEdges,
          })
        )
      );
      return andThenAsync(
        stored,
        async (row): Promise<Result<ContentLinkView, ContentLinkWriteFailure>> => {
          if (!row) return err(linkExists());
          return this.afterWrite(user, row, 'link.created');
        }
      );
    });
  }

  async suggest(
    viewer: UserContext,
    body: CreateLinkBody
  ): Promise<Result<void, ContentLinkSuggestFailure>> {
    const allowed = authorize(viewer, canSuggestContentLink({ user: viewer }), {
      action: 'suggest',
      subject: 'ContentLink',
    });
    if (isErr(allowed)) return allowed;

    const resolved = await this.deps.refs.resolve([body.source, body.target]);
    return andThenAsync(resolved, async (contents) => {
      const from = contents.get(contentRefKey(body.source));
      const to = contents.get(contentRefKey(body.target));
      if (!from) return err(contentLinkNotFound(contentRefKey(body.source)));
      if (!to) return err(contentLinkNotFound(contentRefKey(body.target)));
      if (!(from.public && to.public)) return err(linkTargetNotPublic());

      const pair = decideLinkPair({
        relation: body.params.relation,
        source: body.source,
        target: body.target,
        sourceChannelId: from.channelId,
        targetChannelId: to.channelId,
      });
      if (isErr(pair)) return pair;
      const anchors = decideLinkAnchors({
        anchors: body.anchors ?? NO_ANCHORS,
        source: { type: body.source.type, durationMs: from.durationMs },
        target: { type: body.target.type, durationMs: to.durationMs },
      });
      if (isErr(anchors)) return anchors;

      const now = new Date(this.deps.now());
      const banned = await refuseWhileBanned(this.deps, from.channelId, viewer.id, now);
      if (isErr(banned)) return banned;
      const restriction = await this.deps.restrictions.findActive(from.channelId, viewer.id, now);
      if (isErr(restriction)) return restriction;
      if (restriction.value?.kind === 'shadow') return ok(undefined);

      return this.storeSuggestion(viewer, body, anchors.value, from, to, now);
    });
  }

  async accept(
    user: UserContext,
    linkId: string
  ): Promise<Result<ContentLinkView, ContentLinkWriteFailure>> {
    const found = await this.deps.links.findById(linkId);
    return andThenAsync(found, async (link) => {
      if (!link || link.status !== 'suggested') return err(contentLinkNotFound(linkId));
      const planned = await planLink(this.planner, user, {
        source: link.source,
        target: link.target,
        params: link.params,
        anchors: link.anchors,
      });
      return andThenAsync(
        planned,
        async (plan): Promise<Result<ContentLinkView, ContentLinkWriteFailure>> => {
          const moved = await this.deps.links.transition(
            linkId,
            ['suggested'],
            plan.status,
            user.id
          );
          return andThenAsync(
            moved,
            (row): Awaitable<Result<ContentLinkView, ContentLinkWriteFailure>> =>
              row ? this.afterWrite(user, row, 'link.accepted') : err(contentLinkNotFound(linkId))
          );
        }
      );
    });
  }

  async approve(
    user: UserContext,
    linkId: string
  ): Promise<Result<ContentLinkView, ContentLinkDecideFailure>> {
    return this.decide(user, linkId, 'approved');
  }

  async decline(
    user: UserContext,
    linkId: string
  ): Promise<Result<ContentLinkView, ContentLinkDecideFailure>> {
    return this.decide(user, linkId, 'declined');
  }

  async remove(user: UserContext, linkId: string): Promise<Result<void, ContentLinkDecideFailure>> {
    const found = await this.deps.links.findById(linkId);
    return andThenAsync(found, async (link) => {
      if (!link) return err(contentLinkNotFound(linkId));
      const own = await this.channelOf(link.sourceChannelId);
      const ownAllowed = decideLinkWrite(user, own, 'link');
      if (isErr(ownAllowed)) {
        const inbound = decideLinkWrite(
          user,
          await this.channelOf(link.targetChannelId),
          'removeInboundLink'
        );
        if (isErr(inbound)) return ownAllowed;
      }
      const removed = await this.deps.links.remove(linkId);
      return andThenAsync(removed, async (was): Promise<Result<void, ContentLinkDecideFailure>> => {
        if (!was) return err(contentLinkNotFound(linkId));
        await this.deps.cache.drop([link.source, link.target]);
        const audited = await this.deps.notifier.audit(
          user,
          'link.removed',
          ownAllowed.ok ? link.sourceChannelId : link.targetChannelId,
          link
        );
        return audited;
      });
    });
  }

  /** A hard delete of content: every link into it is `broken` and shows in the creator's fix-ups. */
  async markTargetGone(ref: ContentRef): Promise<Result<void, DatabaseUnavailable>> {
    const marked = await this.deps.links.markTargetBroken(ref);
    await this.deps.cache.drop([ref]);
    return map(marked, () => undefined);
  }

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

  private async decide(
    user: UserContext,
    linkId: string,
    decision: 'approved' | 'declined'
  ): Promise<Result<ContentLinkView, ContentLinkDecideFailure>> {
    const found = await this.deps.links.findById(linkId);
    return andThenAsync(found, async (link) => {
      const decidable =
        link &&
        (link.status === 'pending' || (decision === 'declined' && link.status === 'suggested'));
      if (!link || !decidable) return err(contentLinkNotFound(linkId));

      const suggestion = link.status === 'suggested';
      const deciding = await this.channelOf(
        suggestion ? link.sourceChannelId : link.targetChannelId
      );
      const allowed = decideLinkWrite(user, deciding, suggestion ? 'link' : 'approveLink');
      if (isErr(allowed)) return allowed;

      const to = decision === 'approved' ? 'active' : 'declined';
      const moved = await this.deps.links.transition(linkId, [link.status], to, user.id);
      return andThenAsync(
        moved,
        async (row): Promise<Result<ContentLinkView, ContentLinkDecideFailure>> => {
          if (!row) return err(contentLinkNotFound(linkId));
          const audited = await this.deps.notifier.audit(
            user,
            decision === 'approved' ? 'link.approved' : 'link.declined',
            deciding.channelId,
            row
          );
          if (isErr(audited)) return audited;
          if (!suggestion) {
            const told = await this.deps.notifier.tell(
              'link_decision',
              row.createdBy ? [row.createdBy] : [],
              row,
              row.targetChannelId,
              {
                decision,
                at: new Date(this.deps.now()),
              }
            );
            if (isErr(told)) return told;
          }
          return this.present(user, row);
        }
      );
    });
  }

  private async storeSuggestion(
    viewer: UserContext,
    body: CreateLinkBody,
    anchors: LinkAnchors,
    from: ResolvedContent,
    to: ResolvedContent,
    now: Date
  ): Promise<Result<void, ContentLinkSuggestFailure>> {
    const existing = await this.deps.links.findByEdge(
      body.source,
      body.target,
      body.params.relation
    );
    if (isErr(existing)) return existing;
    if (existing.value) {
      const mine = existing.value.createdBy === viewer.id && existing.value.status === 'suggested';
      return mine ? err(linkExists()) : ok(undefined);
    }
    const today = await this.deps.links.countSuggestedBy(viewer.id, startOfDay(now.getTime()));
    if (isErr(today)) return today;
    const decided = decideLinkSuggestion({ openDuplicate: false, suggestedToday: today.value });
    if (isErr(decided)) return decided;

    const link: ContentLink = {
      id: uuidv7(),
      source: body.source,
      target: body.target,
      params: body.params,
      anchors,
      status: 'suggested',
      sourceChannelId: from.channelId,
      targetChannelId: to.channelId,
      origin: 'viewer',
      createdBy: viewer.id,
      decidedBy: null,
      createdAt: now,
    };
    const inserted = await this.deps.links.insert(link);
    return andThenAsync(inserted, async (row) => {
      if (!row) return ok(undefined);
      const audited = await this.deps.notifier.audit(
        viewer,
        'link.suggested',
        row.sourceChannelId,
        row
      );
      if (isErr(audited)) return audited;
      const managers = await this.deps.notifier.managersOf(row.sourceChannelId, viewer.id);
      return andThenAsync(managers, (ids) =>
        this.deps.notifier.tell('link_suggestion', ids, row, row.sourceChannelId, { at: now })
      );
    });
  }

  private newLink(
    request: {
      source: ContentLink['source'];
      target: ContentLink['target'];
      params: ContentLink['params'];
    },
    plan: PlannedLink,
    createdBy: string,
    status: ContentLink['status']
  ): ContentLink {
    return {
      id: uuidv7(),
      source: request.source,
      target: request.target,
      params: request.params,
      anchors: plan.anchors,
      status,
      sourceChannelId: plan.sourceChannelId,
      targetChannelId: plan.targetChannelId,
      origin: 'creator',
      createdBy,
      decidedBy: null,
      createdAt: new Date(this.deps.now()),
    };
  }

  private async afterWrite(
    user: UserContext,
    link: ContentLink,
    action: 'link.created' | 'link.accepted'
  ): Promise<Result<ContentLinkView, DatabaseUnavailable>> {
    const audited = await this.deps.notifier.audit(user, action, link.sourceChannelId, link);
    if (isErr(audited)) return audited;
    const at = new Date(this.deps.now());
    if (link.status === 'pending') {
      const managers = await this.deps.notifier.managersOf(link.targetChannelId, user.id);
      const told = await andThenAsync(managers, (ids) =>
        this.deps.notifier.tell('link_request', ids, link, link.sourceChannelId, { at })
      );
      if (isErr(told)) return told;
    } else if (link.sourceChannelId !== link.targetChannelId) {
      const owner = await this.deps.notifier.ownerOf(link.targetChannelId);
      const told = await this.deps.notifier.tell(
        'link_added',
        owner ? [owner] : [],
        link,
        link.sourceChannelId,
        { at }
      );
      if (isErr(told)) return told;
    }
    return this.present(user, link);
  }

  private async present(
    user: UserContext,
    link: ContentLink
  ): Promise<Result<ContentLinkView, DatabaseUnavailable>> {
    await this.deps.cache.drop([link.source, link.target]);
    const contents = await this.deps.refs.resolve([link.source, link.target]);
    return andThen(contents, (resolved) =>
      ok(toLinkView(link, { viewer: user, contents: resolved, stats: null }))
    );
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

  private async channelOf(channelId: string): Promise<{ channelId: string; ownerId: string }> {
    const found = await this.deps.channels.findById(channelId);
    return { channelId, ownerId: found.ok ? (found.value?.userId ?? '') : '' };
  }
}

function isFixup(link: ContentLink, contents: ReadonlyMap<string, ResolvedContent>): boolean {
  if (link.status === 'broken') return true;
  const target = contents.get(contentRefKey(link.target));
  return !target || !canSeeContent(null, target);
}
