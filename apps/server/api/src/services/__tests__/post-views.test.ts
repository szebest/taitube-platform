import { expectOk } from '@kit/testing/result';
import type { ChannelPostEntry, PostPayload } from '@vp/domain';
import { uuidv7 } from 'uuidv7';
import { postAuditOf } from '../post-audit';
import { toPostViews } from '../post-views';
import { ABSENT, CDN, NOW, OWNER, postsFixture } from './post-deps';

const VIEWER = { user: null, now: new Date(NOW) };

async function setup() {
  const fixture = await postsFixture();
  const { repositories } = fixture;
  const viewDeps = {
    channels: repositories.channels,
    images: repositories.channelImages,
    videos: repositories.videos,
    playlists: repositories.playlists,
    engagement: repositories.postEngagement,
    cdn: CDN,
  };
  const entryOf = async (payload: PostPayload): Promise<ChannelPostEntry> => {
    const id = uuidv7();
    const post = expectOk(
      await repositories.channelPosts.publish(
        {
          id,
          channelId: fixture.channel.id,
          authorUserId: OWNER.id,
          payload,
          commentsEnabled: true,
        },
        postAuditOf('post.published', OWNER, fixture.channel.id, { id, payload })
      )
    );
    return { post, likedByViewer: false };
  };
  return { ...fixture, viewDeps, entryOf };
}

describe('apps/server/api/services: toPostViews', () => {
  it('answers nothing without reading anything', async () => {
    const { viewDeps, repositories } = await setup();
    const channels = vi.spyOn(repositories.channels, 'findByIds');

    expect(expectOk(await toPostViews(viewDeps, [], VIEWER))).toEqual([]);
    expect(channels).not.toHaveBeenCalled();
  });

  it('leaves out an image whose upload is not ready, and keeps the others in order', async () => {
    const { viewDeps, entryOf, readyImage, repositories, channel } = await setup();
    const ready = await readyImage();
    const pending = ABSENT;
    expectOk(
      await repositories.channelImages.create({
        id: pending,
        channelId: channel.id,
        uploadedBy: OWNER.id,
        kind: 'post-image',
        contentType: 'image/png',
        sizeBytes: 10,
      })
    );
    const entry = await entryOf({
      kind: 'images',
      images: [
        { uploadId: pending, alt: 'not yet' },
        { uploadId: ready, alt: 'ready' },
      ],
      caption: 'c',
    });

    const [view] = expectOk(await toPostViews(viewDeps, [entry], VIEWER));

    expect(view?.body).toEqual({
      kind: 'images',
      caption: 'c',
      images: [
        {
          uploadId: ready,
          alt: 'ready',
          urls: {
            w640: `https://cdn.test/${ready}-640.webp`,
            w1280: `https://cdn.test/${ready}-1280.webp`,
          },
        },
      ],
    });
  });

  it('reads each channel, each channel images and each shared video once for a whole page', async () => {
    const { viewDeps, entryOf, video, repositories } = await setup();
    const shared = await video();
    const entries = [
      await entryOf({ kind: 'video_share', videoId: shared, comment: null, startMs: null }),
      await entryOf({ kind: 'video_share', videoId: shared, comment: 'again', startMs: 3 }),
      await entryOf({ kind: 'text', text: 'plain' }),
    ];
    const channels = vi.spyOn(repositories.channels, 'findByIds');
    const videos = vi.spyOn(repositories.videos, 'findById');
    const images = vi.spyOn(repositories.channelImages, 'findReadyImages');

    const views = expectOk(await toPostViews(viewDeps, entries, VIEWER));

    expect(views.map(({ id }) => id)).toEqual(entries.map(({ post }) => post.id));
    expect([channels, videos, images].map((spy) => spy.mock.calls.length)).toEqual([1, 1, 0]);
  });

  it('shows the channel of each post and never the author', async () => {
    const { viewDeps, entryOf, channel } = await setup();
    const entry = await entryOf({ kind: 'text', text: 'x' });

    const [view] = expectOk(await toPostViews(viewDeps, [entry], VIEWER));

    expect(view?.channel).toEqual({
      id: channel.id,
      handle: 'owner',
      displayName: 'Owner',
      avatarUrl: null,
    });
    expect(JSON.stringify(view)).not.toContain(OWNER.id);
  });

  it('leaves out a post whose channel is gone', async () => {
    const { viewDeps, entryOf } = await setup();
    const entry = await entryOf({ kind: 'text', text: 'x' });
    const orphan = { ...entry, post: { ...entry.post, channelId: ABSENT } };

    expect(expectOk(await toPostViews(viewDeps, [orphan], VIEWER))).toEqual([]);
  });

  it('reports what the viewer did and when the post was edited', async () => {
    const { viewDeps, entryOf } = await setup();
    const entry = await entryOf({ kind: 'text', text: 'x' });
    const edited = {
      post: { ...entry.post, editedAt: new Date(), likeCount: 3, commentsCount: 2, version: 4 },
      likedByViewer: true,
    };

    const [view] = expectOk(await toPostViews(viewDeps, [edited], VIEWER));

    expect(view).toMatchObject({
      likedByViewer: true,
      isEdited: true,
      likeCount: 3,
      commentsCount: 2,
      version: 4,
      publishedAt: entry.post.publishedAt?.toISOString(),
    });
  });
});
