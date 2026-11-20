import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl video tool errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'errors.videoPasswordRequired', expected: 'Ten film jest chroniony hasłem.' },
    { key: 'errors.experimentNotRunning', expected: 'Ten test już się zakończył.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
