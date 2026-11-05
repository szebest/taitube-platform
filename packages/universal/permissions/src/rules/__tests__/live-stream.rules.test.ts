import { subject } from '@casl/ability';
import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { AppAction, UserContext } from '../../types/index';
import { defineLiveStreamRules } from '../live-stream.rules';
import { buildAbility } from './build-ability';

const can = (user: UserContext | null, action: AppAction) =>
  buildAbility(defineLiveStreamRules, user).can(
    action,
    subject('LiveStream', { ownerId: standardUser.id })
  );

describe('rules/live-stream.rules: who may run a channel broadcast', () => {
  it.each<{ scenario: string; user: UserContext | null; update: boolean; moderate: boolean }>([
    { scenario: 'the channel owner', user: standardUser, update: true, moderate: true },
    { scenario: 'another creator', user: creatorUser, update: false, moderate: false },
    { scenario: 'a moderator', user: moderatorUser, update: false, moderate: true },
    { scenario: 'a guest', user: guestUser, update: false, moderate: false },
    {
      scenario: 'an admin, left to the admin rules',
      user: adminUser,
      update: false,
      moderate: false,
    },
  ])('$scenario: update $update, moderate $moderate', ({ user, update, moderate }) => {
    expect(can(user, 'update')).toBe(update);
    expect(can(user, 'moderate')).toBe(moderate);
  });
});
