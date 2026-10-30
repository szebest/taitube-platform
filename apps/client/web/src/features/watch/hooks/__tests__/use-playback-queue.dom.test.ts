import { act, renderHook } from '@testing-library/react';
import { videoSummary } from '@vp/web-testing';

import { usePlaybackQueue } from '../use-playback-queue';

const queued = (title: string, index: number) =>
  videoSummary({ id: `0190c3a0-5e1d-7000-8000-00000000c00${index}`, title });

const first = queued('a', 1);
const second = queued('b', 2);
const third = queued('c', 3);
const QUEUE = [first, second, third];

function renderQueue() {
  return renderHook(() => usePlaybackQueue(QUEUE));
}

const titles = (videos: readonly { title: string | null }[]) => videos.map(({ title }) => title);

describe('apps/client/web: usePlaybackQueue', () => {
  it.each([
    { move: 'down', id: first.id, toIndex: 2, order: ['b', 'c', 'a'] },
    { move: 'up', id: third.id, toIndex: 0, order: ['c', 'a', 'b'] },
    { move: 'nowhere', id: second.id, toIndex: 1, order: ['a', 'b', 'c'] },
    { move: 'of a video that is not queued', id: 'other', toIndex: 0, order: ['a', 'b', 'c'] },
  ])('moves a video $move', ({ id, toIndex, order }) => {
    const { result } = renderQueue();

    act(() => result.current.reorder(id, toIndex));

    expect(titles(result.current.videos)).toEqual(order);
  });

  it('removes a video', () => {
    const { result } = renderQueue();

    act(() => result.current.remove(second.id));

    expect(titles(result.current.videos)).toEqual(['a', 'c']);
  });
});
