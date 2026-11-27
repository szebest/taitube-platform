import { subject } from '@casl/ability';
import { creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineThreadRules } from '../thread.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const owned = subject('Thread', { ownerId: creatorUser.id, channelId: 'chan-1' });

describe('rules/thread.rules: who pins a viewer thread', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a stranger', user: standardUser, expected: false },
    { scenario: 'the owner', user: creatorUser, expected: true },
  ])('$scenario pins: $expected', ({ user, expected }) => {
    expect(buildAbility(defineThreadRules, user).can('pin', owned)).toBe(expected);
  });

  it.each(matrixCells('Thread'))(
    'the channel matrix: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(defineThreadRules, user).can(action, target)).toBe(expected);
    }
  );
});
