import type { FakeChannel, FakeComment, FakeVideo } from './fake-api-types';

export interface FakeOptions {
  disabled?: readonly string[];
  failUploads?: number;
  stuck?: boolean;
  hold?: number;
}

export function createFakeStore(options: FakeOptions) {
  let counter = 0;
  const id = (prefix: string) => `${prefix}-${String(++counter).padStart(6, '0')}`;
  const channels = new Map<string, FakeChannel>();
  const comments: FakeComment[] = [];

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

  return {
    options,
    id,
    channels,
    channelOf,
    categories: [] as { id: string; slug: string }[],
    videos: new Map<string, FakeVideo>(),
    comments,
    reactions: new Map<string, string>(),
    subscriptions: new Set<string>(),
    playlists: [] as {
      id: string;
      ownerId: string;
      title: string;
      isSystem: boolean;
      items: string[];
    }[],
    history: new Set<string>(),
    searches: new Map<string, string[]>(),
    reports: new Set<string>(),
    captions: new Map<string, Set<string>>(),
    featured: new Map<string, string[]>(),
    spotlight: new Map<string, string>(),
    vtt: [] as string[],
    screening: { held: 0, released: new Set<string>() },
    uploads: { created: 0 },
    summary: (video: FakeVideo) => ({ ...video, format: 'standard' }),
    roots: (videoId: string) =>
      comments.filter((c) => c.videoId === videoId && c.parentId === null),
    commentPage: (items: FakeComment[]) => ({ items, nextCursor: null }),
  };
}

export type FakeStore = ReturnType<typeof createFakeStore>;
