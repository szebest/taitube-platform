import { type NewNotificationInput, toNotificationView } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { createRoom, ROOM_ID } from './watch-party-activity-fixtures';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';
const INVITE_A = '00000000-0000-7000-8000-00000000e101';
const INVITE_B = '00000000-0000-7000-8000-00000000e102';

const invite = (inviteId: string): NewNotificationInput => ({
  userId: OTHER_OWNER_ID,
  kind: 'party_invite',
  actorChannelId: CHANNEL_ID,
  videoId: null,
  commentId: null,
  watchPartyId: ROOM_ID,
  groupKey: `party_invite:${ROOM_ID}`,
  payload: {
    actor: { handle: 'night-kitchen', displayName: 'Night Kitchen', avatarUrl: null },
    videoTitle: null,
    excerpt: null,
    outcome: null,
    party: {
      roomId: ROOM_ID,
      name: 'Movie night',
      videoTitle: null,
      scheduledFor: null,
      inviteId,
      expiresAt: '2026-03-02T12:00:00.000Z',
      watching: { names: ['Ana'], count: 1 },
    },
  },
});

export function describeNotificationPartyInvitesContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('party invites', () => {
    let subject: RepositoriesSubject;

    const record = async (input: NewNotificationInput) =>
      expectOk(await subject.repositories.notifications.record(input));
    const list = async () =>
      expectOk(
        await subject.repositories.notifications.list(OTHER_OWNER_ID, { filter: 'all', limit: 50 })
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'night-kitchen',
        displayName: 'Night Kitchen',
      });
      await createRoom(subject, ROOM_ID);
    });

    it('keeps the room and the invite on the row and in the view', async () => {
      const stored = await record(invite(INVITE_A));

      expect(stored).toMatchObject({
        watchPartyId: ROOM_ID,
        payload: { party: { inviteId: INVITE_A } },
      });
      expect(toNotificationView(stored ?? failed()).payload.party).toMatchObject({
        roomId: ROOM_ID,
      });
    });

    it('folds a different invite to the room into the row and counts a repeat of one once', async () => {
      await record(invite(INVITE_A));
      expect(await record(invite(INVITE_A))).toBeNull();
      const folded = await record(invite(INVITE_B));

      expect(await list()).toMatchObject([
        { id: folded?.id, payload: { count: 2, party: { inviteId: INVITE_B } } },
      ]);
    });
  });
}

function failed(): never {
  throw new Error('the notification was not stored');
}
