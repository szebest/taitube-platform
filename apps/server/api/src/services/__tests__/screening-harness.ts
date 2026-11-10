import {
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { NewScreeningInput } from '@vp/core/repositories';
import type { ScreeningFinding } from '@vp/domain';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { ScreeningCaseViews } from '../screening-case-views';
import { ScreeningService } from '../screening-service';
import { TEST_CDN } from './service-deps';

export const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000005e1', role: 'CREATOR' };
export const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000005e2', role: 'USER' };
export const MODERATOR_A: UserContext = {
  id: '00000000-0000-7000-8000-0000000005e3',
  role: 'ADMIN',
};
export const MODERATOR_B: UserContext = {
  id: '00000000-0000-7000-8000-0000000005e4',
  role: 'ADMIN',
};
const ORIGINAL_OWNER: UserContext = {
  id: '00000000-0000-7000-8000-0000000005e5',
  role: 'CREATOR',
};
export const HELD_ID = '00000000-0000-7000-8000-0000000005f1';
export const ORIGINAL_ID = '00000000-0000-7000-8000-0000000005f2';
export const SCREENING_ID = '00000000-0000-7000-8000-0000000005f3';
export const FRAME_KEY = `evidence/${HELD_ID}/frame-0.jpg`;

export const duplicate: ScreeningFinding = {
  reason: 'DUPLICATE',
  score: 0.97,
  evidence: {
    matchedVideoId: ORIGINAL_ID,
    sameChannel: false,
    video: {
      coverage: 0.97,
      longestRunSeconds: 60,
      runFromSeconds: 10,
      runToSeconds: 70,
      offsetSeconds: 5,
      mirrored: true,
    },
    audio: null,
  },
};

const nsfw: ScreeningFinding = {
  reason: 'NSFW',
  score: 0.93,
  evidence: { share: 0.4, frames: [{ key: FRAME_KEY, timestampSeconds: 12, score: 0.93 }] },
};

export function screeningHarness() {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const packageQueue = new InMemoryJobQueue('package');
  const service = new ScreeningService({
    screenings: repositories.screenings,
    videos: repositories.videos,
    views: new ScreeningCaseViews({
      videos: repositories.videos,
      channels: repositories.channels,
      storage,
      rawBucket: 'raw',
      frameUrlTtlSeconds: 300,
      cdn: TEST_CDN,
    }),
    packageQueue,
    paginator: new Paginator(),
  });

  const video = async (overrides: Parameters<InMemoryRepositories['videos']['create']>[0]) =>
    expectOk(await repositories.videos.create(overrides));

  async function seedHeld(
    screening: Partial<NewScreeningInput> = {},
    videoOverrides: Partial<Parameters<InMemoryRepositories['videos']['create']>[0]> = {}
  ) {
    expectOk(
      await repositories.channels.create({
        userId: ORIGINAL_OWNER.id,
        handle: 'original',
        displayName: 'The Original',
      })
    );
    await video({
      id: ORIGINAL_ID,
      ownerId: ORIGINAL_OWNER.id,
      title: 'The original',
      status: 'READY',
      visibility: 'public',
      sourceKey: 'raw/original.mp4',
      posterKey: `videos/${ORIGINAL_ID}/thumbs/poster.jpg`,
    });
    await video({
      id: HELD_ID,
      ownerId: OWNER.id,
      title: 'A copy',
      status: 'HELD',
      visibility: 'public',
      sourceKey: 'raw/copy.mp4',
      ladder: CANONICAL_LADDER,
      ...videoOverrides,
    });
    expectOk(
      await repositories.screenings.record({
        id: SCREENING_ID,
        videoId: HELD_ID,
        sourceChecksum: 'sum-1',
        outcome: 'HOLD',
        score: 0.97,
        reasons: [duplicate, nsfw],
        flags: [],
        modelVersion: 'nsfw-classifier',
        thresholdVersion: 'v1',
        ...screening,
      })
    );
  }

  const statusOf = async (id = HELD_ID) => expectOk(await repositories.videos.findById(id))?.status;
  const eventTypes = async (id = HELD_ID) =>
    expectOk(await repositories.events.findByVideoId(id)).map((event) => event.type);

  return { repositories, storage, packageQueue, service, seedHeld, video, statusOf, eventTypes };
}
