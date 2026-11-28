import { andThenAsync, err, isErr, ok, type Result } from '@kit/result';
import type { CreateLinkBody } from '@vp/api-contracts';
import type {
  ChannelUserRestrictionRepositoryPort,
  ContentLinkRepositoryPort,
  ContentRefDirectoryPort,
  ResolvedContent,
} from '@vp/core/repositories';
import { type ContentLink, contentRefKey, type LinkAnchors, NO_ANCHORS } from '@vp/domain';
import {
  type AuthorizationFailure,
  authorize,
  type CommentsBanned,
  type ContentLinkNotFound,
  contentLinkNotFound,
  decideLinkAnchors,
  decideLinkPair,
  decideLinkSuggestion,
  type LinkAnchorInvalid,
  type LinkExists,
  type LinkPairFailure,
  type LinkSuggestionLimit,
  type LinkTargetNotPublic,
  linkExists,
  linkTargetNotPublic,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { canSuggestContentLink, type UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { refuseWhileBanned } from './channel-ban';
import type { ContentLinkNotifier } from './content-link-notifier';

export interface ContentLinkViewerSuggestionsDeps {
  links: ContentLinkRepositoryPort;
  refs: ContentRefDirectoryPort;
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
  notifier: ContentLinkNotifier;
  now: () => number;
}

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

const startOfDay = (at: number) => new Date(Math.floor(at / 86_400_000) * 86_400_000);

/** A signed-in viewer proposing a link between two public videos: it queues for the source channel and changes nothing else. */
export class ContentLinkViewerSuggestions {
  constructor(private readonly deps: ContentLinkViewerSuggestionsDeps) {}

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
}
