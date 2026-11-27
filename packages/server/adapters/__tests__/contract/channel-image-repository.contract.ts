import { expectOk } from '@kit/testing/result';
import type {
  ChannelImageCompletion,
  ChannelImageRepositoryPort,
  Repositories,
} from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind } from '@vp/domain';
import { OTHER_OWNER_ID, OWNER_CHANNEL_ID, OWNER_ID, seedOwners } from './fixtures';
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

const POST_DONE: ChannelImageCompletion = {
  width: 3000,
  height: 2000,
  crops: { kind: 'post-image', crop: { x: 0, y: 0, width: 3000, height: 2000 } },
};
const COMPLETIONS: Record<ChannelImageKind, ChannelImageCompletion> = {
  avatar: AVATAR_DONE,
  banner: BANNER_DONE,
  'post-image': POST_DONE,
};
const POST_URLS = {
  w640: 'https://cdn.example/c/post-image/v1/640.webp',
  w1280: 'https://cdn.example/c/post-image/v1/1280.webp',
};

const DAY_MS = 86_400_000;
const DEFAULT_URL = 'https://cdn.example/c/banner/v1/desktop-1280.webp';

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
      return expectOk(await images.queue(id, COMPLETIONS[kind]));
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
        variantUrls: null,
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

        const again = expectOk(await images.queue(FIRST, { ...BANNER_DONE, width: 9999 }));

        expect(again).toMatchObject({ status: 'queued', version: 1, width: 2560 });

        expectOk(await images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await images.queue(SECOND, BANNER_DONE))).toBeNull();
        expect(expectOk(await images.queue(FIRST, BANNER_DONE))).toBeNull();
      });
    });

    describe('commit', () => {
      it('moves the channel to the version, announces it and audits it', async () => {
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

    describe('post images', () => {
      it('numbers them apart from the channel images and keeps every ready one beside the others', async () => {
        await queue(FIRST, 'post-image');
        await queue(SECOND, 'post-image');
        await queue(THIRD, 'banner');

        const first = expectOk(await images.commit(FIRST, POST_URLS.w1280, POST_URLS));
        const second = expectOk(await images.commit(SECOND, POST_URLS.w1280, POST_URLS));

        expect(first).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
        expect(second).toMatchObject({ applied: true, upload: { status: 'ready', version: 2 } });
        expect(expectOk(await images.findById(THIRD))?.version).toBe(1);
        expect(await channel()).toMatchObject({
          avatarVersion: 0,
          bannerVersion: 0,
          bannerCrops: null,
          avatarUrl: null,
          bannerUrl: null,
        });
        expect(await auditActions()).toEqual([]);
        expect(await eventTypes()).toEqual(['channel.image.ready', 'channel.image.ready']);
      });

      it('is never purgeable while ready', async () => {
        await queue(FIRST, 'post-image');
        expectOk(await images.commit(FIRST, POST_URLS.w1280, POST_URLS));

        expect(expectOk(await images.listPurgeable(new Date(Date.now() + DAY_MS), 10))).toEqual([]);
      });

      it('finds the ready post images of the channel among the ids and nothing else', async () => {
        await queue(FIRST, 'post-image');
        await queue(SECOND, 'post-image');
        await queue(THIRD, 'avatar');
        expectOk(await images.commit(FIRST, POST_URLS.w1280, POST_URLS));
        expectOk(await images.commit(THIRD, DEFAULT_URL));
        const missing = '00000000-0000-7000-8000-0000000004f0';

        const found = expectOk(
          await images.findReadyPostImages(channelId, [FIRST, SECOND, THIRD, missing])
        );

        expect(found).toEqual([{ uploadId: FIRST, urls: POST_URLS }]);
        expect(expectOk(await images.findReadyPostImages(channelId, []))).toEqual([]);
        expect(
          expectOk(
            await images.findReadyPostImages('00000000-0000-7000-8000-0000000004e0', [FIRST])
          )
        ).toEqual([]);
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

      it('leaves an upload that already settled as it is,, and null for an unknown one', async () => {
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
        await images.queue(FIRST, BANNER_DONE);

        expectOk(await images.markPurged([FIRST, SECOND]));

        expect(expectOk(await images.findById(FIRST))?.status).toBe('queued');
        expect(expectOk(await images.findById(SECOND))?.status).toBe('ready');
      });
    });

    it('keeps a team uploader apart from the owner', async () => {
      await repositories.users.upsert({ id: OTHER_OWNER_ID, email: 'other@video-pipeline.local' });
      await issue(FIRST, 'avatar', OTHER_OWNER_ID);
      expectOk(await images.queue(FIRST, AVATAR_DONE));

      expectOk(await images.commit(FIRST, DEFAULT_URL));

      const told = expectOk(await repositories.userEvents.listFrom(OTHER_OWNER_ID, 0, 10));
      expect(told.map(({ type }) => type)).toEqual(['channel.image.ready']);
      expect(await eventTypes()).toEqual([]);
    });
  });
}
