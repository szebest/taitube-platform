import type { ChannelFeaturedRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { asc, eq } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { channelFeaturedVideos: f, channels: ch } = schema;

export class PostgresChannelFeaturedRepository implements ChannelFeaturedRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async listForChannel(channelId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ videoId: f.videoId })
          .from(f)
          .where(eq(f.channelId, channelId))
          .orderBy(asc(f.position)),
      databaseUnavailable.during('listFeaturedVideos')
    );
    return map(rows, (found) => found.map(({ videoId }) => videoId));
  }

  async replace(
    channelId: string,
    videoIds: readonly string[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.select({ id: ch.id }).from(ch).where(eq(ch.id, channelId)).for('update');
          await tx.delete(f).where(eq(f.channelId, channelId));
          if (videoIds.length === 0) return;
          await tx
            .insert(f)
            .values(videoIds.map((videoId, position) => ({ channelId, videoId, position })));
        }),
      databaseUnavailable.during('replaceFeaturedVideos')
    );
    return map(written, () => undefined);
  }
}
