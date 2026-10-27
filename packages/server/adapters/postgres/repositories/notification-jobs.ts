import * as schema from '@vp/db';
import type { notificationOutbox } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import type { PostgresDatabase } from './types';

/** Written on the caller's transaction, so a change that rolls back enqueues nothing. */
export async function enqueueNotificationJobs(
  tx: PostgresDatabase,
  jobs: readonly ReturnType<typeof notificationOutbox>[]
): Promise<void> {
  if (jobs.length === 0) return;

  await tx.insert(schema.outbox).values(jobs.map((job) => ({ id: uuidv7(), ...job })));
}
