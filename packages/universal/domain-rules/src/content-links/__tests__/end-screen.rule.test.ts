import { isErr, isOk } from '@kit/result';
import type { EndScreenItem } from '@vp/domain';
import { decideEndScreen } from '../end-screen.rule';

const content: EndScreenItem = { type: 'content', ref: { type: 'video', id: 'v2' } };
const four: EndScreenItem[] = [
  content,
  { type: 'channel_tab', channelId: 'c1', tabId: 'shorts' },
  { type: 'next_episode' },
  { type: 'subscribe' },
];

describe('@vp/domain-rules: decideEndScreen', () => {
  it('accepts four items 10 seconds before the end', () => {
    expect(isOk(decideEndScreen({ items: four, startsAtMs: 590_000, durationMs: 600_000 }))).toBe(
      true
    );
  });

  it.each([
    { scenario: 'five items', items: [...four, content], startsAtMs: 590_000, reason: 'items' },
    {
      scenario: 'two subscribe items',
      items: [{ type: 'subscribe' }, { type: 'subscribe' }] as EndScreenItem[],
      startsAtMs: 590_000,
      reason: 'item_type',
    },
    {
      scenario: 'a start 30 seconds before the end',
      items: four,
      startsAtMs: 570_000,
      reason: 'start',
    },
    {
      scenario: 'a start 2 seconds before the end',
      items: four,
      startsAtMs: 598_000,
      reason: 'start',
    },
  ])('refuses $scenario', ({ items, startsAtMs, reason }) => {
    const result = decideEndScreen({ items, startsAtMs, durationMs: 600_000 });
    expect(isErr(result) && result.error.reason).toBe(reason);
  });
});
