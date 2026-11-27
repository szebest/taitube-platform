import { expectOk } from '@kit/testing/result';
import type { ChannelPost, PostPayload } from '@vp/domain';
import { loadPollLookups, pollBodyOf } from '../post-poll-views';
import { NOW, OWNER, STRANGER, member, postsFixture } from './post-deps';

const QUIZ: Extract<PostPayload, { kind: 'quiz' }> = {
  kind: 'quiz',
  question: 'Q?',
  options: ['a', 'b'],
  closesAt: null,
  correctIndex: 1,
  explanation: 'why',
};

function postWith(payload: PostPayload): ChannelPost {
  return {
    id: 'p1',
    channelId: 'c1',
    authorUserId: OWNER.id,
    payload,
    status: 'published',
    publishAt: null,
    publishedAt: new Date(NOW),
    pinnedAt: null,
    commentsEnabled: true,
    editedAt: null,
    likeCount: 0,
    commentsCount: 0,
    version: 1,
    createdAt: new Date(NOW),
  };
}

const lookups = (voted: [string, number][], tallies: [string, number[]][]) => ({
  voted: new Map(voted),
  tallies: new Map(tallies),
});

describe('apps/server/api/services: poll views', () => {
  it.each([
    {
      scenario: 'an anonymous reader before any vote',
      viewer: null,
      lookup: lookups([], [['p1', [3, 1]]]),
      expected: { votedIndex: null, totalVotes: null, correctIndex: null, explanation: null },
    },
    {
      scenario: 'a voter',
      viewer: STRANGER,
      lookup: lookups([['p1', 0]], [['p1', [3, 1]]]),
      expected: { votedIndex: 0, totalVotes: 4, correctIndex: 1, explanation: 'why' },
    },
    {
      scenario: 'the owner before any vote',
      viewer: OWNER,
      lookup: lookups([], [['p1', [3, 1]]]),
      expected: { votedIndex: null, totalVotes: 4, correctIndex: 1, explanation: 'why' },
    },
    {
      scenario: 'an editor of the channel',
      viewer: member('editor-1', 'c1', 'editor'),
      lookup: lookups([], []),
      expected: { totalVotes: 0, correctIndex: 1 },
    },
  ])('shows a quiz to $scenario', ({ viewer, lookup, expected }) => {
    const body = pollBodyOf(postWith(QUIZ), QUIZ, OWNER.id, lookup, {
      user: viewer,
      now: new Date(NOW),
    });

    expect(body).toMatchObject({ kind: 'quiz', ...expected });
  });

  it('hides the counts of an open poll from a reader and shows them once it closed', () => {
    const poll: Extract<PostPayload, { kind: 'poll' }> = {
      kind: 'poll',
      question: 'Q?',
      options: ['a', 'b'],
      closesAt: new Date(NOW + 1000).toISOString(),
    };
    const lookup = lookups([], [['p1', [2, 0]]]);
    const read = (at: number) =>
      pollBodyOf(postWith(poll), poll, OWNER.id, lookup, { user: null, now: new Date(at) });

    expect(read(NOW)).toMatchObject({ closed: false, totalVotes: null });
    expect(read(NOW + 2000)).toMatchObject({
      closed: true,
      totalVotes: 2,
      options: [{ votes: 2 }, { votes: 0 }],
    });
  });

  it('reads nothing for posts that are no poll, and the viewer votes only when signed in', async () => {
    const { repositories } = await postsFixture();
    const text = postWith({ kind: 'text', text: 'hi' });
    const spy = vi.spyOn(repositories.postEngagement, 'tallies');

    const none = expectOk(
      await loadPollLookups(repositories.postEngagement, [text], { user: null, now: new Date(NOW) })
    );
    const anonymous = expectOk(
      await loadPollLookups(repositories.postEngagement, [postWith(QUIZ)], {
        user: null,
        now: new Date(NOW),
      })
    );

    expect(none.tallies.size).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(anonymous.voted.size).toBe(0);
  });
});
