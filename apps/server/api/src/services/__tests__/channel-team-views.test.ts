import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';
import { profilesOf, toInviteView, toMemberView } from '../channel-team-views';

const ADA = '00000000-0000-7000-8000-0000000017d1';
const GONE = '00000000-0000-7000-8000-0000000017d2';

async function profiles() {
  const repositories = new InMemoryRepositories();
  expectOk(await repositories.channels.create({ userId: ADA, handle: 'ada', displayName: 'Ada' }));
  return expectOk(await profilesOf(repositories.channels, [ADA, null, ADA, GONE]));
}

describe('apps/server/api/services: channel team views', () => {
  it('keys each user to their own channel, skipping a deleted actor and anyone without one', async () => {
    expect([...(await profiles()).entries()]).toEqual([
      [ADA, { handle: 'ada', displayName: 'Ada', avatarUrl: null }],
    ]);
  });

  it('shows a member and an invitee without a channel with no profile', async () => {
    const found = await profiles();
    const createdAt = new Date('2026-11-01T00:00:00.000Z');

    expect(
      toMemberView(
        { channelId: 'c', userId: GONE, role: 'editor', invitedBy: null, createdAt },
        found
      )
    ).toEqual({
      userId: GONE,
      role: 'editor',
      invitedBy: null,
      joinedAt: '2026-11-01T00:00:00.000Z',
      profile: null,
    });
    expect(
      toInviteView(
        {
          id: 'i',
          channelId: 'c',
          inviteeUserId: ADA,
          role: 'moderator',
          invitedBy: GONE,
          status: 'pending',
          createdAt,
          expiresAt: createdAt,
        },
        found
      ).invitee
    ).toEqual({ handle: 'ada', displayName: 'Ada', avatarUrl: null });
  });
});
