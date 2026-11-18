import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio batch', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.batchDeleted', args: { count: 22 }, expected: '22 filmy usunięte' },
    { key: 'studio.batchUpdated', args: { count: 1 }, expected: '1 film zaktualizowany' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'batchAction',
      rendered: t('studio.batchAction', { field: 'removeTags' }),
      expected: 'Usuń tagi',
    },
    {
      key: 'batchFieldAppliesTo',
      rendered: t('studio.batchFieldAppliesTo', { count: 3 }),
      expected: 'Dotyczy 3 zaznaczonych filmów.',
    },
  ])('writes $key', ({ rendered, expected }) => {
    expect(rendered).toEqual({ ok: true, value: expected });
  });
});
