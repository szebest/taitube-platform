import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    {
      key: 'errors.uploadTooLarge',
      expected: 'Ten plik jest większy, niż pozwalają przesyłane pliki.',
    },
    { key: 'errors.videoNotFound', expected: 'Ten film nie istnieje lub został usunięty.' },
    {
      key: 'errors.rateLimited',
      expected: 'Zbyt wiele żądań. Poczekaj chwilę i spróbuj ponownie.',
    },
    { key: 'errors.internal', expected: 'Coś poszło nie tak po naszej stronie.' },
    { key: 'errors.ffmpegTimeout', expected: 'Przetwarzanie tego filmu trwało zbyt długo.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
