import { buildPath, defineEndpoint, isEndpoint } from '../endpoint';
import { VideoIdParamSchema, VideoSchema } from '../video-resource';
import { getVideo } from '../videos';

describe('packages/api-contracts: endpoint', () => {
  it('returns the contract it was given', () => {
    const contract = defineEndpoint({
      method: 'GET',
      path: '/v1/videos/:id',
      tag: 'Videos',
      summary: 'summary',
      description: 'description',
      params: VideoIdParamSchema,
      status: 200,
      result: VideoSchema,
      errors: {},
    });

    expect(contract.method).toBe('GET');
    expect(contract.path).toBe('/v1/videos/:id');
  });

  it.each([
    ['/v1/videos', {}, '/v1/videos'],
    ['/v1/videos/:id', { id: 'abc' }, '/v1/videos/abc'],
    ['/v1/videos/:id/reactions/me', { id: 'a b' }, '/v1/videos/a%20b/reactions/me'],
    ['/v1/uploads/:uploadId/parts', { uploadId: 7 }, '/v1/uploads/7/parts'],
  ])('fills %s', (path, params, expected) => {
    expect(buildPath(path, params)).toBe(expected);
  });

  it('refuses to build a path with a missing parameter', () => {
    expect(() => buildPath('/v1/videos/:id')).toThrow(/Missing path parameter "id"/);
  });

  it.each([
    { scenario: 'an endpoint contract', value: getVideo, expected: true },
    { scenario: 'a schema', value: VideoSchema, expected: false },
    { scenario: 'a constant', value: ['recent', 'popular'], expected: false },
    { scenario: 'null', value: null, expected: false },
    {
      scenario: 'an object whose result is not a schema',
      value: { method: 'GET', path: '/v1/videos', result: {} },
      expected: false,
    },
  ])('tells $scenario apart from an endpoint', ({ value, expected }) => {
    expect(isEndpoint(value)).toBe(expected);
  });
});
