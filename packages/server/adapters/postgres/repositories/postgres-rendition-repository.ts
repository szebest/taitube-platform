import {
  type NewRenditionInput,
  type RenditionRecord,
  RenditionRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { toRenditionInsert, toRenditionUpdate } from '../mappers/index';

export class PostgresRenditionRepository extends RenditionRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async create(data: NewRenditionInput): Promise<Result<RenditionRecord, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.insert(schema.renditions).values(toRenditionInsert(data)).returning(),
      databaseUnavailable.during('create')
    );

    if (!rows.ok) return rows;
    const [created] = rows.value;
    return created ? ok(created) : err(databaseUnavailable('create', 'insert returned no row'));
  }

  async findByVideoId(videoId: string): Promise<Result<RenditionRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.select().from(schema.renditions).where(eq(schema.renditions.videoId, videoId)),
      databaseUnavailable.during('findByVideoId')
    );
  }

  async findByVideoIds(
    videoIds: string[]
  ): Promise<Result<RenditionRecord[], DatabaseUnavailable>> {
    if (videoIds.length === 0) return ok([]);
    return fromPromise(
      () =>
        this.db
          .select()
          .from(schema.renditions)
          .where(inArray(schema.renditions.videoId, videoIds)),
      databaseUnavailable.during('findByVideoIds')
    );
  }

  async update(
    videoId: string,
    name: string,
    patch: Partial<RenditionRecord>
  ): Promise<Result<RenditionRecord | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(schema.renditions)
          .set(toRenditionUpdate(patch))
          .where(and(eq(schema.renditions.videoId, videoId), eq(schema.renditions.name, name)))
          .returning(),
      databaseUnavailable.during('update')
    );

    return map(rows, ([updated]) => updated ?? null);
  }
}
