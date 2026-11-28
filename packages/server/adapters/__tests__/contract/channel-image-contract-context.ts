import { expectOk } from '@kit/testing/result';
import type { ChannelImageCompletion } from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind } from '@vp/domain';
import { OWNER_CHANNEL_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const UPLOADS = [1, 2, 3].map((n) => `00000000-0000-7000-8000-0000000004${n}0`);
export const [FIRST, SECOND, THIRD] = UPLOADS as [string, string, string];

const CROP = { x: 0, y: 0, width: 400, height: 400 };
export const BANNER_CROPS: BannerCrops = {
  desktop: { x: 0, y: 0, width: 2400, height: 400 },
  mobile: { x: 0, y: 0, width: 1500, height: 500 },
  tv: { x: 0, y: 0, width: 1600, height: 900 },
};
export const AVATAR_DONE: ChannelImageCompletion = {
  width: 800,
  height: 800,
  crops: { kind: 'avatar', crop: CROP },
};
export const BANNER_DONE: ChannelImageCompletion = {
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

export const POST_URLS = {
  w640: 'https://cdn.example/c/post-image/v1/640.webp',
  w1280: 'https://cdn.example/c/post-image/v1/1280.webp',
};
export const DAY_MS = 86_400_000;
export const DEFAULT_URL = 'https://cdn.example/c/banner/v1/desktop-1280.webp';

/** Registers the hooks of a contract file and returns the repositories and helpers they fill. */
export function channelImageContractContext(makeSubject: MakeRepositoriesSubject) {
  let subject: RepositoriesSubject;
  const channelId = OWNER_CHANNEL_ID;

  beforeAll(async () => {
    subject = await makeSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  beforeEach(async () => {
    await subject.reset();
    await seedOwners(subject.repositories);
  });

  const issue = async (id: string, kind: ChannelImageKind = 'banner', uploadedBy = OWNER_ID) =>
    expectOk(
      await subject.repositories.channelImages.create({
        id,
        channelId,
        uploadedBy,
        kind,
        contentType: 'image/png',
        sizeBytes: 1000,
      })
    );

  return {
    channelId,
    get repositories() {
      return subject.repositories;
    },
    get images() {
      return subject.repositories.channelImages;
    },
    issue,
    queue: async (id: string, kind: ChannelImageKind = 'banner') => {
      await issue(id, kind);
      return expectOk(await subject.repositories.channelImages.queue(id, COMPLETIONS[kind]));
    },
    channel: async () => expectOk(await subject.repositories.channels.findById(channelId)),
    eventTypes: async () =>
      expectOk(await subject.repositories.userEvents.listFrom(OWNER_ID, 0, 50)).map(
        ({ type }) => type
      ),
    auditActions: async () =>
      expectOk(
        await subject.repositories.channelAudit.list(channelId, { cursor: null, limit: 50 })
      ).map(({ action }) => action),
  };
}
