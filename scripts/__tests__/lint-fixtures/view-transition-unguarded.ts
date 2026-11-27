export function swap(update: () => void): void {
  document.startViewTransition(update);
}
