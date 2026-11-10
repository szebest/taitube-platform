import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../../__tests__/test-app';
import { WatchPartyQueueService } from '../watch-party-queue-service';
import { keyOf, ROOM_ID, seatUser, seedRoom } from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, userCaller, watchPartyTestDeps } from './watch-party-test-deps';

const videoId = (n: number) => `018f0000-0000-7000-8000-0000000000a${n}`;

async function setUpQueue() {
  const test = watchPartyTestDeps();
  const { repositories, deps } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at);
  await seatUser(repositories, MEMBER, at);
  for (const n of [1, 2]) {
    await seedVideo(repositories, { id: videoId(n), ownerId: OWNER.id, title: `Video ${n}` });
  }
  return { ...test, service: new WatchPartyQueueService(deps) };
}

const queueFrames = (frames: ReturnType<typeof watchPartyTestDeps>['frames']) =>
  frames()
    .filter(({ frame }) => frame.type === 'queue')
    .map(({ memberKey, frame }) => ({ memberKey, frame }));

describe('WatchPartyQueueService', () => {
  it('tells every socket in the room the queue it answered, and logs the change once', async () => {
    const { service, frames, log } = await setUpQueue();

    const added = expectOk(
      await service.add(ROOM_ID, userCaller(MEMBER), { videoId: videoId(1), startMs: 500 })
    );

    expect(queueFrames(frames)).toEqual([{ memberKey: null, frame: { type: 'queue', ...added } }]);
    expect(log.lines()).toEqual([
      expect.objectContaining({
        level: 'info',
        roomId: ROOM_ID,
        actorKey: keyOf(MEMBER),
        action: 'queue.add',
      }),
    ]);
  });

  it('answers the same queue to a read as it sent after the change', async () => {
    const { service } = await setUpQueue();
    const added = expectOk(await service.add(ROOM_ID, userCaller(OWNER), { videoId: videoId(2) }));

    expect(expectOk(await service.list(ROOM_ID, userCaller(MEMBER)))).toEqual(added);
  });

  it.each([
    {
      scenario: 'asked by a stranger to the room',
      who: OTHER,
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'of a video that cannot be shared',
      who: OWNER,
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
    },
  ])('sends and logs nothing for a change $scenario', async ({ who, code }) => {
    const { service, frames, log } = await setUpQueue();
    const missing = '018f0000-0000-7000-8000-0000000000ff';

    const failure = expectErr(await service.add(ROOM_ID, userCaller(who), { videoId: missing }));

    expect(failure.code).toBe(code);
    expect([frames(), log.lines()]).toEqual([[], []]);
  });

  it('leaves the queue, its version and the room alone when an item is moved to where it is', async () => {
    const { service, frames } = await setUpQueue();
    const first = expectOk(await service.add(ROOM_ID, userCaller(OWNER), { videoId: videoId(1) }));
    await service.add(ROOM_ID, userCaller(OWNER), { videoId: videoId(2) });

    const moved = expectOk(
      await service.move(ROOM_ID, userCaller(OWNER), first.items[0]?.id ?? '', { toIndex: 0 })
    );

    expect(moved.version).toBe(2);
    expect(queueFrames(frames)).toHaveLength(2);
  });
});
