import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { useSegmentText } from '../use-segment-text';

const renderSegmentText = () =>
  renderHook(useSegmentText, { wrapper: AppProviders }).result.current;

describe('apps/client/web: useSegmentText', () => {
  it.each([
    { bounds: 'none', startMs: null, endMs: null, text: null },
    { bounds: 'a start', startMs: 30_000, endMs: null, text: 'From 00:30' },
    { bounds: 'an end', startMs: null, endMs: 105_000, text: '00:00 to 01:45' },
    { bounds: 'both, past an hour', startMs: 30_000, endMs: 3_725_000, text: '00:30 to 1:02:05' },
  ])('writes the segment with $bounds', ({ startMs, endMs, text }) => {
    expect(renderSegmentText().segment(startMs, endMs)).toBe(text);
  });
});
