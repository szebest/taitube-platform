import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: en browse', () => {
  const { t } = translatorFor('en');

  it.each([{ key: 'browse.untitled', expected: 'Untitled video' }] as const)(
    'renders $key with no arguments',
    ({ key, expected }) => {
      expect(t(key)).toEqual({ ok: true, value: expected });
    }
  );
});
