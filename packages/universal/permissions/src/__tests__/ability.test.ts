import { subject } from '@casl/ability';
import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  rejectedVideo,
  standardUser,
} from '../__mocks__/fixtures';
import { getUserPermissions } from '../ability';
import type { AppAction, AppSubjects, UserContext } from '../types/index';

describe('permissions: getUserPermissions', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    allowed: boolean;
  }>([
    {
      scenario: 'an admin manages everything',
      user: adminUser,
      action: 'manage',
      target: 'all',
      allowed: true,
    },
    {
      scenario: 'a guest reads channels',
      user: guestUser,
      action: 'read',
      target: 'Channel',
      allowed: true,
    },
    {
      scenario: 'a guest creates no video',
      user: guestUser,
      action: 'create',
      target: 'Video',
      allowed: false,
    },
    {
      scenario: 'a user creates a video',
      user: standardUser,
      action: 'create',
      target: 'Video',
      allowed: true,
    },
    {
      scenario: 'a user starts an upload',
      user: standardUser,
      action: 'create',
      target: 'Upload',
      allowed: true,
    },
    {
      scenario: 'a user manages nothing',
      user: standardUser,
      action: 'manage',
      target: 'all',
      allowed: false,
    },
  ])('builds one ability from every rule set: $scenario', ({ user, action, target, allowed }) => {
    expect(getUserPermissions(user).can(action, target)).toBe(allowed);
  });

  it.each([
    { scenario: 'an admin', user: adminUser, allowed: true },
    { scenario: 'a moderator', user: moderatorUser, allowed: false },
    { scenario: 'the creator who owns it', user: creatorUser, allowed: false },
  ])('$scenario takes a video down: $allowed', ({ user, allowed }) => {
    expect(getUserPermissions(user).can('moderate', subject('Video', rejectedVideo))).toBe(allowed);
  });

  it('lets an admin reopen the visibility an owner may not touch after a takedown', () => {
    const admin = { ...adminUser, id: rejectedVideo.ownerId ?? '' };

    expect(
      getUserPermissions(admin).can('update', subject('Video', rejectedVideo), 'visibility')
    ).toBe(true);
  });
});
