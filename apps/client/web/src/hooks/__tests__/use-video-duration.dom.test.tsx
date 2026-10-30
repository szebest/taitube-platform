import { renderHook } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { useVideoDuration } from '../use-video-duration';

describe('apps/client/web: useVideoDuration', () => {
  it.each([
    { scenario: 'a video of 12:45', durationMs: 765_000, duration: '12:45', spoken: '12 minutes' },
    { scenario: 'a video of unknown length', durationMs: undefined, duration: undefined },
  ])('reads $scenario', ({ durationMs, duration, spoken }) => {
    const { result } = renderHook(() => useVideoDuration({ durationMs }), {
      wrapper: AppProviders,
    });

    expect(result.current.duration).toBe(duration);
    expect(result.current.spokenDuration).toEqual(spoken ? expect.stringContaining(spoken) : undefined);
  });
});
