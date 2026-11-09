import type { ChannelRepositoryPort } from '@vp/core/repositories';
import type { UpdateChannelInput } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { describeChannelStatsContract } from './channel-stats.contract';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000301';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-000000000302';
const ABSENT_ID = '00000000-0000-7000-8000-0000000003ff';

export function describeChannelRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelRepository contract', () => {
    let subject: RepositoriesSubject;
    let channels: ChannelRepositoryPort;

    const createOtherChannel = async (): Promise<void> => {
      expectOk(
        await channels.create({
          id: OTHER_CHANNEL_ID,
          userId: OTHER_OWNER_ID,
          handle: 'otherhandle',
          displayName: 'Other',
        })
      );
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      channels = subject.repositories.channels;
      expectOk(
        await channels.create({
          id: CHANNEL_ID,
          userId: OWNER_ID,
          handle: 'OwnerHandle',
          displayName: 'Owner',
        })
      );
    });

    it('stores the handle lower-cased and applies the defaults', async () => {
      expect(expectOk(await channels.findById(CHANNEL_ID))).toMatchObject({
        handle: 'ownerhandle',
        displayName: 'Owner',
        avatarUrl: null,
        bannerUrl: null,
        brandColor: null,
        bio: null,
        links: [],
        avatarVersion: 0,
        bannerVersion: 0,
        bannerCrops: null,
        country: null,
        contactEmail: null,
        bannerLink: null,
        handleChangedAt: null,
        subscriberCount: 0,
      });
    });

    it('looks a channel up by id, user and handle, case-insensitively', async () => {
      expect(expectOk(await channels.findByUserId(OWNER_ID))?.id).toBe(CHANNEL_ID);
      expect(expectOk(await channels.findByHandle('OWNERHANDLE'))?.id).toBe(CHANNEL_ID);
    });

    it.each([
      { name: 'an unknown handle', read: (c: ChannelRepositoryPort) => c.findByHandle('missing') },
      {
        name: 'an unknown user',
        read: (c: ChannelRepositoryPort) => c.findByUserId(OTHER_OWNER_ID),
      },
      { name: 'an unknown id', read: (c: ChannelRepositoryPort) => c.findById(ABSENT_ID) },
    ])('answers ok(null) for $name, because absence is not a failure', async ({ read }) => {
      expect(expectOk(await read(channels))).toBeNull();
    });

    describe('findByUserIds', () => {
      beforeEach(createOtherChannel);

      it.each([
        {
          name: 'each owner once, repeats included',
          userIds: [OTHER_OWNER_ID, OWNER_ID, OWNER_ID],
          expected: [CHANNEL_ID, OTHER_CHANNEL_ID],
        },
        { name: 'no owners', userIds: [], expected: [] },
        {
          name: 'an owner with no channel',
          userIds: [OWNER_ID, ABSENT_ID],
          expected: [CHANNEL_ID],
        },
      ])('finds the channels of $name in one call', async ({ userIds, expected }) => {
        const found = expectOk(await channels.findByUserIds(userIds));

        expect(found.map((channel) => channel.id).sort()).toEqual(expected);
      });
    });

    it('reports a handle another channel holds as HANDLE_ALREADY_TAKEN', async () => {
      const failure = expectErr(
        await channels.create({
          id: OTHER_CHANNEL_ID,
          userId: OTHER_OWNER_ID,
          handle: 'ownerhandle',
          displayName: 'Impostor',
        })
      );

      expect(failure.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('reports a second channel for the same user as HANDLE_ALREADY_TAKEN', async () => {
      const failure = expectErr(
        await channels.create({
          id: OTHER_CHANNEL_ID,
          userId: OWNER_ID,
          handle: 'secondhandle',
          displayName: 'Second',
        })
      );

      expect(failure.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('patches only the supplied fields', async () => {
      const updated = expectOk(
        await channels.update(CHANNEL_ID, { displayName: 'Renamed', bio: 'Hello' })
      );

      expect(updated).toMatchObject({
        displayName: 'Renamed',
        bio: 'Hello',
        handle: 'ownerhandle',
      });
    });

    it('stores links, keeps them across a patch that omits them, and clears them with an empty list', async () => {
      const links = [{ label: 'Shop', url: 'https://shop.example.com' }];

      const stored = expectOk(await channels.update(CHANNEL_ID, { links }))?.links;
      const kept = expectOk(await channels.update(CHANNEL_ID, { bio: 'Hello' }))?.links;
      const cleared = expectOk(await channels.update(CHANNEL_ID, { links: [] }))?.links;

      expect([stored, kept, cleared]).toEqual([links, links, []]);
      expect(expectOk(await channels.findById(CHANNEL_ID))?.links).toEqual([]);
    });

    it('stores a brand colour, keeps it across a patch that omits it, and clears it with null', async () => {
      const brandColorAfter = async (patch: UpdateChannelInput) =>
        expectOk(await channels.update(CHANNEL_ID, patch))?.brandColor;

      expect([
        await brandColorAfter({ brandColor: '#3366cc' }),
        await brandColorAfter({ bio: 'Hello' }),
        await brandColorAfter({ brandColor: null }),
      ]).toEqual(['#3366cc', '#3366cc', null]);
    });

    it.each([
      { field: 'country', value: 'PL' },
      { field: 'contactEmail', value: 'ada@example.com' },
      { field: 'bannerLink', value: { label: 'Shop', url: 'https://shop.example.com' } },
    ] as const)(
      'stores $field, keeps it across a patch that omits it, and clears it with null',
      async ({ field, value }) => {
        const after = async (patch: UpdateChannelInput) =>
          expectOk(await channels.update(CHANNEL_ID, patch))?.[field];

        expect([
          await after({ [field]: value }),
          await after({ bio: 'Hello' }),
          await after({ [field]: null }),
        ]).toEqual([value, value, null]);
      }
    );

    describe('changing the handle', () => {
      const changedAt = new Date('2026-03-01T00:00:00.000Z');
      const historyOf = async (handle: string) =>
        expectOk(await subject.repositories.channelHandleHistory.findByHandle(handle));

      it('stamps the change time, retires the old handle and frees nothing else', async () => {
        const updated = expectOk(
          await channels.update(CHANNEL_ID, { handle: 'NewHandle', handleChangedAt: changedAt })
        );

        expect(updated).toMatchObject({ handle: 'newhandle', handleChangedAt: changedAt });
        expect(await historyOf('ownerhandle')).toEqual({
          handle: 'ownerhandle',
          channelId: CHANNEL_ID,
          retiredAt: changedAt,
        });
        expect(await historyOf('newhandle')).toBeNull();
      });

      it('leaves history and the change time alone when the handle stays', async () => {
        expectOk(
          await channels.update(CHANNEL_ID, {
            handle: 'OWNERHANDLE',
            handleChangedAt: changedAt,
            bio: 'Hi',
          })
        );

        expect(expectOk(await channels.findById(CHANNEL_ID))?.handleChangedAt).toBeNull();
        expect(await historyOf('ownerhandle')).toBeNull();
      });

      it('takes the old handle out of the history when the channel changes back to it', async () => {
        expectOk(
          await channels.update(CHANNEL_ID, { handle: 'newhandle', handleChangedAt: changedAt })
        );
        expectOk(
          await channels.update(CHANNEL_ID, { handle: 'ownerhandle', handleChangedAt: changedAt })
        );

        expect(await historyOf('ownerhandle')).toBeNull();
        expect(await historyOf('newhandle')).toMatchObject({ channelId: CHANNEL_ID });
      });

      it('retires nothing when another channel holds the new handle', async () => {
        await createOtherChannel();

        expectErr(
          await channels.update(CHANNEL_ID, { handle: 'otherhandle', handleChangedAt: changedAt })
        );

        expect(await historyOf('ownerhandle')).toBeNull();
        expect(expectOk(await channels.findById(CHANNEL_ID))?.handle).toBe('ownerhandle');
      });
    });

    it('reports a patch taking a handle another channel holds', async () => {
      await createOtherChannel();

      const failure = expectErr(
        await channels.update(CHANNEL_ID, { handle: 'otherhandle', handleChangedAt: changedAt })
      );

      expect(failure.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('answers ok(null) when patching a channel that is not there', async () => {
      expect(expectOk(await channels.update(ABSENT_ID, { displayName: 'Ghost' }))).toBeNull();
    });
  });

  describeChannelStatsContract(makeSubject);
}
