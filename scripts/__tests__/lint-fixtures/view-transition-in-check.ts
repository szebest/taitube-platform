export function swap(update: () => void): void {
  if ('startViewTransition' in document) document.startViewTransition(update);
}
