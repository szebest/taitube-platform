import { expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { channelImageUploadKey } from '@vp/storage';
import { type LibraryApp, OWNER, buildLibraryApp } from '../../__tests__/library-app';
import { seedPrimaryChannel } from '../../__tests__/test-app';

const REQUEST = { contentType: 'image/png', sizeBytes: 4096 };
const CROP = { x: 0, y: 0, width: 1600, height: 900 };

describe('playlist cover routes', () => {
  let ctx: LibraryApp;
  let playlistId: string;
  let channelId: string;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    channelId = await seedPrimaryChannel(ctx.repositories, OWNER);
    playlistId = await ctx.playlist('owner', { title: 'Mix', visibility: 'public' });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('presigns, queues and then sets an uploaded cover as the custom cover', async () => {
    const prepared = await ctx.call(
      'owner',
      'POST',
      `/v1/playlists/${playlistId}/cover/upload`,
      REQUEST
    );
    const { uploadId } = prepared.json();
    expectOk(
      await ctx.storage.uploadObject({
        bucket: 'raw',
        key: channelImageUploadKey(channelId, 'playlist-cover', uploadId),
        body: Buffer.alloc(REQUEST.sizeBytes),
        contentType: REQUEST.contentType,
      })
    );

    const queued = await ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/cover/complete`, {
      uploadId,
      width: 1600,
      height: 900,
      crop: CROP,
    });
    expectOk(await ctx.repositories.channelImages.commit(uploadId, 'https://cdn.example/c.webp'));
    const updated = await ctx.call('owner', 'PATCH', `/v1/playlists/${playlistId}`, {
      coverUploadId: uploadId,
    });

    expect(prepared.statusCode).toBe(201);
    expect(queued.statusCode).toBe(202);
    expect(queued.json()).toEqual({ uploadId, version: 1 });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().cover).toMatchObject({ mode: 'custom', videoId: null });
    expect(updated.json().thumbnailUrl).toContain(`${channelId}/playlist-cover/v1/1280.webp`);
  });

  it.each([
    { who: 'anonymous' as const, status: 401, code: ErrorCodes.UNAUTHORIZED },
    { who: 'stranger' as const, status: 403, code: ErrorCodes.FORBIDDEN },
  ])('refuses a cover upload by $who with $status', async ({ who, status, code }) => {
    const res = await ctx.call(who, 'POST', `/v1/playlists/${playlistId}/cover/upload`, REQUEST);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });

  it('answers 422 for a cover over 2 MB', async () => {
    const res = await ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/cover/upload`, {
      ...REQUEST,
      sizeBytes: 2 * 1024 * 1024 + 1,
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe(ErrorCodes.UPLOAD_TOO_LARGE);
  });
});
