import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: pl link errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'errors.postAlreadyVoted', expected: 'Oddano już głos w tym poście.' },
    { key: 'errors.postPollClosed', expected: 'To głosowanie jest już zamknięte.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
