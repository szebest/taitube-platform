const PUSH_TO_TALK_KEY = 'v';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)
  );
}

/** Whether the key event is the held `V`, and not a letter typed into a field or part of a shortcut. */
export function isPushToTalkKey(event: KeyEventLike): boolean {
  const shortcut = event.ctrlKey || event.metaKey || event.altKey;
  return event.key.toLowerCase() === PUSH_TO_TALK_KEY && !shortcut && !isTypingTarget(event.target);
}
