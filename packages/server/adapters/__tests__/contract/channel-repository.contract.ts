import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000301';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-000000000302';
const ABSENT_ID = '00000000-0000-7000-8000-0000000003ff';

export function describeChannelRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelRepository contract', () => {
    let subject: RepositoriesSubject;
    let channels: ChannelRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
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
        bio: null,
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

    it('reports a patch taking a handle another channel holds', async () => {
      expectOk(
        await channels.create({
          id: OTHER_CHANNEL_ID,
          userId: OTHER_OWNER_ID,
          handle: 'otherhandle',
          displayName: 'Other',
        })
      );

      const failure = expectErr(await channels.update(CHANNEL_ID, { handle: 'otherhandle' }));

      expect(failure.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('answers ok(null) when patching a channel that is not there', async () => {
      expect(expectOk(await channels.update(ABSENT_ID, { displayName: 'Ghost' }))).toBeNull();
    });
  });
}
