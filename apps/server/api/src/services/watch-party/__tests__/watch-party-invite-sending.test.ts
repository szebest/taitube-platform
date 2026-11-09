import { WATCH_PARTY_LIMITS, type WatchPartyRoom } from '@vp/domain';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { MS_PER_DAY, MS_PER_HOUR } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { sendInvites } from '../watch-party-invite-sending';
import { seatGuest, seatUser, ROOM_ID, seedRoom } from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, watchPartyTestDeps } from './watch-party-test-deps';

const EXTRA = [
  { id: '00000000-0000-7000-8000-00000000f010', role: 'USER' as const },
  { id: '00000000-0000-7000-8000-00000000f011', role: 'USER' as const },
];
const DISCORD_ID = '123456789012345678';

async function setUpSending() {
  const test = watchPartyTestDeps();
  const { repositories, deps } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at);
  await seatUser(repositories, MEMBER, at);
  for (const [n, user] of [OWNER, MEMBER, OTHER, ...EXTRA].entries()) {
    expectOk(await repositories.users.upsert({ id: user.id, email: `user${n}@taitube.local` }));
    expectOk(
      await repositories.channels.create({
        userId: user.id,
        handle: `user-${n}`,
        displayName: `User ${n}`,
      })
    );
  }
  const room = async (): Promise<WatchPartyRoom> => {
    const found = expectOk(await repositories.watchPartyRooms.findById(ROOM_ID));
    if (found === null) throw new Error('the room is gone');
    return found;
  };
  const send = async (...invitees: string[]) =>
    expectOk(await sendInvites(deps, await room(), OWNER.id, invitees));
  const invite = async (inviteId: string) => {
    const stored = expectOk(await repositories.watchPartyInvites.findById(inviteId));
    if (stored === null) throw new Error('the invite is gone');
    return stored;
  };
  return { ...test, at, send, invite, room };
}

const NO_JOB = {
  kind: 'notification',
  payload: { type: 'pubsub', channel: 'x', message: 'x' },
} as const;

const pendingInvite = (at: Date, inviteeId: string) => ({
  id: uuidv7(),
  roomId: ROOM_ID,
  inviterId: MEMBER.id,
  inviteeId,
  status: 'pending' as const,
  watching: { names: [], count: 0 },
  expiresAt: new Date(at.getTime() + MS_PER_HOUR),
  createdAt: at,
});

const savePrivacy = async (
  { repositories }: Awaited<ReturnType<typeof setUpSending>>,
  userId: string,
  showInParties: boolean
) =>
  expectOk(
    await repositories.userPreferences.save({
      userId,
      preferences: {
        appearance: null,
        playback: null,
        notifications: null,
        privacy: { ...DEFAULT_PREFERENCES.privacy, showInParties },
      },
      expectedVersion: 0,
      sections: ['privacy'],
    })
  );

describe('sendInvites', () => {
  type Party = Awaited<ReturnType<typeof setUpSending>>;
  const SEATS: Record<string, (party: Party) => Promise<unknown>> = {
    guest: ({ repositories, at }) => seatGuest(repositories, at),
    discord: async ({ repositories, at }) =>
      repositories.watchPartyMembers.join(
        {
          roomId: ROOM_ID,
          memberKey: `discord:${DISCORD_ID}`,
          kind: 'discord',
          userId: null,
          discordUserId: DISCORD_ID,
          displayName: 'Discord Dana',
          avatarUrl: null,
          ipHash: null,
          joinedVia: 'activity',
          joinedAt: at,
        },
        null
      ),
    firstAccount: ({ repositories, at }) => seatUser(repositories, EXTRA[0] ?? OTHER, at),
    secondAccount: ({ repositories, at }) => seatUser(repositories, EXTRA[1] ?? OTHER, at),
  };

  it.each([
    { scenario: 'two accounts', also: [], hidden: false, names: ['User 0', 'User 1'], count: 2 },
    { scenario: 'two accounts, one hidden', also: [], hidden: true, names: ['User 0'], count: 2 },
    {
      scenario: 'two accounts, a Discord member and a guest',
      also: ['discord', 'guest'],
      hidden: false,
      names: ['User 0', 'User 1'],
      count: 4,
    },
    {
      scenario: 'four accounts',
      also: ['firstAccount', 'secondAccount'],
      hidden: false,
      names: ['User 0', 'User 1'],
      count: 4,
    },
  ])('freezes who is watching with $scenario as $names of $count', async (row) => {
    const party = await setUpSending();
    if (row.hidden) await savePrivacy(party, MEMBER.id, false);
    for (const kind of row.also) await SEATS[kind]?.(party);

    const { sent } = await party.send(OTHER.id);

    expect((await party.invite(sent[0]?.inviteId ?? '')).watching).toEqual({
      names: row.names,
      count: row.count,
    });
  });

  it.each([
    {
      scenario: 'a party with no schedule',
      scheduledAfterMs: null,
      expiresAfterMs: 24 * MS_PER_HOUR,
    },
    {
      scenario: 'a party scheduled in two days',
      scheduledAfterMs: 2 * MS_PER_DAY,
      expiresAfterMs: 54 * MS_PER_HOUR,
    },
  ])(
    'ends an invite to $scenario at the later of a day and six hours past its start',
    async (row) => {
      const party = await setUpSending();
      if (row.scheduledAfterMs !== null) {
        expectOk(
          await party.repositories.watchPartyRooms.updateSettings(
            ROOM_ID,
            { scheduledFor: new Date(party.at.getTime() + row.scheduledAfterMs) },
            (await party.room()).version,
            null,
            party.at
          )
        );
      }

      const { sent } = await party.send(OTHER.id);

      expect((await party.invite(sent[0]?.inviteId ?? '')).expiresAt).toEqual(
        new Date(party.at.getTime() + row.expiresAfterMs)
      );
    }
  );

  it('refuses a new invitee at the pending limit and still folds one already invited', async () => {
    const party = await setUpSending();
    const { watchPartyInvites } = party.repositories;
    const inviteesAtLimit = [
      OTHER.id,
      ...Array.from({ length: WATCH_PARTY_LIMITS.pendingInvitesPerRoom - 1 }, () => uuidv7()),
    ];
    for (const inviteeId of inviteesAtLimit) {
      expectOk(await watchPartyInvites.create(pendingInvite(party.at, inviteeId), NO_JOB));
    }

    const outcome = await party.send(OTHER.id, EXTRA[0]?.id ?? '');

    expect(outcome).toEqual({
      sent: [],
      folded: [{ userId: OTHER.id }],
      refused: [{ userId: EXTRA[0]?.id }],
    });
  });
});
