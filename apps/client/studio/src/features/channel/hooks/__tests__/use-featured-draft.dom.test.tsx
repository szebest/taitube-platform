import { act, renderHook } from '@testing-library/react';
import { FEATURED_VIDEOS_MAX } from '@vp/domain';

import { libraryOf } from '#app/features/channel/__tests__/featured-api.fixture';
import { useFeaturedDraft } from '../use-featured-draft';

const LIBRARY = libraryOf(FEATURED_VIDEOS_MAX + 1);
const at = (index: number) => {
  const video = LIBRARY[index];
  if (video === undefined) throw new Error(`no video ${index}`);
  return video;
};
const idsOf = (pins: readonly { id: string }[]) => pins.map(({ id }) => id);

describe('apps/client/studio: useFeaturedDraft', () => {
  it('starts on the saved pins, clean', () => {
    const { result } = renderHook(() => useFeaturedDraft(LIBRARY.slice(0, 2)));

    expect(idsOf(result.current.pins)).toEqual(idsOf(LIBRARY.slice(0, 2)));
    expect(result.current.dirty).toBe(false);
  });

  it.each([
    {
      change: 'adds a video',
      apply: (draft: ReturnType<typeof useFeaturedDraft>) => draft.add(at(2)),
      expected: [0, 1, 2],
    },
    {
      change: 'ignores a video that is already pinned',
      apply: (draft: ReturnType<typeof useFeaturedDraft>) => draft.add(at(0)),
      expected: [0, 1],
    },
    {
      change: 'removes a video',
      apply: (draft: ReturnType<typeof useFeaturedDraft>) => draft.remove(at(0).id),
      expected: [1],
    },
    {
      change: 'moves the videos to the order given',
      apply: (draft: ReturnType<typeof useFeaturedDraft>) => draft.reorder([at(1).id, at(0).id]),
      expected: [1, 0],
    },
  ])('$change', ({ apply, expected }) => {
    const { result } = renderHook(() => useFeaturedDraft(LIBRARY.slice(0, 2)));

    act(() => apply(result.current));

    expect(idsOf(result.current.pins)).toEqual(expected.map((index) => at(index).id));
    expect(result.current.dirty).toBe(expected.join() !== '0,1');
  });

  it('is clean again once the order is back to the saved one', () => {
    const { result } = renderHook(() => useFeaturedDraft(LIBRARY.slice(0, 2)));

    act(() => result.current.reorder([at(1).id, at(0).id]));
    act(() => result.current.reorder([at(0).id, at(1).id]));

    expect(result.current.dirty).toBe(false);
  });

  it('holds at six and refuses a seventh', () => {
    const { result } = renderHook(() => useFeaturedDraft(LIBRARY.slice(0, FEATURED_VIDEOS_MAX)));

    expect(result.current.full).toBe(true);
    act(() => result.current.add(at(FEATURED_VIDEOS_MAX)));

    expect(result.current.pins).toHaveLength(FEATURED_VIDEOS_MAX);
    expect(result.current.dirty).toBe(false);
  });
});
