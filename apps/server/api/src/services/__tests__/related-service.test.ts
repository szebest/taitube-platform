import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { RelatedService } from '../related-service';
import { VideoService } from '../video-service';
import { ViewerProgress } from '../viewer-progress';
import { videoServiceDeps } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000000f1';
const VIEWER = { id: '00000000-0000-7000-8000-0000000000f2', role: 'USER' } as const;
const ANCHOR = '00000000-0000-7000-8000-00000000000a';
const TAGGED = '00000000-0000-7000-8000-00000000000b';
const PRIVATE = '00000000-0000-7000-8000-00000000000c';
const OWN_UPLOAD = '00000000-0000-7000-8000-00000000000d';

describe('apps/server/api/services: RelatedService', () => {
  let repositories: InMemoryRepositories;
  let service: RelatedService;

  const publish = (id: string, overrides: Partial<NewVideoInput> = {}) =>
    repositories.videos.create({
      id,
      ownerId: OWNER,
      title: `Video ${id.slice(-1)}`,
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${id}.mp4`,
      tags: ['lisbon'],
      ...overrides,
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new RelatedService({
      videos: repositories.videos,
      related: repositories.related,
      videoService: new VideoService(
        videoServiceDeps(repositories.videos, { channels: repositories.channels })
      ),
      viewerProgress: new ViewerProgress(repositories.watchHistory),
    });
    await publish(ANCHOR);
    await publish(TAGGED);
    await publish(PRIVATE, { visibility: 'private' });
    await publish(OWN_UPLOAD, { ownerId: VIEWER.id });
  });

  it('never returns the video itself, a private video or the caller own upload, and says why each is there', async () => {
    const items = expectOk(await service.get(VIEWER, ANCHOR));

    expect(items.map(({ id, reason }) => [id, reason])).toEqual([
      [TAGGED, { kind: 'shared-tags', subjectId: ANCHOR }],
    ]);
  });

  it('marks the related videos with the caller playhead', async () => {
    await repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-000000000701',
      userId: VIEWER.id,
      videoId: TAGGED,
      progressSeconds: 15,
      durationSeconds: 60,
      watchedAt: new Date('2026-03-01T12:00:00.000Z'),
    });

    const items = expectOk(await service.get(VIEWER, ANCHOR));

    expect(items[0]?.viewer).toMatchObject({ progressSeconds: 15 });
  });

  it('refuses a video the caller may not read', async () => {
    expect(expectErr(await service.get(VIEWER, PRIVATE)).code).toBe(ErrorCodes.FORBIDDEN);
  });
});
