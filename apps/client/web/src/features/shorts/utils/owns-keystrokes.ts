/** Whether the target is a field that takes the keys the Shorts feed would otherwise act on. */
export function ownsKeystrokes(target: EventTarget) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
