import { expectOk } from '@kit/testing/result';
import type { PostPayload, Video } from '@vp/domain';
import {
  loadShareSource,
  loadSharedTarget,
  shareCardOf,
  shareRefOf,
  sharedTargetOf,
} from '../post-share-cards';
import { ABSENT, CDN, postsFixture } from './post-deps';

const VIDEO_SHARE = (videoId: string): PostPayload => ({
  kind: 'video_share',
  videoId,
  comment: null,
  startMs: null,
});

const PLAYLIST_SHARE = (playlistId: string): PostPayload => ({
  kind: 'playlist_share',
  playlistId,
  comment: null,
});

async function deps() {
  const fixture = await postsFixture();
  return {
    ...fixture,
    shareDeps: {
      videos: fixture.repositories.videos,
      playlists: fixture.repositories.playlists,
      cdn: CDN,
    },
  };
}

describe('apps/server/api/services: post share cards', () => {
  it.each([
    { scenario: 'text', payload: { kind: 'text', text: 'x' } as PostPayload, ref: null },
    {
      scenario: 'images',
      payload: { kind: 'images', images: [], caption: null } as PostPayload,
      ref: null,
    },
    { scenario: 'a video share', payload: VIDEO_SHARE('v'), ref: { type: 'video', id: 'v' } },
    {
      scenario: 'a playlist share',
      payload: PLAYLIST_SHARE('p'),
      ref: { type: 'playlist', id: 'p' },
    },
  ])('names what $scenario shares', ({ payload, ref }) => {
    expect(shareRefOf(payload)).toEqual(ref);
  });

  it('reads a video as it is, whoever may watch it, and a playlist as an anonymous visitor does', async () => {
    const { shareDeps, video, playlist } = await deps();
    const privateVideo = await video('private');
    const privatePlaylist = await playlist('private');
    const publicPlaylist = await playlist('public');

    const sources = [
      expectOk(await loadShareSource(shareDeps, { type: 'video', id: privateVideo })),
      expectOk(await loadShareSource(shareDeps, { type: 'playlist', id: privatePlaylist })),
      expectOk(await loadShareSource(shareDeps, { type: 'playlist', id: publicPlaylist })),
      expectOk(await loadShareSource(shareDeps, { type: 'video', id: ABSENT })),
    ];

    expect(sources.map((source) => source?.type ?? null)).toEqual([
      'video',
      null,
      'playlist',
      null,
    ]);
  });

  it('carries the visibility and status the share rule reads', async () => {
    const { shareDeps, video } = await deps();
    const id = await video('unlisted', 'PROCESSING');

    expect(expectOk(await loadSharedTarget(shareDeps, VIDEO_SHARE(id)))).toEqual({
      type: 'video',
      id,
      visibility: 'unlisted',
      status: 'PROCESSING',
    });
    expect(sharedTargetOf(null)).toBeNull();
    expect(expectOk(await loadSharedTarget(shareDeps, { kind: 'text', text: 'x' }))).toBeNull();
  });

  it('shows a public ready video with its title and rounded duration, no thumbnail without a poster', async () => {
    const { shareDeps, repositories, video } = await deps();
    const id = await video();
    const stored = expectOk(await repositories.videos.findById(id)) as Video;
    stored.durationMs = 61_500;
    const source = expectOk(await loadShareSource(shareDeps, { type: 'video', id }));

    expect(shareCardOf(VIDEO_SHARE(id), source, CDN)).toEqual({
      type: 'video',
      id,
      title: 'A video',
      thumbnailUrl: null,
      durationSeconds: 62,
    });
  });

  it('points a thumbnail at the CDN when the video has a poster', async () => {
    const { shareDeps, repositories, video } = await deps();
    const id = await video();
    const stored = expectOk(await repositories.videos.findById(id)) as Video;
    stored.posterKey = `videos/${id}/poster.jpg`;
    const source = expectOk(await loadShareSource(shareDeps, { type: 'video', id }));

    expect(shareCardOf(VIDEO_SHARE(id), source, CDN)).toMatchObject({
      thumbnailUrl: `https://cdn.test/videos/${id}/poster.jpg`,
    });
  });

  it('counts the videos of a public playlist', async () => {
    const { shareDeps, repositories, playlist, video } = await deps();
    const id = await playlist();
    expectOk(
      await repositories.playlists.addItem(
        id,
        { id: ABSENT, videoId: await video(), addedBy: null },
        ABSENT
      )
    );
    const source = expectOk(await loadShareSource(shareDeps, { type: 'playlist', id }));

    expect(shareCardOf(PLAYLIST_SHARE(id), source, CDN)).toEqual({
      type: 'playlist',
      id,
      title: 'A playlist',
      itemCount: 1,
    });
  });

  it.each([
    {
      scenario: 'a private video',
      make: (f: Awaited<ReturnType<typeof deps>>) => f.video('private'),
    },
    {
      scenario: 'a video still processing',
      make: (f: Awaited<ReturnType<typeof deps>>) => f.video('public', 'PROCESSING'),
    },
  ])('hides $scenario behind an unavailable card', async (scenario) => {
    const fixture = await deps();
    const id = await scenario.make(fixture);
    const source = expectOk(await loadShareSource(fixture.shareDeps, { type: 'video', id }));

    expect(shareCardOf(VIDEO_SHARE(id), source, CDN)).toEqual({ type: 'unavailable' });
  });

  it('hides a target that is gone and an unlisted playlist', async () => {
    const { shareDeps, playlist } = await deps();
    const unlisted = await playlist('unlisted');
    const source = expectOk(await loadShareSource(shareDeps, { type: 'playlist', id: unlisted }));

    expect(shareCardOf(PLAYLIST_SHARE(unlisted), source, CDN)).toEqual({ type: 'unavailable' });
    expect(shareCardOf(VIDEO_SHARE(ABSENT), null, CDN)).toEqual({ type: 'unavailable' });
  });
});
