import { subject } from '@casl/ability';
import { creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { AppAction, UserContext } from '../../types/index';
import { defineContentLinkRules } from '../content-link.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const owned = subject('ContentLink', { ownerId: creatorUser.id, channelId: 'chan-1' });

describe('rules/content-link.rules: who links, approves, removes and suggests', () => {
  it.each<{ scenario: string; user: UserContext | null; action: AppAction; expected: boolean }>([
    { scenario: 'a guest suggests', user: guestUser, action: 'suggest', expected: false },
    { scenario: 'a viewer suggests', user: standardUser, action: 'suggest', expected: true },
    { scenario: 'a stranger links', user: standardUser, action: 'link', expected: false },
    { scenario: 'a stranger approves', user: standardUser, action: 'approveLink', expected: false },
    ...(['link', 'approveLink', 'removeInboundLink'] as const).map((action) => ({
      scenario: `the owner may ${action}`,
      user: creatorUser,
      action,
      expected: true,
    })),
  ])('$scenario: $expected', ({ user, action, expected }) => {
    const target = action === 'suggest' ? 'ContentLink' : owned;
    expect(buildAbility(defineContentLinkRules, user).can(action, target)).toBe(expected);
  });

  it.each([
    ...matrixCells('ContentLink').map((cell) => ({ ...cell, subjectName: 'ContentLink' })),
    ...matrixCells('ContentLinkStats').map((cell) => ({
      ...cell,
      subjectName: 'ContentLinkStats',
    })),
  ])(
    'the channel matrix on $subjectName: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(defineContentLinkRules, user).can(action, target)).toBe(expected);
    }
  );
});
