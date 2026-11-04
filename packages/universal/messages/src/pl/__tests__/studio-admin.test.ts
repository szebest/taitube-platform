import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl studio admin', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.adminTabModeration', expected: 'Moderacja' },
    { key: 'studio.adminDeniedTitle', expected: 'Brak dostępu' },
    { key: 'studio.adminDlqTitle', expected: 'Kolejka martwych zadań' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'studio.adminCategoryDeleteTitle',
      args: { name: 'Muzyka' },
      expected: 'Usunąć kategorię Muzyka?',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.adminReportReasonName', args: { reason: 'harassment' }, expected: 'Nękanie' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.adminDlqStatusName', args: { status: 'PARKED' }, expected: 'Zaparkowane' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([{ key: 'studio.adminDlqCountMore', args: { count: 50 }, expected: '50+' }] as const)(
    'renders $key for $args',
    ({ key, args, expected }) => {
      expect(t(key, args)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
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
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
