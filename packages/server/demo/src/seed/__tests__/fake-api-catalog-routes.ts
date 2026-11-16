import type { FakeStore } from './fake-api-store';
import { type Route, problem } from './fake-api-types';

export function catalogRoutes(store: FakeStore): Route[] {
  const { options, categories, videos, captions, vtt, id, summary, screening } = store;
  return [
    ['GET', '/v1/categories', () => ({ body: categories })],
    [
      'POST',
      '/v1/admin/categories',
      ({ actor, json }) => {
        if (actor?.role !== 'admin') return problem(403, 'FORBIDDEN');
        const category = { id: id('category'), slug: json.slug ?? '' };
        categories.push(category);
        return { status: 201, body: category };
      },
    ],
    [
      'GET',
      '/v1/creator/videos',
      ({ actor }) => {
        const items = [...videos.values()].filter((video) => video.ownerId === actor?.id);
        for (const video of items) {
          if (video.status === 'UPLOADED') video.status = 'PROCESSING';
          else if (video.status === 'PROCESSING' && !options.stuck) {
            if (screening.held < (options.hold ?? 0) && !screening.released.has(video.id)) {
              screening.held += 1;
              video.status = 'HELD';
              continue;
            }
            video.status = 'READY';
            video.durationMs = 10_000;
            video.version += 1;
          }
        }
        return { body: { items: items.map(summary), nextCursor: null } };
      },
    ],
    [
      'POST',
      '/v1/admin/videos/:id/screening/approve',
      ({ actor, params }) => {
        const video = videos.get(params.id ?? '');
        if (!video || actor?.role !== 'admin') return problem(404, 'VIDEO_NOT_FOUND');
        screening.released.add(video.id);
        video.status = 'PROCESSING';
        return { body: {} };
      },
    ],
    [
      'DELETE',
      '/v1/creator/videos/:id',
      ({ params }) => {
        videos.delete(params.id ?? '');
        return { status: 202, body: { status: 'DELETED' } };
      },
    ],
    [
      'GET',
      '/v1/videos/:id',
      ({ params }) => {
        const video = videos.get(params.id ?? '');
        return video ? { body: summary(video) } : problem(404, 'VIDEO_NOT_FOUND');
      },
    ],
    [
      'PATCH',
      '/v1/creator/videos/:id',
      ({ params, json }) => {
        const video = videos.get(params.id ?? '');
        if (!video) return problem(404, 'VIDEO_NOT_FOUND');
        if (json.version !== video.version) return problem(409, 'VERSION_CONFLICT');
        const { version: _version, ...changes } = json;
        Object.assign(video, changes);
        video.version += 1;
        return { body: summary(video) };
      },
    ],
    [
      'PUT',
      '/v1/videos/:id/captions/:lang',
      ({ params, text }) => {
        vtt.push(text);
        const set = captions.get(params.id ?? '') ?? new Set<string>();
        set.add(params.lang ?? '');
        captions.set(params.id ?? '', set);
        return { status: 202, body: {} };
      },
    ],
    [
      'GET',
      '/v1/videos/:id/captions',
      ({ params }) => ({
        body: {
          tracks: [...(captions.get(params.id ?? '') ?? [])].map((language) => ({ language })),
        },
      }),
    ],
  ];
}
