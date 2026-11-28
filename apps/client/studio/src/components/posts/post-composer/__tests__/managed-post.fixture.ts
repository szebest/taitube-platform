import type { ManagedPostView } from '@vp/api-contracts';
import { CHANNEL_ID } from '@vp/web-testing';

export const POST_ID = '0190c3a0-5e1d-7000-8000-0000000fa001';
export const VIDEO_ID = '0190c3a0-5e1d-7000-8000-0000000fa002';
export const PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-0000000fa003';

const TEXT_BODY = { kind: 'text', text: 'Hello from the studio' } as const;

/** A post of the acting channel holding `body`, published an hour into 2026 unless a patch says otherwise. */
export function managedPost(
  body: ManagedPostView['body'] = TEXT_BODY,
  patch: Partial<ManagedPostView> = {}
): ManagedPostView {
  return {
    id: POST_ID,
    channel: { id: CHANNEL_ID, handle: 'creator', displayName: 'The Creator', avatarUrl: null },
    kind: body.kind,
    body,
    commentsEnabled: true,
    likeCount: 0,
    commentsCount: 0,
    likedByViewer: false,
    pinned: false,
    isEdited: false,
    version: 1,
    status: 'published',
    publishAt: null,
    publishedAt: '2026-01-01T01:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}
