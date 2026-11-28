import { type Result, err, ok } from '@kit/result';
import { END_SCREEN_MAX_ITEMS, type EndScreenItem, endScreenStartWindow } from '@vp/domain';
import { type EndScreenInvalid, endScreenInvalid } from './failures';

export interface EndScreenInput {
  readonly items: readonly EndScreenItem[];
  readonly startsAtMs: number;
  readonly durationMs: number;
}

/** Up to four items, each kind at most once except content, starting 5 to 20 seconds before the end. */
export function decideEndScreen(input: EndScreenInput): Result<void, EndScreenInvalid> {
  const { items, startsAtMs, durationMs } = input;
  if (items.length > END_SCREEN_MAX_ITEMS) return err(endScreenInvalid('items'));

  const singles = items.filter((item) => item.type === 'next_episode' || item.type === 'subscribe');
  if (new Set(singles.map((item) => item.type)).size !== singles.length) {
    return err(endScreenInvalid('item_type'));
  }

  const { earliest, latest } = endScreenStartWindow(durationMs);
  if (startsAtMs < earliest || startsAtMs > latest) return err(endScreenInvalid('start'));
  return ok(undefined);
}
