export const ITEM_SELECTOR = '[data-slot="chip-bar-item"]';

const CHEVRON_SCROLL_SHARE = 0.6;

export type Overflow = { start: boolean; end: boolean };

export const isRtl = (element: HTMLElement) =>
  element.closest('[dir]')?.getAttribute('dir') === 'rtl';

export function readOverflow(track: HTMLElement): Overflow {
  const travelled = Math.abs(track.scrollLeft);
  const room = track.scrollWidth - track.clientWidth;
  return { start: travelled > 1, end: room - travelled > 1 };
}

export function revealInTrack(track: HTMLElement, item: Element) {
  const bounds = track.getBoundingClientRect();
  const box = item.getBoundingClientRect();
  const before = box.left - bounds.left;
  const after = box.right - bounds.right;
  const delta = before < 0 ? before : Math.max(after, 0);
  if (delta !== 0) {
    track.scrollBy({ left: delta });
  }
}

export function scrollByChevron(track: HTMLElement | null, direction: 1 | -1) {
  if (track === null) {
    return;
  }
  const physical = isRtl(track) ? -direction : direction;
  track.scrollBy({ left: physical * track.clientWidth * CHEVRON_SCROLL_SHARE });
}
