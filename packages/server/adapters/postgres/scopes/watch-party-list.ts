import * as schema from '@vp/db';
import { memberKeyOf } from '@vp/domain';
import { type SQL, and, eq, isNull, or, sql } from 'drizzle-orm';
import { publicVisibilityScope, watchableVideoScope } from './accessible-by';
import { aliasedTable } from './aliased-table';
import { drizzleWhere } from './where';

const { watchPartyRooms: rooms, watchPartyBans, videos } = schema;

const ban = aliasedTable(watchPartyBans, 'list_scope_ban');

/**
 * The only way discovery reads rooms, over `watch_party_rooms` left-joined to its current video:
 * open, public, not hidden by reports or a moderator, playing a public ready video (or none yet),
 * and not a room the viewer is banned from.
 */
export function watchPartyListScope(viewerId: string | null): SQL {
  const playsPublicVideo = drizzleWhere(
    watchableVideoScope(null),
    publicVisibilityScope(videos),
    eq(videos.status, 'READY')
  );
  const notBanned =
    viewerId === null
      ? undefined
      : sql`not exists (
          select 1 from ${ban.from}
          where ${ban.table.roomId} = ${rooms.id}
            and ${ban.table.memberKey} = ${memberKeyOf({ kind: 'user', userId: viewerId })}
        )`;
  return and(
    eq(rooms.status, 'open'),
    eq(rooms.visibility, 'public'),
    isNull(rooms.hiddenAt),
    or(isNull(rooms.currentVideoId), playsPublicVideo),
    notBanned
  ) as SQL;
}
