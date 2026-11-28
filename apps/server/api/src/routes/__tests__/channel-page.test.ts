import { type PostsApp, seedPostsApp } from '../../__tests__/posts-app';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

describe('channel page route', () => {
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

  it('answers a guest the default layout, landing on Home with the public tabs', async () => {
    const res = await ctx.call('anonymous', 'GET', '/v1/channels/owner/page');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      channelId: ctx.ownerChannelId,
      revision: null,
      landing: 'home',
      tab: { slug: 'home' },
    });
    expect(res.json().tabs.map((tab: { slug: string }) => tab.slug)).toEqual([
      'home',
      'videos',
      'about',
    ]);
  });

  it.each([
    { scenario: 'a channel that is not there', url: '/v1/channels/nobody/page' },
    { scenario: 'a tab that is not there', url: '/v1/channels/owner/page?tab=nope' },
    { scenario: 'a tab with nothing to show', url: '/v1/channels/owner/page?tab=shorts' },
  ])('answers 404 for $scenario', async ({ url }) => {
    const res = await ctx.call('anonymous', 'GET', url);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CHANNEL_NOT_FOUND');
  });
});
