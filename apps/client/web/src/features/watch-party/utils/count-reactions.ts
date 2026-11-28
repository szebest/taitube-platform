import type { PartyReaction } from '@vp/queries';

/** The reactions folded by emoji, in the order each emoji first appeared. */
export function countReactions(
  reactions: readonly Pick<PartyReaction, 'emoji' | 'count'>[]
): { emoji: PartyReaction['emoji']; count: number }[] {
  const totals = new Map<PartyReaction['emoji'], number>();
  for (const { emoji, count } of reactions) {
    totals.set(emoji, (totals.get(emoji) ?? 0) + count);
  }

  return [...totals].map(([emoji, count]) => ({ emoji, count }));
}
