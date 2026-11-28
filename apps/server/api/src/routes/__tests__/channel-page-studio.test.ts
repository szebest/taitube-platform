import { type ChannelLayout, type CustomTab, standardChannelLayout } from '@vp/domain';
import {
  ABSENT,
  EDITOR,
  MODERATOR,
  PRIVATE_VIDEO,
  type PostsApp,
  seedPostsApp,
} from '../../__tests__/posts-app';
import { type TestApp, buildTestApp } from '../../__tests__/test-app';

const EVERYONE = { audience: 'everyone', from: null, to: null, locales: [] };

function episodes(slug = 'episodes'): CustomTab {
  return {
    kind: 'custom',
    id: 'episodes',
    title: 'Episodes',
    hidden: false,
    visibility: EVERYONE,
    slug,
    icon: null,
    description: 'All of them',
    header: null,
    sections: [],
  } as CustomTab;
}

const withTabs = (...tabs: CustomTab[]): ChannelLayout => {
  const base = standardChannelLayout();
  return { ...base, tabs: [...base.tabs, ...tabs] };
};

describe('channel page studio routes', () => {
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
    await ctx.join('editor', EDITOR);
    await ctx.join('moderator', MODERATOR);
  });

  const call = (
    who: 'owner' | 'editor' | 'moderator' | 'stranger',
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: object
  ) => ctx.call(who, method, url, { payload, as: ctx.ownerChannelId });
  const save = (document: ChannelLayout, version: number, who: 'owner' | 'editor' = 'owner') =>
    call(who, 'PUT', '/v1/me/channel/page/draft', { document, version });
  const publish = async (document: ChannelLayout, version: number) => {
    expect((await save(document, version)).statusCode).toBe(200);
    return call('owner', 'POST', '/v1/me/channel/page/publish', { version: version + 1 });
  };

  it.each([
    { method: 'GET' as const, url: '/v1/me/channel/page/draft' },
    {
      method: 'PUT' as const,
      url: '/v1/me/channel/page/draft',
      payload: { document: standardChannelLayout(), version: 0 },
    },
    { method: 'POST' as const, url: '/v1/me/channel/page/publish', payload: { version: 1 } },
    { method: 'GET' as const, url: '/v1/me/channel/page/schedule' },
    {
      method: 'POST' as const,
      url: '/v1/me/channel/page/schedule',
      payload: { publishAt: '2030-01-01T00:00:00.000Z', source: 'draft' },
    },
    { method: 'DELETE' as const, url: `/v1/me/channel/page/schedule/${ABSENT}` },
    { method: 'GET' as const, url: '/v1/me/channel/page/revisions' },
    { method: 'POST' as const, url: `/v1/me/channel/page/revisions/${ABSENT}/restore` },
    { method: 'GET' as const, url: '/v1/me/channel/page/preview?as=visitor' },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await ctx.call('anonymous', method, url, { payload });

    expect(res.statusCode).toBe(401);
  });

  it.each([
    { who: 'owner' as const, status: 200 },
    { who: 'editor' as const, status: 200 },
    { who: 'moderator' as const, status: 403 },
    { who: 'stranger' as const, status: 403 },
  ])('answers $who reading and saving the draft with $status', async ({ who, status }) => {
    const read = await call(who, 'GET', '/v1/me/channel/page/draft');
    const written = await save(standardChannelLayout(), 0, who as 'owner');
    const previewed = await call(who, 'GET', '/v1/me/channel/page/preview?as=visitor');

    expect([read.statusCode, written.statusCode, previewed.statusCode]).toEqual([
      status,
      status,
      status,
    ]);
  });

  it('answers a second member saving under the version they read with a conflict', async () => {
    expect((await save(standardChannelLayout(), 0, 'owner')).statusCode).toBe(200);

    const stale = await save(withTabs(episodes()), 0, 'editor');
    const current = await save(withTabs(episodes()), 1, 'editor');

    expect(stale.statusCode).toBe(409);
    expect(stale.json().code).toBe('VERSION_CONFLICT');
    expect(current.json()).toMatchObject({ version: 2 });
  });

  it.each([
    {
      scenario: 'an eleventh tab',
      document: () =>
        withTabs(
          ...Array.from({ length: 5 }, (_, i) => ({ ...episodes(`show-${i}`), id: `t${i}` }))
        ),
      code: 'LAYOUT_LIMIT_EXCEEDED',
    },
    {
      scenario: 'a reserved slug',
      document: () => withTabs(episodes('community')),
      code: 'LAYOUT_SLUG_INVALID',
    },
  ])('refuses $scenario with $code', async ({ document, code }) => {
    const res = await save(document(), 0);

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe(code);
  });

  it('publishes the draft so the public page serves it, and shows it in the revision list', async () => {
    const published = await publish(withTabs(episodes()), 0);
    const page = await ctx.call('anonymous', 'GET', '/v1/channels/owner/page?tab=episodes');
    const revisions = await call('owner', 'GET', '/v1/me/channel/page/revisions');

    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ version: 1 });
    expect(page.json()).toMatchObject({ revision: 1, tab: { slug: 'episodes' } });
    expect(revisions.json().items).toHaveLength(1);
  });

  it('refuses a publish that points at a private video, and one under a stale version', async () => {
    const layout = standardChannelLayout();
    const home = layout.tabs[0];
    const document: ChannelLayout = {
      ...layout,
      tabs: [
        {
          ...(home as Extract<ChannelLayout['tabs'][number], { kind: 'home' }>),
          sections: [
            {
              kind: 'content',
              id: 'picks',
              source: { type: 'picked', items: [{ kind: 'video', id: PRIVATE_VIDEO }] },
              filters: { tags: [], dateRange: null, duration: null, hideWatched: false },
              sort: 'manual',
              layout: { type: 'shelf' },
              itemCount: 6,
              seeAll: null,
              presentation: {
                title: null,
                subtitle: null,
                background: null,
                accent: null,
                density: 'comfortable',
                show: { duration: true, views: true, date: true },
              },
              visibility: { audience: 'everyone', from: null, to: null, locales: [] },
              hideWhenEmpty: true,
            },
          ],
        },
        ...layout.tabs.slice(1),
      ],
    };
    await save(document, 0);

    const refused = await call('owner', 'POST', '/v1/me/channel/page/publish', { version: 1 });
    const stale = await call('owner', 'POST', '/v1/me/channel/page/publish', { version: 9 });

    expect(refused.statusCode).toBe(422);
    expect(refused.json().code).toBe('LAYOUT_REFERENCE_INVALID');
    expect(stale.statusCode).toBe(409);
  });

  it('restores an earlier layout as a new revision', async () => {
    await publish(withTabs(episodes()), 0);
    await publish(standardChannelLayout(), 1);
    const listed = await call('owner', 'GET', '/v1/me/channel/page/revisions');
    const first = listed.json().items.find((item: { version: number }) => item.version === 1);

    const restored = await call(
      'owner',
      'POST',
      `/v1/me/channel/page/revisions/${first.id}/restore`
    );
    const page = await ctx.call('anonymous', 'GET', '/v1/channels/owner/page?tab=episodes');

    expect(restored.json()).toMatchObject({ version: 3, restoredFromVersion: 1 });
    expect(page.statusCode).toBe(200);
  });

  it('queues the published layout for later and cancels it once', async () => {
    await publish(standardChannelLayout(), 0);
    const later = new Date(Date.now() + 3_600_000).toISOString();

    const past = await call('owner', 'POST', '/v1/me/channel/page/schedule', {
      publishAt: new Date(Date.now() - 1000).toISOString(),
      source: 'published',
    });
    const queued = await call('owner', 'POST', '/v1/me/channel/page/schedule', {
      publishAt: later,
      source: 'published',
    });
    const url = `/v1/me/channel/page/schedule/${queued.json().id}`;
    const cancelled = await call('owner', 'DELETE', url);
    const again = await call('owner', 'DELETE', url);

    expect(past.json().code).toBe('LAYOUT_SCHEDULE_INVALID');
    expect(queued.statusCode).toBe(201);
    expect(cancelled.json()).toMatchObject({ status: 'cancelled' });
    expect(again.statusCode).toBe(404);
  });

  it('previews the draft before it is published, without caching it', async () => {
    await save(withTabs(episodes()), 0);

    const preview = await call(
      'owner',
      'GET',
      '/v1/me/channel/page/preview?as=visitor&tab=episodes'
    );
    const live = await ctx.call('anonymous', 'GET', '/v1/channels/owner/page?tab=episodes');

    expect(preview.statusCode).toBe(200);
    expect(preview.headers['cache-control']).toBe('no-store');
    expect(live.statusCode).toBe(404);
  });
});
