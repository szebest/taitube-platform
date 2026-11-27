import type { ThreadListView, ThreadView } from '@vp/api-contracts';
import { CHANNEL_ID } from '@vp/web-testing';

export const THREAD_ID = '0190c3a0-5e1d-7000-8000-0000000f1002';
export const OTHER_THREAD_ID = '0190c3a0-5e1d-7000-8000-0000000f1003';

export function thread(overrides: Partial<ThreadView> = {}): ThreadView {
  return {
    id: THREAD_ID,
    videoId: '0190c3a0-5e1d-7000-8000-0000000f1001',
    anchorMs: 65_000,
    title: 'The twist at the tram',
    body: 'Did anyone catch the second sign?',
    isPinned: false,
    replyCount: 2,
    status: 'published',
    author: { channelId: CHANNEL_ID, handle: 'sam', displayName: 'Sam', avatarUrl: null },
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export function threadList(
  items: ThreadView[] = [thread()],
  markers: ThreadListView['markers'] = []
): ThreadListView {
  return { items, markers };
}
