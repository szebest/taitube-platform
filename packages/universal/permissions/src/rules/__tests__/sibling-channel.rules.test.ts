import { getUserPermissions } from '../../ability';
import { siblingCells } from './channel-matrix';

describe('rules: a channel role stops at its channel', () => {
  it.each(siblingCells())(
    '$persona holding $capability may $action on its channel and only the owner on a sibling',
    ({ persona, user, action, home, sibling }) => {
      const ability = getUserPermissions(user);

      expect([ability.can(action, home), ability.can(action, sibling)]).toEqual([
        true,
        persona === 'owner',
      ]);
    }
  );
});
