import type {
  EndLiveInput,
  GoLiveInput,
  LiveStreamPatch,
  LiveStreamRepositoryPort,
  LiveStreamSeed,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type LiveStream, liveStreamCarryOver, videoStatusChanged } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { andThenAsync, err, fromPromise, map, ok, type Result } from '@vp/result';
import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { liveStreams: ls, videos: v, videoEvents: ve } = schema;

export class PostgresLiveStreamRepository implements LiveStreamRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async ensureIdle(
    channelId: string,
    seed: LiveStreamSeed
  ): Promise<Result<LiveStream, DatabaseUnavailable>> {
    const inserted = await fromPromise(
      () =>
        this.db
          .insert(ls)
          .values({ ...seed, channelId, status: 'IDLE' })
          .onConflictDoNothing(),
      databaseUnavailable.during('ensureIdleLiveStream')
    );

    return andThenAsync(inserted, async () =>
      andThenAsync(await this.findOpenByChannel(channelId), async (open) =>
        open ? ok(open) : err(databaseUnavailable('ensureIdleLiveStream', 'no open stream'))
      )
    );
  }

  async findById(id: string): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.findOne('findLiveStream', eq(ls.id, id));
  }

  async findByKey(streamKey: string): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.findOne('findLiveStreamByKey', eq(ls.streamKey, streamKey));
  }

  async findOpenByChannel(
    channelId: string
  ): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.findOne(
      'findOpenLiveStream',
      and(eq(ls.channelId, channelId), inArray(ls.status, ['IDLE', 'LIVE']))
    );
  }

  async findByVideoId(videoId: string): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.findOne('findLiveStreamByVideo', eq(ls.videoId, videoId));
  }

  async goLive(input: GoLiveInput): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const { streamId, video, startedAt, outbox } = input;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [idle] = await tx
            .select({ id: ls.id })
            .from(ls)
            .where(and(eq(ls.id, streamId), eq(ls.status, 'IDLE')))
            .for('update');
          if (!idle) return null;

          await tx.insert(v).values({ ...video, status: 'LIVE' });
          const [live] = await tx
            .update(ls)
            .set({ status: 'LIVE', startedAt, videoId: video.id, updatedAt: startedAt })
            .where(eq(ls.id, streamId))
            .returning();
          await tx.insert(ve).values({
            videoId: video.id,
            type: 'video.live',
            payload: { liveStreamId: streamId },
            createdAt: startedAt,
          });
          if (outbox.length > 0) {
            await tx
              .insert(schema.outbox)
              .values(outbox.map(({ id, ...row }) => ({ id: id ?? uuidv7(), ...row })));
          }
          await appendUserEvent(tx, {
            userId: video.ownerId,
            ...videoStatusChanged(video.id, 'LIVE'),
          });
          return live ?? null;
        }),
      databaseUnavailable.during('goLive')
    );
  }

  async end(input: EndLiveInput): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const { streamId, endedAt, nextId } = input;

    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [stream] = await tx.select().from(ls).where(eq(ls.id, streamId)).for('update');
          if (stream?.status !== 'LIVE') return stream?.status === 'ENDED' ? stream : null;

          const [ended] = await tx
            .update(ls)
            .set({
              status: 'ENDED',
              endedAt,
              streamKey: null,
              overlayToken: null,
              controlToken: null,
              updatedAt: endedAt,
            })
            .where(eq(ls.id, streamId))
            .returning();
          await tx
            .insert(ls)
            .values({ ...liveStreamCarryOver(stream), id: nextId, status: 'IDLE' });
          return ended ?? null;
        }),
      databaseUnavailable.during('endLiveStream')
    );
  }

  async update(
    id: string,
    patch: LiveStreamPatch
  ): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(ls)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(ls.id, id))
          .returning(),
      databaseUnavailable.during('updateLiveStream')
    );
    return map(rows, ([row]) => row ?? null);
  }

  private async findOne(
    operation: string,
    where: SQL | undefined
  ): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(ls).where(where).limit(1),
      databaseUnavailable.during(operation)
    );
    return map(rows, ([row]) => row ?? null);
  }
}
