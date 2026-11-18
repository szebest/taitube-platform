import {
  bulkEditCreatorVideos,
  createVideoCorrection,
  deleteVideoCorrection,
  updateVideoCorrection,
  getChapterSuggestions,
  listVideoCorrections,
  listVideoRevisions,
  replaceVideoChapters,
  restoreVideoRevision,
} from '../video-tools';

const ID = '00000000-0000-7000-8000-0000000000a1';

describe('packages/api-contracts: video tools', () => {
  it.each([
    {
      endpoint: bulkEditCreatorVideos,
      method: 'POST',
      path: '/v1/creator/videos/bulk',
      status: 200,
    },
    {
      endpoint: listVideoRevisions,
      method: 'GET',
      path: '/v1/creator/videos/:id/revisions',
      status: 200,
    },
    {
      endpoint: restoreVideoRevision,
      method: 'POST',
      path: '/v1/creator/videos/:id/revisions/:revisionId/restore',
      status: 200,
    },
    {
      endpoint: getChapterSuggestions,
      method: 'GET',
      path: '/v1/creator/videos/:id/chapter-suggestions',
      status: 200,
    },
    { endpoint: replaceVideoChapters, method: 'PUT', path: '/v1/videos/:id/chapters', status: 200 },
    {
      endpoint: listVideoCorrections,
      method: 'GET',
      path: '/v1/videos/:id/corrections',
      status: 200,
    },
    {
      endpoint: createVideoCorrection,
      method: 'POST',
      path: '/v1/videos/:id/corrections',
      status: 201,
    },
    {
      endpoint: updateVideoCorrection,
      method: 'PATCH',
      path: '/v1/videos/:id/corrections/:correctionId',
      status: 200,
    },
    {
      endpoint: deleteVideoCorrection,
      method: 'DELETE',
      path: '/v1/videos/:id/corrections/:correctionId',
      status: 204,
    },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it('lists corrections without a sign-in only', () => {
    expect(listVideoCorrections.anonymous).toBe(true);
    expect('anonymous' in createVideoCorrection).toBe(false);
  });

  it.each([
    {
      scenario: 'one id and a patch',
      body: { ids: [ID], patch: { commentsEnabled: false } },
      ok: true,
    },
    { scenario: 'no ids', body: { ids: [], patch: {} }, ok: false },
    {
      scenario: 'a hundred and one ids',
      body: { ids: Array.from({ length: 101 }, () => ID), patch: {} },
      ok: false,
    },
    { scenario: 'an id that is not a UUID', body: { ids: ['x'], patch: {} }, ok: false },
    {
      scenario: 'a visibility that does not exist',
      body: { ids: [ID], patch: { visibility: 'secret' } },
      ok: false,
    },
  ])('checks the bulk body of $scenario', ({ body, ok }) => {
    expect(bulkEditCreatorVideos.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    {
      scenario: 'a set with a version',
      body: { chapters: [{ startMs: 0, title: 'A' }], version: 1 },
      ok: true,
    },
    { scenario: 'an empty set, which clears', body: { chapters: [], version: 1 }, ok: true },
    { scenario: 'no version', body: { chapters: [] }, ok: false },
    {
      scenario: 'a fractional start',
      body: { chapters: [{ startMs: 1.5, title: 'A' }], version: 1 },
      ok: false,
    },
  ])('checks the chapters body of $scenario', ({ body, ok }) => {
    expect(replaceVideoChapters.body.safeParse(body).success).toBe(ok);
  });

  it('checks the correction body shape', () => {
    expect(
      createVideoCorrection.body.safeParse({ startMs: 0, endMs: 5000, text: 'x' }).success
    ).toBe(true);
    expect(createVideoCorrection.body.safeParse({ startMs: 0, endMs: 5000 }).success).toBe(false);
  });

  it.each([
    { scenario: 'a new text', body: { text: 'Fixed' }, ok: true },
    { scenario: 'a new range', body: { startMs: 1000, endMs: 5000 }, ok: true },
    { scenario: 'nothing', body: {}, ok: false },
  ])('checks the correction changes of $scenario', ({ body, ok }) => {
    expect(updateVideoCorrection.body.safeParse(body).success).toBe(ok);
  });

  it('pages the history with a cursor and an optional limit', () => {
    expect(listVideoRevisions.query.parse({ cursor: 'abc', limit: '5' })).toEqual({
      cursor: 'abc',
      limit: 5,
    });
    expect(listVideoRevisions.query.parse({})).toEqual({});
  });
});
