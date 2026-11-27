import { useEffect, useEffectEvent } from 'react';

export const QUEUE_KEYS = ['j', 'k', 'a', 'r', 'h', 'b', 'v', 'x', '?'] as const;

export type QueueKey = (typeof QUEUE_KEYS)[number];

export type QueueShortcuts = Record<QueueKey, () => void>;

const FIELDS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const isField = (target: EventTarget | null) => target instanceof Element && target.matches(FIELDS);

const isQueueKey = (key: string): key is QueueKey => QUEUE_KEYS.some((known) => known === key);

/**
 * One key runs one action anywhere on the page, except while a field has focus or a modifier is held,
 * and while `enabled` is off, which a dialog that takes the keys itself uses.
 */
export function useQueueShortcuts(shortcuts: QueueShortcuts, enabled: boolean) {
  const run = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (isField(event.target) || !isQueueKey(event.key)) {
      return;
    }
    event.preventDefault();
    shortcuts[event.key]();
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    document.addEventListener('keydown', run);
    return () => document.removeEventListener('keydown', run);
  }, [enabled]);
}
