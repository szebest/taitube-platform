import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio video tools', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.chaptersTimeLabel', values: { number: 2 }, expected: 'Start of chapter 2' },
    { key: 'studio.historyVersion', values: { version: 7 }, expected: 'Version 7' },
    { key: 'studio.historyRestore', values: { version: 3 }, expected: 'Restore version 3' },
    {
      key: 'studio.correctionsRemove',
      values: { start: '0:10' },
      expected: 'Remove the correction at 0:10',
    },
  ] as const)('writes $key', ({ key, values, expected }) => {
    expect(t(key, values)).toEqual({ ok: true, value: expected });
  });

  it('lists the changed fields of a version', () => {
    expect(t('studio.historyChanged', { fields: ['title', 'tags'] })).toEqual({
      ok: true,
      value: 'title and tags',
    });
  });

  it.each([
    { field: 'categoryId', expected: 'category' },
    { field: 'commentsEnabled', expected: 'comments switch' },
  ] as const)('names the field $field as $expected', ({ field, expected }) => {
    expect(t('studio.historyField', { field })).toEqual({ ok: true, value: expected });
  });
});
