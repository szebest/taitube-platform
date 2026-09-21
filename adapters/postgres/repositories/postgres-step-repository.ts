import {
  type ClaimStepOptions,
  type ClaimStepResult,
  type CompleteStepOptions,
  type CompleteStepResult,
  DatabaseError,
  type FailStepOptions,
  type FailStepResult,
  type MarkDeadOptions,
  type ProcessingStepRecord,
  StepRepository,
} from '@vp/core/ports';
import * as schema from '@vp/db';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class PostgresStepRepository extends StepRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    super();
  }

  async claim(options: ClaimStepOptions): Promise<ClaimStepResult> {
    const { id, videoId, step, rendition = '-', jobId, attempt, workerId, lockToken } = options;
    try {
      const result = await this.db.execute<{ lock_token: string }>(sql`
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
      `);

      if (result.length === 0 || !result[0]?.lock_token) {
        return { stepId: id, lockToken: '', fenced: true };
      }
      return { stepId: id, lockToken: result[0].lock_token, fenced: false };
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to claim step ${step} on video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async complete(options: CompleteStepOptions): Promise<CompleteStepResult> {
    const { videoId, step, rendition = '-', lockToken, result = {} } = options;
    try {
      const updatedRows = await this.db
        .update(schema.processingSteps)
        .set({
          status: 'DONE',
          completedAt: new Date(),
          result,
        } as Partial<typeof schema.processingSteps.$inferInsert>)
        .where(
          and(
            eq(schema.processingSteps.videoId, videoId),
            eq(schema.processingSteps.step, step),
            eq(schema.processingSteps.rendition, rendition),
            eq(schema.processingSteps.lockToken, lockToken)
          )
        )
        .returning({ id: schema.processingSteps.id });

      if (updatedRows.length === 0) {
        return { completed: false, fenced: true };
      }
      return { completed: true, fenced: false };
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to complete step ${step} on video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async fail(options: FailStepOptions): Promise<FailStepResult> {
    const { videoId, step, rendition = '-', lockToken, errorCode, errorMessage } = options;
    try {
      const updatedRows = await this.db
        .update(schema.processingSteps)
        .set({
          status: 'FAILED',
          completedAt: new Date(),
          errorCode,
          errorMessage: errorMessage || null,
        } as Partial<typeof schema.processingSteps.$inferInsert>)
        .where(
          and(
            eq(schema.processingSteps.videoId, videoId),
            eq(schema.processingSteps.step, step),
            eq(schema.processingSteps.rendition, rendition),
            eq(schema.processingSteps.lockToken, lockToken)
          )
        )
        .returning({ id: schema.processingSteps.id });

      if (updatedRows.length === 0) {
        return { failed: false, fenced: true };
      }
      return { failed: true, fenced: false };
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to fail step ${step} on video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async markDead(options: MarkDeadOptions): Promise<boolean> {
    const { videoId, step, rendition = '-', errorCode, errorMessage } = options;
    try {
      const updatedRows = await this.db
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
        .returning({ id: schema.processingSteps.id });

      return updatedRows.length > 0;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to mark step ${step} DEAD on video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async heartbeat(lockToken: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(schema.processingSteps)
        .set({ heartbeatAt: new Date() })
        .where(eq(schema.processingSteps.lockToken, lockToken))
        .returning({ id: schema.processingSteps.id });

      return result.length > 0;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to heartbeat step with token ${lockToken}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async findByVideoId(videoId: string): Promise<ProcessingStepRecord[]> {
    try {
      const rows = await this.db
        .select()
        .from(schema.processingSteps)
        .where(eq(schema.processingSteps.videoId, videoId));
      return rows;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to get steps for video ${videoId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async countRunningStale(thresholdMs: number): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - thresholdMs);
      const [res] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.processingSteps)
        .where(
          and(
            eq(schema.processingSteps.status, 'RUNNING'),
            sql`COALESCE(${schema.processingSteps.heartbeatAt}, ${schema.processingSteps.startedAt}) < ${cutoff}`
          )
        );
      return res?.count ?? 0;
    } catch (err: unknown) {
      throw new DatabaseError(
        `Failed to count running stale processing steps: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }
}
