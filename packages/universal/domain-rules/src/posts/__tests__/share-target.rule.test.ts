import { isErr, isOk } from '@kit/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type SharedTarget, decidePostShare } from '../share-target.rule';

const video = (
  overrides: Partial<Extract<SharedTarget, { type: 'video' }>> = {}
): SharedTarget => ({
  type: 'video',
  id: 'v-1',
  visibility: 'public',
  status: 'READY',
  ...overrides,
});
const playlist = (
  overrides: Partial<Extract<SharedTarget, { type: 'playlist' }>> = {}
): SharedTarget => ({ type: 'playlist', id: 'pl-1', visibility: 'public', ...overrides });

const videoShare: PostPayload = {
  kind: 'video_share',
  videoId: 'v-1',
  comment: null,
  startMs: null,
};
const playlistShare: PostPayload = { kind: 'playlist_share', playlistId: 'pl-1', comment: null };

describe('@vp/domain-rules: decidePostShare', () => {
  it.each<{ name: string; payload: PostPayload; shared: SharedTarget | null }>([
    { name: 'a text post', payload: { kind: 'text', text: 'hi' }, shared: null },
    {
      name: 'an images post',
      payload: { kind: 'images', images: [{ uploadId: 'u-1', alt: 'cat' }], caption: null },
      shared: null,
    },
    { name: 'a public ready video', payload: videoShare, shared: video() },
    { name: 'a public playlist', payload: playlistShare, shared: playlist() },
  ])('allows $name', ({ payload, shared }) => {
    expect(isOk(decidePostShare({ payload, shared }))).toBe(true);
  });

  it.each<{
    name: string;
    payload: PostPayload;
    shared: SharedTarget | null;
    expected: { shared: string; id: string };
  }>([
    {
      name: 'a private video',
      payload: videoShare,
      shared: video({ visibility: 'private' }),
      expected: { shared: 'video', id: 'v-1' },
    },
    {
      name: 'an unlisted video',
      payload: videoShare,
      shared: video({ visibility: 'unlisted' }),
      expected: { shared: 'video', id: 'v-1' },
    },
    {
      name: 'a public video still processing',
      payload: videoShare,
      shared: video({ status: 'PROCESSING' }),
      expected: { shared: 'video', id: 'v-1' },
    },
    {
      name: 'a missing video',
      payload: videoShare,
      shared: null,
      expected: { shared: 'video', id: 'v-1' },
    },
    {
      name: 'a playlist where a video is shared',
      payload: videoShare,
      shared: playlist(),
      expected: { shared: 'video', id: 'v-1' },
    },
    {
      name: 'another video than the one shared',
      payload: videoShare,
      shared: video({ id: 'v-2' }),
      expected: { shared: 'video', id: 'v-1' },
    },
    {
      name: 'a private playlist',
      payload: playlistShare,
      shared: playlist({ visibility: 'private' }),
      expected: { shared: 'playlist', id: 'pl-1' },
    },
    {
      name: 'an unlisted playlist',
      payload: playlistShare,
      shared: playlist({ visibility: 'unlisted' }),
      expected: { shared: 'playlist', id: 'pl-1' },
    },
    {
      name: 'a missing playlist',
      payload: playlistShare,
      shared: null,
      expected: { shared: 'playlist', id: 'pl-1' },
    },
    {
      name: 'a video where a playlist is shared',
      payload: playlistShare,
      shared: video(),
      expected: { shared: 'playlist', id: 'pl-1' },
    },
  ])('refuses $name as not public', ({ payload, shared, expected }) => {
    const result = decidePostShare({ payload, shared });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_SHARE_NOT_PUBLIC,
      ...expected,
    });
  });
});
