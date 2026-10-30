import { renderHook } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { useDurationText } from '../use-duration-text';

describe('apps/client/web: useDurationText', () => {
  it.each([
    { durationMs: 765_000, clock: '12:45', spoken: '12 minutes, 45 seconds' },
    { durationMs: undefined, clock: undefined, spoken: undefined },
  ])('reads $durationMs ms as $clock', ({ durationMs, clock, spoken }) => {
    const { result } = renderHook(() => useDurationText(durationMs), { wrapper: AppProviders });

    expect(result.current).toEqual({ clock, spoken });
  });
});
