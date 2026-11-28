import { type Result, fromPromise, map } from '@kit/result';
import type {
  ListPlaylistActivityOptions,
  PlaylistActivityRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { PlaylistActivity } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, desc, eq, lt } from 'drizzle-orm';
import { keysetBefore, msTimestamp } from '../scopes/index';
import { toPlaylistActivity } from './playlist-change';
import type { PostgresDatabase } from './types';

const { playlistActivity: pa } = schema;

export class PostgresPlaylistActivityRepository implements PlaylistActivityRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(
    playlistId: string,
    { cursor, limit }: ListPlaylistActivityOptions
  ): Promise<Result<PlaylistActivity[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(pa)
          .where(
            and(
              eq(pa.playlistId, playlistId),
              keysetBefore(
                msTimestamp(pa.createdAt),
                pa.id,
                cursor && { sort: cursor.createdAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(msTimestamp(pa.createdAt)), desc(pa.id))
          .limit(limit + 1),
      databaseUnavailable.during('listPlaylistActivity')
    );
    return map(rows, (found) => found.map(toPlaylistActivity));
  }

  async find(id: string): Promise<Result<PlaylistActivity | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(pa).where(eq(pa.id, id)),
      databaseUnavailable.during('findPlaylistActivity')
    );
    return map(rows, ([row]) => (row ? toPlaylistActivity(row) : null));
  }

  async purgeOlderThan(before: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(pa).where(lt(pa.createdAt, before)).returning({ id: pa.id }),
      databaseUnavailable.during('purgePlaylistActivity')
    );
    return map(rows, (purged) => purged.length);
  }
}
