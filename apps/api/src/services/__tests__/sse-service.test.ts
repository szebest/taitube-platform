import { InMemoryRepositories } from '@vp/adapters';
import type { RenditionStatus } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { userChannel, videoChannel } from '@vp/events';
import type { AuthUser } from '../../plugins/auth';
import { SseService, mapEventToSse } from '../sse-service';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000d1';
const OWNER: AuthUser = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-0000000000d3', role: 'USER' };
const CDN = 'http://localhost:9000/public';

describe('apps/api/services: SseService', () => {
  let repositories: InMemoryRepositories;
  let service: SseService;

  async function seed(
    visibility: 'private' | 'public',
    status: 'PROCESSING' | 'READY' = 'PROCESSING'
  ): Promise<void> {
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Stream fixture',
      visibility,
      status,
      sourceKey: 'raw/stream.mp4',
    });
  }

  function addRendition(name: string, status: RenditionStatus): Promise<unknown> {
    return repositories.renditions.create({
      videoId: VIDEO_ID,
      name,
      status,
      width: 1280,
      height: 720,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
    });
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new SseService({
      videos: repositories.videos,
      renditions: repositories.renditions,
      events: repositories.events,
      cdnBaseUrl: `${CDN}/`,
    });
  });

  describe('openVideoStream', () => {
    it('names the channel the hub broadcasts on', async () => {
      await seed('public');

      const session = await service.openVideoStream(OWNER, VIDEO_ID);

      expect(session.channel).toBe(videoChannel(VIDEO_ID));
      expect(session.userId).toBe(OWNER.id);
    });

    it('reports an unknown video as not found', async () => {
      await expect(service.openVideoStream(OWNER, VIDEO_ID)).rejects.toMatchObject({
        code: ErrorCodes.VIDEO_NOT_FOUND,
      });
    });

    it('asks an anonymous caller to authenticate for a private video', async () => {
      await seed('private');

      await expect(service.openVideoStream(null, VIDEO_ID)).rejects.toMatchObject({
        code: ErrorCodes.UNAUTHORIZED,
      });
    });

    it('hides a private video from a signed-in stranger behind a 404', async () => {
      await seed('private');

      await expect(service.openVideoStream(STRANGER, VIDEO_ID)).rejects.toMatchObject({
        code: ErrorCodes.VIDEO_NOT_FOUND,
      });
    });

    it('averages rendition completion into overall progress', async () => {
      await seed('public');
      await addRendition('720p', 'DONE');
      await addRendition('480p', 'RUNNING');

      const { data } = await (await service.openVideoStream(OWNER, VIDEO_ID)).snapshot();

      expect(data['progress']).toEqual({ overall: 50, byRendition: { '720p': 100, '480p': 0 } });
    });

    it('omits a playback URL until the video is READY', async () => {
      await seed('public');

      const { data } = await (await service.openVideoStream(OWNER, VIDEO_ID)).snapshot();

      expect(data).not.toHaveProperty('playbackUrl');
    });

    it('serves the playback URL off the trimmed CDN base once READY', async () => {
      await seed('public', 'READY');

      const { data } = await (await service.openVideoStream(OWNER, VIDEO_ID)).snapshot();

      expect(data['playbackUrl']).toBe(`${CDN}/videos/${VIDEO_ID}/hls/master.m3u8`);
      expect(data['progress']).toEqual({ overall: 100, byRendition: {} });
    });

    it('carries the latest event id so a reconnect resumes from the snapshot', async () => {
      await seed('public');
      const event = await repositories.events.create({ videoId: VIDEO_ID, type: 'probe.started' });

      const { lastEventId } = await (await service.openVideoStream(OWNER, VIDEO_ID)).snapshot();

      expect(lastEventId).toBe(event.id);
    });

    it('replays only the events after the supplied id', async () => {
      await seed('public');
      const first = await repositories.events.create({ videoId: VIDEO_ID, type: 'probe.started' });
      await repositories.events.create({ videoId: VIDEO_ID, type: 'video.ready' });

      const replayed = await (await service.openVideoStream(OWNER, VIDEO_ID)).replay(first.id);

      expect(replayed).toEqual([
        { id: expect.any(Number), event: 'status', data: { status: 'READY' } },
      ]);
    });
  });

  describe('openUserStream', () => {
    it('opens on the user channel with an empty snapshot', async () => {
      const session = service.openUserStream(OWNER);

      expect(session.channel).toBe(userChannel(OWNER.id));
      await expect(session.snapshot()).resolves.toEqual({
        lastEventId: 0,
        data: {
          userId: OWNER.id,
          status: 'SUBSCRIBED',
          progress: { overall: 0, byRendition: {} },
        },
      });
    });

    it('replays across every video the user owns', async () => {
      await seed('public');
      await repositories.events.create({ videoId: VIDEO_ID, type: 'video.ready' });

      await expect(service.openUserStream(OWNER).replay(0)).resolves.toEqual([
        { id: expect.any(Number), event: 'status', data: { status: 'READY' } },
      ]);
    });
  });

  describe('mapEventToSse', () => {
    it.each([
      ['progress', { percent: 40 }, 'progress', { percent: 40 }],
      ['video.ready', {}, 'status', { status: 'READY' }],
      ['probe.started', {}, 'status', { status: 'PROBING' }],
      ['video.processing', {}, 'status', { status: 'PROCESSING' }],
      ['probe.completed', {}, 'status', { status: 'PROCESSING' }],
      ['upload.initiated', { a: 1 }, 'status', { a: 1 }],
    ])('maps %s onto the %s event', (type, payload, event, data) => {
      expect(mapEventToSse({ id: 7, type, payload })).toEqual({ id: 7, event, data });
    });

    it('defaults a failure without codes to a bare FAILED status', () => {
      expect(mapEventToSse({ id: 9, type: 'video.failed', payload: null })).toEqual({
        id: 9,
        event: 'status',
        data: { status: 'FAILED', error: { code: 'FAILED', message: '' } },
      });
    });

    it('carries the failure code and message through', () => {
      expect(
        mapEventToSse({
          id: 9,
          type: 'video.failed',
          payload: { errorCode: 'PROBE_FAILED', errorMessage: 'no video stream' },
        })
      ).toMatchObject({
        data: { error: { code: 'PROBE_FAILED', message: 'no video stream' } },
      });
    });
  });
});
