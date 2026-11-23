import { fromPromise, map, type Result } from '@kit/result';
import {
  type NewOutboxInput,
  type OpenReplacementInput,
  type SaveEditInput,
  type SwapGenerationInput,
  type SwapOutcome,
  VideoGenerationRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type VideoEdit, type VideoGeneration, videoGenerationUpdated } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, desc, eq, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { commitGenerationSwap } from './generation-swap';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { videoGenerations: vg, videoEdits: ved, outbox } = schema;

type GenerationRow = typeof vg.$inferSelect;

function toGeneration(row: GenerationRow): VideoGeneration {
  return {
    videoId: row.videoId,
    generation: row.generation,
    kind: row.kind,
    status: row.status,
    sourceKey: row.sourceKey,
    baseGeneration: row.baseGeneration,
    replacesGeneration: row.replacesGeneration,
    playback: row.playback,
    timeline: row.timeline,
    retention: row.retention,
    needsReview: row.needsReview,
    errorCode: row.errorCode,
    purgeAfter: row.purgeAfter,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function enqueue(tx: PostgresDatabase, item: NewOutboxInput, now: Date): Promise<void> {
  await tx.insert(outbox).values({
    id: item.id ?? sql`gen_random_uuid()`,
    kind: item.kind,
    payload: item.payload,
    createdAt: now,
    attempts: 0,
  });
}

export class PostgresVideoGenerationRepository extends VideoGenerationRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async list(videoId: string): Promise<Result<VideoGeneration[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(vg).where(eq(vg.videoId, videoId)).orderBy(desc(vg.generation)),
      databaseUnavailable.during('listVideoGenerations')
    );
    return map(rows, (found) => found.map(toGeneration));
  }

  async findEdit(videoId: string): Promise<Result<VideoEdit | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(ved).where(eq(ved.videoId, videoId)),
      databaseUnavailable.during('findVideoEdit')
    );
    return map(rows, ([row]) =>
      row
        ? {
            videoId: row.videoId,
            baseGeneration: row.baseGeneration,
            generation: row.generation,
            trim: row.trim,
            blurs: row.blurs,
            status: row.status,
            updatedAt: row.updatedAt,
          }
        : null
    );
  }

  async openReplacement(
    input: OpenReplacementInput
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const inserted = await fromPromise(
      () =>
        this.db
          .insert(vg)
          .values({
            videoId: input.videoId,
            generation: input.generation,
            kind: 'replacement',
            status: 'uploading',
            sourceKey: input.sourceKey,
            replacesGeneration: input.replacesGeneration,
            purgeAfter: input.uploadExpiresAt,
          })
          .onConflictDoNothing()
          .returning({ generation: vg.generation }),
      databaseUnavailable.during('openVideoReplacement')
    );
    return map(inserted, (rows) => rows.length > 0);
  }

  async startRender(
    videoId: string,
    generation: number,
    item: NewOutboxInput
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const now = new Date();
          const moved = await tx
            .update(vg)
            .set({ status: 'rendering', purgeAfter: null, updatedAt: now })
            .where(
              and(
                eq(vg.videoId, videoId),
                eq(vg.generation, generation),
                eq(vg.status, 'uploading')
              )
            )
            .returning({ generation: vg.generation });
          if (moved.length === 0) return false;
          await enqueue(tx, item, now);
          return true;
        }),
      databaseUnavailable.during('startVideoRender')
    );
  }

  async saveEdit(input: SaveEditInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, generation, baseGeneration, edit } = input;
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const now = new Date();
          const opened = await tx
            .insert(vg)
            .values({
              videoId,
              generation,
              kind: 'edit',
              status: 'rendering',
              baseGeneration,
              replacesGeneration: input.replacesGeneration,
            })
            .onConflictDoNothing()
            .returning({ generation: vg.generation });
          if (opened.length === 0) return false;
          const row = { ...edit, baseGeneration, generation, status: 'rendering' as const };
          await tx
            .insert(ved)
            .values({ ...row, videoId, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({ target: ved.videoId, set: { ...row, updatedAt: now } });
          await enqueue(tx, input.outbox, now);
          return true;
        }),
      databaseUnavailable.during('saveVideoEdit')
    );
  }

  async claim(
    videoId: string,
    generation: number,
    lockToken: string
  ): Promise<Result<VideoGeneration | null, DatabaseUnavailable>> {
    const claimed = await fromPromise(
      () =>
        this.db
          .update(vg)
          .set({ lockToken, updatedAt: new Date() })
          .where(
            and(eq(vg.videoId, videoId), eq(vg.generation, generation), eq(vg.status, 'rendering'))
          )
          .returning(),
      databaseUnavailable.during('claimVideoGeneration')
    );
    return map(claimed, ([row]) => (row ? toGeneration(row) : null));
  }

  async swap(input: SwapGenerationInput): Promise<Result<SwapOutcome, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => commitGenerationSwap(tx, input)),
      databaseUnavailable.during('swapVideoGeneration')
    );
  }

  async fail(
    videoId: string,
    generation: number,
    errorCode: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const now = new Date();
          const failed = await tx
            .update(vg)
            .set({ status: 'failed', errorCode, lockToken: null, purgeAfter: null, updatedAt: now })
            .where(
              and(
                eq(vg.videoId, videoId),
                eq(vg.generation, generation),
                inArray(vg.status, ['uploading', 'rendering'])
              )
            )
            .returning({ generation: vg.generation });
          if (failed.length === 0) return false;
          await tx
            .update(ved)
            .set({ status: 'failed', updatedAt: now })
            .where(and(eq(ved.videoId, videoId), eq(ved.generation, generation)));
          const [owner] = await tx
            .select({ id: schema.videos.ownerId })
            .from(schema.videos)
            .where(eq(schema.videos.id, videoId));
          if (owner) {
            await appendUserEvent(tx, {
              userId: owner.id,
              ...videoGenerationUpdated({ videoId, generation, status: 'failed' }),
            });
          }
          return true;
        }),
      databaseUnavailable.during('failVideoGeneration')
    );
  }

  async listDue(now: Date, limit: number): Promise<Result<VideoGeneration[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(vg)
          .where(
            and(lt(vg.purgeAfter, now), or(eq(vg.status, 'retired'), eq(vg.status, 'uploading')))
          )
          .orderBy(asc(vg.purgeAfter))
          .limit(limit),
      databaseUnavailable.during('listDueVideoGenerations')
    );
    return map(rows, (found) => found.map(toGeneration));
  }

  async markPurged(
    videoId: string,
    generation: number,
    now: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const purged = await tx
            .update(vg)
            .set({
              status: 'purged',
              purgeAfter: null,
              playback: null,
              timeline: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(vg.videoId, videoId),
                eq(vg.generation, generation),
                eq(vg.status, 'retired'),
                lte(vg.purgeAfter, now)
              )
            )
            .returning({ generation: vg.generation });
          if (purged.length === 0) return false;
          await tx
            .update(ved)
            .set({
              baseGeneration: sql`(select generation from ${schema.videos} where id = ${videoId})`,
              trim: null,
              blurs: [],
              updatedAt: now,
            })
            .where(and(eq(ved.videoId, videoId), eq(ved.baseGeneration, generation)));
          return true;
        }),
      databaseUnavailable.during('markVideoGenerationPurged')
    );
  }
}
