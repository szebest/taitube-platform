import * as schema from '@vp/db';
import type { OwnedPlaylist, PlaylistDetail, SeatedPlaylist } from '@vp/domain';
import type { ShareGrant, UserContext } from '@vp/permissions';
import { type Column, and, count, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { drizzleWhere, playlistReadScope, watchableVideoScope } from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import { rowsOf, toDetailItems, toPlaylist } from './playlist-query';
import type { PostgresDatabase } from './types';

const {
  playlists: p,
  playlistItems: pi,
  playlistCollaborators: pc,
  playlistFollows: pf,
  videos: v,
  channels: ch,
} = schema;

/** An anonymous caller holds no row of anyone's. */
function heldBy(column: Column, userId: string | null) {
  return userId === null ? sql`false` : eq(column, userId);
}

/** The playlist with `userId`'s seat resolved on it, whoever may read it. */
export async function seatedOf(
  db: PostgresDatabase,
  id: string,
  userId: string | null
): Promise<SeatedPlaylist | null> {
  const [row] = await db
    .select({ playlist: getTableColumns(p), role: pc.role })
    .from(p)
    .leftJoin(pc, and(eq(pc.playlistId, p.id), heldBy(pc.userId, userId)))
    .where(eq(p.id, id));
  if (!row) return null;
  return {
    ...toPlaylist(row.playlist),
    collaboratorId: row.role === null ? null : userId,
    collaboratorRole: row.role,
  };
}

export async function detailOf(
  db: PostgresDatabase,
  id: string,
  viewer: UserContext | null,
  share: ShareGrant | null
): Promise<PlaylistDetail | null> {
  const viewerId = viewer?.id ?? null;
  const [header] = await db
    .select({
      playlist: getTableColumns(p),
      ...channelCardColumns,
      seat: pc.role,
      followedAt: pf.createdAt,
    })
    .from(p)
    .leftJoin(ch, and(eq(ch.userId, p.ownerId), eq(ch.isPrimary, true)))
    .leftJoin(pc, and(eq(pc.playlistId, p.id), heldBy(pc.userId, viewerId)))
    .leftJoin(pf, and(eq(pf.playlistId, p.id), heldBy(pf.userId, viewerId)))
    .where(drizzleWhere(eq(p.id, id), playlistReadScope(viewer, share)));
  if (!header) return null;

  const rows = await rowsOf(db, id, viewer);
  const { playlist, seat, followedAt, ...owner } = header;
  return {
    playlist: toPlaylist(playlist),
    owner: toChannelCard(owner),
    ...toDetailItems(rows),
    viewer: {
      role: playlist.ownerId === viewerId ? 'owner' : seat,
      following: followedAt !== null,
    },
  };
}

export async function ownedBy(
  db: PostgresDatabase,
  owner: UserContext,
  videoId: string | null
): Promise<OwnedPlaylist[]> {
  const videoCount = db
    .select({ n: count() })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(drizzleWhere(eq(pi.playlistId, p.id), watchableVideoScope(owner)));
  const holdsVideo =
    videoId === null
      ? sql`false`
      : inArray(p.id, db.select({ id: pi.playlistId }).from(pi).where(eq(pi.videoId, videoId)));

  const rows = await db
    .select({
      playlist: getTableColumns(p),
      videoCount: sql<number>`(${videoCount})`.mapWith(Number),
      containsVideo: sql<boolean>`${holdsVideo}`.mapWith(Boolean),
    })
    .from(p)
    .where(eq(p.ownerId, owner.id))
    .orderBy(desc(p.isSystem), desc(p.updatedAt), desc(p.id));
  return rows.map(({ playlist, ...counts }) => ({ ...toPlaylist(playlist), ...counts }));
}
