import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio batch', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.batchDeleted', count: 1, expected: '1 video deleted' },
    { key: 'studio.batchDeleted', count: 4, expected: '4 videos deleted' },
    { key: 'studio.batchVisibilitySet', count: 1, expected: '1 video updated' },
    { key: 'studio.batchVisibilitySet', count: 2, expected: '2 videos updated' },
  ] as const)('counts the videos of $key for $count', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });

  it('reports a partly failed batch', () => {
    expect(t('studio.batchPartial', { done: 2, total: 5, failed: 3 })).toEqual({
      ok: true,
      value: '2 of 5 done, 3 failed. The failed ones stay selected.',
    });
  });
});
