import { fromPromise, map, ok, type Result } from '@kit/result';
import { VideoChapterRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Chapter } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { asc, inArray } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoChapters: vc } = schema;

export class PostgresVideoChapterRepository extends VideoChapterRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async listFor(
    videoIds: readonly string[]
  ): Promise<Result<Map<string, Chapter[]>, DatabaseUnavailable>> {
    const byVideo = new Map<string, Chapter[]>(videoIds.map((id) => [id, []]));
    if (videoIds.length === 0) return ok(byVideo);

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(vc)
          .where(inArray(vc.videoId, [...videoIds]))
          .orderBy(asc(vc.videoId), asc(vc.position)),
      databaseUnavailable.during('listVideoChapters')
    );
    return map(rows, (found) => {
      for (const { videoId, startMs, title } of found)
        byVideo.get(videoId)?.push({ startMs, title });
      return byVideo;
    });
  }
}
