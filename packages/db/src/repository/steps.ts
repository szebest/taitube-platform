import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { processingSteps } from '../schema';

export interface ClaimStepOptions {
  id: string;
  videoId: string;
  step: string;
  rendition?: string;
  jobId: string;
  attempt: number;
  workerId: string;
  lockToken: string;
}

export interface ClaimStepResult {
  lockToken: string | null;
  fenced: boolean;
}

export interface CompleteStepOptions {
  videoId: string;
  step: string;
  rendition?: string;
  lockToken: string;
  result?: Record<string, unknown>;
}

export interface CompleteStepResult {
  completed: boolean;
  fenced: boolean;
}

export interface FailStepOptions {
  videoId: string;
  step: string;
  rendition?: string;
  lockToken: string;
  errorCode: string;
  errorMessage?: string;
}

export interface FailStepResult {
  failed: boolean;
  fenced: boolean;
}

/**
 * Idempotently claims a processing step using a fresh fencing token (SDD §5.3, §9.5).
 * - First attempt inserts the row.
 * - Retries bump attempt and take the new lock_token.
 * - If status is already 'DONE', the WHERE clause rejects reopening and returns no rows (fenced: true).
 */
export async function claimStep(db: Database, options: ClaimStepOptions): Promise<ClaimStepResult> {
  const { id, videoId, step, rendition = '-', jobId, attempt, workerId, lockToken } = options;

  // Execute raw query using tagged sql template for precise ON CONFLICT WHERE control
  const result = await db.execute<{ lock_token: string }>(sql`
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
    // 0 rows returned => the step has already reached terminal status 'DONE'
    return { lockToken: null, fenced: true };
  }

  return { lockToken: result[0].lock_token, fenced: false };
}

/**
 * Completes a processing step only if the caller holds the active fencing token.
 * A stale or zombie worker whose lock was reclaimed gets 0 rows affected (fenced: true).
 */
export async function completeStep(
  db: Database,
  options: CompleteStepOptions
): Promise<CompleteStepResult> {
  const { videoId, step, rendition = '-', lockToken, result = {} } = options;

  const updatedRows = await db
    .update(processingSteps)
    .set({
      status: 'DONE',
      finishedAt: new Date(),
      result,
    })
    .where(
      and(
        eq(processingSteps.videoId, videoId),
        eq(processingSteps.step, step),
        eq(processingSteps.rendition, rendition),
        eq(processingSteps.lockToken, lockToken)
      )
    )
    .returning({ id: processingSteps.id });

  if (updatedRows.length === 0) {
    // 0 rows => Zombie or stale worker: FENCED_OUT
    return { completed: false, fenced: true };
  }

  return { completed: true, fenced: false };
}

/**
 * Records failure on a processing step only if the caller holds the active fencing token.
 */
export async function failStep(db: Database, options: FailStepOptions): Promise<FailStepResult> {
  const { videoId, step, rendition = '-', lockToken, errorCode, errorMessage } = options;

  const updatedRows = await db
    .update(processingSteps)
    .set({
      status: 'FAILED',
      finishedAt: new Date(),
      errorCode,
      errorMessage: errorMessage || null,
    })
    .where(
      and(
        eq(processingSteps.videoId, videoId),
        eq(processingSteps.step, step),
        eq(processingSteps.rendition, rendition),
        eq(processingSteps.lockToken, lockToken)
      )
    )
    .returning({ id: processingSteps.id });

  if (updatedRows.length === 0) {
    return { failed: false, fenced: true };
  }

  return { failed: true, fenced: false };
}

/**
 * Updates the heartbeat on an active step to prevent stuck worker alerts.
 */
export async function heartbeatStep(db: Database, lockToken: string): Promise<boolean> {
  const result = await db
    .update(processingSteps)
    .set({ heartbeatAt: new Date() })
    .where(eq(processingSteps.lockToken, lockToken))
    .returning({ id: processingSteps.id });

  return result.length > 0;
}
