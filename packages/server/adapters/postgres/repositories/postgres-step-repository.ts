import {
  type ClaimStepOptions,
  type ClaimStepResult,
  type CompleteStepOptions,
  type CompleteStepResult,
  type FailStepOptions,
  type FailStepResult,
  type MarkDeadOptions,
  type ProcessingStepRecord,
  StepRepository,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const CLAIMED = { id: schema.processingSteps.id };

export class PostgresStepRepository extends StepRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async claim(options: ClaimStepOptions): Promise<Result<ClaimStepResult, DatabaseUnavailable>> {
    const { id, videoId, step, rendition = '-', jobId, attempt, workerId, lockToken } = options;
    const claimed = await fromPromise(
      () =>
        this.db
          .insert(schema.processingSteps)
          .values({
            id,
            videoId,
            step,
            rendition,
            jobId,
            attempt,
            status: 'RUNNING',
            workerId,
            lockToken,
            startedAt: sql`now()`,
            heartbeatAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: [
              schema.processingSteps.videoId,
              schema.processingSteps.step,
              schema.processingSteps.rendition,
            ],
            set: {
              attempt,
              status: 'RUNNING',
              workerId,
              lockToken,
              startedAt: sql`now()`,
              heartbeatAt: sql`now()`,
              errorCode: null,
              errorMessage: null,
            },
            setWhere: ne(schema.processingSteps.status, 'DONE'),
          })
          .returning({ lockToken: schema.processingSteps.lockToken }),
      databaseUnavailable.during('claim')
    );

    return map(claimed, (rows) => {
      const token = rows[0]?.lockToken;
      return token
        ? { stepId: id, lockToken: token, fenced: false }
        : { stepId: id, lockToken: '', fenced: true };
    });
  }

  async complete(
    options: CompleteStepOptions
  ): Promise<Result<CompleteStepResult, DatabaseUnavailable>> {
    const { videoId, step, rendition = '-', lockToken, result = {} } = options;
    const updated = await fromPromise(
      () =>
        this.db
          .update(schema.processingSteps)
          .set({
            status: 'DONE',
            finishedAt: new Date(),
            result,
          })
          .where(this.fencedStep(videoId, step, rendition, lockToken))
          .returning(CLAIMED),
      databaseUnavailable.during('complete')
    );

    return map(updated, (rows) =>
      rows.length === 0 ? { completed: false, fenced: true } : { completed: true, fenced: false }
    );
  }

  async fail(options: FailStepOptions): Promise<Result<FailStepResult, DatabaseUnavailable>> {
    const { videoId, step, rendition = '-', lockToken, errorCode, errorMessage } = options;
    const updated = await fromPromise(
      () =>
        this.db
          .update(schema.processingSteps)
          .set({
            status: 'FAILED',
            finishedAt: new Date(),
            errorCode,
            errorMessage: errorMessage || null,
          })
          .where(this.fencedStep(videoId, step, rendition, lockToken))
          .returning(CLAIMED),
      databaseUnavailable.during('fail')
    );

    return map(updated, (rows) =>
      rows.length === 0 ? { failed: false, fenced: true } : { failed: true, fenced: false }
    );
  }

  async markDead(options: MarkDeadOptions): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, step, rendition = '-', errorCode, errorMessage } = options;
    const updated = await fromPromise(
      () =>
        this.db
          .update(schema.processingSteps)
          .set({
            status: 'DEAD',
            finishedAt: new Date(),
            errorCode: errorCode || null,
            errorMessage: errorMessage || null,
          })
          .where(
            and(
              eq(schema.processingSteps.videoId, videoId),
              eq(schema.processingSteps.step, step),
              eq(schema.processingSteps.rendition, rendition)
            )
          )
          .returning(CLAIMED),
      databaseUnavailable.during('markDead')
    );

    return map(updated, (rows) => rows.length > 0);
  }

  async heartbeat(lockToken: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const updated = await fromPromise(
      () =>
        this.db
          .update(schema.processingSteps)
          .set({ heartbeatAt: new Date() })
          .where(eq(schema.processingSteps.lockToken, lockToken))
          .returning(CLAIMED),
      databaseUnavailable.during('heartbeat')
    );

    return map(updated, (rows) => rows.length > 0);
  }

  async findByVideoId(
    videoId: string
  ): Promise<Result<ProcessingStepRecord[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(schema.processingSteps)
          .where(eq(schema.processingSteps.videoId, videoId)),
      databaseUnavailable.during('findByVideoId')
    );
  }

  async countRunningStale(thresholdMs: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const counted = await fromPromise(
      () =>
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.processingSteps)
          .where(
            and(
              eq(schema.processingSteps.status, 'RUNNING'),
              sql`COALESCE(${schema.processingSteps.heartbeatAt}, ${schema.processingSteps.startedAt}) < ${cutoff}`
            )
          ),
      databaseUnavailable.during('countRunningStale')
    );

    return map(counted, ([row]) => row?.count ?? 0);
  }

  private fencedStep(videoId: string, step: string, rendition: string, lockToken: string) {
    return and(
      eq(schema.processingSteps.videoId, videoId),
      eq(schema.processingSteps.step, step),
      eq(schema.processingSteps.rendition, rendition),
      eq(schema.processingSteps.lockToken, lockToken)
    );
  }
}
