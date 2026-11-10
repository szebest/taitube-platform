import { expectOk } from '@vp/testing/result';
import { WatchPartyControlsService } from '../watch-party-controls-service';
import { keyOf, ROOM_ID, seedRoom } from './watch-party-moderation-fixture';
import { MEMBER, OWNER, watchPartyTestDeps } from './watch-party-test-deps';

async function setUpControls() {
  const test = watchPartyTestDeps();
  await seedRoom(test.repositories, OWNER, test.deps.now());
  return { ...test, service: new WatchPartyControlsService(test.deps) };
}

const hide = { targetKey: keyOf(OWNER), roomId: ROOM_ID, hideMessages: true } as const;

describe('WatchPartyControlsService', () => {
  it('logs nothing about a control, however many are set or cleared', async () => {
    const { service, log } = await setUpControls();

    expectOk(await service.put(MEMBER.id, hide));
    expectOk(await service.put(MEMBER.id, { ...hide, hideMessages: false }));
    expectOk(await service.list(MEMBER.id, ROOM_ID));

    expect(log.text()).toBe('');
  });

  it('stamps the control with the viewer and the time it was set, and shows it to the viewer alone', async () => {
    const { service, repositories, clock } = await setUpControls();

    expectOk(await service.put(MEMBER.id, hide));

    const stored = expectOk(await repositories.watchPartyControls.list(MEMBER.id, ROOM_ID));
    expect(stored).toEqual([
      expect.objectContaining({ userId: MEMBER.id, updatedAt: new Date(clock.nowMs) }),
    ]);
    expect(expectOk(await service.list(OWNER.id, ROOM_ID)).items).toEqual([]);
  });
});
