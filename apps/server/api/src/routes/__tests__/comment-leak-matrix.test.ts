import type { CommentActionBody } from '@vp/api-contracts';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import { expectOk } from '@vp/testing/result';
import {
  AS,
  AUTHOR,
  CREATOR,
  type CommentsApp,
  buildCommentsApp,
} from '../../__tests__/comments-app';

type Silent = 'held' | 'hidden' | 'removed' | 'shadow';
type Viewer = 'anonymous' | 'stranger' | 'author' | 'moderator';

const HEADERS = {
  anonymous: {},
  stranger: AS.stranger,
  author: AS.author,
  moderator: AS.creator,
} satisfies Record<Viewer, Record<string, string>>;

const SILENT_ACTION = {
  held: { action: 'hold', disclosure: 'silent' },
  hidden: { action: 'hide', disclosure: 'silent' },
  removed: { action: 'remove', disclosure: 'silent' },
} satisfies Record<Exclude<Silent, 'shadow'>, CommentActionBody>;

const STATES: Silent[] = ['held', 'hidden', 'removed', 'shadow'];
const VIEWERS: Viewer[] = ['anonymous', 'stranger', 'author', 'moderator'];

describe('no leak of silent state: state x viewer x read path', () => {
  let ctx: CommentsApp;
  let channelId: string;
  let baseline: string;
  let subject: string;
  let reply: string;

  const apply = async (state: Silent) => {
    const res =
      state === 'shadow'
        ? await ctx.app.inject({
            method: 'PUT',
            url: `/v1/me/channel/restrictions/${AUTHOR}`,
            headers: { ...AS.creator, [CHANNEL_HEADER]: channelId },
            payload: { action: 'shadow_ban' },
          })
        : await ctx.app.inject({
            method: 'POST',
            url: `/v1/comments/${subject}/moderate`,
            headers: AS.creator,
            payload: SILENT_ACTION[state],
          });
    expect(res.statusCode).toBe(200);
  };
  const visibleToAuthor = (state: Silent) => state !== 'removed';
  const sees = (state: Silent, viewer: Viewer) => viewer === 'author' && visibleToAuthor(state);
  const listAs = async (viewer: Viewer) => (await ctx.list('', HEADERS[viewer])).json();
  const eventTypes = async () =>
    expectOk(await ctx.repositories.userEvents.listFrom(CREATOR, 0, 100)).map(({ type }) => type);

  beforeEach(async () => {
    ctx = await buildCommentsApp();
    channelId = expectOk(
      await ctx.repositories.channels.create({
        userId: CREATOR,
        handle: 'creator',
        displayName: 'Creator',
      })
    ).id;
    baseline = await ctx.comment('stranger', 'public');
    subject = await ctx.comment('author', 'the subject');
    reply = await ctx.comment('author', 'a reply of the subject author', baseline);
    await listAs('anonymous');
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each(STATES.flatMap((state) => VIEWERS.map((viewer) => ({ state, viewer }))))(
    'lists a silently $state comment to $viewer only as its author, and counts it likewise, from the warm cache too',
    async ({ state, viewer }) => {
      await apply(state);

      const read = await listAs(viewer);

      const ids = read.items.map((item: { id: string }) => item.id);
      expect(ids.includes(subject)).toBe(sees(state, viewer));
      const mine = viewer === 'author';
      expect(read.total).toBe(mine ? (state === 'removed' ? 2 : 3) : state === 'shadow' ? 1 : 2);
    }
  );

  it.each(STATES.flatMap((state) => VIEWERS.map((viewer) => ({ state, viewer }))))(
    'answers the replies of a $state comment as nothing to $viewer, who is not its author',
    async ({ state, viewer }) => {
      await apply(state);

      const res = await ctx.app.inject({
        method: 'GET',
        url: `/v1/comments/${subject}/replies`,
        headers: HEADERS[viewer],
      });

      expect(res.statusCode).toBe(sees(state, viewer) ? 200 : 404);
    }
  );

  it.each(STATES.flatMap((state) => VIEWERS.map((viewer) => ({ state, viewer }))))(
    'lists the reply of a $state author under a public root to $viewer only as that author',
    async ({ state, viewer }) => {
      await apply(state);

      const res = await ctx.app.inject({
        method: 'GET',
        url: `/v1/comments/${baseline}/replies`,
        headers: HEADERS[viewer],
      });

      const ids = res.json().items.map((item: { id: string }) => item.id);
      const shadowed = state === 'shadow';
      expect(ids.includes(reply)).toBe(viewer === 'author' || !shadowed);
    }
  );

  it.each(
    STATES.flatMap((state) =>
      (['anonymous', 'stranger', 'author'] as const).map((viewer) => ({ state, viewer }))
    )
  )('refuses the creator inbox of a $state comment to $viewer', async ({ state, viewer }) => {
    await apply(state);

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/creator/comments?filter=all',
      headers: { ...HEADERS[viewer], [CHANNEL_HEADER]: channelId },
    });

    expect([401, 403]).toContain(res.statusCode);
  });

  it.each(STATES.filter((state) => state !== 'removed'))(
    'keeps a $state comment in the inbox of the moderators, with its state',
    async (state) => {
      await apply(state);

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/v1/creator/comments?filter=all',
        headers: AS.creator,
      });

      const found = res.json().items.find((item: { id: string }) => item.id === subject);
      expect(found).toMatchObject(state === 'shadow' ? { status: 'published' } : { status: state });
    }
  );

  it.each(STATES)(
    'emits no event and takes back the unread notification for a silent %s',
    async (state) => {
      expectOk(
        await ctx.repositories.notifications.record({
          userId: CREATOR,
          kind: 'comment',
          actorChannelId: null,
          videoId: expectOk(await ctx.repositories.comments.findById(subject))?.videoId ?? null,
          commentId: subject,
          groupKey: null,
          payload: { actor: null, videoTitle: 'Open', excerpt: 'the subject', outcome: null },
        })
      );
      const before = (await eventTypes()).length;
      const unreadBefore = expectOk(await ctx.repositories.notifications.unreadCount(CREATOR));

      await apply(state);

      const announced = (await eventTypes()).slice(before);
      expect(announced.filter((type) => type !== 'notification.read')).toEqual([]);
      expect(unreadBefore).toBe(1);
      expect(expectOk(await ctx.repositories.notifications.unreadCount(CREATOR))).toBe(0);
    }
  );
});
