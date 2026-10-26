import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotifyCommentJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createNotifyCommentProcessor } from '../notify-comment';
import {
  CREATOR_ID,
  logger,
  notificationsOf,
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

  const comment = async (author: string, content: string, parentId: string | null = null) => {
    commentCount += 1;
    const id = `00000000-0000-7000-8000-${String(900 + commentCount).padStart(12, '0')}`;
    expectOk(
      await repositories.comments.create({
        id,
        videoId: VIDEO,
        authorId: author,
        parentId,
        content,
      })
    );
    return id;
  };

  const notify = async (commentId: string) => {
    const job: QueueJob<NotifyCommentJob> = {
      id: `${commentId}--notify-comment`,
      name: 'notify-comment',
      data: { videoId: VIDEO, commentId },
    };
    return expectOk(await createNotifyCommentProcessor({ repositories, logger })(job));
  };

  const kindsFor = async (id: string) =>
    (await notificationsOf(repositories, id)).map((row) => row.kind);

  const withChannel = async (id: string, handle: string) => {
    expectOk(await repositories.users.upsert({ id, email: `${handle}@example.com` }));
    expectOk(
      await repositories.channels.create({
        id: userId(500 + Number(id.slice(-3))),
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

  it('skips a comment that is gone', async () => {
    const result = await notify('00000000-0000-7000-8000-000000000999');

    expect(result.recorded).toBe(0);
  });
});
