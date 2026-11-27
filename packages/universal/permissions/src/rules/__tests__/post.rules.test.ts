import { subject } from '@casl/ability';
import { creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { AppAction, UserContext } from '../../types/index';
import { definePostRules } from '../post.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const owned = subject('Post', { ownerId: creatorUser.id, channelId: 'chan-1' });

describe('rules/post.rules: who writes, pins and reads the stats of a post', () => {
  it.each<{ scenario: string; user: UserContext | null; action: AppAction; expected: boolean }>([
    { scenario: 'a guest creates', user: guestUser, action: 'create', expected: false },
    { scenario: 'a stranger updates', user: standardUser, action: 'update', expected: false },
    { scenario: 'a stranger pins', user: standardUser, action: 'pin', expected: false },
    ...(['create', 'update', 'delete', 'pin'] as const).map((action) => ({
      scenario: `the owner ${action}s`,
      user: creatorUser,
      action,
      expected: true,
    })),
  ])('$scenario: $expected', ({ user, action, expected }) => {
    expect(buildAbility(definePostRules, user).can(action, owned)).toBe(expected);
  });

  it.each([
    ...matrixCells('Post').map((cell) => ({ ...cell, subjectName: 'Post' })),
    ...matrixCells('PostStats').map((cell) => ({ ...cell, subjectName: 'PostStats' })),
  ])(
    'the channel matrix on $subjectName: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(definePostRules, user).can(action, target)).toBe(expected);
    }
  );
});
