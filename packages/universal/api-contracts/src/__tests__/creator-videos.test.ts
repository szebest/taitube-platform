import { deleteCreatorVideo, listCreatorVideos, updateCreatorVideo } from '../creator-videos';

const THUMBNAIL_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('packages/api-contracts: creator videos', () => {
  it.each([
    { contract: listCreatorVideos, method: 'GET', path: '/v1/creator/videos' },
    { contract: updateCreatorVideo, method: 'PATCH', path: '/v1/creator/videos/:id' },
    { contract: deleteCreatorVideo, method: 'DELETE', path: '/v1/creator/videos/:id' },
  ])('serves $method $path under the creator prefix', ({ contract, method, path }) => {
    expect(contract).toMatchObject({ method, path });
  });

  it('sorts the library newest first unless asked otherwise', () => {
    expect(listCreatorVideos.query.parse({})).toMatchObject({ sort: 'newest' });
  });

  it.each([
    { name: 'a sort it does not offer', query: { sort: 'oldest' } },
    { name: 'the deleted status, which the library never lists', query: { status: 'DELETED' } },
  ])('rejects $name', ({ query }) => {
    expect(listCreatorVideos.query.safeParse(query).success).toBe(false);
  });

  it('accepts the generated poster as the thumbnail', () => {
    const body = { version: 1, selectedThumbnail: { source: 'poster' } };

    expect(updateCreatorVideo.body.safeParse(body).success).toBe(true);
  });

  it.each([
    {
      name: 'a custom thumbnail, which nothing can upload yet',
      body: {
        version: 1,
        selectedThumbnail: { source: 'custom', thumbnailId: THUMBNAIL_ID, format: 'png' },
      },
    },
    { name: 'no version to check it against', body: { title: 'No version' } },
    { name: 'a category that is not an id', body: { version: 1, categoryId: 'music' } },
  ])('refuses an edit carrying $name', ({ body }) => {
    expect(updateCreatorVideo.body.safeParse(body).success).toBe(false);
  });

  it('clears the category with null', () => {
    expect(updateCreatorVideo.body.parse({ version: 1, categoryId: null }).categoryId).toBeNull();
  });

  it('declares the missing category and the stale version it can answer with', () => {
    expect(updateCreatorVideo.errors[404]).toEqual(['VIDEO_NOT_FOUND', 'CATEGORY_NOT_FOUND']);
    expect(updateCreatorVideo.errors[409]).toEqual(['VERSION_CONFLICT']);
  });
});
