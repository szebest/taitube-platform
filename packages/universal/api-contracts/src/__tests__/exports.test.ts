import { ErrorCodes } from '@vp/errors';
import {
  createChannelExport,
  deleteChannelExport,
  exportColumns,
  getChannelExport,
  listChannelExports,
} from '../exports';

describe('packages/api-contracts: exports', () => {
  it.each([
    { endpoint: createChannelExport, method: 'POST', path: '/v1/me/channel/exports', status: 202 },
    { endpoint: listChannelExports, method: 'GET', path: '/v1/me/channel/exports', status: 200 },
    { endpoint: getChannelExport, method: 'GET', path: '/v1/me/channel/exports/:id', status: 200 },
    {
      endpoint: deleteChannelExport,
      method: 'DELETE',
      path: '/v1/me/channel/exports/:id',
      status: 204,
    },
  ])('declares $method $path on the acting channel', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status, channelScoped: true });
  });

  it('refuses a second export with 409 and the eleventh of a day with 429', () => {
    expect(createChannelExport.errors).toMatchObject({
      409: [ErrorCodes.EXPORT_IN_PROGRESS],
      429: [ErrorCodes.EXPORT_DAILY_LIMIT],
    });
  });

  it.each([
    { scenario: 'a kind and a format', body: { kind: 'comments', format: 'csv' }, ok: true },
    {
      scenario: 'a range',
      body: {
        kind: 'channel_analytics',
        format: 'json',
        params: { from: '2026-01-01', to: '2026-01-31' },
      },
      ok: true,
    },
    {
      scenario: 'a range that ends before it starts',
      body: {
        kind: 'video_analytics',
        format: 'csv',
        params: { from: '2026-02-01', to: '2026-01-31' },
      },
      ok: false,
    },
    {
      scenario: 'a day that is not one',
      body: { kind: 'videos', format: 'csv', params: { from: '2026-02-30' } },
      ok: false,
    },
    {
      scenario: 'a kind that does not exist',
      body: { kind: 'playlists', format: 'csv' },
      ok: false,
    },
    {
      scenario: 'a format that does not exist',
      body: { kind: 'videos', format: 'xlsx' },
      ok: false,
    },
  ])('checks a create body with $scenario', ({ body, ok }) => {
    expect(createChannelExport.body.safeParse(body).success).toBe(ok);
  });

  it('defaults the range to everything', () => {
    expect(createChannelExport.body.parse({ kind: 'videos', format: 'json' }).params).toEqual({});
  });

  it.each([
    { kind: 'video_analytics', first: ['videoId', 'title', 'series', 'day'] },
    { kind: 'channel_analytics', first: ['day', 'views', 'watchSeconds', 'subscribersGained'] },
    { kind: 'comments', first: ['commentId', 'videoId', 'videoTitle', 'parentId'] },
    { kind: 'videos', first: ['videoId', 'title', 'description', 'tags'] },
    { kind: 'posts', first: ['postId', 'kind', 'status', 'payload'] },
  ] as const)('orders the $kind columns as its row schema does', ({ kind, first }) => {
    expect(exportColumns(kind).slice(0, first.length)).toEqual(first);
  });

  it('names a commenter by public identity only', () => {
    const columns = exportColumns('comments');

    expect(columns).toEqual(expect.arrayContaining(['authorHandle', 'authorDisplayName']));
    expect(columns.filter((column) => /email|authorId|userId/i.test(column))).toEqual([]);
  });
});
