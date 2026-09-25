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

  it.each([
    { name: 'the generated poster', selectedThumbnail: { source: 'poster' } },
    {
      name: 'a custom image by id and format',
      selectedThumbnail: { source: 'custom', thumbnailId: THUMBNAIL_ID, format: 'webp' },
    },
  ])('accepts $name as the thumbnail', ({ selectedThumbnail }) => {
    expect(updateCreatorVideo.body.safeParse({ version: 1, selectedThumbnail }).success).toBe(true);
  });

  it.each([
    {
      name: 'a custom thumbnail named by a key, which a client never chooses',
      body: { version: 1, selectedThumbnail: { source: 'custom', key: 'videos/x/thumbs/a.jpg' } },
    },
    { name: 'an edit without the version it was made against', body: { title: 'No version' } },
    { name: 'a category that is not an id', body: { version: 1, categoryId: 'music' } },
  ])('rejects $name', ({ body }) => {
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
