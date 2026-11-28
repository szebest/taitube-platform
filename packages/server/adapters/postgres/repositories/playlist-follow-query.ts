import type { FollowedPlaylist } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { UserContext } from '@vp/permissions';
import { and, asc, count, eq, getTableColumns, inArray, isNotNull, sql } from 'drizzle-orm';
import { drizzleWhere, playlistReadScope, watchableVideoScope } from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v, channels: ch } = schema;

type Card = NonNullable<FollowedPlaylist['playlist']>;

/** The cards of the followed playlists the viewer may still read; one gone private is absent. */
export async function followedCardsOf(
  db: PostgresDatabase,
  viewer: UserContext,
  playlistIds: readonly string[]
): Promise<Map<string, Card>> {
  if (playlistIds.length === 0) return new Map();
  const watchable = watchableVideoScope(viewer);
  const videoCount = db
    .select({ n: count() })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(drizzleWhere(eq(pi.playlistId, p.id), watchable));
  const posterKey = db
    .select({ key: v.posterKey })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(drizzleWhere(eq(pi.playlistId, p.id), isNotNull(v.posterKey), watchable))
    .orderBy(asc(pi.position), asc(pi.id))
    .limit(1);

  const rows = await db
    .select({
      playlist: getTableColumns(p),
      videoCount: sql<number>`(${videoCount})`.mapWith(Number),
      posterKey: sql<string | null>`(${posterKey})`,
      ...channelCardColumns,
    })
    .from(p)
    .leftJoin(ch, and(eq(ch.userId, p.ownerId), eq(ch.isPrimary, true)))
    .where(drizzleWhere(inArray(p.id, [...playlistIds]), playlistReadScope(viewer)));

  return new Map(
    rows.map(({ playlist, videoCount: videos, posterKey: poster, ...owner }) => [
      playlist.id,
      {
        title: playlist.title,
        visibility: playlist.visibility,
        isSmart: playlist.rules !== null,
        customThumbnailKey: playlist.customThumbnailKey,
        posterKey: poster,
        videoCount: videos,
        owner: toChannelCard(owner),
        updatedAt: playlist.updatedAt,
      },
    ])
  );
}
