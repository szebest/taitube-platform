import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { ClipSuggestionService } from '../clip-suggestion-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000f1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000f2', role: 'USER' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000fa';

describe('apps/server/api/services: clip suggestions', () => {
  let repositories: InMemoryRepositories;
  let clips: ClipSuggestionService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    clips = new ClipSuggestionService({
      videos: repositories.videos,
      views: repositories.videoViews,
      chapters: repositories.videoChapters,
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        channelId: await seedPrimaryChannel(repositories, OWNER.id),
        visibility: 'private',
        status: 'READY',
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        durationMs: 120_000,
      })
    );
  });

  it('suggests nothing before anyone has watched', async () => {
    expect(expectOk(await clips.suggest(OWNER, VIDEO_ID))).toEqual({ items: [] });
  });

  it('reads the curve and the chapters of the video', async () => {
    repositories.videoChapters.replace(VIDEO_ID, [
      { startMs: 0, title: 'Start' },
      { startMs: 30_000, title: 'Middle' },
      { startMs: 90_000, title: 'End' },
    ]);
    expectOk(
      await repositories.videoViews.applyBatch({
        batchId: 'b1',
        counts: [],
        hourly: [],
        devices: [],
        shareLinks: [],
        experiments: [],
        playlists: [],
        retention: [
          { videoId: VIDEO_ID, percent: 0, viewers: 10 },
          { videoId: VIDEO_ID, percent: 100, viewers: 2 },
        ],
      })
    );

    const { items } = expectOk(await clips.suggest(OWNER, VIDEO_ID));

    expect(items.length).toBeGreaterThan(0);
    expect(items.every(({ endMs }) => endMs <= 120_000)).toBe(true);
    expect(items[0]?.chapterTitle).toBe('Start');
  });

  it('hides a private video from a caller who cannot read it', async () => {
    expect(expectErr(await clips.suggest(STRANGER, VIDEO_ID)).code).toBe(
      ErrorCodes.VIDEO_NOT_FOUND
    );
  });
});
