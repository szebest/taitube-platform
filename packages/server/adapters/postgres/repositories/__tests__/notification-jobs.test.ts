import * as schema from '@vp/db';
import { commentOutbox, transitionNotificationJobs } from '@vp/job-contracts';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { enqueueNotificationJobs } from '../notification-jobs';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';
const COMMENT_ID = '00000000-0000-7000-8000-0000000000b1';

describe('postgres: enqueueNotificationJobs', () => {
  it('writes one outbox row per job, and none for an empty list', async () => {
    const engine = await migratedPglite();
    try {
      const db = drizzle(engine, { schema });

      await enqueueNotificationJobs(db, []);
      expect(await db.select().from(schema.outbox)).toEqual([]);

      await enqueueNotificationJobs(db, [
        ...transitionNotificationJobs(VIDEO_ID, 'READY', 'private'),
        commentOutbox({ videoId: VIDEO_ID, commentId: COMMENT_ID }),
      ]);

      const rows = await db.select().from(schema.outbox);
      expect(rows.map((row) => row.kind)).toEqual(['notification', 'notification']);
    } finally {
      await engine.close();
    }
  });
});
