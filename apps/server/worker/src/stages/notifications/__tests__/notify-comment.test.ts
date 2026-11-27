import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { CommentTarget, NewCommentModeration } from '@vp/domain';
import type { NotifyCommentJob } from '@vp/job-contracts';
import { createNotifyCommentProcessor } from '../notify-comment';
import {
  CHANNEL_ID,
  channelOf,
  CREATOR_ID,
  logger,
  notificationsOf,
  postId,
  seedPost,
  saveSwitches,
  seedCreator,
  seedVideo,
  userId,
  videoId,
} from './notification-harness';

const VIDEO = videoId(1);
const AUTHOR = userId(41);
const FAN = userId(42);

describe('apps/server/worker/stages: notify-comment', () => {
  let repositories: InMemoryRepositories;
  let commentCount = 0;

  const comment = async (
    author: string,
    content: string,
    parentId: string | null = null,
    moderation?: NewCommentModeration,
    target: CommentTarget = { type: 'video', id: VIDEO }
  ) => {
    commentCount += 1;
    const id = `00000000-0000-7000-8000-${String(900 + commentCount).padStart(12, '0')}`;
    expectOk(
      await repositories.comments.create({
        id,
        target,
        channelId: CHANNEL_ID,
        authorId: author,
        authorChannelId: channelOf(author),
        parentId,
        content,
        moderation,
      })
    );
    return id;
  };

  const notify = async (
    commentId: string,
    target: CommentTarget = { type: 'video', id: VIDEO }
  ) => {
    const job: QueueJob<NotifyCommentJob> = {
      id: `${commentId}--notify-comment`,
      name: 'notify-comment',
      data: { target, commentId },
    };
    return expectOk(await createNotifyCommentProcessor({ repositories, logger })(job));
  };

  const kindsFor = async (id: string) =>
    (await notificationsOf(repositories, id)).map((row) => row.kind);

  const withChannel = async (id: string, handle: string) => {
    expectOk(await repositories.users.upsert({ id, email: `${handle}@example.com` }));
    expectOk(
      await repositories.channels.create({
        id: channelOf(id),
        userId: id,
        handle,
        displayName: handle,
      })
    );
  };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    commentCount = 0;
    await seedCreator(repositories);
    await seedVideo(repositories, VIDEO);
    await withChannel(AUTHOR, 'the-author');
    await withChannel(FAN, 'a-fan');
  });

  it("tells a video's owner about a comment on it, with the author and an excerpt", async () => {
    await notify(await comment(FAN, 'lovely video'));

    const [row] = await notificationsOf(repositories, CREATOR_ID);
    expect(row).toMatchObject({
      kind: 'comment',
      videoId: VIDEO,
      payload: { actor: { handle: 'a-fan' }, excerpt: 'lovely video', count: 1 },
    });
  });

  it("tells a comment's author about a reply, and the owner about nothing", async () => {
    const root = await comment(AUTHOR, 'first');

    await notify(await comment(FAN, 'agreed', root));

    expect(await kindsFor(AUTHOR)).toEqual(['reply']);
    expect(await kindsFor(CREATOR_ID)).toEqual([]);
  });

  it('tells a mentioned person, once, as a mention rather than a reply', async () => {
    const root = await comment(AUTHOR, 'first');

    await notify(await comment(FAN, 'thanks @the-author and @the-author', root));

    expect(await kindsFor(AUTHOR)).toEqual(['mention']);
  });

  it('never tells the author about their own comment', async () => {
    await notify(await comment(CREATOR_ID, 'thanks for watching @a-fan'));

    expect(await kindsFor(CREATOR_ID)).toEqual([]);
    expect(await kindsFor(FAN)).toEqual(['mention']);
  });

  it('shows several replies to one comment as one row with a count', async () => {
    const root = await comment(AUTHOR, 'first');

    await notify(await comment(FAN, 'one', root));
    await notify(await comment(CREATOR_ID, 'two', root));

    const rows = await notificationsOf(repositories, AUTHOR);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.count).toBe(2);
  });

  it('counts nothing twice when the same job runs again', async () => {
    const id = await comment(FAN, 'lovely video');

    await notify(id);
    const again = await notify(id);

    expect(again.recorded).toBe(0);
    expect((await notificationsOf(repositories, CREATOR_ID))[0]?.payload.count).toBe(1);
  });

  it('gives nothing to a person whose replies and mentions switch is off', async () => {
    await saveSwitches(repositories, CREATOR_ID, { repliesAndMentions: false });

    await notify(await comment(FAN, 'lovely video @the-author'));

    expect(await kindsFor(CREATOR_ID)).toEqual([]);
    expect(await kindsFor(AUTHOR)).toEqual(['mention']);
  });

  it.each(['unlisted', 'private'] as const)(
    'tells only the owner about a comment on a video that is %s',
    async (visibility) => {
      repositories = new InMemoryRepositories();
      await seedCreator(repositories);
      await seedVideo(repositories, VIDEO, { visibility });
      await withChannel(AUTHOR, 'the-author');
      await withChannel(FAN, 'a-fan');
      const root = await comment(AUTHOR, 'first');

      await notify(await comment(CREATOR_ID, 'see @a-fan', root));

      expect(await kindsFor(AUTHOR)).toEqual([]);
      expect(await kindsFor(FAN)).toEqual([]);
    }
  );

  it('skips a comment that is gone', async () => {
    const result = await notify('00000000-0000-7000-8000-000000000999');

    expect(result.recorded).toBe(0);
  });

  it.each([
    { scenario: 'held', state: 'held' as const, shadow: false },
    { scenario: 'hidden', state: 'hidden' as const, shadow: false },
    { scenario: 'by a shadow banned author', state: 'published' as const, shadow: true },
  ])(
    'tells no one about a comment $scenario, nor about a mention in it',
    async ({ state, shadow }) => {
      const moderation: NewCommentModeration = {
        moderationState: state,
        moderationDisclosure: 'silent',
        heldReason: null,
        looksLikeQuestion: false,
      };
      if (shadow) {
        expectOk(
          await repositories.channelUserRestrictions.apply({
            channelId: CHANNEL_ID,
            userId: FAN,
            kind: 'shadow',
            reason: null,
            expiresAt: null,
            createdBy: CREATOR_ID,
          })
        );
      }
      const root = await comment(AUTHOR, 'first');

      const result = await notify(await comment(FAN, 'hi @the-author', root, moderation));

      expect(result.recorded).toBe(0);
      expect(await kindsFor(AUTHOR)).toEqual([]);
      expect(await kindsFor(CREATOR_ID)).toEqual([]);
    }
  );

  describe('under a post or a viewer thread', () => {
    const POST = postId(1);
    const THREAD = '00000000-0000-7000-8000-0000000007f1';
    const onPost: CommentTarget = { type: 'post', id: POST };
    const onThread: CommentTarget = { type: 'thread', id: THREAD };
    const held: NewCommentModeration = {
      moderationState: 'held',
      moderationDisclosure: 'silent',
      heldReason: 'review_all',
      looksLikeQuestion: false,
    };

    const targets = [
      {
        name: 'a post',
        target: onPost,
        videoId: null,
        link: { postId: POST },
      },
      {
        name: 'a viewer thread',
        target: onThread,
        videoId: VIDEO,
        link: { threadId: THREAD },
      },
    ];

    const seedTarget = async (target: CommentTarget) => {
      if (target.type === 'post') {
        await seedPost(repositories, POST);
        return;
      }
      expectOk(
        await repositories.videoThreads.create(
          {
            id: THREAD,
            videoId: VIDEO,
            channelId: CHANNEL_ID,
            authorId: AUTHOR,
            authorChannelId: channelOf(AUTHOR),
            anchorMs: 1_000,
            title: 'The cut',
            body: '',
            moderation: {
              moderationState: 'published',
              moderationDisclosure: null,
              heldReason: null,
              looksLikeQuestion: false,
            },
          },
          5
        )
      );
    };

    it.each(targets)(
      'tells the author of a comment about a reply under $name, with its link',
      async ({ target, videoId, link }) => {
        await seedTarget(target);
        const root = await comment(AUTHOR, 'first', null, undefined, target);

        await notify(await comment(FAN, 'agreed', root, undefined, target), target);

        const [row] = await notificationsOf(repositories, AUTHOR);
        expect(row).toMatchObject({
          kind: 'reply',
          videoId,
          payload: { actor: { handle: 'a-fan' }, excerpt: 'agreed', ...link },
        });
        expect(await kindsFor(CREATOR_ID)).toEqual([]);
      }
    );

    it.each(targets)('tells nobody about a root comment under $name', async ({ target }) => {
      await seedTarget(target);

      await notify(await comment(FAN, 'first', null, undefined, target), target);

      expect(await kindsFor(CREATOR_ID)).toEqual([]);
    });

    it.each(targets)('tells nobody about a reply under $name that is held', async ({ target }) => {
      await seedTarget(target);
      const root = await comment(AUTHOR, 'first', null, undefined, target);

      const result = await notify(await comment(FAN, 'agreed', root, held, target), target);

      expect(result.recorded).toBe(0);
      expect(await kindsFor(AUTHOR)).toEqual([]);
    });
  });
});
