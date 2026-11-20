import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories, InMemoryViewBuffer } from '@vp/adapters/in-memory';
import { ErrorCodes, cacheUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ExperimentOverlay } from '../experiment-overlay';
import { VideoService } from '../video-service';
import { type WatchRequest, VideoWatchService } from '../video-watch-service';
import { sessionShown, startTitleTest } from './running-test';
import { videoAccessGateOf, videoServiceDeps } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000004a1';
const VIEWER: UserContext = { id: '00000000-0000-7000-8000-0000000004a2', role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-0000000004a3';
const LINK = '00000000-0000-7000-8000-0000000004a4';
const TOKEN = 'linktokenlinktoken0001';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const PLAIN: WatchRequest = { shareToken: null, credential: null, sessionKey: null };

describe('apps/server/api/services: VideoWatchService', () => {
  let repositories: InMemoryRepositories;
  let viewBuffer: InMemoryViewBuffer;
  let service: VideoWatchService;

  const opens = async () =>
    expectOk(await viewBuffer.snapshot('opens'))?.shareLinks.map(({ linkId, opens }) => [
      linkId,
      opens,
    ]) ?? [];

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    viewBuffer = new InMemoryViewBuffer();
    service = new VideoWatchService({
      videos: repositories.videos,
      videoService: new VideoService(
        videoServiceDeps(repositories.videos, { channels: repositories.channels })
      ),
      gate: videoAccessGateOf(repositories, () => NOW),
      experiments: new ExperimentOverlay(repositories.videoExperiments),
      viewBuffer,
      now: () => NOW,
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Rough cut',
        visibility: 'private',
        status: 'READY',
        sourceKey: `raw/${VIDEO}.mp4`,
      })
    );
    expectOk(
      await repositories.shareLinks.create(
        {
          id: LINK,
          targetType: 'video',
          targetId: VIDEO,
          token: TOKEN,
          label: null,
          expiresAt: null,
          createdBy: OWNER,
          revokedAt: null,
          createdAt: new Date(NOW - 1000),
        },
        50
      )
    );
  });

  it('answers a read let through by a link with the link id', async () => {
    const view = expectOk(await service.watch(null, VIDEO, { ...PLAIN, shareToken: TOKEN }));

    expect(view).toMatchObject({ id: VIDEO, shareLinkId: LINK, passwordProtected: false });
  });

  it('carries no link id on a read the caller could make without it', async () => {
    const owner: UserContext = { id: OWNER, role: 'CREATOR' };

    expect(expectOk(await service.watch(owner, VIDEO, PLAIN))).not.toHaveProperty('shareLinkId');
  });

  it('counts one open per viewer, keyed by account, else session', async () => {
    await service.watch(VIEWER, VIDEO, { ...PLAIN, shareToken: TOKEN });
    await service.watch(VIEWER, VIDEO, { ...PLAIN, shareToken: TOKEN, sessionKey: 'session-1' });
    await service.watch(null, VIDEO, { ...PLAIN, shareToken: TOKEN, sessionKey: 'session-1' });
    await service.watch(null, VIDEO, { ...PLAIN, shareToken: TOKEN, sessionKey: 'session-1' });

    expect(await opens()).toEqual([[LINK, 2]]);
  });

  it('counts no open for a read with neither an account nor a session key, as a server render', async () => {
    const view = expectOk(await service.watch(null, VIDEO, { ...PLAIN, shareToken: TOKEN }));

    expect(view.shareLinkId).toBe(LINK);
    expect(await opens()).toEqual([]);
  });

  it('still answers the read when the buffer cannot take the open', async () => {
    vi.spyOn(viewBuffer, 'recordShareLinkOpen').mockResolvedValueOnce(
      err(cacheUnavailable('recordShareLinkOpen'))
    );

    expect((await service.watch(VIEWER, VIDEO, { ...PLAIN, shareToken: TOKEN })).ok).toBe(true);
  });

  it('refuses without the link and counts nothing', async () => {
    expect(expectErr(await service.watch(VIEWER, VIDEO, PLAIN)).code).toBe(ErrorCodes.FORBIDDEN);
    expect(await opens()).toEqual([]);
  });

  it("shows the session its test variant on the watch read, as on the session's cards", async () => {
    const test = await startTitleTest(repositories, {
      videoId: VIDEO,
      ownerId: OWNER,
      control: 'Rough cut',
      challenger: 'Final cut',
    });
    const request = { ...PLAIN, shareToken: TOKEN, sessionKey: sessionShown(test.id, 'b') };

    expect(expectOk(await service.watch(null, VIDEO, request))).toMatchObject({
      title: 'Final cut',
      shareLinkId: LINK,
      experiment: { id: test.id, variantId: 'b' },
    });
  });
});
