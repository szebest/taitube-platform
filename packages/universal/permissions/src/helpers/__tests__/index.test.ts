import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { UserContext, VideoResource } from '../../types/index';
import {
  canAccessAdmin,
  canCreateVideo,
  canDeleteVideo,
  canManageCategory,
  canReactVideo,
  canReadVideo,
  canSubscribeChannel,
  canUpdateVideo,
} from '../index';

type Check = (user: UserContext | null, resource?: VideoResource) => boolean;

const CHECKS = {
  'video:read': (user, video) => canReadVideo({ user, video }),
  'video:create': (user) => canCreateVideo({ user }),
  'video:update': (user, video) => canUpdateVideo({ user, video }),
  'video:delete': (user, video) => canDeleteVideo({ user, video }),
  'video:react': (user) => canReactVideo({ user }),
  'channel:subscribe': (user) => canSubscribeChannel({ user }),
  'category:manage': (user) => canManageCategory({ user }),
  'admin:access': (user) => canAccessAdmin({ user }),
} satisfies Record<string, Check>;

type Action = keyof typeof CHECKS;

type Row = [scenario: string, action: Action, expected: boolean, resource?: VideoResource];

const GUEST: Row[] = [
  ['reads the video collection', 'video:read', true],
  ['reads a public video', 'video:read', true, { visibility: 'public' }],
  ['reads an unlisted video', 'video:read', true, { visibility: 'unlisted' }],
  ['reads a private video', 'video:read', false, { visibility: 'private', ownerId: 'usr-1' }],
  ['creates a video', 'video:create', false],
  ['updates a video', 'video:update', false, { ownerId: 'usr-1' }],
  ['deletes a video', 'video:delete', false, { ownerId: 'usr-1' }],
  ['reacts to a video', 'video:react', false],
  ['subscribes to a channel', 'channel:subscribe', false],
  ['manages categories', 'category:manage', false],
  ['reaches the admin area', 'admin:access', false],
];

const USER: Row[] = [
  ['creates a video', 'video:create', true],
  ['reacts to a video', 'video:react', true],
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
  ['manages categories', 'category:manage', false],
  ['reaches the admin area', 'admin:access', false],
];

const CREATOR: Row[] = [];

const MODERATOR: Row[] = [
  [
    'reads a foreign private video',
    'video:read',
    true,
    { visibility: 'private', ownerId: 'usr-2' },
  ],
  ['manages categories', 'category:manage', false],
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

describe('helpers: the role matrix across every action', () => {
  it.each([
    ...asCases('guest', guestUser, GUEST),
    ...asCases('user', standardUser, USER),
    ...asCases('creator', creatorUser, CREATOR),
    ...asCases('moderator', moderatorUser, MODERATOR),
  ])('$scenario: $expected', ({ user, action, resource, expected }) => {
    expect(CHECKS[action](user, resource)).toBe(expected);
  });

  it.each(Object.entries<Check>(CHECKS))(
    'an admin bypasses every check for %s',
    (_action, check) => {
      expect(check(adminUser)).toBe(true);
      expect(check(adminUser, { ownerId: 'foreign-id', userId: 'foreign-id' })).toBe(true);
    }
  );
});
