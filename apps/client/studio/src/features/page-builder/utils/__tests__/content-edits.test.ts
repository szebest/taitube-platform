import { contentSection } from '@vp/domain';
import {
  isManualSource,
  numberOrNull,
  sourceValue,
  withColumns,
  withDurationMinutes,
  withLastDays,
  withLayout,
  withSource,
} from '../content-edits';

const section = (source: Parameters<typeof contentSection>[1] = { type: 'videos' }) =>
  contentSection('s', source, 'Title');

describe('apps/client/studio: content edits', () => {
  it.each([
    { scenario: 'a kind of content', value: 'shorts', held: 'shorts' },
    { scenario: 'one playlist', value: 'playlist:abc', held: 'playlist:abc' },
    { scenario: 'a value it does not know', value: 'nope', held: 'videos' },
  ])('takes $scenario as the source', ({ value, held }) => {
    expect(sourceValue(withSource(section(), value))).toBe(held);
  });

  it('drops a manual order and a masonry layout the new source cannot keep', () => {
    const picked = { ...section({ type: 'start_here' }), sort: 'manual' as const };
    const masonry = { ...section({ type: 'posts' }), layout: { type: 'masonry' as const } };

    expect(isManualSource(picked)).toBe(true);
    expect(withSource(picked, 'videos').sort).toBe('newest');
    expect(withSource(masonry, 'videos').layout).toEqual({ type: 'shelf' });
  });

  it('lays out a hero as one item and a grid as three columns', () => {
    expect(withLayout(section(), 'hero')).toMatchObject({ layout: { type: 'hero' }, itemCount: 1 });
    expect(withColumns(withLayout(section(), 'grid'), 5).layout).toEqual({
      type: 'grid',
      columns: 5,
    });
    expect(withColumns(section(), 5).layout).toEqual({ type: 'shelf' });
  });

  it.each([
    { text: '12', expected: 12 },
    { text: '0', expected: null },
    { text: '', expected: null },
    { text: 'x', expected: null },
  ])('reads "$text" as $expected', ({ text, expected }) => {
    expect(numberOrNull(text)).toBe(expected);
  });

  it('keeps the duration filter in seconds and clears it when both bounds are empty', () => {
    const bounded = withDurationMinutes(section(), 'maxSeconds', '10');

    expect(bounded.filters.duration).toEqual({ minSeconds: null, maxSeconds: 600 });
    expect(withDurationMinutes(bounded, 'maxSeconds', '').filters.duration).toBeNull();
    expect(withLastDays(section(), '30').filters.dateRange).toEqual({
      type: 'last_days',
      days: 30,
    });
  });
});
