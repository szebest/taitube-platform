import * as schema from '@vp/db';
import { expectErr, expectOk } from '@vp/testing/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from '../../../__tests__/contract/fixtures';
import { describeNotificationRepositoryContract } from '../../../__tests__/contract/notification-repository.contract';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { PostgresRepositories } from '../postgres-repositories';

describeNotificationRepositoryContract(postgresSubject);

describe('PostgresNotificationRepository: one transaction per write', () => {
  it('writes no notification when its notification.created cannot be written', async () => {
    const engine = await migratedPglite();
    try {
      const db = drizzle(engine, { schema });
      const repositories = new PostgresRepositories({ type: 'drizzle', db });
      await seedOwners(repositories);
      await db.execute(
        sql`alter table user_events add constraint refuse_created check (type <> 'notification.created')`
      );

      expectErr(
        await repositories.notifications.record({
          userId: OTHER_OWNER_ID,
          kind: 'processing',
          actorChannelId: null,
          videoId: null,
          commentId: null,
          groupKey: null,
          payload: { actor: null, videoTitle: null, excerpt: null, outcome: 'ready' },
        })
      );

      expect(
        expectOk(
          await repositories.notifications.list(OTHER_OWNER_ID, { filter: 'all', limit: 10 })
        )
      ).toEqual([]);
    } finally {
      await engine.close();
    }
  });

  it('creates no comment when its notification job cannot be written', async () => {
    const engine = await migratedPglite();
    try {
      const db = drizzle(engine, { schema });
      const repositories = new PostgresRepositories({ type: 'drizzle', db });
      await seedOwners(repositories);
      const videoId = '00000000-0000-7000-8000-00000000000a';
      expectOk(
        await repositories.videos.create({
          id: videoId,
          ownerId: OWNER_ID,
          sourceKey: 'raw/a/source.mp4',
          visibility: 'public',
          status: 'READY',
        })
      );
      await db.execute(
        sql`alter table outbox add constraint refuse_notification check (kind <> 'notification')`
      );

      expectErr(
        await repositories.comments.create({
          id: '00000000-0000-7000-8000-0000000000c1',
          videoId,
          authorId: OTHER_OWNER_ID,
          parentId: null,
          content: 'hello',
        })
      );

      expect(
        expectOk(await repositories.comments.findById('00000000-0000-7000-8000-0000000000c1'))
      ).toBeNull();
    } finally {
      await engine.close();
    }
  });
});
