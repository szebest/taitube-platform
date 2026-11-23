import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio invites', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.invitesNav', args: undefined, expected: 'Zaproszenia' },
    {
      key: 'studio.invitesAcceptLabel',
      args: { name: 'Ada' },
      expected: 'Przyjmij zaproszenie od: Ada',
    },
    { key: 'studio.teamLeaveTitle', args: { name: 'Ada' }, expected: 'Opuścić zespół: Ada?' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
