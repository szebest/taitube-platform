import type { FakeStore } from './fake-api-store';
import type { Route } from './fake-api-types';

export function channelRoutes(store: FakeStore): Route[] {
  const { channelOf, featured, spotlight } = store;
  return [
    [
      'GET',
      '/v1/me/account',
      ({ actor }) => ({
        body: { id: actor?.id, role: actor?.role, channel: channelOf(actor?.id ?? '') },
      }),
    ],
    [
      'PATCH',
      '/v1/me/channel',
      ({ actor, json }) => {
        const channel = channelOf(actor?.id ?? '');
        if (json.handle && json.handle !== channel.handle)
          channel.handleChangeAvailableAt = '2999-01-01T00:00:00.000Z';
        Object.assign(channel, json);
        return { body: channel };
      },
    ],
    [
      'GET',
      '/v1/channels/:id/featured',
      ({ params }) => ({
        body: { items: (featured.get(params.id ?? '') ?? []).map((videoId) => ({ id: videoId })) },
      }),
    ],
    [
      'PUT',
      '/v1/me/channel/featured',
      ({ actor, json }) => {
        featured.set(channelOf(actor?.id ?? '').id, json.videoIds ?? []);
        return { body: {} };
      },
    ],
    [
      'GET',
      '/v1/me/channel/spotlight',
      ({ actor }) => {
        const trailer = spotlight.get(actor?.id ?? '');
        return {
          body: { trailerVideoId: trailer ?? null, returningVideoId: null, localizations: [] },
        };
      },
    ],
    [
      'PUT',
      '/v1/me/channel/spotlight',
      ({ actor, json }) => {
        spotlight.set(actor?.id ?? '', json.trailerVideoId ?? '');
        return { body: {} };
      },
    ],
    [
      'POST',
      '/v1/me/channel/images/:kind/upload',
      ({ params }) => ({
        status: 201,
        body: {
          uploadId: `${params.kind}-upload`,
          uploadUrl: 'http://storage.test/put',
          headers: { 'content-type': 'image/png' },
        },
      }),
    ],
    [
      'POST',
      '/v1/me/channel/images/:kind/complete',
      ({ actor, params }) => {
        channelOf(actor?.id ?? '')[params.kind === 'avatar' ? 'avatarUrl' : 'bannerUrl'] =
          'http://cdn.test/image.png';
        return { status: 202, body: {} };
      },
    ],
  ];
}
