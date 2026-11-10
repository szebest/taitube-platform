import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { refuseWhileBanned } from '../channel-ban';

const OWNER = '00000000-0000-7000-8000-0000000000a2';
const USER = '00000000-0000-7000-8000-0000000000a3';
const HOUR_MS = 3_600_000;

describe('apps/server/api/services: refuseWhileBanned', () => {
  let repositories: InMemoryRepositories;
  let channelId: string;

  const restrict = (kind: 'ban' | 'shadow', expiresAt: Date | null = null) =>
    repositories.channelUserRestrictions.apply({
      channelId,
      userId: USER,
      kind,
      reason: 'spam',
      expiresAt,
      createdBy: OWNER,
    });
  const refuse = (ownerId = OWNER) =>
    refuseWhileBanned(
      { channels: repositories.channels, restrictions: repositories.channelUserRestrictions },
      ownerId,
      USER,
      new Date()
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    channelId = expectOk(
      await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
    ).id;
  });

  it('lets a user with no restriction through, and an owner with no channel', async () => {
    expect((await refuse()).ok).toBe(true);
    expect((await refuse('00000000-0000-7000-8000-0000000000b0')).ok).toBe(true);
  });

  it.each([
    { scenario: 'a shadow ban', restriction: () => restrict('shadow'), refused: false },
    {
      scenario: 'a ban that has ended',
      restriction: () => restrict('ban', new Date(Date.now() - HOUR_MS)),
      refused: false,
    },
    { scenario: 'a ban without an end', restriction: () => restrict('ban'), refused: true },
    {
      scenario: 'a ban that has not ended',
      restriction: () => restrict('ban', new Date(Date.now() + HOUR_MS)),
      refused: true,
    },
  ])('answers $scenario with refused: $refused', async ({ restriction, refused }) => {
    await restriction();

    const result = await refuse();

    expect(result.ok).toBe(!refused);
    if (refused) {
      expect(expectErr(result)).toMatchObject({ code: ErrorCodes.COMMENTS_BANNED, reason: 'spam' });
    }
  });
});
