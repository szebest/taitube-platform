import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { Action, Resource, UserContext } from '../../types';
import { can } from '../can';

type CanCase = {
  scenario: string;
  user: UserContext | null;
  action: Action;
  resource?: Resource;
  expected: boolean;
};

const ALL_ACTIONS: Action[] = [
  'video:read',
  'video:create',
  'video:update',
  'video:delete',
  'video:publish',
  'video:react',
  'comment:create',
  'comment:delete',
  'comment:pin',
  'channel:update',
  'channel:manage',
  'channel:subscribe',
  'category:manage',
  'analytics:view_all',
  'admin:access',
];

describe('helpers/can: Unified Action Evaluator Bridge', () => {
  it.each<CanCase>([
    {
      scenario: 'guest reads the video collection',
      user: guestUser,
      action: 'video:read',
      expected: true,
    },
    {
      scenario: 'guest reads a public video',
      user: guestUser,
      action: 'video:read',
      resource: { visibility: 'public' },
      expected: true,
    },
    {
      scenario: 'guest reads an unlisted video',
      user: guestUser,
      action: 'video:read',
      resource: { visibility: 'unlisted' },
      expected: true,
    },
    {
      scenario: 'guest reads a private video',
      user: guestUser,
      action: 'video:read',
      resource: { visibility: 'private', ownerId: 'usr-1' },
      expected: false,
    },
    { scenario: 'guest creates a video', user: guestUser, action: 'video:create', expected: false },
    {
      scenario: 'guest updates a video',
      user: guestUser,
      action: 'video:update',
      resource: { ownerId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest deletes a video',
      user: guestUser,
      action: 'video:delete',
      resource: { ownerId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest publishes a video',
      user: guestUser,
      action: 'video:publish',
      resource: { ownerId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest reacts to a video',
      user: guestUser,
      action: 'video:react',
      expected: false,
    },
    {
      scenario: 'guest creates a comment',
      user: guestUser,
      action: 'comment:create',
      expected: false,
    },
    {
      scenario: 'guest deletes a comment',
      user: guestUser,
      action: 'comment:delete',
      resource: { authorId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest pins a comment',
      user: guestUser,
      action: 'comment:pin',
      resource: { videoOwnerId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest updates a channel',
      user: guestUser,
      action: 'channel:update',
      resource: { userId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest manages a channel',
      user: guestUser,
      action: 'channel:manage',
      resource: { userId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'guest subscribes to a channel',
      user: guestUser,
      action: 'channel:subscribe',
      expected: false,
    },
    {
      scenario: 'guest manages categories',
      user: guestUser,
      action: 'category:manage',
      expected: false,
    },
    {
      scenario: 'guest views all analytics',
      user: guestUser,
      action: 'analytics:view_all',
      expected: false,
    },
    {
      scenario: 'guest reaches the admin area',
      user: guestUser,
      action: 'admin:access',
      expected: false,
    },

    {
      scenario: 'user creates a video',
      user: standardUser,
      action: 'video:create',
      expected: true,
    },
    {
      scenario: 'user reacts to a video',
      user: standardUser,
      action: 'video:react',
      expected: true,
    },
    {
      scenario: 'user creates a comment',
      user: standardUser,
      action: 'comment:create',
      expected: true,
    },
    {
      scenario: 'user subscribes to a channel',
      user: standardUser,
      action: 'channel:subscribe',
      expected: true,
    },
    {
      scenario: 'user reads a foreign public video',
      user: standardUser,
      action: 'video:read',
      resource: { visibility: 'public', ownerId: 'usr-2' },
      expected: true,
    },
    {
      scenario: 'user reads a foreign unlisted video',
      user: standardUser,
      action: 'video:read',
      resource: { visibility: 'unlisted', ownerId: 'usr-2' },
      expected: true,
    },
    {
      scenario: 'user reads their own private video',
      user: standardUser,
      action: 'video:read',
      resource: { visibility: 'private', ownerId: 'usr-1' },
      expected: true,
    },
    {
      scenario: 'user reads a foreign private video',
      user: standardUser,
      action: 'video:read',
      resource: { visibility: 'private', ownerId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'user updates their own video',
      user: standardUser,
      action: 'video:update',
      resource: { ownerId: 'usr-1' },
      expected: true,
    },
    {
      scenario: 'user deletes their own video',
      user: standardUser,
      action: 'video:delete',
      resource: { ownerId: 'usr-1' },
      expected: true,
    },
    {
      scenario: 'user updates a foreign video',
      user: standardUser,
      action: 'video:update',
      resource: { ownerId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'user deletes a foreign video',
      user: standardUser,
      action: 'video:delete',
      resource: { ownerId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'user updates a video with no owner in hand',
      user: standardUser,
      action: 'video:update',
      expected: false,
    },
    {
      scenario: 'user deletes a video with no owner in hand',
      user: standardUser,
      action: 'video:delete',
      expected: false,
    },
    {
      scenario: 'user publishes their own video',
      user: standardUser,
      action: 'video:publish',
      resource: { ownerId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'user deletes their own comment under a foreign video',
      user: standardUser,
      action: 'comment:delete',
      resource: { authorId: 'usr-1', videoOwnerId: 'usr-2' },
      expected: true,
    },
    {
      scenario: 'user deletes a foreign comment under a foreign video',
      user: standardUser,
      action: 'comment:delete',
      resource: { authorId: 'usr-2', videoOwnerId: 'usr-3' },
      expected: false,
    },
    {
      scenario: 'user deletes a foreign comment under their own video',
      user: standardUser,
      action: 'comment:delete',
      resource: { authorId: 'usr-2', videoOwnerId: 'usr-1' },
      expected: true,
    },
    {
      scenario: 'user pins a comment under their own video',
      user: standardUser,
      action: 'comment:pin',
      resource: { videoOwnerId: 'usr-1' },
      expected: true,
    },
    {
      scenario: 'user pins a comment under a foreign video',
      user: standardUser,
      action: 'comment:pin',
      resource: { videoOwnerId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'user pins a comment with no video owner in hand',
      user: standardUser,
      action: 'comment:pin',
      expected: false,
    },
    {
      scenario: 'user updates their own channel',
      user: standardUser,
      action: 'channel:update',
      resource: { userId: 'usr-1' },
      expected: true,
    },
    {
      scenario: 'user updates a foreign channel',
      user: standardUser,
      action: 'channel:update',
      resource: { userId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'user manages their own channel',
      user: standardUser,
      action: 'channel:manage',
      resource: { userId: 'usr-1' },
      expected: false,
    },
    {
      scenario: 'user manages categories',
      user: standardUser,
      action: 'category:manage',
      expected: false,
    },
    {
      scenario: 'user views all analytics',
      user: standardUser,
      action: 'analytics:view_all',
      expected: false,
    },
    {
      scenario: 'user reaches the admin area',
      user: standardUser,
      action: 'admin:access',
      expected: false,
    },

    {
      scenario: 'creator publishes their own video',
      user: creatorUser,
      action: 'video:publish',
      resource: { ownerId: 'creator-1' },
      expected: true,
    },
    {
      scenario: 'creator publishes a foreign video',
      user: creatorUser,
      action: 'video:publish',
      resource: { ownerId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'creator manages their own channel',
      user: creatorUser,
      action: 'channel:manage',
      resource: { userId: 'creator-1' },
      expected: true,
    },
    {
      scenario: 'creator manages a foreign channel',
      user: creatorUser,
      action: 'channel:manage',
      resource: { userId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'creator pins a comment under their own video',
      user: creatorUser,
      action: 'comment:pin',
      resource: { videoOwnerId: 'creator-1' },
      expected: true,
    },
    {
      scenario: 'creator pins a comment under a foreign video',
      user: creatorUser,
      action: 'comment:pin',
      resource: { videoOwnerId: 'usr-2' },
      expected: false,
    },
    {
      scenario: 'creator deletes a foreign comment under their own video',
      user: creatorUser,
      action: 'comment:delete',
      resource: { authorId: 'usr-2', videoOwnerId: 'creator-1' },
      expected: true,
    },

    {
      scenario: 'moderator deletes any comment on the platform',
      user: moderatorUser,
      action: 'comment:delete',
      resource: { authorId: 'usr-2', videoOwnerId: 'usr-3' },
      expected: true,
    },
    {
      scenario: 'moderator reads a foreign private video',
      user: moderatorUser,
      action: 'video:read',
      resource: { visibility: 'private', ownerId: 'usr-2' },
      expected: true,
    },
    {
      scenario: 'moderator manages categories',
      user: moderatorUser,
      action: 'category:manage',
      expected: false,
    },
    {
      scenario: 'moderator views all analytics',
      user: moderatorUser,
      action: 'analytics:view_all',
      expected: false,
    },
    {
      scenario: 'moderator reaches the admin area',
      user: moderatorUser,
      action: 'admin:access',
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, resource, expected }) => {
    expect(can(user, action, resource)).toBe(expected);
  });

  it.each(ALL_ACTIONS)('an admin bypasses every check for %s', (action) => {
    expect(can(adminUser, action)).toBe(true);
    expect(can(adminUser, action, { ownerId: 'foreign-id', userId: 'foreign-id' })).toBe(true);
  });

  it('denies an action it does not know', () => {
    expect(can(adminUser, 'video:archive' as Action)).toBe(false);
  });
});
