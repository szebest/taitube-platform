import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: pl layout errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    {
      key: 'errors.layoutScheduleInvalid',
      expected: 'Wybierz przyszły termin zaplanowanej zmiany strony.',
    },
    {
      key: 'errors.layoutMarkdownInvalid',
      expected:
        'Tekst formatowany pozwala tylko na zwykły Markdown: bez HTML, skryptów i linków do obrazów.',
    },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
