import { playlistCollaborators, playlists, videos } from '@vp/db';
import { PUBLIC_FEED_VISIBILITY } from '@vp/domain';
import type { ShareGrant, UserContext } from '@vp/permissions';
import { type SQL, eq, sql } from 'drizzle-orm';
import { type Viewer, rulesToSql } from './rules-to-sql';
import { notDeletedScope } from './soft-delete';
import type { WithOwner, WithVisibility } from './traits';
import { drizzleWhere } from './where';

export function videoReadScope(viewer: Viewer): SQL | undefined {
  return rulesToSql('read', 'Video', viewer, videos);
}

/** A video the viewer may read and nobody has deleted: what a playlist or a history may show. */
export function watchableVideoScope(viewer: Viewer): SQL | undefined {
  return drizzleWhere(videoReadScope(viewer), notDeletedScope(videos));
}

/**
 * `collaboratorId` is the viewer's own seat, so the rule that matches it on the viewer's id reads as
 * "the viewer sits on this playlist".
 */
export function playlistReadScope(
  viewer: Viewer,
  share: ShareGrant | null = null
): SQL | undefined {
  const { userId, playlistId } = playlistCollaborators;
  const seat = sql`(select ${userId} from ${playlistCollaborators} where ${playlistId} = ${playlists.id} and ${userId} = ${viewer?.id ?? null})`;
  return rulesToSql('read', 'Playlist', viewer, playlists, { collaboratorId: seat }, share);
}

export function ownerScope<T extends WithOwner>(table: T, owner: UserContext | string): SQL {
  return eq(table.ownerId, typeof owner === 'string' ? owner : owner.id);
}

/**
 * Feed policy rather than authorization: unlisted videos stay readable by link but must
 * never surface in a listing.
 */
export function publicVisibilityScope<T extends WithVisibility>(table: T): SQL {
  return eq(table.visibility, PUBLIC_FEED_VISIBILITY);
}
