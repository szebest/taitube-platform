import { err, ok } from '@vp/result';
import type { FetchPort, UploaderPort } from '../ports';
import { catalogRoutes } from './fake-api-catalog-routes';
import { channelRoutes } from './fake-api-channel-routes';
import { libraryRoutes } from './fake-api-library-routes';
import { socialRoutes } from './fake-api-social-routes';
import { type FakeOptions, createFakeStore } from './fake-api-store';
import type { FakeVideo } from './fake-api-types';

/** A stateful, in-process stand-in for the public API: just the routes the seed uses, answering like the real ones. */
export function createFakeApi(options: FakeOptions = {}) {
  const store = createFakeStore(options);
  const { id, videos, uploads } = store;
  const calls: string[] = [];

  const routes = [
    ...channelRoutes(store),
    ...catalogRoutes(store),
    ...socialRoutes(store),
    ...libraryRoutes(store),
  ];
  const compiled = routes.map(([method, pattern, handler]) => ({
    method,
    pattern,
    handler,
    regex: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
  }));

  const fetchPort: FetchPort = async (url, init) => {
    const target = new URL(url);
    const method = init?.method ?? 'GET';
    if (target.host === 'storage.test') return new Response(null, { status: 200 });
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const [, role, sub] = /^Bearer token:([^:]+):(.+)$/.exec(headers.authorization ?? '') ?? [];
    const route = compiled.find((r) => r.method === method && r.regex.test(target.pathname));
    calls.push(`${method} ${target.pathname}`);
    if (
      !route ||
      options.disabled?.some((prefix) => `${method} ${target.pathname}`.startsWith(prefix))
    ) {
      return new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 });
    }
    const params = route.regex.exec(target.pathname)?.groups ?? {};
    const body = typeof init?.body === 'string' ? init.body : '';
    const isJson = headers['content-type'] === 'application/json';
    const result = route.handler({
      actor: sub && role ? { id: sub, role } : null,
      params,
      query: target.searchParams,
      json: isJson && body ? JSON.parse(body) : {},
      text: isJson ? '' : body,
    });
    const status = result.status ?? 200;
    return new Response(result.body === undefined ? null : JSON.stringify(result.body), { status });
  };

  const uploader: UploaderPort = {
    async upload({ token, title }) {
      if (uploads.created++ < (options.failUploads ?? 0)) {
        return err({
          kind: 'http',
          method: 'POST',
          path: '/v1/uploads',
          status: 429,
          message: 'slow down',
        });
      }
      const ownerId = token.split(':')[2] ?? '';
      const video: FakeVideo = {
        id: id('video'),
        ownerId,
        title,
        description: '',
        visibility: 'private',
        status: 'UPLOADED',
        categoryId: null,
        tags: [],
        version: 1,
        durationMs: undefined,
      };
      videos.set(video.id, video);
      return ok({ videoId: video.id });
    },
  };

  return {
    fetch: fetchPort,
    uploader,
    calls,
    vtt: store.vtt,
    state: {
      channels: store.channels,
      categories: store.categories,
      videos,
      comments: store.comments,
      reactions: store.reactions,
      subscriptions: store.subscriptions,
      playlists: store.playlists,
      history: store.history,
      searches: store.searches,
      reports: store.reports,
      captions: store.captions,
      featured: store.featured,
      spotlight: store.spotlight,
    },
    count: () => ({
      videos: videos.size,
      comments: store.comments.length,
      reactions: store.reactions.size,
      subscriptions: store.subscriptions.size,
      playlists: store.playlists.length,
      history: store.history.size,
      reports: store.reports.size,
    }),
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
