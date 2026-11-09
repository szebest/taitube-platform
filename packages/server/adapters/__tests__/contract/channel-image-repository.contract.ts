import type {
  ChannelImageCompletion,
  ChannelImageRepositoryPort,
  Repositories,
} from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const UPLOADS = [1, 2, 3].map((n) => `00000000-0000-7000-8000-0000000004${n}0`);
const [FIRST, SECOND, THIRD] = UPLOADS as [string, string, string];

const CROP = { x: 0, y: 0, width: 400, height: 400 };
const BANNER_CROPS: BannerCrops = {
  desktop: { x: 0, y: 0, width: 2400, height: 400 },
  mobile: { x: 0, y: 0, width: 1500, height: 500 },
  tv: { x: 0, y: 0, width: 1600, height: 900 },
};
const AVATAR_DONE: ChannelImageCompletion = {
  width: 800,
  height: 800,
  crops: { kind: 'avatar', crop: CROP },
};
const BANNER_DONE: ChannelImageCompletion = {
  width: 2560,
  height: 1440,
  crops: { kind: 'banner', crops: BANNER_CROPS },
};

const DAY_MS = 86_400_000;
const DEFAULT_URL = 'https://cdn.example/channels/c/banner/v1/desktop-1280.webp';

export function describeChannelImageRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelImageRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let images: ChannelImageRepositoryPort;
    let channelId: string;

    const issue = async (id: string, kind: ChannelImageKind = 'banner') =>
      expectOk(
        await images.create({
          id,
          channelId,
          uploadedBy: OWNER_ID,
          kind,
          contentType: 'image/png',
          sizeBytes: 1000,
        })
      );
    const queue = async (id: string, kind: ChannelImageKind = 'banner') => {
      await issue(id, kind);
      return expectOk(await images.queue(id, kind === 'banner' ? BANNER_DONE : AVATAR_DONE));
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
      channelId = expectOk(
        await repositories.channels.create({
          userId: OWNER_ID,
          handle: 'owner',
          displayName: 'Owner',
        })
      ).id;
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
      it('stores the dimensions and crops and numbers the upload after the newest version', async () => {
        expect(await queue(FIRST)).toMatchObject({
          status: 'queued',
          width: 2560,
          height: 1440,
          crops: { kind: 'banner', crops: BANNER_CROPS },
          version: 1,
        });
        expect(await queue(SECOND)).toMatchObject({ version: 2 });
      });

      it('numbers each kind on its own', async () => {
        await queue(FIRST, 'banner');

        expect(await queue(SECOND, 'avatar')).toMatchObject({ version: 1 });
      });

      it('answers a second call for a queued upload with the same version', async () => {
        await queue(FIRST);

        const again = expectOk(await images.queue(FIRST, { ...BANNER_DONE, width: 9999 }));

        expect(again).toMatchObject({ status: 'queued', version: 1, width: 2560 });
      });

      it('answers null for an upload that is missing or has moved on', async () => {
        await queue(FIRST);
        expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await images.queue(SECOND, BANNER_DONE))).toBeNull();
        expect(expectOk(await images.queue(FIRST, BANNER_DONE))).toBeNull();
      });
    });

    describe('commit', () => {
      it('moves the channel to the version, announces it and writes the audit row', async () => {
        await queue(FIRST);

        const commit = expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(commit).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
        expect(await channel()).toMatchObject({
          bannerVersion: 1,
          bannerCrops: BANNER_CROPS,
          avatarVersion: 0,
        });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
        expect(await auditActions()).toEqual(['channel.updated']);
      });

      it('moves an avatar without touching the banner', async () => {
        await queue(FIRST, 'avatar');

        expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(await channel()).toMatchObject({
          avatarVersion: 1,
          bannerVersion: 0,
          bannerCrops: null,
        });
      });

      it('repeats its outcome for an upload already committed and announces nothing more', async () => {
        await queue(FIRST);
        expectOk(await images.commit(FIRST, DEFAULT_URL));

        const again = expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(again).toMatchObject({ applied: true, upload: { status: 'ready' } });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
        expect(await auditActions()).toEqual(['channel.updated']);
      });

      it('never brings an older version back: the late one is superseded and says nothing', async () => {
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
      it('keeps the old image, records why and tells the uploader', async () => {
        await queue(FIRST);

        const failed = expectOk(await images.fail(FIRST, 'unreadable'));

        expect(failed).toMatchObject({ status: 'failed', failure: 'unreadable' });
        expect(await channel()).toMatchObject({ bannerVersion: 0 });
        expect(await eventTypes()).toEqual(['channel.image.failed']);
      });

      it('leaves an upload that already settled as it is', async () => {
        await queue(FIRST);
        expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await images.fail(FIRST, 'late'))).toMatchObject({
          status: 'ready',
          failure: null,
        });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
      });

      it('answers null for an unknown upload', async () => {
        expect(expectOk(await images.fail(THIRD, 'x'))).toBeNull();
      });
    });

    describe('purging', () => {
      const future = () => new Date(Date.now() + DAY_MS);

      it('lists replaced versions, failures and abandoned uploads, never the current image', async () => {
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

      it('stops listing an upload once it is marked purged', async () => {
        await queue(FIRST);
        expectOk(await images.fail(FIRST, 'bad'));

        expectOk(await images.markPurged([FIRST]));

        expect(expectOk(await images.listPurgeable(future(), 10))).toEqual([]);
        expect(expectOk(await images.findById(FIRST))?.status).toBe('purged');
      });

      it('accepts an empty list', async () => {
        expectOk(await images.markPurged([]));
      });
    });

    it('keeps the uploader of a team channel apart from its owner', async () => {
      await repositories.users.upsert({ id: OTHER_OWNER_ID, email: 'other@video-pipeline.local' });
      expectOk(
        await images.create({
          id: FIRST,
          channelId,
          uploadedBy: OTHER_OWNER_ID,
          kind: 'avatar',
          contentType: 'image/png',
          sizeBytes: 1,
        })
      );
      expectOk(await images.queue(FIRST, AVATAR_DONE));

      expectOk(await images.commit(FIRST, DEFAULT_URL));

      const told = expectOk(await repositories.userEvents.listFrom(OTHER_OWNER_ID, 0, 10));
      expect(told.map(({ type }) => type)).toEqual(['channel.image.ready']);
      expect(await eventTypes()).toEqual([]);
    });
  });
}
