import { type Result, assertNever, err, ok } from '@kit/result';
import { type PostPayload, VIDEO_LIFECYCLE_EDGES } from '@vp/domain';
import { type PostShareNotPublic, postShareNotPublic } from './failures';

const WATCHABLE_STATUS = VIDEO_LIFECYCLE_EDGES.package.to;

export type SharedTarget =
  | {
      readonly type: 'video';
      readonly id: string;
      readonly visibility: string;
      readonly status: string;
    }
  | { readonly type: 'playlist'; readonly id: string; readonly visibility: string };

export interface PostShareInput {
  readonly payload: PostPayload;
  readonly shared: SharedTarget | null;
}

/** A missing target is refused like a private one, so a post cannot probe which ids exist. */
export function decidePostShare(input: PostShareInput): Result<void, PostShareNotPublic> {
  const { payload, shared } = input;
  switch (payload.kind) {
    case 'text':
    case 'images':
    case 'poll':
    case 'quiz':
      return ok(undefined);
    case 'video_share':
      return shared?.type === 'video' &&
        shared.id === payload.videoId &&
        shared.visibility === 'public' &&
        shared.status === WATCHABLE_STATUS
        ? ok(undefined)
        : err(postShareNotPublic('video', payload.videoId));
    case 'playlist_share':
      return shared?.type === 'playlist' &&
        shared.id === payload.playlistId &&
        shared.visibility === 'public'
        ? ok(undefined)
        : err(postShareNotPublic('playlist', payload.playlistId));
    default:
      return assertNever(payload, 'PostPayload');
  }
}
