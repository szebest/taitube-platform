import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio admin', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.adminTabModeration', args: undefined, expected: 'Moderacja' },
    { key: 'studio.adminDeniedTitle', args: undefined, expected: 'Brak dostępu' },
    { key: 'studio.adminDlqTitle', args: undefined, expected: 'Kolejka martwych zadań' },
    {
      key: 'studio.adminCategoryDeleteTitle',
      args: { name: 'Muzyka' },
      expected: 'Usunąć kategorię Muzyka?',
    },
    { key: 'studio.adminReportReasonName', args: { reason: 'harassment' }, expected: 'Nękanie' },
    { key: 'studio.adminDlqStatusName', args: { status: 'PARKED' }, expected: 'Zaparkowane' },
    { key: 'studio.adminDlqCountMore', args: { count: 50 }, expected: '50+' },
    {
      key: 'studio.adminCategoryInUseDescription',
      args: { name: 'Muzyka', count: 1 },
      expected:
        'Kategoria Muzyka jest używana w 1 filmie. Kategorii z filmami nie można usunąć. Dezaktywuj ją: jej filmy nadal działają, a widzowie przestają ją widzieć w przeglądaniu.',
    },
    {
      key: 'studio.adminCategoryInUseDescription',
      args: { name: 'Muzyka', count: 5 },
      expected:
        'Kategoria Muzyka jest używana w 5 filmach. Kategorii z filmami nie można usunąć. Dezaktywuj ją: jej filmy nadal działają, a widzowie przestają ją widzieć w przeglądaniu.',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
