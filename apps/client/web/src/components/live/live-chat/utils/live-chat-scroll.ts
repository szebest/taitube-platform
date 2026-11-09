export function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function scrollToEnd(list: HTMLElement, behavior: ScrollBehavior) {
  if (typeof list.scrollTo === 'function') {
    list.scrollTo({ top: list.scrollHeight, behavior });
    return;
  }
  list.scrollTop = list.scrollHeight;
}
