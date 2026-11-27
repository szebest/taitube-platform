import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { revokeInvitesSentBy } from '../channel-invite-writes';

function inviteeOf(n: number) {
  return `00000000-0000-7000-8000-0000000000b${n}`;
}

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';
const MANAGER_ID = '00000000-0000-7000-8000-0000000000a2';
const INVITEE_IDS = [1, 2, 3].map(inviteeOf);
const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';
const DAY_MS = 86_400_000;

const inviteOf = (n: number, invitedBy: string, expiresInMs = DAY_MS) => ({
  id: `00000000-0000-7000-8000-0000000000e${n}`,
  channelId: CHANNEL_ID,
  inviteeUserId: inviteeOf(n),
  role: 'editor' as const,
  invitedBy,
  status: 'pending' as const,
  expiresAt: new Date(Date.now() + expiresInMs),
});

describe('postgres: revokeInvitesSentBy', () => {
  it("revokes only the inviter's live invites, auditing each as the actor's", async () => {
    const engine = await migratedPglite();
    try {
      const db = drizzle(engine, { schema });
      await db
        .insert(schema.users)
        .values(
          [OWNER_ID, MANAGER_ID, ...INVITEE_IDS].map((id) => ({ id, email: `${id}@test.local` }))
        );
      await db
        .insert(schema.channels)
        .values({ id: CHANNEL_ID, userId: OWNER_ID, handle: 'o', displayName: 'O' });
      await db
        .insert(schema.channelInvites)
        .values([inviteOf(1, MANAGER_ID), inviteOf(2, OWNER_ID), inviteOf(3, MANAGER_ID, -DAY_MS)]);

      await revokeInvitesSentBy(db, {
        channelId: CHANNEL_ID,
        inviterId: MANAGER_ID,
        actorUserId: OWNER_ID,
      });

      const statuses = await db
        .select({ id: schema.channelInvites.id, status: schema.channelInvites.status })
        .from(schema.channelInvites)
        .orderBy(schema.channelInvites.id);
      expect(statuses.map(({ status }) => status)).toEqual(['revoked', 'pending', 'pending']);
      expect(await db.select().from(schema.channelAuditLog)).toMatchObject([
        {
          action: 'invite.revoked',
          actorUserId: OWNER_ID,
          targetId: inviteOf(1, MANAGER_ID).id,
          meta: { inviteeUserId: inviteeOf(1), role: 'editor' },
        },
      ]);
    } finally {
      await engine.close();
    }
  });
});
