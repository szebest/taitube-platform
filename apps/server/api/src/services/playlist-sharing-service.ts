import { type Result, err, isErr, map, ok } from '@kit/result';
import type { PlaylistStatsView, ShareLinkView } from '@vp/api-contracts';
import type {
  PlaylistRepositoryPort,
  PlaylistStatsRepositoryPort,
  ShareLinkRepository,
} from '@vp/core/repositories';
import {
  MAX_ACTIVE_SHARE_LINKS,
  NO_SHARE_LINK_TOTALS,
  type PlaylistStatsRange,
  type ShareLink,
  analyticsPeriods,
  shareLinkState,
} from '@vp/domain';
import {
  type InvalidShareLink,
  type ManagePlaylistFailure,
  type PlaylistNotFound,
  type ShareLinkExpired,
  type ShareLinkInput,
  type ShareLinkLimit,
  type ShareLinkNotFound,
  type SystemPlaylistImmutable,
  decidePlaylistShare,
  decidePlaylistStatsRead,
  decideShareLink,
  decideShareLinkUse,
  shareLinkLimit,
  shareLinkNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { ShareGrant, UserContext } from '@vp/permissions';
import { toShareLinkView } from './share-link-service';

export interface PlaylistSharingServiceDeps {
  playlists: Pick<PlaylistRepositoryPort, 'findSeated'>;
  shareLinks: ShareLinkRepository;
  stats: PlaylistStatsRepositoryPort;
  newToken: () => string;
  newId: () => string;
  now: () => number;
}

type ShareFailure = ManagePlaylistFailure | SystemPlaylistImmutable | DatabaseUnavailable;

/** A live link of the playlist that let a read through. */
export interface PlaylistShare {
  readonly link: ShareLink;
  readonly grant: ShareGrant;
}

/**
 * The links that let a holder read one private playlist, which only its owner hands out, and the
 * owner's numbers for it. A link grants the playlist and nothing in it: each video still needs its
 * own right to be watched.
 */
export class PlaylistSharingService {
  constructor(private readonly deps: PlaylistSharingServiceDeps) {}

  /** What a token proves about this playlist; one of anything else proves nothing. */
  async shareOf(
    token: string | null,
    playlistId: string
  ): Promise<Result<PlaylistShare | null, ShareLinkExpired | DatabaseUnavailable>> {
    if (token === null) return ok(null);
    const found = await this.deps.shareLinks.findByToken(token);
    if (isErr(found)) return found;
    const target = { targetType: 'playlist', targetId: playlistId } as const;
    const used = decideShareLinkUse(found.value, { target, now: new Date(this.deps.now()) });
    return map(used, (grant) =>
      grant === null || found.value === null ? null : { link: found.value, grant }
    );
  }

  async list(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<{ items: ShareLinkView[] }, ShareFailure>> {
    const shared = await this.shareable(actor, playlistId);
    if (isErr(shared)) return shared;
    const links = await this.deps.shareLinks.listFor('playlist', playlistId);
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
    actor: UserContext,
    playlistId: string,
    input: ShareLinkInput
  ): Promise<Result<ShareLinkView, ShareFailure | InvalidShareLink | ShareLinkLimit>> {
    const shared = await this.shareable(actor, playlistId);
    if (isErr(shared)) return shared;
    const links = await this.deps.shareLinks.listFor('playlist', playlistId);
    if (isErr(links)) return links;
    const now = new Date(this.deps.now());
    const target = { targetType: 'playlist', targetId: playlistId } as const;
    const active = links.value.filter((link) => shareLinkState(link, now) === 'active').length;
    const decided = decideShareLink(input, { target, active, now });
    if (isErr(decided)) return decided;

    const link: ShareLink = {
      ...decided.value,
      ...target,
      id: this.deps.newId(),
      token: this.deps.newToken(),
      createdBy: actor.id,
      revokedAt: null,
      createdAt: now,
    };
    const created = await this.deps.shareLinks.create(link, MAX_ACTIVE_SHARE_LINKS);
    if (isErr(created)) return created;
    return created.value
      ? ok(toShareLinkView(link, now, NO_SHARE_LINK_TOTALS))
      : err(shareLinkLimit(target));
  }

  async revoke(
    actor: UserContext,
    playlistId: string,
    linkId: string
  ): Promise<Result<null, ShareFailure | ShareLinkNotFound>> {
    const shared = await this.shareable(actor, playlistId);
    if (isErr(shared)) return shared;
    const revoked = await this.deps.shareLinks.revoke(
      'playlist',
      playlistId,
      linkId,
      new Date(this.deps.now())
    );
    if (isErr(revoked)) return revoked;
    return revoked.value ? ok(null) : err(shareLinkNotFound(linkId));
  }

  async stats(
    actor: UserContext,
    playlistId: string,
    range: PlaylistStatsRange
  ): Promise<
    Result<PlaylistStatsView, PlaylistNotFound | ManagePlaylistFailure | DatabaseUnavailable>
  > {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const decided = decidePlaylistStatsRead({ actor, playlist: playlist.value, playlistId });
    if (isErr(decided)) return decided;

    const { current } = analyticsPeriods(range, new Date(this.deps.now()));
    const read = await this.deps.stats.statsOf(playlistId, current);
    return map(read, ({ totals, topItems }) => ({ ...current, ...totals, topItems }));
  }

  private async shareable(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<unknown, ShareFailure>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    return decidePlaylistShare({ actor, playlist: playlist.value, playlistId });
  }
}
