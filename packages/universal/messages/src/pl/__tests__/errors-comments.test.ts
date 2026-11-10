import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl comment errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'errors.commentsDisabled', expected: 'Komentarze są wyłączone dla tego filmu.' },
    { key: 'errors.savedReplyNotFound', expected: 'Ta zapisana odpowiedź nie istnieje.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
