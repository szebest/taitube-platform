import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/studio: en studio batch', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.batchDeleted', count: 1, expected: '1 video deleted' },
    { key: 'studio.batchDeleted', count: 4, expected: '4 videos deleted' },
    { key: 'studio.batchUpdated', count: 1, expected: '1 video updated' },
    { key: 'studio.batchUpdated', count: 2, expected: '2 videos updated' },
  ] as const)('counts the videos of $key for $count', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'batchAction',
      rendered: t('studio.batchAction', { field: 'addTags' }),
      expected: 'Add tags',
    },
    {
      key: 'batchFieldLabel',
      rendered: t('studio.batchFieldLabel', { field: 'commentsEnabled' }),
      expected: 'Comments',
    },
    {
      key: 'batchFieldAppliesTo',
      rendered: t('studio.batchFieldAppliesTo', { count: 3 }),
      expected: 'Applies to 3 selected videos.',
    },
    {
      key: 'batchFailure',
      rendered: t('studio.batchFailure', {
        title: 'Lisbon',
        code: 'FORBIDDEN',
        reason: 'No access',
      }),
      expected: 'Lisbon (FORBIDDEN): No access',
    },
  ])('writes $key', ({ rendered, expected }) => {
    expect(rendered).toEqual({ ok: true, value: expected });
  });

  it('reports a partly failed batch', () => {
    expect(t('studio.batchPartial', { done: 2, total: 5, failed: 3 })).toEqual({
      ok: true,
      value: '2 of 5 done, 3 failed. The failed ones stay selected.',
    });
  });
});
