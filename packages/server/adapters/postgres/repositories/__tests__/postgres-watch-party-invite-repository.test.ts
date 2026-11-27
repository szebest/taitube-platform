import { expectErr } from '@kit/testing/result';
import * as schema from '@vp/db';
import { sql } from 'drizzle-orm';
import { OTHER_OWNER_ID, OWNER_ID } from '../../../__tests__/contract/fixtures';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { AT, ROOM_ID } from '../../../__tests__/contract/watch-party-fixtures';
import { describeWatchPartyInviteRepositoryContract } from '../../../__tests__/contract/watch-party-invite-repository.contract';
import { setUpWatchPartyDatabase } from '../../../__tests__/contract/watch-party-pglite';
import { PostgresRepositories } from '../postgres-repositories';

describeWatchPartyInviteRepositoryContract(postgresSubject);

describe('PostgresWatchPartyInviteRepository: one transaction per invite', () => {
  it('stores no invite when its notification cannot be written', async () => {
    const database = await setUpWatchPartyDatabase();
    try {
      await database.reset();
      const repositories = new PostgresRepositories({ type: 'drizzle', db: database.db });
      await database.db.execute(
        sql`alter table outbox add constraint refuse_invites check (kind <> 'watch_party_invite')`
      );

      expectErr(
        await repositories.watchPartyInvites.create(
          {
            id: '00000000-0000-7000-8000-00000000e101',
            roomId: ROOM_ID,
            inviterId: OWNER_ID,
            inviteeId: OTHER_OWNER_ID,
            status: 'pending',
            watching: { names: [], count: 0 },
            expiresAt: new Date(AT.getTime() + 3_600_000),
            createdAt: AT,
          },
          {
            id: '00000000-0000-7000-8000-00000000e102',
            kind: 'watch_party_invite',
            payload: { type: 'pubsub', channel: 'invites', message: 'invite' },
          }
        )
      );

      expect(await database.db.select().from(schema.watchPartyInvites)).toEqual([]);
      expect(await database.db.select().from(schema.outbox)).toEqual([]);
    } finally {
      await database.close();
    }
  });
});
