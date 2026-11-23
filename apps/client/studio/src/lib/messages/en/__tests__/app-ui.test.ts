import { translatorFor } from '../../__tests__/fixtures';

describe('apps/client/studio: en appUi', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'appUi.legend', expected: 'Legend' },
    { key: 'appUi.selectAllRows', expected: 'Select all rows' },
    { key: 'appUi.selectRow', expected: 'Select' },
    { key: 'appUi.sortedAscending', expected: 'sorted ascending' },
    { key: 'appUi.sortedDescending', expected: 'sorted descending' },
    { key: 'appUi.notSorted', expected: 'not sorted' },
    { key: 'appUi.rowsPerPage', expected: 'Rows per page' },
    { key: 'appUi.previousPage', expected: 'Previous page' },
    { key: 'appUi.nextPage', expected: 'Next page' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'appUi.selectedCount', args: { count: '12' }, expected: '12 selected' },
    { key: 'appUi.pageOf', args: { position: '3', count: '12' }, expected: 'Page 3 of 12' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
