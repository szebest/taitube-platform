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
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

const CLAIMED = { id: schema.processingSteps.id };

export class PostgresStepRepository extends StepRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  private unavailable(operation: string) {
    return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
  }

  async claim(options: ClaimStepOptions): Promise<Result<ClaimStepResult, DatabaseUnavailable>> {
    const { id, videoId, step, rendition = '-', jobId, attempt, workerId, lockToken } = options;
    const claimed = await fromPromise(
      () =>
        this.db.execute<{ lock_token: string }>(sql`
        INSERT INTO processing_steps (
          id, video_id, step, rendition, job_id, attempt, status, worker_id, lock_token, started_at, heartbeat_at
        )
        VALUES (
          ${id}::uuid, ${videoId}::uuid, ${step}, ${rendition}, ${jobId}, ${attempt}, 'RUNNING'::step_status, ${workerId}, ${lockToken}::uuid, now(), now()
        )
        ON CONFLICT (video_id, step, rendition) DO UPDATE
          SET attempt = EXCLUDED.attempt,
              status = 'RUNNING'::step_status,
              worker_id = EXCLUDED.worker_id,
              lock_token = EXCLUDED.lock_token,
              started_at = now(),
              heartbeat_at = now(),
              error_code = NULL,
              error_message = NULL
          WHERE processing_steps.status <> 'DONE'::step_status
        RETURNING lock_token;
      `),
      this.unavailable('claim')
    );

    return map(claimed, (rows) => {
      const token = rows[0]?.lock_token;
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
            completedAt: new Date(),
            result,
          } as Partial<typeof schema.processingSteps.$inferInsert>)
          .where(this.fencedStep(videoId, step, rendition, lockToken))
          .returning(CLAIMED),
      this.unavailable('complete')
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
            completedAt: new Date(),
            errorCode,
            errorMessage: errorMessage || null,
          } as Partial<typeof schema.processingSteps.$inferInsert>)
          .where(this.fencedStep(videoId, step, rendition, lockToken))
          .returning(CLAIMED),
      this.unavailable('fail')
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
            completedAt: new Date(),
            errorCode: errorCode || null,
            errorMessage: errorMessage || null,
          } as Partial<typeof schema.processingSteps.$inferInsert>)
          .where(
            and(
              eq(schema.processingSteps.videoId, videoId),
              eq(schema.processingSteps.step, step),
              eq(schema.processingSteps.rendition, rendition)
            )
          )
          .returning(CLAIMED),
      this.unavailable('markDead')
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
      this.unavailable('heartbeat')
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
      this.unavailable('findByVideoId')
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
      this.unavailable('countRunningStale')
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
