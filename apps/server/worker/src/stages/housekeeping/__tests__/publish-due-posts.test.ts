import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { runPublishDuePosts } from '../publish-due-posts';

const AT = Date.parse('2026-03-10T12:00:00.000Z');
const USER = '00000000-0000-7000-8000-00000000b001';
const CHANNEL = '00000000-0000-7000-8000-00000000b002';

async function schedule(repositories: InMemoryRepositories, n: number, minutesFromAt: number) {
  const id = `00000000-0000-7000-8000-00000000b1${String(n).padStart(2, '0')}`;
  expectOk(
    await repositories.channelPosts.saveUnpublished(
      {
        id,
        channelId: CHANNEL,
        authorUserId: USER,
        payload: { kind: 'text', text: `post ${n}` },
        commentsEnabled: true,
        status: 'scheduled',
        publishAt: new Date(AT + minutesFromAt * 60_000),
      },
      {
        channelId: CHANNEL,
        actorUserId: USER,
        action: 'post.updated',
        targetType: 'post',
        targetId: id,
        meta: { kind: 'text' },
      }
    )
  );
  return id;
}

describe('housekeeping: publish-due-posts', () => {
  it('publishes the posts that came due and leaves the ones still ahead', async () => {
    const repositories = new InMemoryRepositories();
    const due = await schedule(repositories, 1, -5);
    const ahead = await schedule(repositories, 2, 5);

    const result = expectOk(
      await runPublishDuePosts({ repositories, now: () => AT, scanLimit: 10 })
    );

    expect(result).toEqual({ publishedCount: 1 });
    expect(expectOk(await repositories.channelPosts.findById(due))).toMatchObject({
      status: 'published',
    });
    expect(expectOk(await repositories.channelPosts.findById(ahead))).toMatchObject({
      status: 'scheduled',
    });
  });

  it('publishes once and tells subscribers once however many runs find the post', async () => {
    const repositories = new InMemoryRepositories();
    await schedule(repositories, 1, -1);
    const run = async () =>
      expectOk(await runPublishDuePosts({ repositories, now: () => AT, scanLimit: 10 }));

    const results = await Promise.all([run(), run(), run()]);

    expect(results.reduce((sum, result) => sum + result.publishedCount, 0)).toBe(1);
    expect(expectOk(await repositories.outbox.claimBatch(10))).toHaveLength(1);
  });

  it('takes at most the scan limit in one run and the rest in the next', async () => {
    const repositories = new InMemoryRepositories();
    await schedule(repositories, 1, -3);
    await schedule(repositories, 2, -2);
    await schedule(repositories, 3, -1);
    const run = async () =>
      expectOk(await runPublishDuePosts({ repositories, now: () => AT, scanLimit: 2 }));

    expect([await run(), await run(), await run()]).toEqual([
      { publishedCount: 2 },
      { publishedCount: 1 },
      { publishedCount: 0 },
    ]);
  });
});
