import { fromPromise, map, ok, type Result } from '@kit/result';
import {
  type ExperimentCreated,
  type ExperimentEnd,
  VideoExperimentRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Experiment, ExperimentVariantStats } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoExperiments: ve, videoExperimentStats: stats, videos: v } = schema;

export class PostgresVideoExperimentRepository extends VideoExperimentRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async listFor(videoId: string): Promise<Result<Experiment[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(ve)
          .where(eq(ve.videoId, videoId))
          .orderBy(desc(ve.startedAt), desc(ve.id)),
      databaseUnavailable.during('listVideoExperiments')
    );
  }

  async find(
    videoId: string,
    experimentId: string
  ): Promise<Result<Experiment | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(ve)
          .where(and(eq(ve.id, experimentId), eq(ve.videoId, videoId)))
          .limit(1),
      databaseUnavailable.during('findVideoExperiment')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async runningFor(
    videoIds: readonly string[]
  ): Promise<Result<Map<string, Experiment>, DatabaseUnavailable>> {
    if (videoIds.length === 0) return ok(new Map());
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(ve)
          .where(and(inArray(ve.videoId, [...videoIds]), eq(ve.status, 'running'))),
      databaseUnavailable.during('runningVideoExperiments')
    );
    return map(rows, (found) => new Map(found.map((row) => [row.videoId, row])));
  }

  async runningOnChannel(ownerId: string): Promise<Result<number, DatabaseUnavailable>> {
    return fromPromise(
      () => runningOwnedBy(this.db, ownerId),
      databaseUnavailable.during('runningOnChannel')
    );
  }

  async create(
    experiment: Experiment,
    ownerId: string,
    channelLimit: number
  ): Promise<Result<ExperimentCreated, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<ExperimentCreated> => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`video_experiments:${ownerId}`}))`
          );
          const [busy] = await tx
            .select({ id: ve.id })
            .from(ve)
            .where(and(eq(ve.videoId, experiment.videoId), eq(ve.status, 'running')))
            .limit(1);
          if (busy) return 'video-busy';
          if ((await runningOwnedBy(tx, ownerId)) >= channelLimit) return 'channel-full';
          await tx.insert(ve).values({ ...experiment, variants: [...experiment.variants] });
          return 'created';
        }),
      databaseUnavailable.during('createVideoExperiment')
    );
  }

  async end(
    videoId: string,
    experimentId: string,
    end: ExperimentEnd
  ): Promise<Result<Experiment | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(ve)
          .set({ status: end.status, winnerVariantId: end.winnerVariantId, endedAt: end.at })
          .where(and(eq(ve.id, experimentId), eq(ve.videoId, videoId), eq(ve.status, 'running')))
          .returning(),
      databaseUnavailable.during('endVideoExperiment')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async statsFor(
    experimentIds: readonly string[]
  ): Promise<Result<Map<string, ExperimentVariantStats[]>, DatabaseUnavailable>> {
    const byExperiment = new Map<string, ExperimentVariantStats[]>(
      experimentIds.map((id) => [id, []])
    );
    if (experimentIds.length === 0) return ok(byExperiment);

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(stats)
          .where(inArray(stats.experimentId, [...experimentIds]))
          .orderBy(asc(stats.variantId), asc(stats.day)),
      databaseUnavailable.during('videoExperimentStats')
    );
    return map(rows, (found) => {
      for (const { experimentId, variantId, impressions, starts, watchSeconds } of found) {
        byExperiment.get(experimentId)?.push({ variantId, impressions, starts, watchSeconds });
      }
      return byExperiment;
    });
  }
}

async function runningOwnedBy(db: PostgresDatabase, ownerId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(ve)
    .innerJoin(v, eq(v.id, ve.videoId))
    .where(and(eq(v.ownerId, ownerId), eq(ve.status, 'running')));
  return row?.total ?? 0;
}
