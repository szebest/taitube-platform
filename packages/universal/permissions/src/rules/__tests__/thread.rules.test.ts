import { subject } from '@casl/ability';
import { creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineThreadRules } from '../thread.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const owned = subject('Thread', {
  ownerId: creatorUser.id,
  channelId: 'chan-1',
  authorId: 'someone',
});
const writtenBy = (authorId: string) =>
  subject('Thread', { ownerId: creatorUser.id, channelId: 'chan-1', authorId });

describe('rules/thread.rules: who pins a viewer thread', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a stranger', user: standardUser, expected: false },
    { scenario: 'the owner', user: creatorUser, expected: true },
  ])('$scenario pins: $expected', ({ user, expected }) => {
    expect(buildAbility(defineThreadRules, user).can('pin', owned)).toBe(expected);
  });

  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a stranger', user: { id: 'stranger-x', role: 'USER' }, expected: false },
    { scenario: 'the owner, who did not write it', user: creatorUser, expected: false },
    { scenario: 'its author', user: standardUser, expected: true },
  ])('$scenario deletes a thread: $expected', ({ user, expected }) => {
    expect(buildAbility(defineThreadRules, user).can('delete', writtenBy(standardUser.id))).toBe(
      expected
    );
  });

  it.each(matrixCells('Thread'))(
    'the channel matrix: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(defineThreadRules, user).can(action, target)).toBe(expected);
    }
  );
});
