import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio video tools', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.chaptersTimeLabel', values: { number: 2 }, expected: 'Początek rozdziału 2' },
    { key: 'studio.historyVersion', values: { version: 7 }, expected: 'Wersja 7' },
    { key: 'studio.historyRestore', values: { version: 3 }, expected: 'Przywróć wersję 3' },
    {
      key: 'studio.historyRestoredFrom',
      values: { version: 3 },
      expected: 'Przywrócono z wersji 3',
    },
    {
      key: 'studio.correctionsRemove',
      values: { start: '0:10' },
      expected: 'Usuń korektę od 0:10',
    },
  ] as const)('writes $key', ({ key, values, expected }) => {
    expect(t(key, values)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { field: 'categoryId', expected: 'kategoria' },
    { field: 'commentsEnabled', expected: 'przełącznik komentarzy' },
  ] as const)('names the field $field as $expected', ({ field, expected }) => {
    expect(t('studio.historyField', { field })).toEqual({ ok: true, value: expected });
  });
});
