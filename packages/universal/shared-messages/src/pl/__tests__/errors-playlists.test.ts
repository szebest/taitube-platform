import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: pl playlist errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    {
      key: 'errors.playlistCollaboratorLimit',
      expected: 'Ta playlista ma już maksymalną liczbę współtwórców.',
    },
    { key: 'errors.playlistActivityNotFound', expected: 'Tej zmiany nie ma w historii playlisty.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
