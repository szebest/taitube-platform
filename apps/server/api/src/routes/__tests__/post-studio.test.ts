import type { PostWriteInput } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  EDITOR,
  MODERATOR,
  type PostsApp,
  seedPostsApp,
  textBody,
} from '../../__tests__/posts-app';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

const POLL: PostWriteInput['payload'] = {
  kind: 'poll',
  question: 'Best?',
  options: ['a', 'b'],
  closesAt: null,
};

describe('post studio routes', () => {
  let testApp: TestApp;
  let ctx: PostsApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    testApp.repositories.clear();
    ctx = await seedPostsApp(testApp);
  });

  const codeOf = (res: { json(): { code: string } }) => res.json().code;
  const poll = async () => {
    const res = await ctx.publish('owner', { payload: POLL, commentsEnabled: true });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  };

  it.each([
    { method: 'GET' as const, url: '/v1/me/channel/posts' },
    { method: 'POST' as const, url: `/v1/me/channel/posts/${ABSENT}/pin` },
    { method: 'DELETE' as const, url: `/v1/me/channel/posts/${ABSENT}/pin` },
    { method: 'GET' as const, url: `/v1/me/channel/posts/${ABSENT}/stats` },
    { method: 'PUT' as const, url: `/v1/posts/${ABSENT}/vote`, payload: { optionIndex: 0 } },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await ctx.call('anonymous', method, url, { payload });

    expect(res.statusCode).toBe(401);
  });

  describe('vote', () => {
    it('takes one vote, shows the results after it and answers the second with 409', async () => {
      const id = await poll();

      const first = await ctx.call('fan', 'PUT', `/v1/posts/${id}/vote`, {
        payload: { optionIndex: 1 },
      });
      const second = await ctx.call('fan', 'PUT', `/v1/posts/${id}/vote`, {
        payload: { optionIndex: 0 },
      });

      expect(first.statusCode).toBe(200);
      expect(first.json().body).toMatchObject({ votedIndex: 1, totalVotes: 1 });
      expect([second.statusCode, codeOf(second)]).toEqual([409, ErrorCodes.POST_ALREADY_VOTED]);
    });

    it.each([
      {
        scenario: 'an option past the list',
        url: () => poll(),
        payload: { optionIndex: 9 },
        status: 422,
      },
      {
        scenario: 'a post that is not there',
        url: async () => ABSENT,
        payload: { optionIndex: 0 },
        status: 404,
      },
      {
        scenario: 'a guest identity',
        url: () => poll(),
        payload: { optionIndex: 0 },
        status: 403,
        who: 'guest' as const,
      },
    ])('refuses $scenario with $status', async ({ url, payload, status, who }) => {
      const id = await url();

      const res = await ctx.call(who ?? 'fan', 'PUT', `/v1/posts/${id}/vote`, { payload });

      expect(res.statusCode).toBe(status);
    });

    it('lets the public post show the results to its creator but never to a reader before voting', async () => {
      const id = await poll();

      const reader = await ctx.call('anonymous', 'GET', `/v1/posts/${id}`);
      const creator = await ctx.call('owner', 'GET', `/v1/posts/${id}`);

      expect(reader.json().body.totalVotes).toBeNull();
      expect(creator.json().body.totalVotes).toBe(0);
    });
  });

  describe('drafts, the studio list and pins', () => {
    it('keeps a draft private to the team and lists it with its status', async () => {
      const draft = await ctx.publish('owner', {
        ...textBody('later'),
        timing: { mode: 'draft' },
      });
      const id = draft.json().id as string;

      const asReader = await ctx.call('anonymous', 'GET', `/v1/posts/${id}`);
      const channelList = await ctx.call('anonymous', 'GET', '/v1/channels/owner/posts');
      const studio = await ctx.call('owner', 'GET', '/v1/me/channel/posts?status=draft');
      const forStranger = await ctx.call('stranger', 'GET', '/v1/me/channel/posts', {
        as: ctx.ownerChannelId,
      });

      expect(draft.statusCode).toBe(201);
      expect(asReader.statusCode).toBe(404);
      expect(channelList.json().items).toEqual([]);
      expect(studio.json().items.map((post: { id: string }) => post.id)).toEqual([id]);
      expect(studio.json().items[0].status).toBe('draft');
      expect(forStranger.statusCode).toBe(403);
    });

    it('pins three, refuses the fourth with 409 and shows the newest pin first', async () => {
      const ids = [
        await ctx.text('owner', 'one'),
        await ctx.text('owner', 'two'),
        await ctx.text('owner', 'three'),
        await ctx.text('owner', 'four'),
      ];
      for (const id of ids.slice(0, 3)) {
        expect((await ctx.call('owner', 'POST', `/v1/me/channel/posts/${id}/pin`)).statusCode).toBe(
          200
        );
      }

      const fourth = await ctx.call('owner', 'POST', `/v1/me/channel/posts/${ids[3]}/pin`);
      const listed = await ctx.call('anonymous', 'GET', '/v1/channels/owner/posts');

      expect([fourth.statusCode, codeOf(fourth)]).toEqual([409, ErrorCodes.POST_PIN_LIMIT]);
      expect(
        listed
          .json()
          .items.slice(0, 3)
          .map((post: { id: string }) => post.id)
      ).toEqual([ids[2], ids[1], ids[0]]);
      expect(listed.json().items[0].pinned).toBe(true);
    });

    it('lets an editor pin and refuses a moderator', async () => {
      await ctx.join('editor', EDITOR);
      await ctx.join('moderator', MODERATOR);
      const id = await ctx.text('owner', 'pin me');

      const editor = await ctx.call('editor', 'POST', `/v1/me/channel/posts/${id}/pin`, {
        as: ctx.ownerChannelId,
      });
      const moderator = await ctx.call('moderator', 'POST', `/v1/me/channel/posts/${id}/pin`, {
        as: ctx.ownerChannelId,
      });

      expect([editor.statusCode, moderator.statusCode]).toEqual([200, 403]);
    });
  });

  describe('stats and beacons', () => {
    it('counts opens once a viewer and day, share clicks every time, and shows them to the team only', async () => {
      const id = await poll();
      await ctx.call('fan', 'PUT', `/v1/posts/${id}/vote`, { payload: { optionIndex: 0 } });

      const opens = [
        await ctx.call('fan', 'POST', `/v1/posts/${id}/open`),
        await ctx.call('fan', 'POST', `/v1/posts/${id}/open`),
        await ctx.call('anonymous', 'POST', `/v1/posts/${id}/open`),
        await ctx.call('anonymous', 'POST', `/v1/posts/${id}/share-click`),
      ];
      const stats = await ctx.call('owner', 'GET', `/v1/me/channel/posts/${id}/stats`);
      const refused = await ctx.call('stranger', 'GET', `/v1/me/channel/posts/${id}/stats`, {
        as: ctx.ownerChannelId,
      });
      const publicPost = await ctx.call('anonymous', 'GET', `/v1/posts/${id}`);

      expect(opens.map((res) => res.statusCode)).toEqual([204, 204, 204, 204]);
      expect(stats.json()).toMatchObject({ opens: 2, shareClicks: 1, votesByOption: [1, 0] });
      expect(refused.statusCode).toBe(403);
      expect(JSON.stringify(publicPost.json())).not.toContain('shareClicks');
    });

    it('answers a beacon on a draft or a missing post with 404', async () => {
      const draft = await ctx.publish('owner', { ...textBody('x'), timing: { mode: 'draft' } });

      const onDraft = await ctx.call('anonymous', 'POST', `/v1/posts/${draft.json().id}/open`);
      const onMissing = await ctx.call('anonymous', 'POST', `/v1/posts/${ABSENT}/share-click`);

      expect([onDraft.statusCode, onMissing.statusCode]).toEqual([404, 404]);
    });
  });
});
