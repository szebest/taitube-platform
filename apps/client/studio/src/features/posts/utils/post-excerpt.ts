import type { ManagedPostView } from '@vp/api-contracts';
import type { PostPayload } from '@vp/domain';

type Body = ManagedPostView['body'];

const cardTitleOf = (card: Extract<Body, { kind: 'video_share' | 'playlist_share' }>['card']) =>
  card.type === 'unavailable' ? '' : card.title;

/** The words a creator knows a post by in a list: what it says, else what it shares or shows. */
export function postExcerpt(body: Body): string {
  switch (body.kind) {
    case 'text':
      return body.text;
    case 'images':
      return body.caption ?? body.images[0]?.alt ?? '';
    case 'poll':
    case 'quiz':
      return body.question;
    case 'video_share':
    case 'playlist_share':
      return body.comment ?? cardTitleOf(body.card);
  }
}

/** The same, for a saved state of a post, which holds the payload a creator wrote rather than a view of it. */
export function payloadExcerpt(payload: PostPayload): string {
  switch (payload.kind) {
    case 'text':
      return payload.text;
    case 'images':
      return payload.caption ?? payload.images[0]?.alt ?? '';
    case 'poll':
    case 'quiz':
      return payload.question;
    case 'video_share':
    case 'playlist_share':
      return payload.comment ?? '';
  }
}
