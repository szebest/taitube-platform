import type { CommentViewer } from '@vp/core/repositories';
import { ok } from '@vp/result';
import { isOwnOrPublic, isVisibleTo, ownOrPublicTo, publicScopeOf } from '../comment-public-scope';
import type { StoredComment } from '../comment-visibility';
import { UNMODERATED } from './stored-comment';

const AUTHOR = { id: 'author' };
const OTHER = { id: 'other' };

const comment = (id: string, overrides: Partial<StoredComment> = {}): StoredComment => ({
  ...UNMODERATED,
  id,
  videoId: 'v1',
  authorId: AUTHOR.id,
  parentId: null,
  content: '',
  isPinned: false,
  isEdited: false,
  likeCount: 0,
  heartedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
  ...overrides,
});

const shadowedAuthor = new Map([['v1', new Set([AUTHOR.id])]]);
const nobodyShadowed = new Map<string, Set<string>>();

describe('adapters/in-memory: public comment scope', () => {
  it.each<{
    name: string;
    state: StoredComment['moderationState'];
    shadowed: ReadonlyMap<string, ReadonlySet<string>>;
    viewer: CommentViewer;
    expected: boolean;
  }>([
    {
      name: 'a published comment to anyone',
      state: 'published',
      shadowed: nobodyShadowed,
      viewer: null,
      expected: true,
    },
    {
      name: 'a held comment to a stranger',
      state: 'held',
      shadowed: nobodyShadowed,
      viewer: OTHER,
      expected: false,
    },
    {
      name: 'a held comment to nobody signed in',
      state: 'held',
      shadowed: nobodyShadowed,
      viewer: null,
      expected: false,
    },
    {
      name: 'a hidden comment to its author',
      state: 'hidden',
      shadowed: nobodyShadowed,
      viewer: AUTHOR,
      expected: true,
    },
    {
      name: 'a shadow banned author to a stranger',
      state: 'published',
      shadowed: shadowedAuthor,
      viewer: OTHER,
      expected: false,
    },
    {
      name: 'a shadow banned author to nobody signed in',
      state: 'published',
      shadowed: shadowedAuthor,
      viewer: null,
      expected: false,
    },
    {
      name: 'a shadow banned author to themselves',
      state: 'published',
      shadowed: shadowedAuthor,
      viewer: AUTHOR,
      expected: true,
    },
  ])('shows $name: $expected', ({ state, shadowed, viewer, expected }) => {
    expect(isOwnOrPublic(viewer, comment('c', { moderationState: state }), shadowed)).toBe(
      expected
    );
  });

  it.each<{
    name: string;
    parent: Partial<StoredComment>;
    viewer: CommentViewer;
    expected: boolean;
  }>([
    { name: 'a reply under a published root', parent: {}, viewer: OTHER, expected: true },
    {
      name: 'a reply under a hidden root, to a stranger',
      parent: { moderationState: 'hidden', authorId: 'someone' },
      viewer: OTHER,
      expected: false,
    },
    {
      name: 'a reply under a hidden root, to the root author',
      parent: { moderationState: 'hidden', authorId: OTHER.id },
      viewer: OTHER,
      expected: true,
    },
    {
      name: 'a reply under a root that is gone',
      parent: { id: 'gone' },
      viewer: OTHER,
      expected: false,
    },
  ])('shows a reply as $name: $expected', ({ parent, viewer, expected }) => {
    const root = comment('root', parent);
    const reply = comment('reply', { parentId: 'root' });

    expect(
      isVisibleTo(viewer, reply, {
        shadowed: nobodyShadowed,
        comments: new Map([
          [root.id, root],
          [reply.id, reply],
        ]),
      })
    ).toBe(expected);
  });

  describe('publicScopeOf', () => {
    const lookups = (shadowedByChannel: Record<string, string[]>) => ({
      videos: {
        findById: async (id: string) =>
          ok(id === 'ghost' ? null : ({ id, ownerId: `owner-of-${id}` } as never)),
      },
      channels: {
        findByUserId: async (userId: string) => ok({ id: `channel-of-${userId}` } as never),
      },
      restrictions: {
        shadowedUserIds: (channelId: string) => new Set(shadowedByChannel[channelId] ?? []),
      },
    });

    it('reads the bans of the channel that owns each video, for the asked and the stored videos', async () => {
      const stored = comment('c1', { videoId: 'v2' });
      const scope = await publicScopeOf(
        new Map([[stored.id, stored]]),
        ['v1', 'ghost'],
        lookups({
          'channel-of-owner-of-v1': ['a'],
          'channel-of-owner-of-v2': ['b'],
        })
      );

      expect(scope.shadowed).toEqual(
        new Map([
          ['v1', new Set(['a'])],
          ['ghost', new Set()],
          ['v2', new Set(['b'])],
        ])
      );
    });
  });

  it('counts a reply for the viewer by the same rule as the scope', () => {
    const count = ownOrPublicTo(OTHER, { shadowed: shadowedAuthor, comments: new Map() });

    expect([
      count(comment('r1', { authorId: 'someone' })),
      count(comment('r2', { authorId: 'someone', moderationState: 'held' })),
      count(comment('r3', { authorId: OTHER.id, moderationState: 'held' })),
      count(comment('r4', { authorId: AUTHOR.id })),
    ]).toEqual([true, false, true, false]);
  });
});
