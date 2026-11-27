import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: pl channel errors', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    {
      key: 'errors.channelMembershipRequired',
      expected: 'Nie należysz już do zespołu tego kanału.',
    },
    { key: 'errors.channelMemberNotFound', expected: 'Tej osoby nie ma w zespole.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
