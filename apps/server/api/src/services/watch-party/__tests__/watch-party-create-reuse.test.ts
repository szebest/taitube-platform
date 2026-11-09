import { MS_PER_HOUR } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { type CreateContext, OWNER_KEY, setUpCreate } from './watch-party-create-fixture';
import { MEMBER, partyBody, VIDEO_A, VIDEO_C } from './watch-party-test-deps';

describe('apps/server/api/services: createRoom reuse', () => {
  const reusing = (overrides = {}) =>
    partyBody({ reuse: true, source: { videoId: VIDEO_A }, ...overrides });

  it('answers the owner’s untouched lobby on the same first video instead of a new room', async () => {
    const { create, repositories } = await setUpCreate();
    const first = expectOk(await create(reusing()));

    expect(expectOk(await create(reusing())).id).toBe(first.id);
    expect(expectOk(await repositories.watchPartyRooms.countOpenOwnedBy(OWNER_KEY))).toBe(1);
  });

  it.each([
    {
      scenario: 'someone else sat down',
      disturb: async ({ repositories, clock }: CreateContext, roomId: string) => {
        expectOk(
          await repositories.watchPartyMembers.join(
            {
              roomId,
              memberKey: `user:${MEMBER.id}`,
              kind: 'user',
              userId: MEMBER.id,
              discordUserId: null,
              displayName: null,
              avatarUrl: null,
              ipHash: null,
              joinedVia: 'link',
              joinedAt: new Date(clock.nowMs),
            },
            null
          )
        );
      },
      body: reusing(),
    },
    {
      scenario: 'it is over an hour old',
      disturb: async ({ clock }: CreateContext) => clock.advance(MS_PER_HOUR + 1),
      body: reusing(),
    },
    {
      scenario: 'the first video differs',
      disturb: async () => {},
      body: reusing({ source: { videoId: VIDEO_C } }),
    },
    {
      scenario: 'reuse was not asked for',
      disturb: async () => {},
      body: reusing({ reuse: false }),
    },
  ])('makes a new room when $scenario', async ({ disturb, body }) => {
    const context = await setUpCreate();
    const first = expectOk(await context.create(reusing()));
    await disturb(context, first.id);

    expect(expectOk(await context.create(body)).id).not.toBe(first.id);
  });
});
