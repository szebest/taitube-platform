import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl settings rows', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'settings.rowLabel', args: { row: 'radius' }, expected: 'Narożniki' },
    { key: 'settings.rowLabel', args: { row: 'reduced-motion' }, expected: 'Ogranicz ruch' },
    {
      key: 'settings.rowDescription',
      args: { row: 'captions-language' },
      expected: 'Język, w którym zaczynają się napisy.',
    },
    {
      key: 'settings.rowKeywords',
      args: { row: 'radius' },
      expected: 'narożniki zaokrąglone okrągłe ostre',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
