import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { Action, Resource, UserContext } from '../../types/index';
import { can } from '../can';

type Row = [scenario: string, action: Action, expected: boolean, resource?: Resource];

const GUEST: Row[] = [
  ['reads the video collection', 'video:read', true],
  ['reads a public video', 'video:read', true, { visibility: 'public' }],
  ['reads an unlisted video', 'video:read', true, { visibility: 'unlisted' }],
  ['reads a private video', 'video:read', false, { visibility: 'private', ownerId: 'usr-1' }],
  ['creates a video', 'video:create', false],
  ['updates a video', 'video:update', false, { ownerId: 'usr-1' }],
  ['deletes a video', 'video:delete', false, { ownerId: 'usr-1' }],
  ['publishes a video', 'video:publish', false, { ownerId: 'usr-1' }],
  ['reacts to a video', 'video:react', false],
  ['creates a comment', 'comment:create', false],
  ['deletes a comment', 'comment:delete', false, { authorId: 'usr-1' }],
  ['pins a comment', 'comment:pin', false, { videoOwnerId: 'usr-1' }],
  ['updates a channel', 'channel:update', false, { userId: 'usr-1' }],
  ['manages a channel', 'channel:manage', false, { userId: 'usr-1' }],
  ['subscribes to a channel', 'channel:subscribe', false],
  ['manages categories', 'category:manage', false],
  ['views all analytics', 'analytics:view_all', false],
  ['reaches the admin area', 'admin:access', false],
];

const USER: Row[] = [
  ['creates a video', 'video:create', true],
  ['reacts to a video', 'video:react', true],
  ['creates a comment', 'comment:create', true],
  ['subscribes to a channel', 'channel:subscribe', true],
  ['reads a foreign public video', 'video:read', true, { visibility: 'public', ownerId: 'usr-2' }],
  [
    'reads a foreign unlisted video',
    'video:read',
    true,
    { visibility: 'unlisted', ownerId: 'usr-2' },
  ],
  [
    'reads their own private video',
    'video:read',
    true,
    { visibility: 'private', ownerId: 'usr-1' },
  ],
  [
    'reads a foreign private video',
    'video:read',
    false,
    { visibility: 'private', ownerId: 'usr-2' },
  ],
  ['updates their own video', 'video:update', true, { ownerId: 'usr-1' }],
  ['deletes their own video', 'video:delete', true, { ownerId: 'usr-1' }],
  ['updates a foreign video', 'video:update', false, { ownerId: 'usr-2' }],
  ['deletes a foreign video', 'video:delete', false, { ownerId: 'usr-2' }],
  ['updates a video with no owner in hand', 'video:update', false],
  ['deletes a video with no owner in hand', 'video:delete', false],
  ['publishes their own video', 'video:publish', false, { ownerId: 'usr-1' }],
  [
    'deletes their own comment under a foreign video',
    'comment:delete',
    true,
    { authorId: 'usr-1', videoOwnerId: 'usr-2' },
  ],
  [
    'deletes a foreign comment under a foreign video',
    'comment:delete',
    false,
    { authorId: 'usr-2', videoOwnerId: 'usr-3' },
  ],
  [
    'deletes a foreign comment under their own video',
    'comment:delete',
    true,
    { authorId: 'usr-2', videoOwnerId: 'usr-1' },
  ],
  ['pins a comment under their own video', 'comment:pin', true, { videoOwnerId: 'usr-1' }],
  ['pins a comment under a foreign video', 'comment:pin', false, { videoOwnerId: 'usr-2' }],
  ['pins a comment with no video owner in hand', 'comment:pin', false],
  ['updates their own channel', 'channel:update', true, { userId: 'usr-1' }],
  ['updates a foreign channel', 'channel:update', false, { userId: 'usr-2' }],
  ['manages their own channel', 'channel:manage', false, { userId: 'usr-1' }],
  ['manages categories', 'category:manage', false],
  ['views all analytics', 'analytics:view_all', false],
  ['reaches the admin area', 'admin:access', false],
];

const CREATOR: Row[] = [
  ['publishes their own video', 'video:publish', true, { ownerId: 'creator-1' }],
  ['publishes a foreign video', 'video:publish', false, { ownerId: 'usr-2' }],
  ['manages their own channel', 'channel:manage', true, { userId: 'creator-1' }],
  ['manages a foreign channel', 'channel:manage', false, { userId: 'usr-2' }],
  ['pins a comment under their own video', 'comment:pin', true, { videoOwnerId: 'creator-1' }],
  ['pins a comment under a foreign video', 'comment:pin', false, { videoOwnerId: 'usr-2' }],
  [
    'deletes a foreign comment under their own video',
    'comment:delete',
    true,
    { authorId: 'usr-2', videoOwnerId: 'creator-1' },
  ],
];

const MODERATOR: Row[] = [
  [
    'deletes any comment on the platform',
    'comment:delete',
    true,
    { authorId: 'usr-2', videoOwnerId: 'usr-3' },
  ],
  [
    'reads a foreign private video',
    'video:read',
    true,
    { visibility: 'private', ownerId: 'usr-2' },
  ],
  ['manages categories', 'category:manage', false],
  ['views all analytics', 'analytics:view_all', false],
  ['reaches the admin area', 'admin:access', false],
];

const asCases = (label: string, user: UserContext | null, rows: Row[]) =>
  rows.map(([scenario, action, expected, resource]) => ({
    scenario: `${label} ${scenario}`,
    user,
    action,
    resource,
    expected,
  }));

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
  it.each([
    ...asCases('guest', guestUser, GUEST),
    ...asCases('user', standardUser, USER),
    ...asCases('creator', creatorUser, CREATOR),
    ...asCases('moderator', moderatorUser, MODERATOR),
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
