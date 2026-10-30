import { renderHook } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { useClipValidators } from '../use-clip-validators';

const TITLE_ERROR = 'Give the clip a title of 1 to 100 characters';
const RANGE_ERROR = 'A clip runs from 5 to 60 seconds and stays inside the video';

function validators() {
  return renderHook(() => useClipValidators(), { wrapper: AppProviders }).result.current;
}

describe('apps/client/web: useClipValidators', () => {
  it.each([
    { title: 'The best part', error: undefined },
    { title: '  Padded  ', error: undefined },
    { title: 'x'.repeat(100), error: undefined },
    { title: '', error: TITLE_ERROR },
    { title: '   ', error: TITLE_ERROR },
    { title: 'x'.repeat(101), error: TITLE_ERROR },
  ])('answers $error for the title "$title"', ({ title, error }) => {
    expect(validators().validateTitle({ value: title })).toBe(error);
  });

  it.each([
    { range: { startMs: 10_000, endMs: 15_000 }, durationMs: 120_000, error: undefined },
    { range: { startMs: 10_000, endMs: 70_000 }, durationMs: 120_000, error: undefined },
    { range: { startMs: 10_000, endMs: 14_000 }, durationMs: 120_000, error: RANGE_ERROR },
    { range: { startMs: 10_000, endMs: 70_001 }, durationMs: 120_000, error: RANGE_ERROR },
    { range: { startMs: 100_000, endMs: 130_000 }, durationMs: 120_000, error: RANGE_ERROR },
  ])('answers $error for $range in a video of $durationMs ms', ({ range, durationMs, error }) => {
    expect(validators().findRangeError(range, durationMs)).toBe(error);
  });
});
