import type { ChannelPost, ChannelPostCursor } from '@vp/domain';

function comparePinnedDesc(a: Date | null, b: Date | null): number {
  if (a && b) return b.getTime() - a.getTime();
  if (a) return -1;
  return b ? 1 : 0;
}

export function compareIdDesc(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/** Pinned first by pin time, then newest, the id breaking ties; every part descends. */
export function compareDesc(a: ChannelPostCursor, b: ChannelPostCursor): number {
  return (
    comparePinnedDesc(a.pinnedAt, b.pinnedAt) ||
    b.publishedAt.getTime() - a.publishedAt.getTime() ||
    compareIdDesc(a.id, b.id)
  );
}

export function cursorOf(post: ChannelPost): ChannelPostCursor | null {
  return (
    post.publishedAt && { pinnedAt: post.pinnedAt, publishedAt: post.publishedAt, id: post.id }
  );
}
