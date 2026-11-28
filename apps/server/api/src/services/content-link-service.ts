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
  ContentLinkStatsRepositoryPort,
  ContentRefDirectoryPort,
  ChannelUserRestrictionRepositoryPort,
  LinkWriteState,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ContentLink,
  type ContentRef,
  type LinkPolicy,
  NO_ANCHORS,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ContentLinkNotFound,
  contentLinkNotFound,
  decideLinkCaps,
  decideLinkLoop,
  decideLinkWrite,
  type LinkExists,
  linkExists,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import type { ContentLinkCache } from './content-link-cache';
import type { ContentLinkNotifier } from './content-link-notifier';
import {
  type PlanLinkFailure,
  type PlannedLink,
  planLink,
  type ContentLinkPlannerDeps,
} from './content-link-planner';
import { ContentLinkQueues } from './content-link-queues';
import {
  type ContentLinkSuggestFailure,
  ContentLinkViewerSuggestions,
} from './content-link-viewer-suggestions';
import { toLinkView } from './content-link-views';

export type { ContentLinkSuggestFailure };

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
export type ContentLinkDecideFailure =
  | AuthorizationFailure
  | ContentLinkNotFound
  | DatabaseUnavailable;

/** Everything that changes or lists the link graph; reads for viewers are `ContentLinkReads`. */
export class ContentLinkService {
  private readonly queues: ContentLinkQueues;
  private readonly suggestions: ContentLinkViewerSuggestions;

  constructor(private readonly deps: ContentLinkServiceDeps) {
    this.queues = new ContentLinkQueues(deps);
    this.suggestions = new ContentLinkViewerSuggestions(deps);
  }

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
        guardLinkWrite(link, state)
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
          const moved = await this.deps.links.transitionGuarded(
            link,
            ['suggested'],
            plan.status,
            user.id,
            (state) => guardLinkWrite(link, state)
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

  private async channelOf(channelId: string): Promise<{ channelId: string; ownerId: string }> {
    const found = await this.deps.channels.findById(channelId);
    return { channelId, ownerId: found.ok ? (found.value?.userId ?? '') : '' };
  }
  suggest(
    viewer: UserContext,
    body: CreateLinkBody
  ): Promise<Result<void, ContentLinkSuggestFailure>> {
    return this.suggestions.suggest(viewer, body);
  }

  list(user: UserContext, acting: ActingChannel, view: LinkListView) {
    return this.queues.list(user, acting, view);
  }

  stats(user: UserContext, acting: ActingChannel) {
    return this.queues.stats(user, acting);
  }

  policy(user: UserContext, acting: ActingChannel) {
    return this.queues.policy(user, acting);
  }

  setPolicy(user: UserContext, acting: ActingChannel, policy: LinkPolicy) {
    return this.queues.setPolicy(user, acting, policy);
  }
}

/** The caps and the loop check, on the state the repository read under its lock. */
function guardLinkWrite(link: ContentLink, state: LinkWriteState) {
  return andThen(decideLinkCaps(state), () =>
    decideLinkLoop({
      relation: link.params.relation,
      source: link.source,
      target: link.target,
      edges: state.chainEdges,
    })
  );
}
