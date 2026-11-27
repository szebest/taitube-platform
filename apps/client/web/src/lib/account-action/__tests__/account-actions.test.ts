import { getUserPermissions } from '@vp/permissions';
import { ACCOUNT_ACTION_RULES, ACCOUNT_ACTIONS } from '../account-actions';

describe('apps/client/web: account actions', () => {
  it.each(ACCOUNT_ACTIONS)('%s is refused to a guest and allowed to a viewer', (action) => {
    const [permission, subject] = ACCOUNT_ACTION_RULES[action];

    expect(getUserPermissions(null).can(permission, subject)).toBe(false);
    expect(getUserPermissions({ id: 'usr-1', role: 'USER' }).can(permission, subject)).toBe(true);
  });
});
