import { type Result, all, assertNever, isErr, ok } from '@kit/result';
import type { PostView } from '@vp/api-contracts';
import type { ChannelImageRepositoryPort, ChannelRepositoryPort } from '@vp/core/repositories';
import {
  type ChannelCard,
  type ChannelPostEntry,
  type PostImageVariants,
  toChannelCard,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import {
  type PostShareDeps,
  type ShareRef,
  type ShareSource,
  loadShareSource,
  shareCardOf,
  shareRefOf,
} from './post-share-cards';

export interface PostViewDeps extends PostShareDeps {
  channels: Pick<ChannelRepositoryPort, 'findByIds'>;
  images: Pick<ChannelImageRepositoryPort, 'findReadyPostImages'>;
}

type PostBody = PostView['body'];

interface Lookups {
  channels: ReadonlyMap<string, ChannelCard>;
  images: ReadonlyMap<string, PostImageVariants>;
  shares: ReadonlyMap<string, ShareSource | null>;
}

const shareKey = ({ type, id }: ShareRef) => `${type}:${id}`;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

async function loadImages(
  deps: PostViewDeps,
  entries: readonly ChannelPostEntry[]
): Promise<Result<Map<string, PostImageVariants>, DatabaseUnavailable>> {
  const uploadsByChannel = new Map<string, string[]>();
  for (const { post } of entries) {
    if (post.payload.kind !== 'images') continue;
    const uploads = uploadsByChannel.get(post.channelId) ?? [];
    uploads.push(...post.payload.images.map((image) => image.uploadId));
    uploadsByChannel.set(post.channelId, uploads);
  }
  const found = await Promise.all(
    [...uploadsByChannel].map(([channelId, uploads]) =>
      deps.images.findReadyPostImages(channelId, unique(uploads))
    )
  );
  const read = all(found);
  if (isErr(read)) return read;
  return ok(new Map(read.value.flat().map((image) => [image.uploadId, image])));
}

async function loadShares(
  deps: PostViewDeps,
  entries: readonly ChannelPostEntry[]
): Promise<Result<Map<string, ShareSource | null>, DatabaseUnavailable>> {
  const refs = new Map<string, ShareRef>();
  for (const { post } of entries) {
    const ref = shareRefOf(post.payload);
    if (ref) refs.set(shareKey(ref), ref);
  }
  const read = all(
    await Promise.all(
      [...refs].map(async ([key, ref]) => {
        const source = await loadShareSource(deps, ref);
        return isErr(source) ? source : ok([key, source.value] as const);
      })
    )
  );
  return isErr(read) ? read : ok(new Map(read.value));
}

async function loadLookups(
  deps: PostViewDeps,
  entries: readonly ChannelPostEntry[]
): Promise<Result<Lookups, DatabaseUnavailable>> {
  const channels = await deps.channels.findByIds(unique(entries.map(({ post }) => post.channelId)));
  if (isErr(channels)) return channels;
  const images = await loadImages(deps, entries);
  if (isErr(images)) return images;
  const shares = await loadShares(deps, entries);
  if (isErr(shares)) return shares;
  return ok({
    channels: new Map(channels.value.map((channel) => [channel.id, toChannelCard(channel)])),
    images: images.value,
    shares: shares.value,
  });
}

function bodyOf({ post }: ChannelPostEntry, lookups: Lookups, deps: PostShareDeps): PostBody {
  const { payload } = post;
  switch (payload.kind) {
    case 'text':
      return payload;
    case 'images':
      return {
        kind: 'images',
        caption: payload.caption,
        images: payload.images.flatMap(({ uploadId, alt }) => {
          const ready = lookups.images.get(uploadId);
          return ready ? [{ uploadId, alt, urls: { ...ready.urls } }] : [];
        }),
      };
    case 'video_share': {
      const { comment, startMs, videoId } = payload;
      const source = lookups.shares.get(shareKey({ type: 'video', id: videoId })) ?? null;
      return {
        kind: 'video_share',
        comment,
        startMs,
        card: shareCardOf(payload, source, deps.cdn),
      };
    }
    case 'playlist_share': {
      const source =
        lookups.shares.get(shareKey({ type: 'playlist', id: payload.playlistId })) ?? null;
      return {
        kind: 'playlist_share',
        comment: payload.comment,
        card: shareCardOf(payload, source, deps.cdn),
      };
    }
    default:
      return assertNever(payload, 'PostPayload');
  }
}

/**
 * Posts ready to render, with what they need read in one pass each: the channels, the ready images
 * of every channel and one lookup per shared video or playlist. A post of a channel that is gone is left out.
 */
export async function toPostViews(
  deps: PostViewDeps,
  entries: readonly ChannelPostEntry[]
): Promise<Result<PostView[], DatabaseUnavailable>> {
  if (entries.length === 0) return ok([]);
  const lookups = await loadLookups(deps, entries);
  if (isErr(lookups)) return lookups;

  return ok(
    entries.flatMap((entry) => {
      const { post, likedByViewer } = entry;
      const channel = lookups.value.channels.get(post.channelId);
      if (!channel) return [];
      return [
        {
          id: post.id,
          channel,
          kind: post.payload.kind,
          body: bodyOf(entry, lookups.value, deps),
          commentsEnabled: post.commentsEnabled,
          likeCount: post.likeCount,
          commentsCount: post.commentsCount,
          likedByViewer,
          isEdited: post.editedAt !== null,
          publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
          version: post.version,
        },
      ];
    })
  );
}
