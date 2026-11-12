import type { ScenarioContext } from '../scenario';
import { actorOf, createSeedState, readyVideos, userById, userByKind } from '../scenario';
import { buildWorld } from '../world';
import { SMALL } from './fake-seed';

const world = buildWorld(SMALL);

describe('seed/scenario', () => {
  it('starts every run with an empty state', () => {
    const state = createSeedState();

    expect(
      [state.channelIds, state.categoryIds, state.clips, state.videos].map((m) => m.size)
    ).toEqual([0, 0, 0, 0]);
  });

  it('finds users by kind and id and signs in as their token role', () => {
    const admin = userByKind(world, 'admin');

    expect(admin?.kind).toBe('admin');
    expect(userById(world, admin?.id ?? '')).toBe(admin);
    expect(userById(world, 'nobody')).toBeUndefined();
    expect(admin && actorOf(admin)).toEqual({ id: admin?.id, role: 'admin' });
  });

  it('lists only the videos that finished the pipeline', () => {
    const state = createSeedState();
    const [first, second] = world.videos;
    state.videos.set('a', { spec: first as never, id: '1', status: 'READY', durationMs: 1 });
    state.videos.set('b', {
      spec: second as never,
      id: '2',
      status: 'PROCESSING',
      durationMs: null,
    });

    expect(readyVideos({ state } as ScenarioContext).map((video) => video.id)).toEqual(['1']);
  });
});
