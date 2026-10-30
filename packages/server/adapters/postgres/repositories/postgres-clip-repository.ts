import type { ClipRepositoryPort, ListClipsOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Clip, ClipEntry } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { fromPromise, map, type Result } from '@vp/result';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, watchableVideoScope } from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import type { PostgresDatabase } from './types';

const { clips: c, videos: v, channels: ch } = schema;

export class PostgresClipRepository implements ClipRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(clip: Clip): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () => this.db.insert(c).values(clip),
      databaseUnavailable.during('createClip')
    );
    return map(written, () => undefined);
  }

  async findById(id: string): Promise<Result<Clip | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(c).where(eq(c.id, id)).limit(1),
      databaseUnavailable.during('findClip')
    );
    return map(rows, ([found]) => found ?? null);
  }

  async listByCreator(
    viewer: UserContext,
    { cursor, limit }: ListClipsOptions
  ): Promise<Result<ClipEntry[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ clip: getTableColumns(c), video: getTableColumns(v), ...channelCardColumns })
          .from(c)
          .innerJoin(v, eq(v.id, c.videoId))
          .leftJoin(ch, eq(ch.userId, v.ownerId))
          .where(
            drizzleWhere(
              eq(c.userId, viewer.id),
              watchableVideoScope(viewer),
              keysetBefore(c.createdAt, c.id, cursor && { sort: cursor.createdAt, tie: cursor.id })
            )
          )
          .orderBy(desc(c.createdAt), desc(c.id))
          .limit(limit + 1),
      databaseUnavailable.during('listClips')
    );
    return map(rows, (found) =>
      found.map(({ clip, video, channelId, handle, displayName, avatarUrl }) => ({
        clip,
        video,
        channel: toChannelCard({ channelId, handle, displayName, avatarUrl }),
      }))
    );
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(c).where(eq(c.id, id)).returning({ id: c.id }),
      databaseUnavailable.during('removeClip')
    );
    return map(rows, (removed) => removed.length > 0);
  }
}
