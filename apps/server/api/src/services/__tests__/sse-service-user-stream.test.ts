import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewUserEventInput } from '@vp/core/repositories';
import { userChannel } from '@vp/events';
import { createLogger } from '@vp/logger';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import type { SseFrame } from '../sse-connection';
import { SseService } from '../sse-service';
import { SSE_REPLAY_LIMIT as REPLAY_LIMIT, sseServiceDeps } from './service-deps';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000d1';
const SEEN_VIDEO_ID = '00000000-0000-7000-8000-0000000000d3';
const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const logger = createLogger({ format: 'json', service: 'sse-user-stream-spec', level: 'silent' });

describe('apps/server/api/services: SseService.openUserStream', () => {
  let repositories: InMemoryRepositories;
  let service: SseService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new SseService(sseServiceDeps(repositories, { logger }));
  });

  async function announce(count: number) {
    const appended = [];
    for (let i = 0; i < count; i += 1) {
      appended.push(
        expectOk(
          await repositories.userEvents.append({
            userId: OWNER.id,
            type: 'video.processing',
            payload: { videoId: VIDEO_ID, change: { kind: 'status', status: 'PROCESSING' } },
          })
        )
      );
    }
    return appended;
  }

  const appendUnknown = () =>
    repositories.userEvents.append({
      userId: OWNER.id,
      type: 'video.deleted',
      payload: {},
    } as unknown as NewUserEventInput);

  const hello = (resume: string, unreadNotifications = 0): SseFrame => ({
    event: 'hello',
    data: { type: 'hello', payload: { resume, unreadNotifications } },
  });

  const userOpening = async (afterId: number | null) =>
    expectOk(await service.openUserStream(OWNER).open(afterId));

  it('opens on the user channel with hello, from the newest logged event', async () => {
    const [, newest] = await announce(2);

    expect(service.openUserStream(OWNER).channel).toBe(userChannel(OWNER.id));
    expect(await userOpening(null)).toEqual({
      frames: [hello('fresh')],
      lastEventId: newest?.id,
    });
  });

  it('reads every event logged after an id on a live cue, past one page', async () => {
    const [seen, ...after] = await announce(REPLAY_LIMIT + 3);
    const { frames, lastId } = expectOk(await service.openUserStream(OWNER).resync(seen?.id ?? 0));

    expect(frames.map((frame) => frame.id)).toEqual(after.map((event) => event.id));
    expect(lastId).toBe(after.at(-1)?.id);
  });

  it('moves a live read past a row the contract does not know', async () => {
    const [seen] = await announce(1);
    const skipped = expectOk(await appendUnknown());

    expect(expectOk(await service.openUserStream(OWNER).resync(seen?.id ?? 0))).toEqual({
      frames: [],
      lastId: skipped.id,
    });
  });

  it('replays the events after Last-Event-ID', async () => {
    const [seen, second, third] = await announce(3);

    const { frames, lastEventId } = await userOpening(seen?.id ?? 0);

    expect(frames.map((frame) => frame.id)).toEqual([undefined, second?.id, third?.id]);
    expect(frames[0]).toEqual(hello('replayed'));
    expect(lastEventId).toBe(third?.id);
  });

  it.each([
    ['the last seen event left the log', 0, 'expired', () => repositories.userEvents.prune(-1)],
    ['as many events followed it as a replay carries', REPLAY_LIMIT, 'replayed', async () => 0],
    ['one more followed it than a replay carries', REPLAY_LIMIT + 1, 'expired', async () => 0],
  ])('resumes when %s as %s', async (_label, following, resume, after) => {
    const [seen] = await announce(following + 1);
    await after();

    expect((await userOpening(seen?.id ?? 0)).frames[0]).toEqual(hello(resume));
  });

  it('skips a logged event the contract does not know, and says so', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const [seen] = await announce(1);
    await appendUnknown();

    expect((await userOpening(seen?.id ?? 0)).frames).toEqual([hello('replayed')]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'video.deleted' }),
      'dropped a user event the contract does not know'
    );
  });

  it('carries the unread notification count on hello, fresh and replayed', async () => {
    const [seen] = await announce(1);
    for (const videoId of [VIDEO_ID, SEEN_VIDEO_ID]) {
      expectOk(
        await repositories.notifications.record({
          userId: OWNER.id,
          kind: 'processing',
          actorChannelId: null,
          videoId,
          commentId: null,
          groupKey: null,
          payload: { actor: null, videoTitle: null, excerpt: null, outcome: 'ready' },
        })
      );
    }

    const fresh = await userOpening(null);
    const replayed = await userOpening(seen?.id ?? 0);

    expect(fresh.frames[0]).toEqual(hello('fresh', 2));
    expect(replayed.frames[0]).toEqual(hello('replayed', 2));
  });
});
