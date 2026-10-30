import type { Account, CommentView } from '@vp/api-contracts';
import { account, OWNER_ID, VIDEO_ID } from '@vp/web-testing';

export const COMMENT_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
export const REPLY_ID = '0190c3a0-5e1d-7000-8000-00000000d002';
export const AUTHOR_ID = '0190c3a0-5e1d-7000-8000-00000000b002';
export const OTHER_ID = '0190c3a0-5e1d-7000-8000-00000000b003';

const POSTED_AT = '2026-10-14T09:12:00.000Z';

export function comment(overrides: Partial<CommentView> = {}): CommentView {
  return {
    id: COMMENT_ID,
    videoId: VIDEO_ID,
    parentId: null,
    content: 'The tram at 02:15 is the best sound design this year.',
    isPinned: false,
    isEdited: false,
    likeCount: 0,
    heartedByCreator: false,
    replyCount: 0,
    author: {
      userId: AUTHOR_ID,
      channelId: null,
      handle: 'ines',
      displayName: 'Ines Carvalho',
      avatarUrl: null,
      isCreator: false,
    },
    createdAt: POSTED_AT,
    updatedAt: POSTED_AT,
    ...overrides,
  };
}

/** A signed-in account with `id` and `role`; the default one is the video's owner. */
export function viewerAccount(id: string = OWNER_ID, role: Account['role'] = 'USER'): Account {
  const { user } = account();
  return account({ role, user: { ...user, id } });
}
