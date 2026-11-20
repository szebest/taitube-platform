import { type Result, err, isErr, map, ok } from '@kit/result';
import type { ShareLinkView } from '@vp/api-contracts';
import type { ShareLinkRepository, VideoRepository } from '@vp/core/repositories';
import {
  MAX_ACTIVE_SHARE_LINKS,
  NO_SHARE_LINK_TOTALS,
  type ShareLink,
  type ShareLinkTotals,
  shareLinkState,
} from '@vp/domain';
import {
  type InvalidShareLink,
  type ShareLinkInput,
  type ShareLinkLimit,
  type ShareLinkNotFound,
  decideShareLink,
  shareLinkLimit,
  shareLinkNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { isoOf } from './cursor';
import { type EditAccessFailure, editableVideo } from './video-edit-access';

export interface ShareLinkServiceDeps {
  videos: VideoRepository;
  shareLinks: ShareLinkRepository;
  newToken: () => string;
  newId: () => string;
  now: () => number;
}

export type CreateShareLinkFailure = EditAccessFailure | InvalidShareLink | ShareLinkLimit;
export type RevokeShareLinkFailure = EditAccessFailure | ShareLinkNotFound;

function toShareLinkView(link: ShareLink, now: Date, stats: ShareLinkTotals): ShareLinkView {
  return {
    id: link.id,
    token: link.token,
    label: link.label,
    expiresAt: link.expiresAt === null ? null : isoOf(link.expiresAt),
    revokedAt: link.revokedAt === null ? null : isoOf(link.revokedAt),
    createdAt: isoOf(link.createdAt),
    state: shareLinkState(link, now),
    stats: { ...stats },
  };
}

/** The links that let a holder watch one video whatever its visibility, for whoever may edit it. */
export class ShareLinkService {
  constructor(private readonly deps: ShareLinkServiceDeps) {}

  async list(
    user: UserContext,
    videoId: string
  ): Promise<Result<{ items: ShareLinkView[] }, EditAccessFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const links = await this.deps.shareLinks.listFor('video', videoId);
    if (isErr(links)) return links;
    const totals = await this.deps.shareLinks.totalsFor(links.value.map(({ id }) => id));
    const now = new Date(this.deps.now());
    return map(totals, (of) => ({
      items: links.value.map((link) =>
        toShareLinkView(link, now, of.get(link.id) ?? NO_SHARE_LINK_TOTALS)
      ),
    }));
  }

  async create(
    user: UserContext,
    videoId: string,
    input: ShareLinkInput
  ): Promise<Result<ShareLinkView, CreateShareLinkFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const links = await this.deps.shareLinks.listFor('video', videoId);
    if (isErr(links)) return links;
    const now = new Date(this.deps.now());
    const active = links.value.filter((link) => shareLinkState(link, now) === 'active').length;
    const decided = decideShareLink(input, { videoId, active, now });
    if (isErr(decided)) return decided;

    const link: ShareLink = {
      ...decided.value,
      id: this.deps.newId(),
      targetType: 'video',
      targetId: videoId,
      token: this.deps.newToken(),
      createdBy: user.id,
      revokedAt: null,
      createdAt: now,
    };
    const created = await this.deps.shareLinks.create(link, MAX_ACTIVE_SHARE_LINKS);
    if (isErr(created)) return created;
    return created.value
      ? ok(toShareLinkView(link, now, NO_SHARE_LINK_TOTALS))
      : err(shareLinkLimit(videoId));
  }

  async revoke(
    user: UserContext,
    videoId: string,
    linkId: string
  ): Promise<Result<null, RevokeShareLinkFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const revoked = await this.deps.shareLinks.revoke(
      'video',
      videoId,
      linkId,
      new Date(this.deps.now())
    );
    if (isErr(revoked)) return revoked;
    return revoked.value ? ok(null) : err(shareLinkNotFound(linkId));
  }
}
