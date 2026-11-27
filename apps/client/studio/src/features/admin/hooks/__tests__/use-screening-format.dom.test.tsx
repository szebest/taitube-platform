import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { useClock, useSecondsRange, useShare } from '../use-screening-format';

describe('apps/client/studio: useClock', () => {
  it.each([
    { seconds: 5, clock: '00:05' },
    { seconds: 65, clock: '01:05' },
    { seconds: 3725, clock: '1:02:05' },
  ])('writes $seconds seconds as $clock', ({ seconds, clock }) => {
    const { result } = renderHook(useClock, { wrapper: AppProviders });

    expect(result.current(seconds)).toBe(clock);
  });
});

describe('apps/client/studio: useShare', () => {
  it.each([
    { share: 0.93, text: '93%' },
    { share: 1, text: '100%' },
    { share: 0, text: '0%' },
  ])('writes $share as $text', ({ share, text }) => {
    const { result } = renderHook(useShare, { wrapper: AppProviders });

    expect(result.current(share)).toBe(text);
  });
});

describe('apps/client/studio: useSecondsRange', () => {
  it('writes a span as two clocks in words', () => {
    const { result } = renderHook(useSecondsRange, { wrapper: AppProviders });

    expect(result.current({ fromSeconds: 12, toSeconds: 65 })).toBe('00:12 to 01:05');
  });
});
