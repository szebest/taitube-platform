import { assertNever } from '@kit/result';
import { NOTIFICATION_EXCERPT_LENGTH, type PostPayload } from '@vp/domain';

/** The start of what a post says: its text, caption or share comment, `null` when it has none. */
export function postExcerpt(payload: PostPayload): string | null {
  switch (payload.kind) {
    case 'text':
      return payload.text.slice(0, NOTIFICATION_EXCERPT_LENGTH);
    case 'images':
      return payload.caption?.slice(0, NOTIFICATION_EXCERPT_LENGTH) ?? null;
    case 'video_share':
    case 'playlist_share':
      return payload.comment?.slice(0, NOTIFICATION_EXCERPT_LENGTH) ?? null;
    default:
      return assertNever(payload, 'PostPayload');
  }
}
