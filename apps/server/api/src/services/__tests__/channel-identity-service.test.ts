import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { type Channel, HANDLE_CHANGE_COOLDOWN_DAYS, HANDLE_RESERVATION_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelIdentityService } from '../channel-identity-service';
import { channelIdentityServiceDeps, TEST_NOW } from './service-deps';

const OWNER_ID = '018f0000-0000-7000-8000-000000000001';
const OTHER_ID = '018f0000-0000-7000-8000-000000000003';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
const OTHER_CHANNEL_ID = '018f0000-0000-7000-8000-000000000004';
const USER: UserContext = { id: OWNER_ID, role: 'CREATOR' };

describe('ChannelIdentityService', () => {
  let repositories: InMemoryRepositories;
  let service: ChannelIdentityService;
  let channel: Channel;

  async function seed(userId: string, id: string, handle: string) {
    expectOk(
      await repositories.users.upsert({ id: userId, email: `${handle}@example.com`, tier: 'free' })
    );
    return expectOk(
      await repositories.channels.create({ id, userId, handle, displayName: handle })
    );
  }

  const retire = async (handle: string, channelId: string, daysAgo: number) => {
    await repositories.channelHandleHistory.retire({
      handle,
      channelId,
      retiredAt: new Date(TEST_NOW - daysAgo * MS_PER_DAY),
    });
  };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    service = new ChannelIdentityService(channelIdentityServiceDeps(repositories));
    channel = await seed(OWNER_ID, CHANNEL_ID, 'owner');
    await seed(OTHER_ID, OTHER_CHANNEL_ID, 'other');
  });

  describe('decide', () => {
    it('answers an empty patch for an empty edit', async () => {
      expect(expectOk(await service.decide(channel, {}))).toEqual({});
    });

    it('carries the validated fields and clears with null', async () => {
      const patch = expectOk(
        await service.decide(channel, {
          brandColor: '#ABCDEF',
          country: 'PL',
          contactEmail: 'Hi@Example.com',
          bannerLink: { label: ' Shop ', url: 'https://shop.example' },
          links: [{ label: 'Site', url: 'https://example.com' }],
        })
      );

      expect(patch).toMatchObject({
        brandColor: '#abcdef',
        country: 'PL',
        bannerLink: { label: 'Shop', url: 'https://shop.example' },
        links: [{ label: 'Site', url: 'https://example.com' }],
      });
      expect(expectOk(await service.decide(channel, { country: null, bannerLink: null }))).toEqual({
        country: null,
        bannerLink: null,
      });
    });

    it.each([
      {
        scenario: 'a malformed colour',
        input: { brandColor: 'red' },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a malformed contact email',
        input: { contactEmail: 'nope' },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'an insecure banner link',
        input: { bannerLink: { label: 'Shop', url: 'http://shop.example' } },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a ninth link',
        input: {
          links: Array.from({ length: 9 }, (_, index) => ({
            label: `L${index}`,
            url: `https://example.com/${index}`,
          })),
        },
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario', async ({ input, code }) => {
      expect(expectErr(await service.decide(channel, input)).code).toBe(code);
    });

    it('sets the handle and when it changed', async () => {
      expect(expectOk(await service.decide(channel, { handle: 'fresh' }))).toEqual({
        handle: 'fresh',
        handleChangedAt: new Date(TEST_NOW),
      });
    });

    it('leaves the handle out when it is the one the channel has', async () => {
      expect(expectOk(await service.decide(channel, { handle: 'owner' }))).toEqual({});
    });

    it.each([
      {
        scenario: 'a handle another channel holds',
        handle: 'other',
        code: ErrorCodes.HANDLE_ALREADY_TAKEN,
      },
      { scenario: 'a malformed handle', handle: 'a', code: ErrorCodes.INVALID_HANDLE_FORMAT },
    ])('refuses $scenario', async ({ handle, code }) => {
      expect(expectErr(await service.decide(channel, { handle })).code).toBe(code);
    });

    it('refuses a second change inside the cooldown and allows it after', async () => {
      const day = (n: number) => new Date(TEST_NOW - n * MS_PER_DAY);

      const recent = { ...channel, handleChangedAt: day(HANDLE_CHANGE_COOLDOWN_DAYS - 1) };
      expect(expectErr(await service.decide(recent, { handle: 'fresh' })).code).toBe(
        ErrorCodes.HANDLE_CHANGE_TOO_SOON
      );

      const settled = { ...channel, handleChangedAt: day(HANDLE_CHANGE_COOLDOWN_DAYS) };
      expect(expectOk(await service.decide(settled, { handle: 'fresh' }))).toMatchObject({
        handle: 'fresh',
      });
    });

    it('reserves a handle another channel gave up, until the reservation passes', async () => {
      await retire('gone', OTHER_CHANNEL_ID, HANDLE_RESERVATION_DAYS - 1);
      expect(expectErr(await service.decide(channel, { handle: 'gone' })).code).toBe(
        ErrorCodes.HANDLE_RESERVED
      );

      await retire('gone', OTHER_CHANNEL_ID, HANDLE_RESERVATION_DAYS);
      expect(expectOk(await service.decide(channel, { handle: 'gone' }))).toMatchObject({
        handle: 'gone',
      });
    });

    it('lets the channel that gave a handle up take it back', async () => {
      await retire('gone', CHANNEL_ID, 1);

      expect(expectOk(await service.decide(channel, { handle: 'gone' }))).toMatchObject({
        handle: 'gone',
      });
    });
  });

  describe('recordChange', () => {
    it('appends one channel.updated audit row naming the fields', async () => {
      expectOk(await service.recordChange(USER, CHANNEL_ID, ['handle']));

      const rows = expectOk(await repositories.channelAudit.list(CHANNEL_ID, { limit: 10 }));
      expect(rows).toMatchObject([
        { action: 'channel.updated', actorUserId: OWNER_ID, meta: { fields: ['handle'] } },
      ]);
    });
  });

  describe('findPublic', () => {
    it.each([
      { scenario: 'an id', key: CHANNEL_ID },
      { scenario: 'a handle', key: 'owner' },
      { scenario: 'a handle with its @', key: '@owner' },
    ])('finds the channel by $scenario without a redirect', async ({ key }) => {
      expect(expectOk(await service.findPublic(key))).toMatchObject({
        channel: { id: CHANNEL_ID },
        redirectedFrom: null,
      });
    });

    it('resolves a retired handle to its channel with redirectedFrom, inside the reservation', async () => {
      await retire('old', CHANNEL_ID, HANDLE_RESERVATION_DAYS - 1);

      expect(expectOk(await service.findPublic('@old'))).toMatchObject({
        channel: { id: CHANNEL_ID },
        redirectedFrom: 'old',
      });
    });

    it('answers CHANNEL_NOT_FOUND for a retired handle past the reservation and for an unknown one', async () => {
      await retire('old', CHANNEL_ID, HANDLE_RESERVATION_DAYS);

      expect(expectErr(await service.findPublic('old')).code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
      expect(expectErr(await service.findPublic('nobody')).code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('revealContact', () => {
    it('hands the address out, and answers not found when the channel set none', async () => {
      expect(expectErr(await service.revealContact(CHANNEL_ID)).code).toBe(
        ErrorCodes.CHANNEL_NOT_FOUND
      );

      expectOk(await repositories.channels.update(CHANNEL_ID, { contactEmail: 'hi@example.com' }));

      expect(expectOk(await service.revealContact(CHANNEL_ID))).toEqual({
        email: 'hi@example.com',
      });
    });
  });
});
