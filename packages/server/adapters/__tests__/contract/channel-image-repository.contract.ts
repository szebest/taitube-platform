import { expectOk } from '@kit/testing/result';
import type { ChannelImageRepositoryPort, Repositories } from '@vp/core/repositories';
import type { ChannelImageKind } from '@vp/domain';
import { BANNER_CROPS, DONE } from './channel-image-fixtures';
import { OTHER_OWNER_ID, OWNER_CHANNEL_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const UPLOADS = [1, 2, 3].map((n) => `00000000-0000-7000-8000-0000000004${n}0`);
const [FIRST, SECOND, THIRD] = UPLOADS as [string, string, string];

const DAY_MS = 86_400_000;
const DEFAULT_URL = 'https://cdn.example/c/v1/1280.webp';

export function describeChannelImageRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelImageRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let images: ChannelImageRepositoryPort;
    let channelId: string;

    const issue = async (id: string, kind: ChannelImageKind = 'banner', uploadedBy = OWNER_ID) =>
      expectOk(
        await images.create({
          id,
          channelId,
          uploadedBy,
          kind,
          contentType: 'image/png',
          sizeBytes: 1000,
        })
      );
    const queue = async (id: string, kind: ChannelImageKind = 'banner') => {
      await issue(id, kind);
      return expectOk(await images.queue(id, DONE[kind]));
    };
    const channel = async () => expectOk(await repositories.channels.findById(channelId));
    const eventTypes = async () =>
      expectOk(await repositories.userEvents.listFrom(OWNER_ID, 0, 50)).map(({ type }) => type);
    const auditActions = async () =>
      expectOk(await repositories.channelAudit.list(channelId, { cursor: null, limit: 50 })).map(
        ({ action }) => action
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      repositories = subject.repositories;
      await seedOwners(repositories);
      channelId = OWNER_CHANNEL_ID;
      images = repositories.channelImages;
    });

    it('records an issued upload with nothing decided about it yet', async () => {
      expect(await issue(FIRST)).toMatchObject({
        id: FIRST,
        channelId,
        kind: 'banner',
        status: 'issued',
        version: null,
        crops: null,
        failure: null,
      });
      expect(expectOk(await images.findById(FIRST))?.id).toBe(FIRST);
      expect(expectOk(await images.findById(SECOND))).toBeNull();
    });

    describe('queue', () => {
      it('stores dimensions and crops, numbering each kind after its newest version', async () => {
        expect(await queue(FIRST)).toMatchObject({
          status: 'queued',
          width: 2560,
          height: 1440,
          crops: { kind: 'banner', crops: BANNER_CROPS },
          version: 1,
        });
        expect(await queue(SECOND)).toMatchObject({ version: 2 });
        expect(await queue(THIRD, 'avatar')).toMatchObject({ version: 1 });
      });

      it('repeats the version for a second call, and answers null once moved on or missing', async () => {
        await queue(FIRST);

        const again = expectOk(await images.queue(FIRST, { ...DONE.banner, width: 9999 }));

        expect(again).toMatchObject({ status: 'queued', version: 1, width: 2560 });

        expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await images.queue(SECOND, DONE.banner))).toBeNull();
        expect(expectOk(await images.queue(FIRST, DONE.banner))).toBeNull();
      });
    });

    describe('commit', () => {
      it.each([
        {
          kind: 'banner',
          moved: { bannerVersion: 1, bannerCrops: BANNER_CROPS, avatarVersion: 0 },
        },
        { kind: 'avatar', moved: { avatarVersion: 1, bannerVersion: 0, bannerCrops: null } },
      ] as const)(
        'moves the channel to the $kind version alone, announcing and auditing it',
        async ({ kind, moved }) => {
          await queue(FIRST, kind);

          const commit = expectOk(await images.commit(FIRST, DEFAULT_URL));

          expect(commit).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
          expect(await channel()).toMatchObject(moved);
          expect(await eventTypes()).toEqual(['channel.image.ready']);
          expect(await auditActions()).toEqual(['channel.updated']);
        }
      );

      it('readies every playlist cover beside the others, moving and auditing nothing', async () => {
        await queue(FIRST, 'playlist-cover');
        await queue(SECOND, 'playlist-cover');

        expectOk(await images.commit(SECOND, DEFAULT_URL));
        const earlier = expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(earlier).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
        expect(await channel()).toMatchObject({ avatarVersion: 0, bannerVersion: 0 });
        expect(await eventTypes()).toEqual(['channel.image.ready', 'channel.image.ready']);
        expect(await auditActions()).toEqual([]);
        expect(expectOk(await images.listPurgeable(new Date(Date.now() + DAY_MS), 10))).toEqual([]);
      });

      it('repeats its outcome for a committed upload and announces nothing more', async () => {
        await queue(FIRST);
        expectOk(await images.commit(FIRST, DEFAULT_URL));

        const again = expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(again).toMatchObject({ applied: true, upload: { status: 'ready' } });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
        expect(await auditActions()).toEqual(['channel.updated']);
      });

      it('never brings back an older version: the late one is superseded silently', async () => {
        await queue(FIRST);
        await queue(SECOND);
        expectOk(await images.commit(SECOND, DEFAULT_URL));

        const late = expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(late).toMatchObject({ applied: false, upload: { status: 'superseded' } });
        expect((await channel())?.bannerVersion).toBe(2);
        expect(await eventTypes()).toEqual(['channel.image.ready']);
      });

      it.each([
        { scenario: 'an unknown upload', prepare: async () => THIRD },
        {
          scenario: 'an upload never queued',
          prepare: async () => {
            await issue(FIRST);
            return FIRST;
          },
        },
      ])('answers null for $scenario', async ({ prepare }) => {
        expect(expectOk(await images.commit(await prepare(), DEFAULT_URL))).toBeNull();
      });
    });

    describe('fail', () => {
      it('keeps the old image, records why, tells the uploader', async () => {
        await queue(FIRST);

        const failed = expectOk(await images.fail(FIRST, 'unreadable'));

        expect(failed).toMatchObject({ status: 'failed', failure: 'unreadable' });
        expect(await channel()).toMatchObject({ bannerVersion: 0 });
        expect(await eventTypes()).toEqual(['channel.image.failed']);
      });

      it('leaves an upload that already settled as it is, and null for an unknown one', async () => {
        await queue(FIRST);
        expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await images.fail(FIRST, 'late'))).toMatchObject({
          status: 'ready',
          failure: null,
        });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
        expect(expectOk(await images.fail(THIRD, 'x'))).toBeNull();
      });
    });

    describe('purging', () => {
      const future = () => new Date(Date.now() + DAY_MS);

      it('lists replaced versions, failures and abandoned uploads, not the current image', async () => {
        await queue(FIRST);
        expectOk(await images.commit(FIRST, DEFAULT_URL));
        await queue(SECOND);
        expectOk(await images.commit(SECOND, DEFAULT_URL));
        await queue(THIRD);
        expectOk(await images.fail(THIRD, 'bad'));

        const purgeable = expectOk(await images.listPurgeable(future(), 10));

        expect(purgeable.map(({ id }) => id).sort()).toEqual([FIRST, THIRD].sort());
      });

      it('leaves out what changed after the cutoff and honours the limit', async () => {
        await queue(FIRST);
        expectOk(await images.fail(FIRST, 'bad'));
        await queue(SECOND);
        expectOk(await images.fail(SECOND, 'bad'));

        expect(expectOk(await images.listPurgeable(new Date(0), 10))).toEqual([]);
        expect(expectOk(await images.listPurgeable(future(), 1))).toHaveLength(1);
      });

      it('stops listing an upload once it is marked purged, and accepts an empty list', async () => {
        await queue(FIRST);
        expectOk(await images.fail(FIRST, 'bad'));

        expectOk(await images.markPurged([]));
        expectOk(await images.markPurged([FIRST]));

        expect(expectOk(await images.listPurgeable(future(), 10))).toEqual([]);
        expect(expectOk(await images.findById(FIRST))?.status).toBe('purged');
      });

      it('leaves an upload that moved on since it was listed, and the live image', async () => {
        await issue(FIRST);
        await queue(SECOND);
        expectOk(await images.commit(SECOND, DEFAULT_URL));
        await images.queue(FIRST, DONE.banner);

        expectOk(await images.markPurged([FIRST, SECOND]));

        expect(expectOk(await images.findById(FIRST))?.status).toBe('queued');
        expect(expectOk(await images.findById(SECOND))?.status).toBe('ready');
      });
    });

    it('keeps a team uploader apart from the owner', async () => {
      await repositories.users.upsert({ id: OTHER_OWNER_ID, email: 'other@video-pipeline.local' });
      await issue(FIRST, 'avatar', OTHER_OWNER_ID);
      expectOk(await images.queue(FIRST, DONE.avatar));

      expectOk(await images.commit(FIRST, DEFAULT_URL));

      const told = expectOk(await repositories.userEvents.listFrom(OTHER_OWNER_ID, 0, 10));
      expect(told.map(({ type }) => type)).toEqual(['channel.image.ready']);
      expect(await eventTypes()).toEqual([]);
    });
  });
}
