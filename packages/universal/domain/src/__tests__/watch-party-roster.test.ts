import type { MemberKind } from '../watch-party-principal';
import {
  type RosterEntry,
  type RosterPreviewMember,
  rosterFor,
  toRosterPreview,
} from '../watch-party-roster';

function entryOf(memberKey: string, kind: MemberKind): RosterEntry {
  return {
    memberKey,
    kind,
    source: 'app',
    name: memberKey,
    avatarUrl: null,
    roleIds: [],
    ready: false,
    sync: 'in_sync',
    voice: 'off',
    away: false,
  };
}

function memberOf(name: string, kind: MemberKind, showInParties = true): RosterPreviewMember {
  return { name, kind, avatarUrl: `/${name}.png`, showInParties };
}

describe('@vp/domain: rosterFor', () => {
  const entries = [entryOf('ana', 'user'), entryOf('g1', 'guest'), entryOf('g2', 'guest')];

  it.each([
    { who: 'a member who cannot kick', seesGuests: false, keys: ['ana'], guests: 2 },
    { who: 'a members.kick holder', seesGuests: true, keys: ['ana', 'g1', 'g2'], guests: 0 },
  ])('shows guests to $who as $guests counted', ({ seesGuests, keys, guests }) => {
    const view = rosterFor(entries, seesGuests);

    expect(view.entries.map((entry) => entry.memberKey)).toEqual(keys);
    expect(view.guests).toBe(guests);
  });
});

describe('@vp/domain: toRosterPreview', () => {
  const accounts = ['ana', 'tom', 'eva', 'max', 'zoe', 'leo'].map((name) => memberOf(name, 'user'));
  const room = [
    ...accounts,
    memberOf('hidden', 'user', false),
    memberOf('dc-ana', 'discord'),
    memberOf('dc-tom', 'discord'),
    memberOf('Guest 4821', 'guest'),
  ];

  it.each([
    {
      scenario: 'a public room on the app',
      visibility: 'public' as const,
      surface: 'app' as const,
      faces: ['ana', 'tom', 'eva', 'max', 'zoe'],
      counts: { others: 2, discord: 2, guests: 1, total: 10 },
    },
    {
      scenario: 'an unlisted room on Discord',
      visibility: 'unlisted' as const,
      surface: 'discord' as const,
      faces: ['ana', 'tom', 'eva', 'max', 'zoe'],
      counts: { others: 2, discord: 2, guests: 1, total: 10 },
    },
    {
      scenario: 'a private room on the app',
      visibility: 'private' as const,
      surface: 'app' as const,
      faces: [],
      counts: { others: 7, discord: 2, guests: 1, total: 10 },
    },
    {
      scenario: 'a private room in an invite',
      visibility: 'private' as const,
      surface: 'invite' as const,
      faces: ['ana', 'tom'],
      counts: { others: 5, discord: 2, guests: 1, total: 10 },
    },
  ])('$scenario shows $faces', ({ visibility, surface, faces, counts }) => {
    const preview = toRosterPreview(room, visibility, surface);

    expect(preview.faces.map((face) => face.name)).toEqual(faces);
    expect(preview).toMatchObject(counts);
  });

  it('names Discord members on a Discord surface only', () => {
    const discordFirst = [memberOf('dc-ana', 'discord'), memberOf('ana', 'user')];

    expect(toRosterPreview(discordFirst, 'public', 'discord').faces.map((f) => f.name)).toEqual([
      'dc-ana',
      'ana',
    ]);
    expect(toRosterPreview(discordFirst, 'public', 'app')).toMatchObject({
      faces: [{ name: 'ana' }],
      discord: 1,
    });
  });
});
