import type { NewChannelAuditEntry, NewVideoThreadInput } from '@vp/domain';
import {
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
} from './fixtures';

export const T = {
  a: '00000000-0000-7000-8000-000000000b01',
  b: '00000000-0000-7000-8000-000000000b02',
  c: '00000000-0000-7000-8000-000000000b03',
  d: '00000000-0000-7000-8000-000000000b04',
  missing: '00000000-0000-7000-8000-000000000bff',
} as const;

export const PUBLISHED = {
  moderationState: 'published',
  moderationDisclosure: null,
  heldReason: null,
  looksLikeQuestion: false,
} as const;

export const threadInput = (
  id: string,
  over: Partial<NewVideoThreadInput> = {}
): NewVideoThreadInput => ({
  id,
  videoId: VIDEO_IDS.a,
  channelId: OWNER_CHANNEL_ID,
  authorId: OTHER_OWNER_ID,
  authorChannelId: OTHER_OWNER_CHANNEL_ID,
  anchorMs: 1_000,
  title: `Thread ${id.slice(-1)}`,
  body: '',
  moderation: PUBLISHED,
  ...over,
});

export const pinAudit = (id: string): NewChannelAuditEntry => ({
  channelId: OWNER_CHANNEL_ID,
  actorUserId: OWNER_ID,
  action: 'comment.pinned',
  targetType: 'comment',
  targetId: id,
  meta: { videoId: VIDEO_IDS.a, pinned: true },
});

export const removeAudit = (id: string): NewChannelAuditEntry => ({
  channelId: OWNER_CHANNEL_ID,
  actorUserId: OWNER_ID,
  action: 'comment.removed',
  targetType: 'comment',
  targetId: id,
  meta: { videoId: VIDEO_IDS.a, disclosure: 'silent' },
});
