import { playlists, videos } from '@vp/db';
import { PUBLIC_FEED_VISIBILITY } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type SQL, eq } from 'drizzle-orm';
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

export function playlistReadScope(viewer: Viewer): SQL | undefined {
  return rulesToSql('read', 'Playlist', viewer, playlists);
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
