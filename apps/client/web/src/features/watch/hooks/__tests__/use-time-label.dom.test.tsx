import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { useTimeLabel } from '../use-time-label';

describe('apps/client/web: useTimeLabel', () => {
  it.each([
    { ms: 0, label: '00:00' },
    { ms: 65_000, label: '01:05' },
    { ms: 65_999, label: '01:05' },
    { ms: 3_725_000, label: '1:02:05' },
  ])('writes $ms ms as $label', ({ ms, label }) => {
    const { result } = renderHook(() => useTimeLabel(), { wrapper: AppProviders });

    expect(result.current(ms)).toBe(label);
  });
});
