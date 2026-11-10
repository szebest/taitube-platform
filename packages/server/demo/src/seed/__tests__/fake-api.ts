import { err, ok } from '@vp/result';
import type { FetchPort, UploaderPort } from '../ports';

interface Call {
  actor: { id: string; role: string } | null;
  params: Record<string, string>;
  query: URLSearchParams;
  json: RequestBody;
  text: string;
}

type Handler = (call: Call) => { status?: number; body?: unknown };

interface RequestBody {
  handle?: string;
  slug?: string;
  version?: number;
  content?: string;
  parentId?: string;
  type?: string;
  title?: string;
  videoId?: string;
  videoIds?: string[];
  trailerVideoId?: string;
}

export interface FakeChannel {
  id: string;
  ownerId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  brandColor: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  handleChangeAvailableAt: string | null;
}

export interface FakeVideo {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: string;
  status: string;
  categoryId: string | null;
  tags: string[];
  version: number;
  durationMs: number | undefined;
}

export interface FakeComment {
  id: string;
  videoId: string;
  parentId: string | null;
  content: string;
  isPinned: boolean;
  heartedByCreator: boolean;
  replyCount: number;
  author: { userId: string };
}

const problem = (status: number, code: string) => ({ status, body: { code } });

/** A stateful, in-process stand-in for the public API: just the routes the seed uses, answering like the real ones. */
export function createFakeApi(
  options: {
    disabled?: readonly string[];
    failUploads?: number;
    stuck?: boolean;
    hold?: number;
  } = {}
) {
  let counter = 0;
  const id = (prefix: string) => `${prefix}-${String(++counter).padStart(6, '0')}`;
  const channels = new Map<string, FakeChannel>();
  const categories: { id: string; slug: string }[] = [];
  const videos = new Map<string, FakeVideo>();
  const comments: FakeComment[] = [];
  const reactions = new Map<string, string>();
  const subscriptions = new Set<string>();
  const playlists: {
    id: string;
    ownerId: string;
    title: string;
    isSystem: boolean;
    items: string[];
  }[] = [];
  const history = new Set<string>();
  const searches = new Map<string, string[]>();
  const reports = new Set<string>();
  const captions = new Map<string, Set<string>>();
  const featured = new Map<string, string[]>();
  const spotlight = new Map<string, string>();
  const calls: string[] = [];
  const vtt: string[] = [];
  const created = { uploads: 0 };
  let held = 0;
  const released = new Set<string>();

  const channelOf = (userId: string) => {
    let channel = channels.get(userId);
    if (!channel) {
      channel = {
        id: id('channel'),
        handle: `u-${userId.slice(-4)}`,
        displayName: userId,
        bio: null,
        brandColor: null,
        avatarUrl: null,
        bannerUrl: null,
        handleChangeAvailableAt: null,
        ownerId: userId,
      };
      channels.set(userId, channel);
    }
    return channel;
  };

  const summary = (video: FakeVideo) => ({ ...video, format: 'standard' });
  const roots = (videoId: string) =>
    comments.filter((c) => c.videoId === videoId && c.parentId === null);
  const commentPage = (items: FakeComment[]) => ({ items, nextCursor: null });

  const routes: [string, string, Handler][] = [
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
            if (held < (options.hold ?? 0) && !released.has(video.id)) {
              held += 1;
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
        released.add(video.id);
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
    [
      'GET',
      '/v1/videos/:id/comments',
      ({ params }) => ({ body: commentPage(roots(params.id ?? '')) }),
    ],
    [
      'POST',
      '/v1/videos/:id/comments',
      ({ actor, params, json }) => {
        const parent = comments.find((c) => c.id === json.parentId);
        const comment: FakeComment = {
          id: id('comment'),
          videoId: params.id ?? '',
          parentId: parent?.id ?? null,
          content: json.content ?? '',
          isPinned: false,
          heartedByCreator: false,
          replyCount: 0,
          author: { userId: actor?.id ?? '' },
        };
        comments.push(comment);
        if (parent) parent.replyCount += 1;
        return { status: 201, body: comment };
      },
    ],
    [
      'GET',
      '/v1/comments/:id/replies',
      ({ params }) => ({ body: commentPage(comments.filter((c) => c.parentId === params.id)) }),
    ],
    [
      'POST',
      '/v1/comments/:id/pin',
      ({ params }) => {
        const comment = comments.find((c) => c.id === params.id);
        if (comment) comment.isPinned = true;
        return { body: comment };
      },
    ],
    [
      'POST',
      '/v1/comments/:id/heart',
      ({ params }) => {
        const comment = comments.find((c) => c.id === params.id);
        if (comment) comment.heartedByCreator = true;
        return { body: comment };
      },
    ],
    [
      'POST',
      '/v1/comments/:id/reports',
      ({ actor, params }) => {
        const key = `${actor?.id}:${params.id}`;
        if (reports.has(key)) return problem(409, 'COMMENT_ALREADY_REPORTED');
        reports.add(key);
        return { status: 201, body: {} };
      },
    ],
    [
      'GET',
      '/v1/videos/:id/reactions/me',
      ({ actor, params }) => ({
        body: { reaction: reactions.get(`${actor?.id}:${params.id}`) ?? null },
      }),
    ],
    [
      'PUT',
      '/v1/videos/:id/reactions',
      ({ actor, params, json }) => {
        reactions.set(`${actor?.id}:${params.id}`, json.type ?? '');
        return { body: {} };
      },
    ],
    [
      'GET',
      '/v1/channels/:id/subscribers/me',
      ({ actor, params }) => ({
        body: { subscribed: subscriptions.has(`${actor?.id}:${params.id}`) },
      }),
    ],
    [
      'POST',
      '/v1/channels/:id/subscribers',
      ({ actor, params }) => {
        subscriptions.add(`${actor?.id}:${params.id}`);
        return { status: 201, body: {} };
      },
    ],
    [
      'GET',
      '/v1/me/playlists',
      ({ actor }) => ({
        body: {
          items: [
            { id: `later-${actor?.id}`, title: 'Watch Later', isSystem: true },
            ...playlists.filter((p) => p.ownerId === actor?.id),
          ],
        },
      }),
    ],
    [
      'POST',
      '/v1/playlists',
      ({ actor, json }) => {
        const playlist = {
          id: id('playlist'),
          ownerId: actor?.id ?? '',
          title: json.title ?? '',
          isSystem: false,
          items: [],
        };
        playlists.push(playlist);
        return { status: 201, body: playlist };
      },
    ],
    [
      'GET',
      '/v1/playlists/:id',
      ({ params }) => {
        const playlist = playlists.find((p) => p.id === params.id);
        return playlist
          ? { body: { id: playlist.id, items: playlist.items.map((videoId) => ({ videoId })) } }
          : problem(404, 'PLAYLIST_NOT_FOUND');
      },
    ],
    [
      'POST',
      '/v1/playlists/:id/items',
      ({ params, json }) => {
        playlists.find((p) => p.id === params.id)?.items.push(json.videoId ?? '');
        return { status: 201, body: {} };
      },
    ],
    [
      'GET',
      '/v1/me/history/:videoId',
      ({ actor, params }) => ({
        body: {
          playhead: history.has(`${actor?.id}:${params.videoId}`) ? { progressSeconds: 1 } : null,
        },
      }),
    ],
    [
      'POST',
      '/v1/me/history',
      ({ actor, json }) => {
        history.add(`${actor?.id}:${json.videoId}`);
        return { body: {} };
      },
    ],
    [
      'GET',
      '/v1/search',
      ({ actor, query }) => {
        searches.set(actor?.id ?? '', [
          ...(searches.get(actor?.id ?? '') ?? []),
          query.get('q') ?? '',
        ]);
        return { body: { items: [] } };
      },
    ],
    [
      'GET',
      '/v1/me/searches',
      ({ actor }) => ({
        body: {
          items: (searches.get(actor?.id ?? '') ?? []).map((query) => ({ id: query, query })),
          nextCursor: null,
        },
      }),
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
      if (created.uploads++ < (options.failUploads ?? 0)) {
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
    vtt,
    state: {
      channels,
      categories,
      videos,
      comments,
      reactions,
      subscriptions,
      playlists,
      history,
      searches,
      reports,
      captions,
      featured,
      spotlight,
    },
    count: () => ({
      videos: videos.size,
      comments: comments.length,
      reactions: reactions.size,
      subscriptions: subscriptions.size,
      playlists: playlists.length,
      history: history.size,
      reports: reports.size,
    }),
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
