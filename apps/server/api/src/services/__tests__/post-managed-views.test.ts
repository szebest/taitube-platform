import { expectOk } from '@kit/testing/result';
import type { ChannelPost } from '@vp/domain';
import { toManagedPostViews } from '../post-managed-views';
import { NOW, OWNER, postsFixture } from './post-deps';

describe('apps/server/api/services: toManagedPostViews', () => {
  it('adds the status, schedule and creation time to the public view and drops a post of a missing channel', async () => {
    const { repositories, channel } = await postsFixture();
    const base: ChannelPost = {
      id: '00000000-0000-7000-8000-0000000013a1',
      channelId: channel.id,
      authorUserId: OWNER.id,
      payload: { kind: 'text', text: 'later' },
      status: 'scheduled',
      publishAt: new Date(NOW + 1000),
      publishedAt: null,
      pinnedAt: null,
      commentsEnabled: true,
      editedAt: null,
      likeCount: 0,
      commentsCount: 0,
      version: 1,
      createdAt: new Date(NOW - 1000),
    };
    const orphan = { ...base, id: '00000000-0000-7000-8000-0000000013a2', channelId: 'gone' };
    const deps = {
      channels: repositories.channels,
      images: repositories.channelImages,
      videos: repositories.videos,
      playlists: repositories.playlists,
      engagement: repositories.postEngagement,
      cdn: { toString: () => 'https://cdn.test' } as never,
    };

    const views = expectOk(
      await toManagedPostViews(deps, [base, orphan], { user: OWNER, now: new Date(NOW) })
    );

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      id: base.id,
      status: 'scheduled',
      publishAt: new Date(NOW + 1000).toISOString(),
      publishedAt: null,
      createdAt: new Date(NOW - 1000).toISOString(),
      pinned: false,
    });
  });
});
