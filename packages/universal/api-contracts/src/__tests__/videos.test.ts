import {
  ListVideosQuerySchema,
  UpdateVideoMetadataSchema,
  deleteVideo,
  getVideo,
  listVideos,
  reprocessVideo,
  updateVideo,
} from '../videos';

function cursor(payload: unknown): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('packages/api-contracts: videos', () => {
  it.each([
    [listVideos, 'GET', '/v1/videos', 200],
    [getVideo, 'GET', '/v1/videos/:id', 200],
    [updateVideo, 'PATCH', '/v1/videos/:id', 200],
    [deleteVideo, 'DELETE', '/v1/videos/:id', 202],
    [reprocessVideo, 'POST', '/v1/videos/:id/reprocess', 202],
  ])('declares %#: $method $path', (contract, method, path, status) => {
    expect(contract.method).toBe(method);
    expect(contract.path).toBe(path);
    expect(contract.status).toBe(status);
  });

  it('accepts a keyset cursor and rejects anything else', () => {
    const valid = cursor({ id: 'v1', createdAt: '2026-01-01T00:00:00.000Z' });

    expect(ListVideosQuerySchema.parse({ cursor: valid }).cursor).toBe(valid);
    expect(ListVideosQuerySchema.safeParse({ cursor: 'nonsense' }).success).toBe(false);
    expect(ListVideosQuerySchema.safeParse({ cursor: cursor({ id: 'v1' }) }).success).toBe(false);
  });

  it('requires the expected version on a metadata edit', () => {
    expect(UpdateVideoMetadataSchema.safeParse({ title: 'New' }).success).toBe(false);
    expect(UpdateVideoMetadataSchema.parse({ title: 'New', version: 3 })).toEqual({
      title: 'New',
      version: 3,
    });
  });
});
