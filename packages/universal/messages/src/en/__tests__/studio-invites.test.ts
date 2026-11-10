import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio invites', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.invitesNav', args: undefined, expected: 'Invites' },
    { key: 'studio.invitesNavBadge', args: { count: 3 }, expected: '3' },
    { key: 'studio.invitesInvitedBy', args: { name: 'Ada' }, expected: 'Invited by Ada' },
    { key: 'studio.teamLeaveTitle', args: { name: 'Other Show' }, expected: 'Leave Other Show?' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
